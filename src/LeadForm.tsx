import { useEffect, useRef, useState } from 'react'
import {
  implementationFirstYearLabel,
  launchOfferDetail,
  regularSelfServicePriceLabel,
  selfServicePriceLabel,
} from './publisherPricing'
import { useTurnstileSiteKey } from './turnstileConfig'

export type LeadIntent = 'implementation' | 'consultation' | 'plugin'
export type LeadContext = {
  website?: string
  checkerStatus?: string
  discoveredUrls?: string[]
  sourceFilename?: string
  itemCount?: number
  blockerCount?: number
  manualReviewCount?: number
  sourceFile?: File | null
}

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string
  remove: (widgetId: string) => void
  reset: (widgetId?: string) => void
}

declare global {
  interface Window { turnstile?: TurnstileApi }
}

let turnstileScriptPromise: Promise<void> | null = null

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve()
  if (turnstileScriptPromise) return turnstileScriptPromise
  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-nepar-turnstile]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('turnstile_load_failed')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.dataset.neparTurnstile = 'true'
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener('error', () => reject(new Error('turnstile_load_failed')), { once: true })
    document.head.appendChild(script)
  })
  return turnstileScriptPromise
}

export function TurnstileField({ onToken }: { onToken: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<string | null>(null)
  const { siteKey, loading } = useTurnstileSiteKey()

  useEffect(() => {
    if (!siteKey || !containerRef.current) return
    let cancelled = false
    void loadTurnstile().then(() => {
      if (cancelled || !window.turnstile || !containerRef.current || widgetRef.current) return
      widgetRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action: 'turnstile-spin-v2',
        language: 'hr',
        theme: 'light',
        callback: (token: string) => onToken(token),
        'expired-callback': () => onToken(''),
        'error-callback': () => onToken(''),
      })
    }).catch(() => onToken(''))
    return () => {
      cancelled = true
      if (widgetRef.current && window.turnstile) window.turnstile.remove(widgetRef.current)
      widgetRef.current = null
    }
  }, [onToken, siteKey])

  if (loading) return <p className="turnstile-unconfigured" aria-live="polite">Učitavamo sigurnosnu provjeru…</p>
  if (!siteKey) return <p className="turnstile-unconfigured">Zaštitu obrasca treba povezati prije produkcijskog slanja.</p>
  return <div className="turnstile-field" ref={containerRef} aria-label="Sigurnosna provjera" />
}

