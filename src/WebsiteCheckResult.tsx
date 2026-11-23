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
  const groups=analysis.findingGroups ?? []
  const recommendations = analysis.recommendations ?? []
  return <article className="acq-document" aria-label={`${analysis.format.toUpperCase()} analiza`}>
    <header><h3>{analysis.format.toUpperCase()}</h3><span className={`acq-document-status acq-status-${analysis.status}`}>{STATUS_LABELS[analysis.status]}</span></header>
    {/* An unfetched analysis carries a guessed address (/cjenik.csv); linking it reads as "found". */}
    {analysis.fetched && analysis.url && /^https?:\/\//.test(analysis.url) && <a className="acq-document-url" href={analysis.url} target="_blank" rel="noreferrer">{analysis.url}<IconExternalLink size={15}/></a>}
    <p>{analysis.fetched ? `Dokument dohvaćen · ${stavke(analysis.itemCount)}` : `${analysis.format.toUpperCase()} nije pronađen na webu ni na uobičajenim adresama.`}</p>
    {analysis.fetched && analysis.contentType && <p><small>Poslužitelj vraća Content-Type: <code>{analysis.contentType}</code>. Pogrešno označen tip zahtijeva ručnu provjeru, ne znači automatski povredu.</small></p>}
    {analysis.publicationFilename && <p><small>Naziv preuzete datoteke: {analysis.publicationFilename}</small></p>}
    {analysis.archiveEntry && <p><strong>Datoteka u komprimiranom paketu:</strong> {analysis.archiveEntry}</p>}
    <h4>Struktura</h4>{analysis.structureReasons.map((reason, i) => <p key={i}>{reason}</p>)}
    <h4>Sadržaj</h4>
    {groups.length > 0 ? <><p className="acq-finding-count">{analysis.affectedRows ?? 0} stavki s nalazima · {analysis.totalFindings} nalaza · {groups.length} vrsta problema.</p><div className="acq-grouped-findings">{groups.map(group=><details key={group.rule+'|'+group.level}><summary><FindingLevel finding={{message:group.message,level:group.level}}/><strong>{group.affectedRows} stavki</strong> · {group.message}</summary><ul className="acq-document-findings">{group.examples.map((finding,i)=><li key={i}>{finding.itemName && <strong>„{finding.itemName}”: </strong>}{finding.message}{finding.row!=null&&<small>Redak {finding.row}</small>}</li>)}</ul></details>)}</div></> : analysis.totalFindings > 0 ? <><p className="acq-finding-count">Prikazano {findings.length} od {analysis.totalFindings} nalaza u ovoj datoteci.</p><ol className="acq-document-findings">{findings.map((finding, i) => <li key={i}><FindingLevel finding={finding}/>{finding.itemName && <strong>„{finding.itemName}”: </strong>}{finding.message}{finding.row != null && <small>Izvorni redak / stavka {finding.row}</small>}</li>)}</ol></> : <p>{analysis.contentStatus === 'pass' ? 'Nema nalaza u podržanim poljima.' : 'Sadržaj nije moguće potvrditi ovom provjerom.'}</p>}
    {recommendations.length > 0 && <div className="acq-recommendations"><h4>Preporuke (nije zakonska obveza)</h4><ul className="acq-document-findings">{recommendations.map((finding, i) => <li key={i}><FindingLevel finding={finding}/>{finding.message}</li>)}</ul></div>}
  </article>
}

const platformInstructions = {
  wordpress: { name: 'WordPress / WooCommerce', tip: 'U izborniku Izgled → Izbornici ili u uređivaču weba dodajte poveznicu „Cjenik” na početnu stranicu ili u footer. Provjerite i javni prikaz bez prijave.' },
  shopify: { name: 'Shopify', tip: 'U Online Store → Navigation dodajte poveznicu „Cjenik” u glavni izbornik ili footer. Poveznica vodi na javno dostupan CSV/XML ili stranicu objave.' },
  wix: { name: 'Wix', tip: 'U uređivaču stranice dodajte gumb ili tekstualni link „Cjenik” na početnu stranicu ili u footer i zatim objavite promjene.' },
} as const

