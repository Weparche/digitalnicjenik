import { PlanCards } from './PlanCards'
import { useEffect, useState } from 'react'
import { IconArrowRight, IconUpload, IconCircleCheckFilled, IconAlertCircle,IconCalendar, IconMenu2, IconX, IconChevronDown } from '@tabler/icons-react'
import { WebsiteCheckEntry } from './WebsiteCheckEntry'
import { PLANS, formatEur, type PlanId } from './publisherPricing'
import { WEB_LINK_LAUNCH_ONLY } from '../shared/pricing'
import { PlatformPills } from './ExistingWebSections'
import type { LeadIntent } from './LeadForm'
import '@fontsource-variable/inter/wght.css'
import './acquisition.css'
import { landingFaq } from './productFaq'
import { getLatestPosts,newsArticlePath } from './news/posts'

const liveReferences = [
  { name: 'Auto Gubić', domain: 'autogubic.hr', category: 'Autoservis', slug: 'auto-gubic', initials: 'AG', logo: 'https://autogubic.hr/favicon-48x48.png' },
  { name: 'Handyman', domain: 'handyman.nepar.hr', category: 'Montaža i kućne usluge', slug: 'handyman', initials: 'H', logo: '/assets/references/handyman.svg' },
  { name: 'NEPAR Kids', domain: 'kids.nepar.hr', category: 'Personalizirani pokloni', slug: 'nepar-kids', initials: 'NK', logo: '/assets/references/nepar-kids.png' },
  { name: 'NEPAR', domain: 'nepar.hr', category: 'Digitalna rješenja', slug: 'nepar-solutions', initials: 'N', logo: '/assets/nepar-logo.png' },
  { name: 'GeoAdrese', domain: 'geoadrese.net', category: 'Geoinformacijske usluge', slug: 'geoadrese', initials: 'GA', logo: '/assets/references/geoadrese.svg' },
  { name: 'KPDinfo', domain: 'kpdinfo.com', category: 'Klasifikacija i savjetovanje', slug: 'kpdinfo', initials: 'K', logo: '/assets/references/kpdinfo.png' },
  { name: 'Digitalni cjenik', domain: 'digitalnicjenik.nepar.hr', category: 'Objava cjenika', slug: 'digitalni-cjenik', initials: 'DC', logo: '/assets/references/digitalni-cjenik.svg' },
] as const

function Wordmark() {
  return <a className="acq-logo" href="/" aria-label="NEPAR početna"><svg width="32" height="34" viewBox="0 0 32 34" aria-hidden="true"><rect x="1" y="18" width="8" height="15" rx="4" fill="currentColor"/><rect x="12" y="9" width="8" height="24" rx="4" fill="currentColor"/><rect x="23" y="1" width="8" height="32" rx="4" fill="currentColor"/></svg><span>NEPAR</span></a>
}


