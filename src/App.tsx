import { useEffect, useMemo, useState } from 'react'
import { adapters, isServiceItem, parseMarketinoCsv, renderCsv, renderXml, validatePriceList, type NormalizedPriceList, type PricePublication, type ValidationIssue } from './price-engine'

const money = (value: number) => new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(value)
const dateTime = (value: string) => new Intl.DateTimeFormat('hr-HR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
const slugFromPath = () => window.location.pathname.match(/^\/c\/([^/]+)/)?.[1]
const platformHost = () => ['localhost', '127.0.0.1', 'digitalnicjenik.nepar.hr'].includes(window.location.hostname) || window.location.hostname.endsWith('.pages.dev')
const isCustomPublication = () => !platformHost() && (window.location.pathname === '/' || window.location.pathname.startsWith('/arhiva'))

function download(text: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function Logo() {
  return <a className="logo" href="/" aria-label="NEPAR Publisher početna"><span className="logo-mark">N</span><span>NEPAR <i>publisher</i></span></a>
}

function Arrow() { return <span className="arrow" aria-hidden="true">↘</span> }

function PublisherFlow() {
  return <section className="publisher-flow" aria-label="NEPAR Publisher workflow">
    {['UČITAJ', 'PROVJERI', 'DOPUNI', 'OBJAVI', 'AKTUALNO + ARHIVA'].map((step, index) => <div className="publisher-step" key={step}><span>0{index + 1}</span><strong>{step}</strong>{index < 4 && <Arrow />}</div>)}
  </section>
}

function PublicPriceList({ slug, customHost = false }: { slug?: string; customHost?: boolean }) {
  const [list, setList] = useState<NormalizedPriceList | null>(null)
  const [publications, setPublications] = useState<PricePublication[]>([])
  const [error, setError] = useState('')
  const isArchive = window.location.pathname.includes('/arhiva')
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const endpoint = customHost ? '/api/publication/current' : '/api/tenants/' + slug
        const response = await fetch(endpoint)
        if (!response.ok) throw new Error('Cjenik nije dostupan.')
        const payload = await response.json() as { priceList?: NormalizedPriceList; publication?: PricePublication; publications?: PricePublication[] }
        const nextList = payload.priceList ?? payload.publication?.payload
        if (!nextList) throw new Error('Nema objavljene verzije.')
        if (!cancelled) {
          setList(nextList)
          setPublications(payload.publications ?? [])
        }
        if (customHost && isArchive) {
          const archive = await fetch('/api/publication/archive')
          if (archive.ok) setPublications((await archive.json() as { publications: PricePublication[] }).publications ?? [])
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Cjenik nije dostupan.')
      }
    })()
    return () => { cancelled = true }
  }, [customHost, slug, isArchive])
  if (error) return <main className="public-shell"><div className="public-top"><Logo /><span className="public-badge">PUBLICATION ERROR</span></div><div className="public-not-found"><p className="eyebrow">NEPAR PUBLISHER</p><h1>Cjenik trenutno nije dostupan.</h1><p>{error}</p></div></main>
  if (!list) return <main className="public-shell"><div className="loading-state">Učitavam objavljeni cjenik…</div></main>
  const grouped = Object.entries(list.items.reduce<Record<string, NormalizedPriceList['items']>>((groups, item) => { const key = item.category || 'Usluge'; (groups[key] ||= []).push(item); return groups }, {}))
  const demo = slug === 'patrisa-sisa'
  const currentPublication = publications.find((publication) => publication.isCurrent)
  return <main className="public-shell">
    <div className="public-top"><Logo /><span className="public-badge">{demo ? 'DEMO PODACI' : isArchive ? 'JAVNA ARHIVA' : 'AKTUALNI CJENIK'}</span></div>
    <header className="public-header"><p className="eyebrow">NEPAR PUBLISHER</p><h1>{list.tenant.name}</h1><p className="public-updated">Zadnje objavljeno: {dateTime(list.updatedAt)}</p>{demo && <p className="public-demo-note">Demo podaci — ovo nije stvarni cjenik salona.</p>}</header>
    {isArchive ? <section className="public-list public-archive" aria-label="Javna arhiva cjenika"><div className="public-list-title"><span>Arhiva objavljenih verzija</span><span className="item-count">{publications.length} verzija</span></div>{publications.map((publication) => <div className="public-archive-item" key={publication.id}><div><strong>{publication.isCurrent ? 'Aktualno · ' : ''}{dateTime(publication.publishedAt)}</strong><small>{publication.filenameStem}</small></div><div className="archive-links"><a href={'/' + publication.filenameStem + '.csv'}>CSV</a><a href={'/' + publication.filenameStem + '.xml'}>XML</a></div></div>)}<p className="public-archive-note">Prethodne objavljene verzije ostaju javno dostupne najmanje 30 dana od trenutka zamjene.</p></section> : <section className="public-list" aria-label="Aktualni digitalni cjenik">
      <div className="public-list-title"><span>Aktualni digitalni cjenik</span><span className="item-count">{list.items.length} stavki</span></div>
      {grouped.map(([category, items]) => <section className="price-group" key={category}><h2>{category}</h2>{items.map((item) => <div className="public-row" key={item.externalId || item.name}><div><strong>{item.name}</strong><small>{item.specialSaleApplied === true ? 'Poseban oblik prodaje: ' + (item.specialSaleName || 'potvrđeno') : ''}{item.anchorPrice != null ? (item.specialSaleApplied === true ? ' · ' : '') + 'Sidrena cijena: ' + money(item.anchorPrice) : ''}</small></div><div className="public-price">{item.salePrice != null && <del>{money(item.price)}</del>}<strong>{money(item.salePrice ?? item.price)}</strong></div></div>)}</section>)}
    </section>}
    {!isArchive && <section className="public-links"><div><strong>Aktualni digitalni cjenik</strong><span><a href={currentPublication ? '/' + currentPublication.filenameStem + '.csv' : '/cjenik.csv'}>{currentPublication ? currentPublication.filenameStem + '.csv' : 'Preuzmi CSV'}</a>{currentPublication && <a href={'/' + currentPublication.filenameStem + '.xml'}>{currentPublication.filenameStem + '.xml'}</a>}</span></div><div><strong>Stable URL za automatizirani dohvat</strong><span><a href="/cjenik.csv">cjenik.csv</a><a href="/cjenik.xml">cjenik.xml</a></span></div></section>}
    <footer className="public-footer"><span>Pokreće NEPAR Publisher</span>{!isArchive && <a href={(customHost ? '/arhiva/' : '/c/' + slug + '/arhiva')}>Arhiva</a>}<a href={customHost ? '/cjenik.csv' : '/c/' + slug + '/cjenik.csv'}>CSV</a><a href={customHost ? '/cjenik.xml' : '/c/' + slug + '/cjenik.xml'}>XML</a></footer>
  </main>
}

