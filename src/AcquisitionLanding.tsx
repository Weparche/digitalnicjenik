import { PlanCards } from './PlanCards'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { IconArrowRight, IconUpload, IconWorld, IconLock, IconLink, IconFileDescription, IconCode, IconExternalLink, IconDatabase, IconClock, IconList, IconCircleCheckFilled, IconAlertCircle, IconCalendar, IconShieldCheck, IconBolt, IconEye, IconMenu2, IconX, IconChevronDown } from '@tabler/icons-react'
import { normalizeWebsiteInput, STATUS_LABELS, TECHNICAL_CHECKS, technicalReport, type WebsiteCheckResult } from '../shared/website-check'
import { PLANS, type PlanId } from './publisherPricing'
import { LeadForm, type LeadContext, type LeadIntent } from './LeadForm'
import { EducationSection } from './EducationSection'
import { RegulatoryNewsWidget } from './news/RegulatoryNewsWidget'
import '@fontsource-variable/inter/wght.css'
import './acquisition.css'

const icons = { globe: IconWorld, lock: IconLock, link: IconLink, file: IconFileDescription, code: IconCode, external: IconExternalLink, database: IconDatabase, clock: IconClock, list: IconList }
const loadingCopy = ['Otvaramo vašu web stranicu…', 'Tražimo javni digitalni cjenik…', 'Provjeravamo dostupne CSV/XML datoteke…', 'Analiziramo javno dostupne podatke…']

function Wordmark() {
  return <a className="acq-logo" href="/" aria-label="NEPAR početna"><svg width="32" height="34" viewBox="0 0 32 34" aria-hidden="true"><rect x="1" y="18" width="8" height="15" rx="4" fill="currentColor"/><rect x="12" y="9" width="8" height="24" rx="4" fill="currentColor"/><rect x="23" y="1" width="8" height="32" rx="4" fill="currentColor"/></svg><span>NEPAR</span></a>
}

function UploadPath({ onUpload }: { onUpload: () => void }) {
  return <div className="acq-upload"><div><h2>Imate Excel, CSV ili XML cjenik?</h2><p>Učitajte datoteku za detaljniju provjeru strukture podataka.</p></div><div className="acq-upload-action"><button className="acq-secondary" type="button" onClick={onUpload}><IconUpload size={21}/>Učitaj datoteku</button><small>XLSX · CSV · XML</small></div></div>
}

function InstallationHelp({ onHelp }: { onHelp: () => void }) {
  return <section className="acq-help" id="pomoc"><div><h2>Već imate web i samo trebate pomoć?</h2><p>Možemo vam ugraditi link, gumb ili prikaz digitalnog cjenika na postojeću web stranicu.</p></div><button type="button" className="acq-secondary" onClick={onHelp}>Trebam pomoć s ugradnjom<IconArrowRight size={20}/></button></section>
}