export function AcquisitionLanding() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [showSticky, setShowSticky] = useState(false)
  useEffect(() => {
    const checker = document.getElementById('checker')
    if (!checker) return
    const update = () => setShowSticky(checker.getBoundingClientRect().bottom < 0 && !checker.contains(document.activeElement))
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', update)
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update); document.removeEventListener('focusin', update); document.removeEventListener('focusout', update) }
  }, [])
  useEffect(() => {
    if (!menuOpen) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuOpen(false); document.querySelector<HTMLButtonElement>('.acq-menu')?.focus() } }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [menuOpen])
  function onUpload() { window.location.assign('/app?new=1') }
  function onLead(next:LeadIntent,selected?:PlanId,cleanCampaign=false){
    if(WEB_LINK_LAUNCH_ONLY && selected && selected !== 'link') { onUpload(); return }
    if(selected==='link'||selected==='publisher'){if(cleanCampaign)window.history.replaceState(window.history.state,'','/');window.location.assign('/app?new=1&plan='+selected);return}
    const current=new URLSearchParams(window.location.search),params=new URLSearchParams({new:'1',tab:'kontakt'})
    if(selected)params.set('plan',selected);else if(next==='implementation')params.set('plan','web')
    for(const key of ['template','checkerRun','website']){const value=current.get(key);if(value)params.set(key,value)}
    if(cleanCampaign)window.history.replaceState(window.history.state,'','/')
    window.location.assign('/app?'+params)
  }
  useEffect(()=>{
    const selected=new URLSearchParams(window.location.search).get('paket')
    if(selected&&PLANS.some(plan=>plan.id===selected))onLead(selected==='web'?'implementation':'plugin',selected as PlanId,true)
    else if(window.location.hash==='#posaljite-cjenik')onLead('consultation')
    if(window.location.hash==='#csv-validator')window.setTimeout(onUpload,50)
  },[])
  return <div className="premium-entry acquisition">
    <a className="acq-skip" href="#checker">Preskoči na provjeru</a>
    <div className="acq-header-bar"><header className="acq-header"><Wordmark/><nav className={menuOpen ? 'acq-nav is-open' : 'acq-nav'} aria-label="Glavna navigacija"><a className="is-active" href="#checker" onClick={() => setMenuOpen(false)}>Provjera weba</a><a href="/app?new=1">Moj cjenik</a><a href="/cijene/">Cijene</a><a href="/vodici/">Vodiči</a><a href="/app?login=1">Prijava</a></nav><div className="acq-deadline"><IconCalendar size={24}/><span>Rok primjene<strong>17.11.2026.</strong></span></div><button className="acq-menu" type="button" aria-label={menuOpen ? 'Zatvori navigaciju' : 'Otvori navigaciju'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <IconX/> : <IconMenu2/>}</button></header></div>
    <main>
    <div className="acq-top">


      <div>
        <section className="acq-hero" aria-labelledby="acq-title"><div className="acq-hero-copy"><h1 id="acq-title">Provjerite digitalni cjenik svoje web stranice <em>besplatno.</em></h1><p className="acq-intro">Unesite adresu svoje web stranice. Provjerit ćemo javno dostupni digitalni cjenik, CSV/XML datoteke, linkove i osnovnu tehničku strukturu.</p>
          <WebsiteCheckEntry source="landing" landing/>
          <a className="acq-secondary" href="/app?new=1" style={{ width: '100%', marginTop: 8, minHeight: 44 }}><IconUpload size={20}/>Izradi digitalni cjenik<IconArrowRight size={19}/></a>
          <ul className="acq-trust">{['Bez registracije', 'Rezultat odmah', 'Potpuno besplatno'].map((text) => <li key={text}><IconCircleCheckFilled size={20}/>{text}</li>)}</ul>
          <div className="acq-hero-platforms"><p>Objava za bilo koji postojeći web od {formatEur(PLANS[0].price, true)} — bez plugina:</p><PlatformPills/></div>
        </div></section>
      </div>
      <div className="acq-scene">
      <picture className="acq-photo"><source media="(min-width: 1000px)" srcSet="/assets/checker-office.webp"/><img src="/assets/checker-office.webp" alt="" width="1536" height="1024" fetchPriority="low"/></picture>
      <div className="acq-preview" aria-label="Ilustrativni primjer rezultata, nije provjera vaše stranice"><span className="acq-preview-label">Primjer rezultata</span><h2>Rezultat provjere</h2><div className="acq-preview-score"><strong>6 / 9</strong><span>3 provjere traže pažnju</span></div><progress max={9} value={6} aria-label="Primjer: šest od devet"/>{[['Javni CSV na webu', 'Nije pronađen'], ['Arhiva prethodnih objava', 'Nije pronađena'], ['Sadržaj cjenika', 'Detaljna provjera']].map(([label, status]) => <div className="acq-preview-row" key={label}><IconAlertCircle size={20}/><span>{label}</span><b>{status}</b></div>)}</div>
      </div>
    </div>
    <div className="acq-content">
      <p className="acq-domain-note">Naše usluge: <a href="/c/digitalni-cjenik">službeni digitalni cjenik naših usluga</a> · CSV/XML i arhiva.</p>
      <section className="acq-live-references" id="reference" aria-labelledby="reference-title">
        <div className="acq-reference-heading">
          <div><span className="acq-preview-label">Stvarne NEPAR implementacije</span><h2 id="reference-title">Digitalni cjenici koji već rade.</h2><p>Od autoservisa do digitalnih usluga i web trgovine. Otvorite stvarne javne cjenike objavljene preko NEPAR Publishera.</p></div>
          <div className="acq-reference-metrics" aria-label="7 implementacija, 63 od 63 bodova"><strong>7</strong><span>objavljenih cjenika</span><strong>63/63</strong><span>bodova Checkera</span></div>
        </div>
        <ul className="acq-reference-grid">
          {liveReferences.map(({name, domain, category, slug, initials, logo}) => <li key={slug}><a className="acq-reference-card" href={'/c/'+slug} aria-label={name+' – javni digitalni cjenik'}>
            <div className="acq-reference-card-top"><span className="acq-reference-mark" aria-hidden="true"><span>{initials}</span><img src={logo} alt="" width={36} height={36} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={event => { event.currentTarget.hidden = true }}/></span><span className="acq-reference-score"><IconCircleCheckFilled size={15} aria-hidden="true"/>9/9</span></div>
            <h3>{name}</h3><span className="acq-reference-domain">{domain}</span><span className="acq-reference-category">{category}</span>
            <span className="acq-reference-link">Otvori cjenik<IconArrowRight size={16} aria-hidden="true"/></span>
          </a></li>)}
        </ul>
        <div className="acq-reference-bottom"><div><p className="acq-reference-note">Rezultati tehničkih provjera 17. i 18.11.2026. Nisu potvrda pravne usklađenosti.</p><a href="/reference/auto-gubic/">Pogledajte primjer ugradnje za Auto Gubić →</a></div><a className="acq-primary" href="/app?new=1&plan=link">Objavite i svoj digitalni cjenik<IconArrowRight size={19} aria-hidden="true"/></a></div>
      </section>
      <section className="acq-publisher-explainer" aria-labelledby="how-publish-title">
        <div className="acq-publisher-steps"><span className="acq-preview-label">Kako radi NEPAR Publisher</span><h2 id="how-publish-title">Do javnog cjenika u tri koraka.</h2><ol>
          <li><span className="acq-step-num" aria-hidden="true">1</span><div><strong>Učitajte datoteku</strong><p>Koristite postojeći Excel, CSV ili XML.</p></div></li>
          <li><span className="acq-step-num" aria-hidden="true">2</span><div><strong>Provjerite i objavite</strong><p>Ispravite eventualne nedostatke i objavite besplatno na 24 sata.</p></div></li>
          <li><span className="acq-step-num" aria-hidden="true">3</span><div><strong>Dodajte link na web</strong><p>Uz godišnji paket zadržite istu poveznicu i pri izmjenama cijena.</p></div></li>
        </ol><a className="acq-primary" href="/app?new=1&plan=link">Započnite besplatno<IconArrowRight size={19} aria-hidden="true"/></a></div>
        <figure className="acq-publisher-figure"><a href="/app?new=1" aria-label="Otvori stvarni radni prostor Publishera"><img src="/assets/publisher-workspace-preview.jpg" alt="Stvarno sučelje NEPAR Publishera za pripremu prvog cjenika: učitavanje datoteke, provjera podataka i objava poveznice" width={1100} height={620} loading="lazy" decoding="async"/></a><figcaption>Stvarni radni prostor · priprema prvog cjenika <a href="/app?new=1">Otvori Publisher →</a></figcaption></figure>
      </section>
      <section className="acq-solutions" id="rjesenja" aria-labelledby="solutions-title">
        <div className="acq-solutions-heading">
          <div><span className="acq-preview-label">Jednostavna objava za postojeći web</span><h2 id="solutions-title">Trebate riješiti digitalni cjenik?</h2><p>Objavite svoj cjenik, a zatim ga ažurirajte svaki put kada promijenite cijene. Vaša web stranica i domena ostaju vaše.</p></div>
          <div className="acq-trial-note"><div className="acq-trial-heading"><IconCircleCheckFilled size={22} aria-hidden="true"/><strong>Besplatna objava 24 sata.</strong></div><p>Učitajte cjenik i dobijte stvarni javni link s CSV/XML datotekama. Isti link zadržavate uz godišnji paket.</p><small>Bez kartice i bez automatske naplate.</small></div>
        </div>
        <div className={WEB_LINK_LAUNCH_ONLY ? 'acq-solutions-offers acq-solutions-offers--launch' : 'acq-solutions-offers'}>
          <PlanCards landingLayout onSelect={(p) => onLead(p === 'web' ? 'implementation' : 'plugin', p)} onExtra={() => onLead('consultation')}/>
        </div>
        <div className="acq-solutions-footer"><p>NEPAR objavljuje cjenik i priprema poveznicu za vaš postojeći web. Ugradnja nije obvezna.</p><a href="/objava-digitalnog-cjenika/">Kako izgleda objava i ugradnja<IconArrowRight size={16} aria-hidden="true"/></a></div>
      </section>
      <section className="acq-help" aria-labelledby="acq-current-title"><div><span className="acq-preview-label">Aktualno · 16.11.2026.</span><h2 id="acq-current-title">Sidrene cijene i digitalni cjenik od 17. studenoga</h2><p>Ministarstvo potvrđuje vanjske poveznice na digitalni cjenik i arhivu. NEPAR čuva arhivu 15 dana od zamjene, prema novom pravilniku. Provjerite svoj web i najnovija pravila.</p><p><a href="/digitalni-cjenik-2026/">Vodič za digitalni cjenik 2026.</a> · <a href="/sidrena-cijena/">Sidrene cijene: zakon i primjeri</a> · <a href="/statistika-digitalnih-cjenika/">Statistika checkera</a></p></div><a className="acq-secondary" href="/vijesti/digitalni-cjenici-novi-pravilnici-15-dana-2026/">Najnovije o pravilima<IconArrowRight size={19}/></a></section>
      <section className="acq-compact-faq" aria-labelledby="landing-faq-title"><h2 id="landing-faq-title">Česta pitanja</h2>{landingFaq.map(entry=><details key={entry.question}><summary>{entry.question}<IconChevronDown size={18}/></summary><p>{entry.answer}</p></details>)}<a href="/faq/">Sva pitanja i odgovori<IconArrowRight size={17}/></a></section>
      <footer className="acq-footer"><Wordmark/><nav aria-label="Dodatne informacije"><a href="/digitalni-cjenik-za-wordpress-webshop/">Za postojeći web</a><a href="/objava-digitalnog-cjenika/">Objava i ugradnja</a><a href="/digitalni-cjenik-za-knjigovode/">Za knjigovođe</a><a href="/faq/">Česta pitanja</a><a href="/vodici/">Vodiči</a><a href="/statistika-digitalnih-cjenika/">Statistika provjera</a><a href="/usporedba/">Usporedba mogućnosti</a><a href="/specifikacija-csv-xml/">Specifikacija CSV/XML</a><a href="/app?login=1">Prijava u dashboard</a><a href="/impressum.html">Impressum</a><a href="/privatnost.html">Privatnost</a><a href="/uvjeti.html">Uvjeti usluge</a></nav><details className="acq-resources"><summary>Vodiči i aktualne informacije</summary><nav aria-label="Vodiči i novosti"><a href="/vodici/sidrena-cijena/">Sidrena cijena</a><a href="/specifikacija-csv-xml/">CSV i XML formati</a><a href="/vodici/automatizacija-digitalnog-cjenika/">Automatizacija objave</a>{getLatestPosts(4).map(post=><a key={post.slug} href={newsArticlePath(post.slug)}>{post.widgetHeadline??post.title}</a>)}<a href="/vijesti/">Sve vijesti</a></nav></details><p>Tehnička provjera i objava digitalnog cjenika. Bez jamstva pravne usklađenosti.</p></footer>
    </div></main>
    {showSticky && !menuOpen && <div className="acq-mobile-cta"><a className="acq-primary" href="#checker" aria-label="Vrati se na besplatnu provjeru" onClick={() => document.getElementById('acq-url')?.focus({preventScroll:true})}>Provjeri besplatno<IconArrowRight size={19} aria-hidden="true"/></a></div>}
  </div>
}
