import { PlanCards } from './PlanCards'
import { useEffect, useState } from 'react'
import { IconArrowRight, IconUpload, IconWorld, IconCircleCheckFilled, IconAlertCircle,IconCalendar, IconMenu2, IconX, IconChevronDown } from '@tabler/icons-react'
import { normalizeWebsiteInput } from '../shared/website-check'
import { PLANS, formatEur, type PlanId } from './publisherPricing'
import { PlatformPills } from './ExistingWebSections'
import { installationPriceLabel } from '../shared/pricing'
import type { LeadIntent } from './LeadForm'
import '@fontsource-variable/inter/wght.css'
import './acquisition.css'
import { landingFaq } from './productFaq'
import { getLatestPosts,newsArticlePath } from './news/posts'

function Wordmark() {
  return <a className="acq-logo" href="/" aria-label="NEPAR početna"><svg width="32" height="34" viewBox="0 0 32 34" aria-hidden="true"><rect x="1" y="18" width="8" height="15" rx="4" fill="currentColor"/><rect x="12" y="9" width="8" height="24" rx="4" fill="currentColor"/><rect x="23" y="1" width="8" height="32" rx="4" fill="currentColor"/></svg><span>NEPAR</span></a>
}

function UploadPath({ onUpload }: { onUpload: () => void }) {
  return <div className="acq-upload"><div><h2>Imate Excel, CSV ili XML cjenik?</h2><p>Otvorite svoj radni prostor za provjeru, objavu i upravljanje cjenikom.</p></div><div className="acq-upload-action"><button className="acq-secondary" type="button" onClick={onUpload}><IconUpload size={21}/>Učitaj cjenik</button><small>Bez registracije za pregled</small></div></div>
}

function InstallationHelp({ onHelp }: { onHelp: () => void }) {
  return <section className="acq-help" id="pomoc"><div><h2>Već imate web i samo trebate pomoć?</h2><p>Postavimo poveznicu ili gumb za digitalni cjenik na vašu postojeću web stranicu — {installationPriceLabel()}.</p></div><button type="button" className="acq-secondary" onClick={onHelp}>Trebam pomoć s ugradnjom<IconArrowRight size={20}/></button></section>
}


