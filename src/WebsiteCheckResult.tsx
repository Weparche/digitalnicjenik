import { useState } from 'react'
import { IconArrowRight,IconUpload,IconExternalLink,IconCircleCheckFilled,IconAlertCircle,IconChevronDown } from '@tabler/icons-react'
import { stavke } from '../shared/plural'
import { PLANS, formatEur } from '../shared/pricing'
import { CURRENT_PROFILE_ID } from '../shared/compliance/legal-profile'
import { STATUS_LABELS,technicalReport,type DocumentAnalysis,type DocumentFinding,type WebsiteCheckResult } from '../shared/website-check'

const LEVEL_LABELS = { error: 'Obvezni podatak', warning: 'Provjeriti', info: 'Preporuka' } as const

function FindingLevel({ finding }: { finding: DocumentFinding }) {
  return finding.level ? <span className={`acq-finding-level acq-finding-level-${finding.level}`}>{LEVEL_LABELS[finding.level]}</span> : null
}

function DocumentResult({ analysis }: { analysis: DocumentAnalysis }) {
  const findings = analysis.findings.slice(0, 20)
  const recommendations = analysis.recommendations ?? []
  return <article className="acq-document" aria-label={`${analysis.format.toUpperCase()} analiza`}>
    <header><h3>{analysis.format.toUpperCase()}</h3><span className={`acq-document-status acq-status-${analysis.status}`}>{STATUS_LABELS[analysis.status]}</span></header>
    {/* An unfetched analysis carries a guessed address (/cjenik.csv); linking it reads as "found". */}
    {analysis.fetched && analysis.url && /^https?:\/\//.test(analysis.url) && <a className="acq-document-url" href={analysis.url} target="_blank" rel="noreferrer">{analysis.url}<IconExternalLink size={15}/></a>}
    <p>{analysis.fetched ? `Dokument dohvaćen · ${stavke(analysis.itemCount)}` : `${analysis.format.toUpperCase()} nije pronađen na webu ni na uobičajenim adresama.`}</p>
    {analysis.fetched && analysis.contentType && <p><small>Poslužitelj vraća Content-Type: <code>{analysis.contentType}</code>. Pogrešno označen tip zahtijeva ručnu provjeru, ne znači automatski povredu.</small></p>}
    {analysis.publicationFilename && <p><small>Naziv preuzete datoteke: {analysis.publicationFilename}</small></p>}
    <h4>Struktura</h4>{analysis.structureReasons.map((reason, i) => <p key={i}>{reason}</p>)}
    <h4>Sadržaj</h4>
    {analysis.totalFindings > 0 ? <><p className="acq-finding-count">Prikazano {findings.length} od {analysis.totalFindings} nalaza u ovoj datoteci.</p><ol className="acq-document-findings">{findings.map((finding, i) => <li key={i}><FindingLevel finding={finding}/>{finding.itemName && <strong>„{finding.itemName}”: </strong>}{finding.message}{finding.row != null && <small>Izvorni redak / stavka {finding.row}</small>}</li>)}</ol></> : <p>{analysis.contentStatus === 'pass' ? 'Nema nalaza u podržanim poljima.' : 'Sadržaj nije moguće potvrditi ovom provjerom.'}</p>}
    {recommendations.length > 0 && <div className="acq-recommendations"><h4>Preporuke (nije zakonska obveza)</h4><ul className="acq-document-findings">{recommendations.map((finding, i) => <li key={i}><FindingLevel finding={finding}/>{finding.message}</li>)}</ul></div>}
  </article>
}

const platformInstructions = {
  wordpress: { name: 'WordPress / WooCommerce', tip: 'U izborniku Izgled → Izbornici ili u uređivaču weba dodajte poveznicu „Cjenik” na početnu stranicu ili u footer. Provjerite i javni prikaz bez prijave.' },
  shopify: { name: 'Shopify', tip: 'U Online Store → Navigation dodajte poveznicu „Cjenik” u glavni izbornik ili footer. Poveznica vodi na javno dostupan CSV/XML ili stranicu objave.' },
  wix: { name: 'Wix', tip: 'U uređivaču stranice dodajte gumb ili tekstualni link „Cjenik” na početnu stranicu ili u footer i zatim objavite promjene.' },
} as const

export function WebsiteCheckResultPanel({ result, onUpload, onRetry,onHelp, website }: { result: WebsiteCheckResult; onUpload: () => void; onRetry: () => void;onHelp:()=>void; website: string }) {
  const [shareState,setShareState]=useState<'idle'|'copied'|'manual'>('idle')
  const [shareUrl,setShareUrl]=useState('')
  async function copyShareLink() {
    if (!result.checkerRunId) return
    const url = new URL('/app',window.location.origin)
    url.search = new URLSearchParams({new:'1',tab:'provjera',report:result.checkerRunId}).toString()
    setShareUrl(url.href)
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard_unavailable')
      await navigator.clipboard.writeText(url.href)
      setShareState('copied')
    } catch { setShareState('manual') }
  }
  // Unknown host or malformed address: there is nothing to score, so no 0/9 table and no sales CTA.
  if (result.status === 'red' && result.details?.reachable !== true) return <section className="acq-result acq-tone-red" id="rezultat" aria-labelledby="result-title">
    <div className="acq-result-top"><div><h2 id="result-title">Adresa nije pronađena</h2><p>{website}</p></div></div>
    <p className="acq-result-message">{result.message} Provjerite upis (npr. vasweb.hr) i pokušajte ponovno.</p>
    <div className="acq-result-footer"><button type="button" className="acq-cancel" onClick={onRetry}>Pokušaj ponovno<IconArrowRight size={19}/></button></div>
  </section>
  const report = technicalReport(result)
  const unconfirmed = report.unknown === 9
  const noPriceList=report.checks.find(check=>check.id==='price')?.status==='missing'&&report.checks.find(check=>check.id==='machine')?.status==='missing'
  const needsHelp=report.score<9
  return <section className={`acq-result acq-tone-${report.tone}`} id="rezultat" aria-labelledby="result-title">
    <div className="acq-result-top"><div><h2 id="result-title">{unconfirmed ? 'Provjeru nije moguće dovršiti' : 'Rezultat provjere'}</h2><p>Tehnička provjera javno dostupnih podataka</p></div><div className="acq-score"><strong>{unconfirmed ? '—' : report.score}</strong><span>/ 9</span></div></div>
    <p className="acq-result-summary">{unconfirmed ? '0 potvrđenih provjera · 9 nije moguće automatski potvrditi' : <>{report.score}/9 tehničkih provjera prolazi{report.attention > 0 && ` · ${report.attention} zahtijeva pažnju`}{report.unknown > 0 && ` · ${report.unknown} nije moguće potvrditi`}</>}</p>
    {!unconfirmed && <progress max={9} value={report.score} aria-label={`${report.score} od 9 tehničkih provjera prolazi`}/>}
    <p className="acq-result-message">{website}<br/>{result.message}</p>
    <div className="workspace-check-meta">
      <span>Pravila provjere: {CURRENT_PROFILE_ID} (nacrt pravilnika nije obvezujuće pravilo)</span>
      {result.savedReport?.checkedAt && <span>Pohranjena snimka od {new Intl.DateTimeFormat('hr-HR',{dateStyle:'short',timeStyle:'short'}).format(new Date(result.savedReport.checkedAt))} — ne predstavlja novu provjeru.</span>}
      {result.details?.robotsEvidence && <p><strong>Automatsko preuzimanje:</strong> {result.details.robotsEvidence} Sam robots.txt ne dokazuje stvarnu blokadu; pristup datoteci provjerava se zasebno.</p>}
    </div>
    {result.details?.platform && result.details.platform !== 'unknown' && <aside className="workspace-platform-tip">
      <strong>Upute za {platformInstructions[result.details.platform].name}</strong>
      <p>{platformInstructions[result.details.platform].tip}</p>
    </aside>}

    <div className="workspace-check-next" aria-label="Sljedeći korak nakon provjere">
      {noPriceList?<><h3>Objavite svoj prvi digitalni cjenik</h3><p>Na webu nismo pronašli strojno čitljiv cjenik (CSV ili XML), ako se na vaše poslovanje primjenjuje obveza objave, provjerite aktualne propise. Učitajte Excel, CSV ili XML u „Moj cjenik” i objavite besplatni link na 24 sata.</p></>:needsHelp?<><h3>Riješimo što nedostaje</h3><p>Pošaljite nam upit s ovom analizom. Adresa weba i rezultat već su pripremljeni u kontaktu.</p></>:<p>Sve tehničke provjere prolaze. Za objavu ili zamjenu vlastitog cjenika otvorite svoj radni prostor.</p>}
      <div className="workspace-check-actions">{noPriceList?<><button type="button" className="acq-primary" onClick={onUpload}><IconUpload size={21}/>Učitaj cjenik i objavi link</button><button type="button" className="workspace-button" onClick={onHelp}>Trebam pomoć s ovim rezultatom<IconArrowRight size={18}/></button></>:needsHelp?<><button type="button" className="acq-primary" onClick={onHelp}>Trebam pomoć s ovim rezultatom<IconArrowRight size={21}/></button><button type="button" className="workspace-button" onClick={unconfirmed?onRetry:onUpload}>{unconfirmed?'Pokušaj ponovno':'Otvori moj cjenik'}<IconArrowRight size={18}/></button></>:<button type="button" className="workspace-button" onClick={onUpload}>Otvori moj cjenik<IconArrowRight size={18}/></button>}</div>
    </div>
    <ol className="acq-status-list">{report.checks.map((check) => <li key={check.id} className={`acq-status-${check.status}`}><details><summary><span className="acq-status-icon" aria-hidden="true">{(check.status === 'pass' || check.status === 'not_applicable') ? <IconCircleCheckFilled size={21}/> : <IconAlertCircle size={21}/>}</span><strong>{check.label}</strong><span className="acq-status-label">{STATUS_LABELS[check.status]}</span><IconChevronDown className="acq-disclosure" size={17} aria-hidden="true"/></summary><div className="acq-evidence"><p>{check.evidence}</p>{check.url && /^https?:\/\//.test(check.url) && <a href={check.url} target="_blank" rel="noreferrer">{check.url}<IconExternalLink size={15}/></a>}</div></details></li>)}</ol>
    {!result.savedReport && <p className="workspace-check-pricing">Za objavu vlastitog cjenika možete isprobati besplatnu 24-satnu objavu ili odabrati <a href="/cijene/">Web Link od {formatEur(PLANS[0].price,true)}</a>. Nije potvrda pravne usklađenosti.</p>}
    {!!result.details?.otherDocumentUrls?.length && <section className="acq-publication-notes"><h3>Pronađene druge datoteke</h3><p>Ovo su moguće poveznice na PDF ili Excel cjenike. Njihov sadržaj nije provjeren, a PDF/XLSX ne zamjenjuje traženi CSV ili XML.</p><ul>{result.details.otherDocumentUrls.map(url=><li key={url}><a href={url} target="_blank" rel="noreferrer">{url}<IconExternalLink size={15}/></a></li>)}</ul></section>}
    {(result.details?.csvAnalysis || result.details?.xmlAnalysis) && <div className="acq-document-grid">{[result.details.csvAnalysis, result.details.xmlAnalysis].map((analysis) => analysis && <DocumentResult key={analysis.format} analysis={analysis}/>)}</div>}
    {(result.details?.publicationFindings?.length ?? 0) > 0 && <section className="acq-publication-notes" aria-label="Napomene o objavi"><h3>Objava i naziv datoteke</h3><ul className="acq-document-findings">{result.details!.publicationFindings!.map((finding, i) => <li key={i}><FindingLevel finding={finding}/>{finding.message}</li>)}</ul></section>}
    <div className="acq-result-footer">
      <p>Ova provjera nije potvrda pravne usklađenosti. Arhiva ne potvrđuje potpunost ni trajanje povijesti objava. Rezultat pokazuje samo podatke dostupne u trenutku provjere.</p>
      <div className="workspace-report-actions">
        {result.checkerRunId && <button type="button" className="workspace-button" onClick={()=>void copyShareLink()}>{shareState==='copied'?'Poveznica kopirana':'Podijeli rezultat'}</button>}
        <button type="button" className="workspace-button" onClick={()=>window.print()}>Ispiši / spremi kao PDF</button>
      </div>
      {shareState==='manual' && <p className="workspace-share-fallback">Kopiranje nije dostupno. <a href={shareUrl}>Otvorite poveznicu izvještaja</a> i kopirajte je iz preglednika.</p>}
      {!unconfirmed && (report.unknown > 0 || result.status === 'unavailable') && <button type="button" className="acq-cancel" onClick={onRetry}>Pokušaj ponovno<IconArrowRight size={19}/></button>}
    </div>
  </section>
}