function ValidationSummary({ issues, itemCount }: { issues: ValidationIssue[]; itemCount: number }) {
  const blockers = issues.filter((issue) => issue.severity !== 'warning').length
  const warnings = issues.filter((issue) => issue.severity === 'warning').length
  return <div className="validation-summary" role="status"><strong>{itemCount} stavki učitano</strong><span className={blockers ? 'has-issue' : 'is-good'}>{blockers ? '⚠ ' + blockers + ' za dopunu' : '✓ Sve spremno'}</span>{warnings > 0 && <span>⚠ {warnings} upozorenja</span>}{issues.length > 0 && <ul className="validation-issue-list">{issues.slice(0, 6).map((issue) => <li key={issue.row + '-' + issue.field + '-' + issue.itemKey}><b>{issue.severity === 'manual_review' ? 'RUČNI PREGLED' : issue.severity === 'error' ? 'GREŠKA' : 'UPOZORENJE'}</b>{issue.message}</li>)}</ul>}{issues.some((issue) => issue.field === 'specialSaleApplied') && <button className="text-button validation-group-button" type="button" onClick={() => window.dispatchEvent(new Event('nepar:confirm-no-special-sale'))}>Grupno potvrdi: nije poseban oblik prodaje <span>→</span></button>}</div>
}

