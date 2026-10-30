import { IconArrowRight,IconUpload,IconExternalLink,IconCircleCheckFilled,IconAlertCircle,IconChevronDown } from '@tabler/icons-react'
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
    {analysis.url && /^https?:\/\//.test(analysis.url) && <a className="acq-document-url" href={analysis.url} target="_blank" rel="noreferrer">{analysis.url}<IconExternalLink size={15}/></a>}
    <p>{analysis.fetched ? 'Dokument dohvaćen' : 'Dokument nije potvrđen'} · {analysis.itemCount} stavki</p>
    <h4>Struktura</h4>{analysis.structureReasons.map((reason, i) => <p key={i}>{reason}</p>)}
    <h4>Sadržaj</h4>
    {analysis.totalFindings > 0 ? <><p className="acq-finding-count">Prikazano {findings.length} od {analysis.totalFindings} nalaza u ovoj datoteci.</p><ol className="acq-document-findings">{findings.map((finding, i) => <li key={i}><FindingLevel finding={finding}/>{finding.itemName && <strong>„{finding.itemName}”: </strong>}{finding.message}{finding.row != null && <small>Izvorni redak / stavka {finding.row}</small>}</li>)}</ol></> : <p>{analysis.contentStatus === 'pass' ? 'Nema nalaza u podržanim poljima.' : 'Sadržaj nije moguće potvrditi ovom provjerom.'}</p>}
    {recommendations.length > 0 && <div className="acq-recommendations"><h4>Preporuke (nije zakonska obveza)</h4><ul className="acq-document-findings">{recommendations.map((finding, i) => <li key={i}><FindingLevel finding={finding}/>{finding.message}</li>)}</ul></div>}
  </article>
}

export function WebsiteCheckResultPanel({ result, onUpload, onRetry,onHelp, website }: { result: WebsiteCheckResult; onUpload: () => void; onRetry: () => void;onHelp:()=>void; website: string }) {
  const report = technicalReport(result)
  const unconfirmed = report.unknown === 9
  const noPriceList=report.checks.find(check=>check.id==='price')?.status==='missing'&&report.checks.find(check=>check.id==='machine')?.status==='missing'
  const needsHelp=report.score<9
  return <section className={`acq-result acq-tone-${report.tone}`} id="rezultat" aria-labelledby="result-title">
    <div className="acq-result-top"><div><h2 id="result-title">{unconfirmed ? 'Provjeru nije moguće dovršiti' : 'Rezultat provjere'}</h2><p>Tehnička provjera javno dostupnih podataka</p></div><div className="acq-score"><strong>{unconfirmed ? '—' : report.score}</strong><span>/ 9</span></div></div>
    <p className="acq-result-summary">{unconfirmed ? '0 potvrđenih provjera · 9 nije moguće automatski potvrditi' : <>{report.score}/9 tehničkih provjera prolazi{report.attention > 0 && ` · ${report.attention} zahtijeva pažnju`}{report.unknown > 0 && ` · ${report.unknown} nije moguće potvrditi`}</>}</p>
    {!unconfirmed && <progress max={9} value={report.score} aria-label={`${report.score} od 9 tehničkih provjera prolazi`}/>}
    <p className="acq-result-message">{website}<br/>{result.message}</p>
    <div className="workspace-check-next" aria-label="Sljedeći korak nakon provjere">
      {noPriceList?<><h3>Objavite svoj prvi digitalni cjenik</h3><p>Javni cjenik nije pronađen. Učitajte Excel, CSV ili XML u „Moj cjenik” i objavite besplatni link na 24 sata.</p></>:needsHelp?<><h3>Riješimo što nedostaje</h3><p>Pošaljite nam upit s ovom analizom. Adresa weba i rezultat već su pripremljeni u kontaktu.</p></>:<p>Sve tehničke provjere prolaze. Za objavu ili zamjenu vlastitog cjenika otvorite svoj radni prostor.</p>}
      <div className="workspace-check-actions">{noPriceList?<><button type="button" className="acq-primary" onClick={onUpload}><IconUpload size={21}/>Učitaj cjenik i objavi link</button><button type="button" className="workspace-button" onClick={onHelp}>Trebam pomoć s ovim rezultatom<IconArrowRight size={18}/></button></>:needsHelp?<><button type="button" className="acq-primary" onClick={onHelp}>Trebam pomoć s ovim rezultatom<IconArrowRight size={21}/></button><button type="button" className="workspace-button" onClick={unconfirmed?onRetry:onUpload}>{unconfirmed?'Pokušaj ponovno':'Otvori moj cjenik'}<IconArrowRight size={18}/></button></>:<button type="button" className="workspace-button" onClick={onUpload}>Otvori moj cjenik<IconArrowRight size={18}/></button>}</div>
    </div>
    <ol className="acq-status-list">{report.checks.map((check) => <li key={check.id} className={`acq-status-${check.status}`}><details><summary><span className="acq-status-icon" aria-hidden="true">{(check.status === 'pass' || check.status === 'not_applicable') ? <IconCircleCheckFilled size={21}/> : <IconAlertCircle size={21}/>}</span><strong>{check.label}</strong><span className="acq-status-label">{STATUS_LABELS[check.status]}</span><IconChevronDown className="acq-disclosure" size={17} aria-hidden="true"/></summary><div className="acq-evidence"><p>{check.evidence}</p>{check.url && /^https?:\/\//.test(check.url) && <a href={check.url} target="_blank" rel="noreferrer">{check.url}<IconExternalLink size={15}/></a>}</div></details></li>)}</ol>
    {(result.details?.csvAnalysis || result.details?.xmlAnalysis) && <div className="acq-document-grid">{[result.details.csvAnalysis, result.details.xmlAnalysis].map((analysis) => analysis && <DocumentResult key={analysis.format} analysis={analysis}/>)}</div>}
    {(result.details?.publicationFindings?.length ?? 0) > 0 && <section className="acq-publication-notes" aria-label="Napomene o objavi"><h3>Objava i naziv datoteke</h3><ul className="acq-document-findings">{result.details!.publicationFindings!.map((finding, i) => <li key={i}><FindingLevel finding={finding}/>{finding.message}</li>)}</ul></section>}
    <div className="acq-result-footer">
      <p>Ova provjera nije potvrda pravne usklađenosti. Arhiva ne potvrđuje potpunost ni trajanje povijesti objava.</p>
      {!unconfirmed && (report.unknown > 0 || result.status === 'unavailable') && <button type="button" className="acq-cancel" onClick={onRetry}>Pokušaj ponovno<IconArrowRight size={19}/></button>}
    </div>
  </section>
}