function ResultPanel({ result, onUpload, onRetry, website }: { result: WebsiteCheckResult; onUpload: () => void; onRetry: () => void; website: string }) {
  const report = technicalReport(result)
  const unconfirmed = report.unknown === 9
  return <section className={`acq-result acq-tone-${report.tone}`} id="rezultat" aria-labelledby="result-title">
    <div className="acq-result-top"><div><h2 id="result-title">{unconfirmed ? 'Provjeru nije moguće dovršiti' : 'Rezultat provjere'}</h2><p>Tehnička provjera javno dostupnih podataka</p></div><div className="acq-score"><strong>{unconfirmed ? '—' : report.score}</strong><span>/ 9</span></div></div>
    <p className="acq-result-summary">{unconfirmed ? '0 potvrđenih provjera · 9 nije moguće automatski potvrditi' : <>{report.score}/9 tehničkih provjera prolazi{report.attention > 0 && ` · ${report.attention} zahtijeva pažnju`}{report.unknown > 0 && ` · ${report.unknown} nije moguće potvrditi`}</>}</p>
    {!unconfirmed && <progress max={9} value={report.score} aria-label={`${report.score} od 9 tehničkih provjera prolazi`}/>}
    <p className="acq-result-message">{website}<br/>{result.message}</p>
    {unconfirmed && <button type="button" className="acq-primary acq-retry-top" onClick={onRetry}>Pokušaj ponovno<IconArrowRight size={19}/></button>}
    <ol className="acq-status-list">{report.checks.map((check) => <li key={check.id} className={`acq-status-${check.status}`}><details><summary><span className="acq-status-icon" aria-hidden="true">{(check.status === 'pass' || check.status === 'not_applicable') ? <IconCircleCheckFilled size={21}/> : <IconAlertCircle size={21}/>}</span><strong>{check.label}</strong><span className="acq-status-label">{STATUS_LABELS[check.status]}</span><IconChevronDown className="acq-disclosure" size={17} aria-hidden="true"/></summary><div className="acq-evidence"><p>{check.evidence}</p>{check.url && /^https?:\/\//.test(check.url) && <a href={check.url} target="_blank" rel="noreferrer">{check.url}<IconExternalLink size={15}/></a>}</div></details></li>)}</ol>
    <div className="acq-result-footer">
      <p>Ova provjera nije potvrda pravne usklađenosti. Arhiva ne potvrđuje potpunost ni trajanje povijesti objava.</p>
      <a className="acq-primary acq-resolve-cta" href="#rjesenja">Riješite digitalni cjenik<IconArrowRight size={24}/></a>
      <button type="button" className="acq-secondary" onClick={onUpload}>Učitajte cjenik za detaljnu provjeru<IconUpload size={19}/></button>
      {!unconfirmed && (report.unknown > 0 || result.status === 'unavailable') && <button type="button" className="acq-cancel" onClick={onRetry}>Pokušaj ponovno<IconArrowRight size={19}/></button>}
    </div>
  </section>
}

export function AcquisitionLanding({ renderValidator }: { renderValidator: (onContext: (context: LeadContext) => void, onLead: (intent: LeadIntent) => void) => ReactNode }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<WebsiteCheckResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [phase, setPhase] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [checkedUrl, setCheckedUrl] = useState('')
  const [context, setContext] = useState<LeadContext>({})
  const [intent, setIntent] = useState<LeadIntent>('consultation')
  const [plan, setPlan] = useState<PlanId | undefined>()
  const [leadOpen, setLeadOpen] = useState(false)
  const [validatorVisible, setValidatorVisible] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const cancelledRef = useRef(false)
  const validatorRef = useRef<HTMLDivElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const inFlight = useRef(false)
  const requestRef = useRef<AbortController | null>(null)
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { setValidatorVisible(true); observer.disconnect() } }, { rootMargin: '400px' })
    if (validatorRef.current) observer.observe(validatorRef.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => () => requestRef.current?.abort(), [])
  useEffect(() => {
    if (!menuOpen) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuOpen(false); document.querySelector<HTMLButtonElement>('.acq-menu')?.focus() } }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [menuOpen])
  useEffect(() => {
    if (!checking) return
    const timer = window.setInterval(() => setPhase((p) => (p + 1) % loadingCopy.length), 2400)
    return () => clearInterval(timer)
  }, [checking])
  function focus(target: HTMLElement | null) {
    target?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
    target?.focus({ preventScroll: true })
  }
  function onUpload() { setValidatorVisible(true); focus(validatorRef.current) }
  function onLead(next: LeadIntent, selected?: PlanId) {
    setIntent(next); setPlan(selected ?? (next === 'implementation' ? 'web' : next === 'plugin' ? 'publisher' : undefined)); setLeadOpen(true)
    window.setTimeout(() => focus(document.getElementById('posaljite-cjenik')), 0)
  }
  useEffect(() => {
    const selected = new URLSearchParams(window.location.search).get('paket')
    if (selected && PLANS.some((p) => p.id === selected)) onLead(selected === 'web' ? 'implementation' : 'plugin', selected as PlanId)
    if (window.location.hash === '#posaljite-cjenik') { setLeadOpen(true); window.setTimeout(() => focus(document.getElementById('posaljite-cjenik')), 50) }
    if (window.location.hash === '#csv-validator') window.setTimeout(onUpload, 50)
  }, [])
  async function check(event?: React.FormEvent) {
    event?.preventDefault()
    if (inFlight.current) return
    let normalized: string
    try { normalized = normalizeWebsiteInput(url) } catch { setError('Unesite ispravnu adresu, primjerice vasweb.hr.'); document.getElementById('acq-url')?.focus(); return }
    inFlight.current = true
    cancelledRef.current = false
    setCancelled(false); setError(''); setChecking(true); setPhase(0); setResult(null); setCheckedUrl(normalized)
    const controller = new AbortController()
    requestRef.current = controller
    const timer = window.setTimeout(() => controller.abort(), 45000)
    try {
      const response = await fetch('/api/digitalni-cjenik/check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: normalized }), signal: controller.signal })
      const data = await response.json() as WebsiteCheckResult
      if (!data || !['green', 'yellow', 'red', 'unavailable'].includes(data.status)) throw new Error('invalid_response')
      setResult(data)
    } catch { if (!cancelledRef.current) setResult({ status: 'unavailable', message: 'Provjeru trenutačno nije moguće dovršiti. Pokušajte ponovno ili učitajte datoteku za detaljnu provjeru.' }) }
    finally { clearTimeout(timer); inFlight.current = false; setChecking(false) }
  }
  useEffect(() => { if (result) focus(resultRef.current) }, [result])
  const report = result ? technicalReport(result) : null
  const leadContext: LeadContext = { ...context, website: checkedUrl || undefined, checkerStatus: result?.status === 'unavailable' ? 'unavailable' : report?.tone, discoveredUrls: [result?.details?.csvUrl, result?.details?.xmlUrl].filter((u): u is string => Boolean(u)), selectedPlan: plan, checkerScore: report?.score }
  return <div className="premium-entry acquisition">
    <a className="acq-skip" href="#checker">Preskoči na provjeru</a>
    <div className="acq-header-bar"><header className="acq-header"><Wordmark/><nav className={menuOpen ? 'acq-nav is-open' : 'acq-nav'} aria-label="Glavna navigacija"><a className="is-active" href="#checker" onClick={() => setMenuOpen(false)}>Provjera weba</a><a href="#kako-radi" onClick={() => setMenuOpen(false)}>Kako radi</a><a href="/cijene/">Cijene</a><a href="#pomoc" onClick={() => setMenuOpen(false)}>Pomoć</a></nav><div className="acq-deadline"><IconCalendar size={24}/><span>Rok primjene<strong>17.11.2026.</strong></span></div><button className="acq-menu" type="button" aria-label={menuOpen ? 'Zatvori navigaciju' : 'Otvori navigaciju'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <IconX/> : <IconMenu2/>}</button></header></div>
    <main>
    <div className="acq-top">


      <div>
        <section className="acq-hero" aria-labelledby="acq-title"><div className="acq-hero-copy"><h1 id="acq-title">Imate web<br/>stranicu?<br/>Provjerite<br className="acq-desktop-break"/> digitalni cjenik <br className="acq-final-break"/><em>besplatno.</em></h1><p className="acq-intro">Unesite adresu svoje web stranice. Provjerit ćemo javno dostupni digitalni cjenik, CSV/XML datoteke, linkove i osnovnu tehničku strukturu.</p>
          <form id="checker" className="acq-form" onSubmit={check} noValidate aria-busy={checking}><label className="sr-only" htmlFor="acq-url">Adresa web stranice</label><div className="acq-input"><IconWorld size={23}/><input id="acq-url" name="website" inputMode="url" autoComplete="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={2048} value={url} onChange={(e) => { setUrl(e.target.value); setError('') }} aria-invalid={Boolean(error)} aria-describedby={error ? 'acq-url-error' : undefined} placeholder="https://vasweb.hr"/></div><button type="submit" className="acq-primary" disabled={checking}>{checking ? 'Provjeravamo…' : 'Provjeri besplatno'}<IconArrowRight size={24}/></button></form>
          {error && <p id="acq-url-error" className="acq-error" role="alert">{error}</p>}
          <div className="acq-loading" role="status" aria-live="polite">{checking ? <><span className="acq-spinner" aria-hidden="true"/>{loadingCopy[phase]}<small>Provjera je u tijeku. Rezultate prikazujemo po završetku dohvata.</small><button type="button" className="acq-cancel" onClick={() => { cancelledRef.current = true; requestRef.current?.abort(); setCancelled(true); document.getElementById('acq-url')?.focus() }}>Odustani od provjere</button></> : cancelled ? 'Provjera je zaustavljena. Možete pokušati ponovno.' : null}</div>
          <ul className="acq-trust">{['Bez registracije', 'Rezultat odmah', 'Potpuno besplatno'].map((text) => <li key={text}><IconCircleCheckFilled size={20}/>{text}</li>)}</ul>
          <UploadPath onUpload={onUpload}/>
        </div></section>
      </div>
      <div className="acq-scene">
      <picture className="acq-photo"><source media="(min-width: 1000px)" srcSet="/assets/checker-office.webp"/><img src="/assets/checker-office.webp" alt="" width="1536" height="1024" fetchPriority="low"/></picture>
      <div className="acq-preview" aria-label="Ilustrativni primjer rezultata, nije provjera vaše stranice"><span className="acq-preview-label">Primjer rezultata</span><h2>Rezultat provjere</h2><div className="acq-preview-score"><strong>6 / 9</strong><span>3 provjere traže pažnju</span></div><progress max={9} value={6} aria-label="Primjer: šest od devet"/>{[['Javni CSV na webu', 'Nije pronađen'], ['Arhiva prethodnih objava', 'Nije pronađena'], ['Sadržaj cjenika', 'Detaljna provjera']].map(([label, status]) => <div className="acq-preview-row" key={label}><IconAlertCircle size={20}/><span>{label}</span><b>{status}</b></div>)}</div>
      </div>
    </div>
    <div className="acq-content">
      <section className="acq-checks" aria-labelledby="checks-title"><h2 id="checks-title">Što provjeravamo?</h2><p>Brza i jednostavna provjera ključnih tehničkih stavki digitalnog cjenika.</p><ol>{TECHNICAL_CHECKS.map((check, index) => { const Icon = icons[check.icon]; return <li key={check.id}><Icon size={25}/><span className="acq-check-number">{index + 1}</span><span>{check.label}</span></li> })}</ol></section>
      <div className="acq-reassurance">{[[IconShieldCheck, 'Sigurno i anonimno', 'Bez registracije za provjeru'], [IconBolt, 'Brza provjera', 'Vrijeme ovisi o vašoj stranici'], [IconEye, 'Samo javno dostupni podaci', 'Ne zahtijevaju prijavu'], [IconCircleCheckFilled, 'Jasan tehnički rezultat', 'Uz objašnjenje svake provjere']].map(([Icon, title, text]) => { const I = Icon as typeof IconEye; return <div key={String(title)}><I size={29}/><p><strong>{String(title)}</strong><span>{String(text)}</span></p></div> })}</div>
      <div className="acq-result-anchor" ref={resultRef} tabIndex={-1} aria-label="Rezultat provjere"><div role="status" className="sr-only" aria-live="polite">{report && `Rezultat: ${report.score} potvrđenih od 9 tehničkih provjera; ${report.unknown} nije moguće potvrditi.`}</div>{result && <ResultPanel result={result} website={checkedUrl} onRetry={() => void check()} onUpload={onUpload}/>}</div>
      <section className="acq-solutions" id="rjesenja" aria-labelledby="solutions-title"><h2 id="solutions-title">Trebate riješiti digitalni cjenik?</h2><p>{!result ? 'NEPAR objavljuje pripremljeni cjenik za obrte i male tvrtke. Odaberite javni link, Publisher s nadzorom ili jednostavan web s cjenikom.' : report?.attention ? 'Pronašli smo stavke koje treba riješiti. Možete sami objaviti cjenik ili prepustiti NEPAR-u više posla.' : report?.unknown ? 'Za dio stavki potrebna je detaljna provjera. Učitajte datoteku ili odaberite pomoć pri objavi.' : 'Tehničke provjere prolaze. Ako želite jednostavnije održavanje i objavu, odaberite rješenje za svoj cjenik.'}</p><PlanCards onSelect={(p) => onLead(p === 'web' ? 'implementation' : 'plugin', p)}/><p className="acq-domain-note">Vaša postojeća web stranica i domena ostaju vaše. NEPAR objavljuje cjenik i priprema link koji možete ugraditi.</p><p><a href="/objava-digitalnog-cjenika/">Kako izgleda objava i ugradnja →</a></p></section>
      <section className="acq-help acq-reference" aria-labelledby="reference-title"><div><span className="acq-preview-label">Stvarna NEPAR implementacija</span><h2 id="reference-title">Digitalni cjenik za Auto Gubić</h2><p>Javni cjenik na webu autoservisa, s aktualnom i sidrenom cijenom, CSV/XML poveznicama i podacima o objavi.</p></div><a className="acq-secondary" href="/reference/auto-gubic/">Pogledajte primjer<IconArrowRight size={19}/></a></section>
      {result && <InstallationHelp onHelp={() => onLead('consultation')}/>}
      <section className="acq-how" id="kako-radi"><h2>Od web adrese do jasnog odgovora.</h2><ol><li><strong>Unesite web adresu</strong><p>Provjera je besplatna i ne traži registraciju.</p></li><li><strong>Pogledajte što je pronađeno</strong><p>Svaki status ima objašnjenje i dostupne dokaze.</p></li><li><strong>Odaberite sljedeći korak</strong><p>Učitajte datoteku, sami objavite cjenik ili zatražite pomoć.</p></li></ol></section>
      <div id="csv-validator" ref={validatorRef} className="premium-validator-anchor" tabIndex={-1} aria-labelledby="csv-validator-title"><div className="premium-validator-heading"><h2 id="csv-validator-title">Detaljna provjera datoteke</h2><p>Učitajte Excel, CSV ili XML. Pregledajte nalaze i, ako želite, započnite 7 dana probne objave.</p></div>{leadContext.discoveredUrls!.length > 0 && <div className="premium-handoff"><p>Pronađene datoteke nisu automatski preuzete. Preuzmite ih i učitajte za detaljnu provjeru.</p>{leadContext.discoveredUrls!.map((u) => <a href={u} key={u} target="_blank" rel="noreferrer">{u}</a>)}</div>}{validatorVisible ? renderValidator(setContext, onLead) : <button type="button" className="acq-secondary" onClick={onUpload}>Otvori validator<IconUpload size={19}/></button>}</div>
      {!result && <InstallationHelp onHelp={() => onLead('consultation')}/>}
      {leadOpen && <LeadForm intent={intent} context={leadContext} onIntentChange={(value) => { setIntent(value); setPlan(undefined) }} onPlanChange={(p) => { setPlan(p); setIntent(p === 'web' ? 'implementation' : p ? 'plugin' : 'consultation') }}/ >}
      <EducationSection onLead={onLead} showOffer={Boolean(result)}/><RegulatoryNewsWidget/>
      <footer className="acq-footer"><Wordmark/><nav aria-label="Dodatne informacije"><a href="/objava-digitalnog-cjenika/">Objava i ugradnja</a><a href="/reference/auto-gubic/">Auto Gubić referenca</a><a href="/faq/">Česta pitanja</a><a href="/vodici/">Vodiči</a><a href="/specifikacija-csv-xml/">Specifikacija CSV/XML</a><a href="/vijesti/">Aktualne informacije</a><a href="/app">Publisher prijava</a><a href="/privatnost.html">Privatnost</a><a href="/uvjeti.html">Uvjeti i podaci o pružatelju</a></nav><p>Tehnička provjera i objava digitalnog cjenika. Bez jamstva pravne usklađenosti.</p></footer>
    </div></main>
  </div>
}
