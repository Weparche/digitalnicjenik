import { PlanCards } from './PlanCards'
import { useEffect, useRef, useState } from 'react'
import { IconArrowRight, IconUpload, IconWorld, IconExternalLink, IconCircleCheckFilled, IconAlertCircle, IconCalendar, IconMenu2, IconX, IconChevronDown } from '@tabler/icons-react'
import { normalizeWebsiteInput, STATUS_LABELS, technicalReport, type DocumentAnalysis, type DocumentFinding, type WebsiteCheckResult } from '../shared/website-check'
import { PLANS, formatEur, type PlanId } from './publisherPricing'
import { PlatformPills } from './ExistingWebSections'
import { installationPriceLabel } from '../shared/pricing'
import { LeadForm, type LeadContext, type LeadIntent } from './LeadForm'
import '@fontsource-variable/inter/wght.css'
import './acquisition.css'
import { landingFaq } from './productFaq'
import { getLatestPosts,newsArticlePath } from './news/posts'

const loadingCopy = ['Otvaramo vašu web stranicu…', 'Tražimo javni digitalni cjenik…', 'Provjeravamo dostupne CSV/XML datoteke…', 'Analiziramo javno dostupne podatke…']

function Wordmark() {
  return <a className="acq-logo" href="/" aria-label="NEPAR početna"><svg width="32" height="34" viewBox="0 0 32 34" aria-hidden="true"><rect x="1" y="18" width="8" height="15" rx="4" fill="currentColor"/><rect x="12" y="9" width="8" height="24" rx="4" fill="currentColor"/><rect x="23" y="1" width="8" height="32" rx="4" fill="currentColor"/></svg><span>NEPAR</span></a>
}

function UploadPath({ onUpload }: { onUpload: () => void }) {
  return <div className="acq-upload"><div><h2>Imate Excel, CSV ili XML cjenik?</h2><p>Otvorite svoj radni prostor za provjeru, objavu i upravljanje cjenikom.</p></div><div className="acq-upload-action"><button className="acq-secondary" type="button" onClick={onUpload}><IconUpload size={21}/>Učitaj cjenik</button><small>Bez registracije za pregled</small></div></div>
}

function InstallationHelp({ onHelp }: { onHelp: () => void }) {
  return <section className="acq-help" id="pomoc"><div><h2>Već imate web i samo trebate pomoć?</h2><p>Postavimo poveznicu ili gumb za digitalni cjenik na vašu postojeću web stranicu — {installationPriceLabel()}.</p></div><button type="button" className="acq-secondary" onClick={onHelp}>Trebam pomoć s ugradnjom<IconArrowRight size={20}/></button></section>
}


const LEVEL_LABELS = { error: 'Obvezni podatak', warning: 'Provjeriti', info: 'Preporuka' } as const

function FindingLevel({ finding }: { finding: DocumentFinding }) {
  return finding.level ? <span className={`acq-finding-level acq-finding-level-${finding.level}`}>{LEVEL_LABELS[finding.level]}</span> : null
}