function Pricing() {
  return <section className="pricing-section" id="pricing"><div className="section-heading"><p className="eyebrow">JASNA PONUDA / 02</p><h2>Od besplatne provjere<br /><em>do cjenika na vašem webu.</em></h2><p>Odaberite koliko posla želite prepustiti NEPAR-u. Nema skrivenog broja objava ni tehničkog žargona.</p></div><div className="pricing-lead"><div><span className="pricing-kicker">NAJČEŠĆI IZBOR</span><h3>Sve ćemo vam postaviti — od 129 €</h3><p>Digitalni cjenik na vašem webu, objava, arhiva i prvih 12 mjeseci Publishera uključeni.</p></div><a className="button button-amber" href="#demo">Zatraži postavljanje <span>→</span></a></div><div className="pricing-grid"><article><span>01 / BESPLATNO</span><h3>Validator</h3><strong>0 €</strong><p>Upload, provjera i preview bez objave.</p></article><article className="pricing-featured"><span>02 / SAMOSTALNO</span><h3>Publisher</h3><strong>49 €/god</strong><p>Samostalni upload, provjera, neograničene objave, hosting, CSV/XML izlazi i arhiva.</p></article><article><span>03 / ODRŽAVANJE</span><h3>Managed</h3><strong>149 €/god</strong><p>NEPAR provjerava, objavljuje i prati uobičajene izmjene postojećeg cjenika.</p></article></div><div className="pricing-details"><span>WordPress ključ u ruke 149 €</span><span>Custom / Wix / Google Sites od 169 €</span><span>Vizualni HTML cjenik +49 €</span><span>Ručna izmjena 39 € · Hitna 69 €</span><span>AutoSync uskoro · 79 €/god ili 7,90 €/mj</span></div></section>
}