export function LeadForm({ intent, context, onIntentChange }: { intent: LeadIntent; context: LeadContext; onIntentChange: (intent: LeadIntent) => void }) {
  const [turnstileToken, setTurnstileToken] = useState('')
  const [attachCurrent, setAttachCurrent] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  const { siteKey, loading: turnstileLoading } = useTurnstileSiteKey()

  useEffect(() => { setAttachCurrent(false) }, [context.sourceFile])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!turnstileToken) {
      setError('Dovršite sigurnosnu provjeru prije slanja.')
      return
    }
    const form = new FormData(event.currentTarget)
    form.set('intent', intent)
    form.set('cf-turnstile-response', turnstileToken)
    form.set('context', JSON.stringify({
      website: context.website,
      checkerStatus: context.checkerStatus,
      discoveredUrls: context.discoveredUrls?.slice(0, 2),
      sourceFilename: context.sourceFilename,
      itemCount: context.itemCount,
      blockerCount: context.blockerCount,
      manualReviewCount: context.manualReviewCount,
    }))
    const selectedAttachment = attachCurrent ? context.sourceFile : attachment
    if (selectedAttachment) form.set('attachment', selectedAttachment, selectedAttachment.name)
    else form.delete('attachment')
    setStatus('sending')
    try {
      const response = await fetch('/api/leads/digitalni-cjenik', { method: 'POST', body: form })
      const payload = await response.json() as { ok: boolean; code?: string }
      if (!response.ok || !payload.ok) throw new Error(payload.code || 'send_failed')
      setStatus('sent')
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : 'send_failed'
      setError(code === 'rate_limited' ? 'Poslano je previše pokušaja. Pokušajte ponovno za sat vremena.' : code === 'file_rejected' ? 'Privitak nije prihvaćen. Provjerite format i veličinu datoteke.' : code === 'turnstile_failed' ? 'Sigurnosna provjera nije uspjela. Osvježite provjeru i pokušajte ponovno.' : 'Upit trenutačno nije moguće poslati. Pokušajte ponovno ili se javite na nepar@nepar.hr.')
      setStatus('idle')
      if (window.turnstile) window.turnstile.reset()
      setTurnstileToken('')
    }
  }

  const consultationCopy = context.checkerStatus === 'green'
    ? 'Pronađeni CSV/XML URL šaljemo u kontekst upita. Pregledat ćemo arhivu, naziv datoteke, sadržaj i strojnu vidljivost — dostupnost datoteke sama po sebi nije potvrda usklađenosti.'
    : 'Možete poslati datoteku, adresu weba ili samo opisati gdje danas držite cijene. Odgovorit ćemo konkretno, bez obveze.'
  const consultationTitle = context.checkerStatus === 'green'
    ? 'Pošaljite pronađeni URL na konzultaciju'
    : 'Pošaljite što imate. Mi ćemo predložiti najkraći put.'

  if (status === 'sent') return <section id="posaljite-cjenik" className="lead-section lead-success" tabIndex={-1}><span className="lead-success-mark" aria-hidden="true">✓</span><div><h2>Upit je poslan.</h2><p>Javit ćemo vam se na unesenu e-mail adresu nakon pregleda materijala.</p></div></section>

  return <section id="posaljite-cjenik" className="lead-section" aria-labelledby="lead-title" tabIndex={-1}>
    <div className="lead-copy"><h2 id="lead-title">{intent === 'plugin' ? 'Zatražite Publisher self-service' : intent === 'implementation' ? 'Zatražite Publisher + postavljanje' : consultationTitle}</h2><p>{intent === 'plugin' ? `${launchOfferDetail()} Sami ugradite link na web. Pošaljite platformu i što imate (Excel/CSV).` : intent === 'implementation' ? `Publisher + postavljanje na vaš web — ${implementationFirstYearLabel()} prva godina, zatim ${regularSelfServicePriceLabel()}. Pošaljite što imate.` : consultationCopy}</p><div className="lead-price"><strong>{intent === 'plugin' ? `Publisher ${selfServicePriceLabel()}` : intent === 'implementation' ? `${implementationFirstYearLabel()} prva godina` : 'Konzultacija'}</strong><span>{intent === 'plugin' ? 'Isti URL ostaje nakon aktivacije. Bez besplatnog trajnog hostinga bez pretplate.' : intent === 'implementation' ? 'Uključuje Publisher i ugradnju; nakon prve godine redovna self-service cijena.' : context.checkerStatus === 'green' ? 'Tehnički pregled pronađenog URL-a: arhiva, naziv, sadržaj, dohvat.' : 'Pregled vašeg slučaja i preporuka sljedećeg koraka.'}</span></div></div>
    <form className="lead-form" onSubmit={submit} encType="multipart/form-data">
      <fieldset className="intent-switch"><legend>Što vam treba?</legend><label><input type="radio" name="intent-choice" checked={intent === 'plugin'} onChange={() => onIntentChange('plugin')} /><span>Self-service · {selfServicePriceLabel()}</span></label><label><input type="radio" name="intent-choice" checked={intent === 'implementation'} onChange={() => onIntentChange('implementation')} /><span>S postavljanjem · {implementationFirstYearLabel()}</span></label><label><input type="radio" name="intent-choice" checked={intent === 'consultation'} onChange={() => onIntentChange('consultation')} /><span>Konzultacija</span></label></fieldset>
      <div className="lead-fields">
        <label>Ime ili naziv tvrtke<input name="name" required maxLength={120} autoComplete="name" /></label>
        <label>E-mail<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
        <label>Telefon <small>opcionalno</small><input name="phone" type="tel" maxLength={40} autoComplete="tel" /></label>
        <label>Web stranica <small>opcionalno</small><input name="website" type="url" maxLength={500} defaultValue={context.website ?? ''} placeholder="https://" autoComplete="url" /></label>
        <label>Platforma<select name="platform" defaultValue="mikro-eracun"><option value="mikro-eracun">MIKROeRAČUN (+ vlastiti web)</option><option value="wordpress">WordPress</option><option value="wix">Wix</option><option value="google-sites">Google Sites</option><option value="webflow">Webflow</option><option value="custom">Custom</option><option value="ne-znam">Ne znam</option></select></label>
        <label>Što trenutno imate?<select name="materials" defaultValue={context.sourceFilename ? 'datoteka' : context.website ? 'web' : 'nista'}><option value="csv">CSV</option><option value="xml">XML</option><option value="excel">Excel</option><option value="web">Samo web stranicu</option><option value="datoteka">Učitanu datoteku</option><option value="nista">Ništa pripremljeno</option></select></label>
      </div>
      <label className="lead-message">Poruka<textarea name="message" rows={5} maxLength={3000} placeholder="Ukratko opišite što želite riješiti." /></label>
      {context.sourceFile && <label className="attachment-choice"><input type="checkbox" checked={attachCurrent} onChange={(event) => setAttachCurrent(event.target.checked)} /><span>Priloži već učitanu datoteku <strong>{context.sourceFile.name}</strong></span></label>}
      {!attachCurrent && <label className="attachment-upload"><span>Privitak <small>opcionalno · jedna datoteka do 4 MB</small></span><input name="attachment-picker" type="file" accept=".csv,.xml,.xls,.xlsx,.pdf,.jpg,.jpeg,.png,.webp" onChange={(event) => setAttachment(event.target.files?.[0] ?? null)} /></label>}
      {(context.checkerStatus || context.sourceFilename) && <div className="lead-context"><strong>Kontekst koji možete poslati uz upit</strong>{context.checkerStatus && <span>Provjera weba: {context.checkerStatus === 'green' ? 'datoteka pronađena (tehnička dostupnost — nije potvrda usklađenosti)' : context.checkerStatus}</span>}{context.discoveredUrls?.map((url) => <span key={url}>{url}</span>)}{context.sourceFilename && <span>{context.sourceFilename} · {context.itemCount ?? 0} stavki · {context.blockerCount ?? 0} za dopunu</span>}</div>}
      <TurnstileField onToken={setTurnstileToken} />
      <label className="privacy-choice"><input name="privacy" type="checkbox" required /><span>Slažem se da NEPAR obradi podatke i privitak radi odgovora na upit. <a href="https://nepar.hr/privatnost" target="_blank" rel="noreferrer">Politika privatnosti</a></span></label>
      {error && <p className="app-error" role="alert">{error}</p>}
      <button className="app-button app-button-primary lead-submit" type="submit" disabled={status === 'sending' || turnstileLoading || !siteKey}>{status === 'sending' ? 'Šaljemo…' : intent === 'implementation' ? `Pošaljite upit za ${implementationFirstYearLabel()}` : intent === 'plugin' ? `Pošaljite upit za ${selfServicePriceLabel()}` : 'Zatražite konzultaciju'}</button>
    </form>
  </section>
}