export function WebsiteCheckResultPanel({ result, onUpload, onRetry,onHelp, website,onSelectDocument }: { result: WebsiteCheckResult; onUpload: () => void; onRetry: () => void;onHelp:()=>void; website: string;onSelectDocument?:(url:string,entry?:string)=>void }) {
  const [shareState,setShareState]=useState<'idle'|'copied'|'manual'>('idle')
  const [shareUrl,setShareUrl]=useState('')
  const [exemptions,setExemptions]=useState<string[]>([])
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
    <div className="acq-result-footer"><button type="button" className="acq-cancel" data-mobile-primary="true" onClick={onRetry}>Pokušaj ponovno<IconArrowRight size={19}/></button></div>
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
      <span>Tehnička provjera NN 132/2026-1584 i kompatibilnost ranijih datoteka ({CURRENT_PROFILE_ID}).</span>
      {result.savedReport?.checkedAt && <span>Povijesni rezultat od {new Intl.DateTimeFormat('hr-HR',{dateStyle:'short',timeStyle:'short'}).format(new Date(result.savedReport.checkedAt))} — ne predstavlja novu provjeru. <button type="button" className="workspace-button-link" onClick={onRetry}>Provjeri ponovno prema aktualnim pravilima</button></span>}
      {result.details?.renderedEvidence && <p>{result.details.renderedEvidence}</p>}
      {result.details?.publicationDateEvidence && <p><strong>Aktualnost:</strong> {result.details.publicationDateEvidence}</p>}
      {result.details?.robotsEvidence && <p><strong>Automatsko preuzimanje:</strong> {result.details.robotsEvidence} Sam robots.txt ne dokazuje stvarnu blokadu; pristup datoteci provjerava se zasebno.</p>}
    </div>
    {result.details?.visiblePrices && <section className="acq-publication-notes" aria-label="Cijene istaknute na web-stranici">
      <h3>Cijene istaknute na webu <small>— ne utječe na rezultat 9/9</small></h3>
      <p>Odvojena informativna analiza javnog HTML-a. Pronađeni iznosi nisu potvrda ispravnosti povijesnih cijena ili primjenjivosti propisa; CSV/XML objava provjerava se zasebno.</p>
      {result.details.visiblePrices.status === 'unavailable'
        ? <p>Automatski dohvat sadržaja nije uspio. Ne možemo potvrditi jesu li cijene istaknute.</p>
        : result.details.visiblePrices.rows.length === 0
          ? <p>U {result.details.visiblePrices.pagesScanned} pregledanih HTML stranica nisu prepoznati dovoljno jasno povezani nazivi i cijene. To ne dokazuje da bazna cijena nedostaje.</p>
          : <><p>Prepoznato {result.details.visiblePrices.rows.length} imenovanih stavki na {result.details.visiblePrices.pagesScanned} pregledanih HTML stranica. Provjera je ograničena na dohvaćene i čitljive stranice.</p>
            <ul className="acq-document-findings">
              {result.details.visiblePrices.rows.map((row, index) => <li key={row.url+'|'+row.name+'|'+index}>
                <strong>{row.name}</strong> — aktualna cijena {row.currentPrice.toLocaleString('hr-HR',{style:'currency',currency:'EUR'})};
                {' '}{row.basePrice !== null ? `bazna / referentna ${row.basePrice.toLocaleString('hr-HR',{style:'currency',currency:'EUR'})}` : 'bazna cijena nije jednoznačno prepoznata uz ovu stavku'}.
                {' '}{row.status === 'paired' ? 'Iznos i referentni datum pronađeni (bez potvrde povijesne točnosti).' : row.status === 'needs_review' ? 'Referentni datum nije potvrđen — ručno provjeriti.' : 'Nije dokaz neusklađenosti; provjeriti primjenjivost i javni prikaz.'}
                {row.referenceDate && <small>Referentni datum: 10. 9. 2026.</small>}
                <small>Dokaz: {row.evidence}</small>
                {/^https?:\/\//.test(row.url) && <a href={row.url} target="_blank" rel="noreferrer"> Izvorna stranica <IconExternalLink size={14}/></a>}
              </li>)}
            </ul>
          </>}
      {result.details.visiblePrices.limitation && <p>{result.details.visiblePrices.limitation}</p>}
      <p><small>Za kulturne, obrazovne i druge djelatnosti primjenjivost članka 4. NN 132/2026 potrebno je zasebno utvrditi; sama djelatnost nije automatski dokaz izuzeća.</small></p>
    </section>}
    {result.details?.platform && result.details.platform !== 'unknown' && <aside className="workspace-platform-tip">
      <strong>Upute za {platformInstructions[result.details.platform].name}</strong>
      <p>{platformInstructions[result.details.platform].tip}</p>
    </aside>}

    <div className="workspace-check-next" aria-label="Sljedeći korak nakon provjere">
      {noPriceList?<><h3>Objavite svoj prvi digitalni cjenik</h3><p>Na webu nismo pronašli strojno čitljiv cjenik (CSV ili XML), ako se na vaše poslovanje primjenjuje obveza objave, provjerite aktualne propise. Učitajte Excel, CSV ili XML u „Moj cjenik” i objavite besplatni link na 24 sata.</p></>:needsHelp?<><h3>Riješimo što nedostaje</h3><p>{result.details?.fetchBlocked?'Web ograničava automatski dohvat. Upišite izravnu adresu CSV/XML datoteke ili učitajte datoteku. Nepotvrđeno ne znači neusklađeno.':'Učitajte postojeći cjenik i provjerite podatke ili nam pošaljite upit s ovom analizom.'}</p></>:<p>Sve tehničke provjere prolaze. Za objavu ili zamjenu vlastitog cjenika otvorite svoj radni prostor.</p>}
      <div className="workspace-check-actions">{noPriceList?<><button type="button" className="acq-primary" data-mobile-primary="true" onClick={onUpload}><IconUpload size={21}/>Učitaj cjenik i objavi link</button><button type="button" className="workspace-button" onClick={onHelp}>Trebam pomoć s ovim rezultatom<IconArrowRight size={18}/></button></>:needsHelp?<><button type="button" className="acq-primary" onClick={onHelp}>Trebam pomoć s ovim rezultatom<IconArrowRight size={21}/></button><button type="button" className="workspace-button" data-mobile-primary="true" onClick={unconfirmed?onRetry:onUpload}>{unconfirmed?'Pokušaj ponovno':'Otvori moj cjenik'}<IconArrowRight size={18}/></button></>:<button type="button" className="workspace-button" data-mobile-primary="true" onClick={onUpload}>Otvori moj cjenik<IconArrowRight size={18}/></button>}</div>
    </div>
    {!result.savedReport&&!unconfirmed&&<section className="acq-weblink-offer" aria-label="Web Link ponuda"><div><p className="acq-offer-eyebrow">NEPAR WEB LINK</p><h3>Vlastiti digitalni cjenik bez izrade novog weba</h3><p>Učitajte vlastiti Excel, CSV ili XML. Nakon validacije objavite link i zamijenite datoteku kad se cijene promijene.</p><ul><li>Javni link, CSV i XML</li><li>Arhiva 15 dana od zamjene</li><li>Do {PLANS[0].highlight.replace('Do ','')}</li></ul></div><div className="acq-offer-actions"><strong>{formatEur(PLANS[0].price,true)}</strong><button type="button" className="acq-primary" onClick={onUpload}>Isprobaj besplatno 24 sata<IconArrowRight size={20}/></button><small>Bez kartice za početnu probnu objavu.</small></div></section>}
    <details className="workspace-surface"><summary>Primjenjuje li se na vas obveza objave?</summary><p>Označite okolnosti koje se odnose na cijene koje provjeravate. Ovo ne mijenja tehnički rezultat.</p><label style={{display:'flex',gap:8,marginTop:8}}><input type="checkbox" checked={exemptions.includes('0')} onChange={e=>setExemptions(current=>e.target.checked?[...current,'0']:current.filter(x=>x!=='0'))}/> Cijene uređuje poseban propis ili drugi pravni akt.</label><label style={{display:'flex',gap:8,marginTop:8}}><input type="checkbox" checked={exemptions.includes('1')} onChange={e=>setExemptions(current=>e.target.checked?[...current,'1']:current.filter(x=>x!=='1'))}/> Posebni popust samo za skupinu potrošača ili oblik plaćanja.</label><label style={{display:'flex',gap:8,marginTop:8}}><input type="checkbox" checked={exemptions.includes('2')} onChange={e=>setExemptions(current=>e.target.checked?[...current,'2']:current.filter(x=>x!=='2'))}/> Isključivo individualizirane, neusporedive cijene.</label><label style={{display:'flex',gap:8,marginTop:8}}><input type="checkbox" checked={exemptions.includes('3')} onChange={e=>setExemptions(current=>e.target.checked?[...current,'3']:current.filter(x=>x!=='3'))}/> Dinamičke cijene za koje nije moguće unaprijed utvrditi usporedive cjenovne elemente.</label><label style={{display:'flex',gap:8,marginTop:8}}><input type="checkbox" checked={exemptions.includes('4')} onChange={e=>setExemptions(current=>e.target.checked?[...current,'4']:current.filter(x=>x!=='4'))}/> Cijene na automatima ili posrednički kanal.</label><p role="status">{exemptions.length?'Označili ste '+exemptions.length+' mogućih izuzeća. Provjerite uvjete za konkretne cijene.':'Niste označili izuzeće. Ako prodajete potrošačima, provjerite primjenjivost obveze.'}</p><p>Označena okolnost može biti izuzeće za konkretne cijene ili kanal, ne nužno za cijelu djelatnost. Ako nudite i standardne cijene, provjerite ih zasebno. <a href="https://narodne-novine.nn.hr/clanci/sluzbeni/2026_11_132_1584.html" target="_blank" rel="noreferrer">Članak 4. Pravilnika</a>.</p></details>
    <ol className="acq-status-list">{report.checks.map((check) => <li key={check.id} className={`acq-status-${check.status}`}><details><summary><span className="acq-status-icon" aria-hidden="true">{(check.status === 'pass' || check.status === 'not_applicable') ? <IconCircleCheckFilled size={21}/> : <IconAlertCircle size={21}/>}</span><strong>{check.label}</strong><span className="acq-status-label">{STATUS_LABELS[check.status]}</span><IconChevronDown className="acq-disclosure" size={17} aria-hidden="true"/></summary><div className="acq-evidence"><p>{check.evidence}</p>{check.url && /^https?:\/\//.test(check.url) && <a href={check.url} target="_blank" rel="noreferrer">{check.url}<IconExternalLink size={15}/></a>}</div></details></li>)}</ol>
    {!result.savedReport && <p className="workspace-check-pricing">Za objavu vlastitog cjenika možete isprobati besplatnu 24-satnu objavu ili odabrati <a href="/cijene/">Web Link od {formatEur(PLANS[0].price,true)}</a>. Nije potvrda pravne usklađenosti.</p>}
    {result.details?.zipEvidence && <p className="acq-publication-notes">{result.details.zipEvidence}</p>}
    {!!result.details?.documentChoices?.length && onSelectDocument && <section className="acq-publication-notes"><h3>Pronađene datoteke / poslovnice</h3><p>{result.details.discoveredObjectCount? 'Najmanje '+result.details.discoveredObjectCount+' prepoznatih objekata. ':''}Prikazane su otkrivene datoteke; nisu sve analizirane. Odaberite konkretnu datoteku za novu provjeru.</p><label>Datoteka<select aria-label="Odaberi datoteku cjenika" defaultValue="" onChange={event=>{const choice=result.details?.documentChoices?.[Number(event.target.value)];if(choice)onSelectDocument(choice.url,choice.entry)}}><option value="" disabled>Odaberite cjenik…</option>{result.details.documentChoices.map((choice,index)=><option key={index} value={index}>{choice.label} · {choice.format.toUpperCase()}</option>)}</select></label></section>}
    {!!result.details?.otherDocumentUrls?.length && <section className="acq-publication-notes"><h3>Pronađene druge datoteke</h3><p>Ovo su moguće poveznice na PDF, Excel ili ZIP cjenike. Sadržaj ovih poveznica nije potpuno provjeren. Rezultat odabranog člana ZIP-a prikazan je zasebno ako je dostupan.</p><ul>{result.details.otherDocumentUrls.map(url=><li key={url}><a href={url} target="_blank" rel="noreferrer">{url}<IconExternalLink size={15}/></a></li>)}</ul></section>}
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