export function AcquisitionLanding() {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    if (!menuOpen) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuOpen(false); document.querySelector<HTMLButtonElement>('.acq-menu')?.focus() } }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [menuOpen])
  function onUpload() { window.location.assign('/app?new=1') }
  function onLead(next:LeadIntent,selected?:PlanId){
    if(selected==='link'||selected==='publisher'){window.location.assign('/app?new=1&plan='+selected);return}
    const current=new URLSearchParams(window.location.search),params=new URLSearchParams({new:'1',tab:'kontakt'})
    if(selected)params.set('plan',selected);else if(next==='implementation')params.set('plan','web')
    for(const key of ['template','checkerRun','website']){const value=current.get(key);if(value)params.set(key,value)}
    window.location.assign('/app?'+params)
  }
  useEffect(()=>{
    const selected=new URLSearchParams(window.location.search).get('paket')
    if(selected&&PLANS.some(plan=>plan.id===selected))onLead(selected==='web'?'implementation':'plugin',selected as PlanId)
    else if(window.location.hash==='#posaljite-cjenik')onLead('consultation')
    if(window.location.hash==='#csv-validator')window.setTimeout(onUpload,50)
  },[])
  function check(event?: React.FormEvent) {
    event?.preventDefault()
    let normalized: string
    try { normalized = normalizeWebsiteInput(url) } catch { setError('Unesite ispravnu adresu, primjerice vasweb.hr.'); document.getElementById('acq-url')?.focus(); return }
    const params=new URLSearchParams({new:'1',tab:'provjera',url:normalized,check:'1',from:'landing'})
    window.location.assign('/app?'+params)
  }
  return <div className="premium-entry acquisition">
    <a className="acq-skip" href="#checker">Preskoči na provjeru</a>
    <div className="acq-header-bar"><header className="acq-header"><Wordmark/><nav className={menuOpen ? 'acq-nav is-open' : 'acq-nav'} aria-label="Glavna navigacija"><a className="is-active" href="#checker" onClick={() => setMenuOpen(false)}>Provjera weba</a><a href="/app?new=1">Moj cjenik</a><a href="/cijene/">Cijene</a><a href="/vodici/">Vodiči</a><a href="/app?login=1">Prijava</a></nav><div className="acq-deadline"><IconCalendar size={24}/><span>Rok primjene<strong>17.11.2026.</strong></span></div><button className="acq-menu" type="button" aria-label={menuOpen ? 'Zatvori navigaciju' : 'Otvori navigaciju'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <IconX/> : <IconMenu2/>}</button></header></div>
    <main>
    <div className="acq-top">


      <div>
        <section className="acq-hero" aria-labelledby="acq-title"><div className="acq-hero-copy"><h1 id="acq-title">Imate web<br/>stranicu?<br/>Provjerite<br className="acq-desktop-break"/> digitalni cjenik <br className="acq-final-break"/><em>besplatno.</em></h1><p className="acq-intro">Unesite adresu svoje web stranice. Provjerit ćemo javno dostupni digitalni cjenik, CSV/XML datoteke, linkove i osnovnu tehničku strukturu.</p>
          <form id="checker" className="acq-form" onSubmit={check} noValidate><label className="sr-only" htmlFor="acq-url">Adresa web stranice</label><div className="acq-input"><IconWorld size={23}/><input id="acq-url" name="website" inputMode="url" autoComplete="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={2048} value={url} onChange={(e) => { setUrl(e.target.value); setError('') }} aria-invalid={Boolean(error)} aria-describedby={error ? 'acq-url-error' : undefined} placeholder="https://vasweb.hr"/></div><button type="submit" className="acq-primary">Provjeri besplatno<IconArrowRight size={24}/></button></form>
          {error && <p id="acq-url-error" className="acq-error" role="alert">{error}</p>}
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
      <section className="acq-solutions" id="rjesenja" aria-labelledby="solutions-title"><h2 id="solutions-title">Trebate riješiti digitalni cjenik?</h2><p>Web Link je za web koji već imate. Publisher dodaje uređivanje stavki i svakodnevni nadzor. Napredna integracija je zasebna individualna ponuda.</p><PlanCards onSelect={(p) => onLead(p === 'web' ? 'implementation' : 'plugin', p)} onExtra={() => onLead('consultation')}/><p className="acq-domain-note">Vaša postojeća web stranica i domena ostaju vaše. NEPAR objavljuje cjenik i priprema link koji možete ugraditi.</p><p><a href="/objava-digitalnog-cjenika/">Kako izgleda objava i ugradnja →</a></p></section>
      <section className="acq-help acq-reference" aria-labelledby="reference-title"><div><span className="acq-preview-label">Stvarna NEPAR implementacija</span><h2 id="reference-title">Digitalni cjenik za Auto Gubić</h2><p>Javni cjenik na webu autoservisa, s aktualnom i sidrenom cijenom, CSV/XML poveznicama i podacima o objavi.</p></div><a className="acq-secondary" href="/reference/auto-gubic/">Pogledajte primjer<IconArrowRight size={19}/></a></section>
      <InstallationHelp onHelp={() => onLead('consultation')}/>
      <section className="acq-compact-faq" aria-labelledby="landing-faq-title"><h2 id="landing-faq-title">Česta pitanja</h2>{landingFaq.map(entry=><details key={entry.question}><summary>{entry.question}<IconChevronDown size={18}/></summary><p>{entry.answer}</p></details>)}<a href="/faq/">Sva pitanja i odgovori<IconArrowRight size={17}/></a></section>
      <footer className="acq-footer"><Wordmark/><nav aria-label="Dodatne informacije"><a href="/digitalni-cjenik-za-wordpress-webshop/">Za postojeći web</a><a href="/objava-digitalnog-cjenika/">Objava i ugradnja</a><a href="/faq/">Česta pitanja</a><a href="/vodici/">Vodiči</a><a href="/usporedba/">Usporedba mogućnosti</a><a href="/specifikacija-csv-xml/">Specifikacija CSV/XML</a><a href="/app?login=1">Prijava u dashboard</a><a href="/privatnost.html">Privatnost</a><a href="/uvjeti.html">Uvjeti usluge</a></nav><details className="acq-resources"><summary>Vodiči i aktualne informacije</summary><nav aria-label="Vodiči i novosti"><a href="/vodici/sidrena-cijena/">Sidrena cijena</a><a href="/specifikacija-csv-xml/">CSV i XML formati</a><a href="/vodici/automatizacija-digitalnog-cjenika/">Automatizacija objave</a>{getLatestPosts(3).map(post=><a key={post.slug} href={newsArticlePath(post.slug)}>{post.widgetHeadline??post.title}</a>)}<a href="/vijesti/">Sve vijesti</a></nav></details><p>Tehnička provjera i objava digitalnog cjenika. Bez jamstva pravne usklađenosti.</p></footer>
    </div></main>
  </div>
}