function PublisherWorkspace() {
  const [list, setList] = useState<NormalizedPriceList | null>(null)
  const [draftId, setDraftId] = useState('')
  const [issues, setIssues] = useState<ValidationIssue[]>([])
  const [sourceFilename, setSourceFilename] = useState('')
  const [step, setStep] = useState<'upload' | 'validate' | 'complete' | 'published'>('upload')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [publication, setPublication] = useState<PricePublication | null>(null)
  const [message, setMessage] = useState('')
  const validation = useMemo(() => list ? validatePriceList(list) : { status: 'invalid' as const, issues, blockingCount: issues.length, warningCount: 0 }, [list, issues])
  useEffect(() => {
    const confirmGroup = () => {
      if (!window.confirm('Potvrdite da nijedna akcijska cijena nije primijenjena tijekom posebnog oblika prodaje.')) return
      setList((current) => current ? { ...current, items: current.items.map((item) => item.salePrice != null ? { ...item, specialSaleApplied: false, specialSaleName: null } : item) } : current)
    }
    window.addEventListener('nepar:confirm-no-special-sale', confirmGroup)
    return () => window.removeEventListener('nepar:confirm-no-special-sale', confirmGroup)
  }, [])
  const updateItem = (index: number, patch: Partial<NormalizedPriceList['items'][number]>) => setList((current) => current ? { ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) } : current)

  async function loadDemo() {
    setError(''); setMessage(''); setBusy(true)
    try {
      const response = await fetch('/api/tenants/nepar')
      if (!response.ok) throw new Error('local')
      const payload = await response.json() as { priceList: NormalizedPriceList }
      setList(payload.priceList); setStep('published'); setSourceFilename('marketino-artikli.csv'); return
    } catch {
      const loaded = await adapters.nepar.load()
      setList(loaded); setStep('published'); setSourceFilename('marketino-artikli.csv')
    } finally { setBusy(false) }
  }

  async function loadFile(file?: File) {
    if (!file) return
    setError(''); setMessage(''); setBusy(true)
    try {
      const raw = await file.text()
      const parsed = parseMarketinoCsv(raw, { id: 'nepar', slug: 'nepar', name: 'NEPAR' })
      setList(parsed.priceList); setIssues([]); setSourceFilename(file.name); setStep('validate')
      const result = validatePriceList(parsed.priceList)
      setIssues(result.issues)
      const response = await fetch('/api/validator/validate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ csv: raw }) })
      if (response.ok) { const remote = await response.json() as { validation: { issues: ValidationIssue[] } }; setIssues(remote.validation.issues) }
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'CSV se ne može učitati.') } finally { setBusy(false) }
  }

  async function createRemoteDraft() {
    if (!list) return null
    const response = await fetch('/api/tenants/nepar/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ csv: renderCsv(list), name: 'NEPAR', sourceFilename }) })
    if (!response.ok) throw new Error((await response.json() as { error?: string }).error || 'Draft nije spremljen.')
    const payload = await response.json() as { draft: { id: string }; validation: { issues: ValidationIssue[] } }
    setDraftId(payload.draft.id); setIssues(payload.validation.issues)
    return payload.draft.id
  }

  async function saveDraft() {
    if (!list) return
    setBusy(true); setError(''); setMessage('')
    try {
      let idToSave = draftId
      if (!idToSave) idToSave = await createRemoteDraft() || ''
      if (idToSave) {
        const response = await fetch('/api/tenants/nepar/draft/' + idToSave, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ priceList: list }) })
        if (!response.ok) throw new Error((await response.json() as { error?: string }).error || 'Dopuna nije spremljena.')
        const payload = await response.json() as { validation: { issues: ValidationIssue[] } }
        setIssues(payload.validation.issues)
      } else setIssues(validatePriceList(list).issues)
      setStep('complete')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Dopuna nije uspjela.') } finally { setBusy(false) }
  }

  async function publish() {
    if (!list || validation.blockingCount > 0) return
    setBusy(true); setError(''); setMessage('')
    try {
      let idToPublish = draftId
      if (!idToPublish) idToPublish = await createRemoteDraft() || ''
      if (!idToPublish) throw new Error('Za objavu pokrenite Cloudflare Pages lokalni server.')
      const response = await fetch('/api/tenants/nepar/publish', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ draftId: idToPublish }) })
      const payload = await response.json() as { error?: string; message?: string; publication?: PricePublication }
      if (!response.ok) throw new Error(payload.error || 'Objava nije uspjela.')
      setPublication(payload.publication ?? null); setMessage(payload.message || 'Cjenik je objavljen.'); setStep('published')
      const current = await fetch('/api/tenants/nepar').then((item) => item.json()) as { priceList: NormalizedPriceList }
      setList(current.priceList)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Objava nije uspjela.') } finally { setBusy(false) }
  }

  const canPublish = list && validation.blockingCount === 0
  return <section className="demo-section" id="demo"><div className="section-heading"><p className="eyebrow">BESPLATNA PROVJERA / 01</p><h2>Učitajte cjenik.<br /><em>Mi ćemo vam reći što nedostaje.</em></h2><p>Učitajte Marketino CSV, pregledajte rezultate i dopunite samo podatke koji su potrebni za objavu.</p></div><PublisherFlow /><div className="source-picker"><button className={'source-choice ' + (step === 'published' ? 'selected' : '')} onClick={loadDemo} disabled={busy}><span className="choice-number">01</span><span><strong>Otvori demo cjenik</strong><small>Javno objavljena demonstracija</small></span><span className="choice-arrow">↗</span></button><label className={'source-choice file-choice ' + (step !== 'published' && list ? 'selected' : '')}><span className="choice-number">02</span><span><strong>Učitaj Marketino CSV</strong><small>Upload, provjera i preview</small></span><span className="choice-arrow">↗</span><input type="file" accept=".csv,text/csv" onChange={(event) => loadFile(event.target.files?.[0])} /></label><div className="source-choice upcoming"><span className="choice-number">03</span><span><strong>AutoSync <em>USKORO</em></strong><small>Marketino / NeoSalon feed</small></span><span className="choice-arrow">→</span></div></div>{busy && <div className="inline-status" role="status"><span className="status-dot" /> Obrada cjenika…</div>}{error && <div className="error-box" role="alert"><strong>Potrebna je pažnja</strong><span>{error}</span></div>}{list && step !== 'published' && <div className="preview-panel"><div className="preview-head"><div><p className="eyebrow">PROVJERA / DOPUNA</p><h3>Podaci prije objave</h3></div><ValidationSummary issues={validation.issues} itemCount={list.items.length} /></div><div className="table-wrap"><table><thead><tr><th>Naziv</th><th>Maloprodajna</th><th>Sidrena</th><th>Posebna prodaja</th></tr></thead><tbody>{list.items.map((item, index) => <tr key={item.externalId || item.name}><td><strong>{item.name}</strong><small>{item.type || 'Vrsta nije navedena'}</small></td><td>{money(item.price)}</td><td><input className="table-input" aria-label={'Sidrena cijena za ' + item.name} type="number" min="0.01" step="0.01" value={item.anchorPrice ?? ''} onChange={(event) => updateItem(index, { anchorPrice: event.target.value ? Number(event.target.value) : null })} /></td><td>{item.salePrice != null ? <div className="sale-fields"><label><input type="checkbox" checked={item.specialSaleApplied === true} onChange={(event) => updateItem(index, { specialSaleApplied: event.target.checked, specialSaleName: event.target.checked ? item.specialSaleName : null })} /> potvrđeno</label>{item.specialSaleApplied === true && <input className="table-input" aria-label={'Naziv posebne prodaje za ' + item.name} value={item.specialSaleName ?? ''} placeholder="Naziv oblika" onChange={(event) => updateItem(index, { specialSaleName: event.target.value })} />}</div> : <span className="muted-cell">Nije navedeno</span>}</td></tr>)}</tbody></table></div><p className="validation-note">{validation.blockingCount ? 'Objava je zaključana dok se ne riješe označene stavke.' : 'Cjenik je spreman za objavu.'}</p><div className="preview-actions"><button className="button button-dark" onClick={saveDraft} disabled={busy}>Spremi dopune <span>→</span></button><button className="button button-amber" onClick={publish} disabled={!canPublish || busy}>Objavi novi cjenik <span>→</span></button></div></div>}{list && step === 'published' && <div className="published-panel" role="status"><div><span className="status-dot" /><strong>Aktualni cjenik je objavljen</strong><p>{publication ? publication.filenameStem + '.csv / .xml' : 'Stable current alias i javna arhiva su aktivni.'}</p></div><a className="button button-amber" href="/c/nepar">Otvori cjenik <span>↗</span></a></div>}{message && <p className="success-line">{message}</p>}</section>
}