function DocumentResult({ analysis }: { analysis: DocumentAnalysis }) {
  const findings = analysis.findings.slice(0, 20)
  const recommendations = analysis.recommendations ?? []
  return <article className="acq-document" aria-label={`${analysis.format.toUpperCase()} analiza`}>
    <header><h3>{analysis.format.toUpperCase()}</h3><span className={`acq-document-status acq-status-${analysis.status}`}>{STATUS_LABELS[analysis.status]}</span></header>
    {analysis.url && /^https?:\/\//.test(analysis.url) && <a className="acq-document-url" href={analysis.url} target="_blank" rel="noreferrer">{analysis.url}<IconExternalLink size={15}/></a>}
    <p>{analysis.fetched ? 'Dokument dohvaćen' : 'Dokument nije potvrđen'} · {analysis.itemCount} stavki</p>
    <h4>Struktura</h4>{analysis.structureReasons.map((reason, i) => <p key={i}>{reason}</p>)}
    <h4>Sadržaj</h4>
    {analysis.totalFindings > 0 ? <><p className="acq-finding-count">Prikazano {findings.length} od {analysis.totalFindings} nalaza u ovoj datoteci.</p><ol className="acq-document-findings">{findings.map((finding, i) => <li key={i}><FindingLevel finding={finding}/>{finding.itemName && <strong>„{finding.itemName}”: </strong>}{finding.message}{finding.row != null && <small>Izvorni redak / stavka {finding.row}</small>}</li>)}</ol></> : <p>{analysis.contentStatus === 'pass' ? 'Nema nalaza u podržanim poljima.' : 'Sadržaj nije moguće potvrditi ovom provjerom.'}</p>}
    {recommendations.length > 0 && <div className="acq-recommendations"><h4>Preporuke (nije zakonska obveza)</h4><ul className="acq-document-findings">{recommendations.map((finding, i) => <li key={i}><FindingLevel finding={finding}/>{finding.message}</li>)}</ul></div>}
  </article>
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
    {(result.details?.csvAnalysis || result.details?.xmlAnalysis) && <div className="acq-document-grid">{[result.details.csvAnalysis, result.details.xmlAnalysis].map((analysis) => analysis && <DocumentResult key={analysis.format} analysis={analysis}/>)}</div>}
    {(result.details?.publicationFindings?.length ?? 0) > 0 && <section className="acq-publication-notes" aria-label="Napomene o objavi"><h3>Objava i naziv datoteke</h3><ul className="acq-document-findings">{result.details!.publicationFindings!.map((finding, i) => <li key={i}><FindingLevel finding={finding}/>{finding.message}</li>)}</ul></section>}
    <div className="acq-result-footer">
      <p>Ova provjera nije potvrda pravne usklađenosti. Arhiva ne potvrđuje potpunost ni trajanje povijesti objava.</p>
      <a className="acq-primary acq-resolve-cta" href="/app?new=1">Objavi svoj cjenik<IconArrowRight size={24}/></a>
      <button type="button" className="acq-secondary" onClick={onUpload}>Učitajte cjenik za detaljnu provjeru<IconUpload size={19}/></button>
      {!unconfirmed && (report.unknown > 0 || result.status === 'unavailable') && <button type="button" className="acq-cancel" onClick={onRetry}>Pokušaj ponovno<IconArrowRight size={19}/></button>}
    </div>
  </section>
}

export function AcquisitionLanding() {
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
  const [cancelled, setCancelled] = useState(false)
  const cancelledRef = useRef(false)
  const resultRef = useRef<HTMLDivElement>(null)
  const inFlight = useRef(false)
  const requestRef = useRef<AbortController | null>(null)
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
  function onUpload() { window.location.assign('/app?new=1') }
  function onLead(next: LeadIntent, selected?: PlanId) {
    if(selected==='link'||selected==='publisher'){window.location.assign('/app?new=1&plan='+selected);return}
    const selectedTemplate = new URLSearchParams(window.location.search).get('template')
    if (selectedTemplate) setContext(current=>({...current,templateId:selectedTemplate}))
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
    <div className="acq-header-bar"><header className="acq-header"><Wordmark/><nav className={menuOpen ? 'acq-nav is-open' : 'acq-nav'} aria-label="Glavna navigacija"><a className="is-active" href="#checker" onClick={() => setMenuOpen(false)}>Provjera weba</a><a href="/app?new=1">Moj cjenik</a><a href="/cijene/">Cijene</a><a href="/vodici/">Vodiči</a><a href="/app?login=1">Prijava</a></nav><div className="acq-deadline"><IconCalendar size={24}/><span>Rok primjene<strong>17.11.2026.</strong></span></div><button className="acq-menu" type="button" aria-label={menuOpen ? 'Zatvori navigaciju' : 'Otvori navigaciju'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <IconX/> : <IconMenu2/>}</button></header></div>
    <main>
    <div className="acq-top">


      <div>
        <section className="acq-hero" aria-labelledby="acq-title"><div className="acq-hero-copy"><h1 id="acq-title">Imate web<br/>stranicu?<br/>Provjerite<br className="acq-desktop-break"/> digitalni cjenik <br className="acq-final-break"/><em>besplatno.</em></h1><p className="acq-intro">Unesite adresu svoje web stranice. Provjerit ćemo javno dostupni digitalni cjenik, CSV/XML datoteke, linkove i osnovnu tehničku strukturu.</p>
          <form id="checker" className="acq-form" onSubmit={check} noValidate aria-busy={checking}><label className="sr-only" htmlFor="acq-url">Adresa web stranice</label><div className="acq-input"><IconWorld size={23}/><input id="acq-url" name="website" inputMode="url" autoComplete="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={2048} value={url} onChange={(e) => { setUrl(e.target.value); setError('') }} aria-invalid={Boolean(error)} aria-describedby={error ? 'acq-url-error' : undefined} placeholder="https://vasweb.hr"/></div><button type="submit" className="acq-primary" disabled={checking}>{checking ? 'Provjeravamo…' : 'Provjeri besplatno'}<IconArrowRight size={24}/></button></form>
          {error && <p id="acq-url-error" className="acq-error" role="alert">{error}</p>}
          <div className="acq-loading" role="status" aria-live="polite">{checking ? <><span className="acq-spinner" aria-hidden="true"/>{loadingCopy[phase]}<small>Provjera je u tijeku. Rezultate prikazujemo po završetku dohvata.</small><button type="button" className="acq-cancel" onClick={() => { cancelledRef.current = true; requestRef.current?.abort(); setCancelled(true); document.getElementById('acq-url')?.focus() }}>Odustani od provjere</button></> : cancelled ? 'Provjera je zaustavljena. Možete pokušati ponovno.' : null}</div>
          <ul className="acq-trust">{['Bez registracije', 'Rezultat odmah', 'Potpuno besplatno'].map((text) => <li key={text}><IconCircleCheckFilled size={20}/>{text}</li>)}</ul>
          <div className="acq-hero-platforms"><p>Objava za bilo koji postojeći web od {formatEur(PLANS[0].price, true)} — bez plugina:</p><PlatformPills/></div>
          <UploadPath onUpload={onUpload}/>
        </div></section>
      </div>
      <div className="acq-scene">
      <picture className="acq-photo"><source media="(min-width: 1000px)" srcSet="/assets/checker-office.webp"/><img src="/assets/checker-office.webp" alt="" width="1536" height="1024" fetchPriority="low"/></picture>
      <div className="acq-preview" aria-label="Ilustrativni primjer rezultata, nije provjera vaše stranice"><span className="acq-preview-label">Primjer rezultata</span><h2>Rezultat provjere</h2><div className="acq-preview-score"><strong>6 / 9</strong><span>3 provjere traže pažnju</span></div><progress max={9} value={6} aria-label="Primjer: šest od devet"/>{[['Javni CSV na webu', 'Nije pronađen'], ['Arhiva prethodnih objava', 'Nije pronađena'], ['Sadržaj cjenika', 'Detaljna provjera']].map(([label, status]) => <div className="acq-preview-row" key={label}><IconAlertCircle size={20}/><span>{label}</span><b>{status}</b></div>)}</div>
      </div>
    </div>
    <div className="acq-content">
      <div className="acq-result-anchor" ref={resultRef} tabIndex={-1} aria-label="Rezultat provjere"><div role="status" className="sr-only" aria-live="polite">{report && `Rezultat: ${report.score} potvrđenih od 9 tehničkih provjera; ${report.unknown} nije moguće potvrditi.`}</div>{result && <ResultPanel result={result} website={checkedUrl} onRetry={() => void check()} onUpload={onUpload}/>}</div>
      <section className="acq-solutions" id="rjesenja" aria-labelledby="solutions-title"><h2 id="solutions-title">Trebate riješiti digitalni cjenik?</h2><p>{!result ? 'Web Link je za web koji već imate. Publisher dodaje uređivanje stavki i svakodnevni nadzor. Napredna integracija je zasebna individualna ponuda.' : report?.attention ? 'Pronašli smo stavke koje treba riješiti. Možete sami objaviti cjenik ili prepustiti NEPAR-u više posla.' : report?.unknown ? 'Za dio stavki potrebna je detaljna provjera. Učitajte datoteku ili odaberite pomoć pri objavi.' : 'Tehničke provjere prolaze. Ako želite jednostavnije održavanje i objavu, odaberite rješenje za svoj cjenik.'}</p><PlanCards onSelect={(p) => onLead(p === 'web' ? 'implementation' : 'plugin', p)} onExtra={() => onLead('consultation')}/><p className="acq-domain-note">Vaša postojeća web stranica i domena ostaju vaše. NEPAR objavljuje cjenik i priprema link koji možete ugraditi.</p><p><a href="/objava-digitalnog-cjenika/">Kako izgleda objava i ugradnja →</a></p></section>
      <section className="acq-help acq-reference" aria-labelledby="reference-title"><div><span className="acq-preview-label">Stvarna NEPAR implementacija</span><h2 id="reference-title">Digitalni cjenik za Auto Gubić</h2><p>Javni cjenik na webu autoservisa, s aktualnom i sidrenom cijenom, CSV/XML poveznicama i podacima o objavi.</p></div><a className="acq-secondary" href="/reference/auto-gubic/">Pogledajte primjer<IconArrowRight size={19}/></a></section>
      {result && <InstallationHelp onHelp={() => onLead('consultation')}/>}
      {!result && <InstallationHelp onHelp={() => onLead('consultation')}/>}
      {leadOpen && <LeadForm intent={intent} context={leadContext} onIntentChange={(value) => { setIntent(value); setPlan(undefined) }} onPlanChange={(p) => { setPlan(p); setIntent(p === 'web' ? 'implementation' : p ? 'plugin' : 'consultation') }}/ >}
      <section className="acq-compact-faq" aria-labelledby="landing-faq-title"><h2 id="landing-faq-title">Česta pitanja</h2>{landingFaq.map(entry=><details key={entry.question}><summary>{entry.question}<IconChevronDown size={18}/></summary><p>{entry.answer}</p></details>)}<a href="/faq/">Sva pitanja i odgovori<IconArrowRight size={17}/></a></section>
      <footer className="acq-footer"><Wordmark/><nav aria-label="Dodatne informacije"><a href="/digitalni-cjenik-za-wordpress-webshop/">Za postojeći web</a><a href="/objava-digitalnog-cjenika/">Objava i ugradnja</a><a href="/faq/">Česta pitanja</a><a href="/vodici/">Vodiči</a><a href="/usporedba/">Usporedba mogućnosti</a><a href="/specifikacija-csv-xml/">Specifikacija CSV/XML</a><a href="/app?login=1">Prijava u dashboard</a><a href="/privatnost.html">Privatnost</a><a href="/uvjeti.html">Uvjeti usluge</a></nav><details className="acq-resources"><summary>Vodiči i aktualne informacije</summary><nav aria-label="Vodiči i novosti"><a href="/vodici/sidrena-cijena/">Sidrena cijena</a><a href="/specifikacija-csv-xml/">CSV i XML formati</a><a href="/vodici/automatizacija-digitalnog-cjenika/">Automatizacija objave</a>{getLatestPosts(3).map(post=><a key={post.slug} href={newsArticlePath(post.slug)}>{post.widgetHeadline??post.title}</a>)}<a href="/vijesti/">Sve vijesti</a></nav></details><p>Tehnička provjera i objava digitalnog cjenika. Bez jamstva pravne usklađenosti.</p></footer>
    </div></main>
  </div>
}