function Landing() {
  return <div className="app-shell"><header className="site-header"><Logo /><nav><a href="#workflow">Kako radi</a><a href="#demo">Provjeri CSV</a><a href="#pricing">Cijene</a></nav><a className="header-cta" href="#demo">Besplatno provjeri <span>→</span></a></header><main>
    <section className="hero"><div className="hero-copy"><p className="eyebrow">NEPAR PUBLISHER <span className="eyebrow-rule" /></p><h1>Sve ćemo vam postaviti — <em>od 129 €.</em></h1><p className="hero-sub">Digitalni cjenik na vašem webu, objava, arhiva i prvih 12 mjeseci Publishera uključeni. Ili ga sami održavajte za 49 €/god.</p><div className="hero-actions"><a className="button button-amber" href="#demo">Besplatno provjeri CSV <span>→</span></a><a className="button button-outline" href="#pricing">Pogledaj opcije <span>↘</span></a></div><p className="hero-note"><span className="status-dot" /> CSV upload, validacija i preview su besplatni.</p></div><div className="hero-visual" aria-label="Vizualni prikaz toka CSV datoteke do objavljenog cjenika"><picture className="visual-asset"><source media="(max-width: 520px)" srcSet="/assets/nepar-orchestration-mobile.webp" /><img src="/assets/nepar-orchestration-desktop.webp" alt="CSV dokument prolazi kroz provjeru i postaje javni digitalni cjenik" /></picture><div className="visual-top"><span>PUBLICATION / READY</span><span>NP—001</span></div><div className="visual-grid" /><div className="visual-core"><span className="core-ring ring-one" /><span className="core-ring ring-two" /><span className="core-ring ring-three" /><div className="core-label"><span>NEPAR</span><strong>PUBLISH<br />READY</strong></div></div><div className="visual-rail rail-source"><span>01 / INPUT</span><strong>CSV EXPORT</strong><i /></div><div className="visual-rail rail-web"><span>02 / OUTPUT</span><strong>WEB</strong><i /></div><div className="visual-rail rail-csv"><span>03 / OUTPUT</span><strong>CSV · XML · ARHIVA</strong><i /></div><div className="visual-readout"><span>LAST EVENT</span><strong>PUBLICATION.CREATED</strong><b>●</b></div></div></section>
    <section className="proof-strip"><span>Učitajte jednom</span><span>→</span><strong>objavite ispravno</strong><span className="proof-fade">i čuvajte svaku verziju</span></section>
    <section className="engine-section" id="workflow"><div className="section-heading"><p className="eyebrow">JEDNOSTAVAN WORKFLOW</p><h2>Vaš poslovni sustav<br /><em>ostaje izvor istine.</em></h2><p>NEPAR provjerava podatke koje već imate, pomaže popuniti što nedostaje i objavljuje ih na pravom mjestu.</p></div><div className="interactive-flow"><PublisherFlow /><div className="workflow-explanation"><div><strong>Validator</strong><span>Besplatna provjera bez objave.</span></div><Arrow /><div><strong>Publisher</strong><span>Jedna immutable verzija po objavi.</span></div><Arrow /><div><strong>Arhiva</strong><span>Aktualna i prethodne verzije na dohvat.</span></div></div></div></section>
    <PublisherWorkspace /><Pricing />
  </main><footer className="site-footer"><Logo /><span>NEPAR Publisher / MVP</span><a href="/c/nepar">Javni demo cjenik ↗</a></footer></div>
}

export default function App() {
  const slug = slugFromPath()
  if (slug) return <PublicPriceList slug={slug} />
  if (isCustomPublication()) return <PublicPriceList customHost />
  return <Landing />
}
