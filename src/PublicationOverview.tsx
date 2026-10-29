import { useEffect,useState } from 'react'
import type { NormalizedPriceList,PricePublication,ValidationIssue } from './price-engine/types'
import { ShareAndPrintCard } from './ShareAndPrintCard'
import { INSTALLATION,formatEur } from '../shared/pricing'
import { untilLabel } from './licenceView'

export function PublicationOverview({slug,publication,list,active,onReplace}:{slug:string;publication:PricePublication|null;list:NormalizedPriceList|null;active:boolean;onReplace:()=>void}){
  const [copied,setCopied]=useState(false)
  const url=`${window.location.origin}/c/${slug}`
  return <section className="publication-overview"><h1>{active?'Vaš digitalni cjenik je aktivan':'Vaš digitalni cjenik trenutačno nije aktivan'}</h1><p><a href={url} target="_blank" rel="noreferrer">{url}</a></p><dl className="publication-facts"><div><dt>Status</dt><dd>{active?'Aktivan':'Čeka aktivaciju'}</dd></div><div><dt>Zadnja objava</dt><dd>{publication?untilLabel(publication.publishedAt):'—'}</dd></div><div><dt>Broj stavki</dt><dd>{publication?.payload.items.length??list?.items.length??0}</dd></div><div><dt>Verzija</dt><dd>{publication?.sequence??'—'}</dd></div></dl><button type="button" className="app-button app-button-primary" onClick={onReplace}>Zamijeni cjenik</button><p>Cijene promijenite u izvornom Excelu, CSV-u ili XML-u i učitajte novu datoteku. Isti link ostaje.</p><div className="publication-actions"><a href={url}>Otvori cjenik</a><a href={`${url}/cjenik.csv`}>CSV</a><a href={`${url}/cjenik.xml`}>XML</a><a href={`${url}/arhiva`}>Arhiva</a><a href={`${url}?print=1`} target="_blank" rel="noreferrer">PDF</a><button type="button" className="app-link-button" onClick={()=>void navigator.clipboard?.writeText(url).then(()=>setCopied(true))}>{copied?'Link je kopiran':'Kopiraj link'}</button></div><details><summary>QR i kod za ugradnju</summary><ShareAndPrintCard slug={slug} publicUrl={url}/></details></section>
}
export function UploadReview({list,issues,busy,blocked,onPublish,onCancel}:{list:NormalizedPriceList;issues:ValidationIssue[];busy:boolean;blocked:boolean;onPublish:()=>void;onCancel:()=>void}){
  const blocking=issues.filter(issue=>issue.severity!=='warning')
  return <section className="validation-app-panel"><h2>{blocking.length?'Ispravite izvornu datoteku i učitajte je ponovno':'Cjenik je spreman za objavu'}</h2><p>{list.items.length} stavki. Nova objava zamjenjuje cijeli cjenik; prethodna verzija ostaje u arhivi.</p>{issues.length>0&&<ul>{issues.slice(0,20).map((issue,index)=><li key={index}>{issue.row}. redak: {issue.message}</li>)}</ul>}<div className="validator-table-wrap"><table><thead><tr><th>Naziv</th><th>Vrsta</th><th>Cijena</th><th>Sidrena cijena</th></tr></thead><tbody>{list.items.slice(0,50).map((item,index)=><tr key={index}><td>{item.name}</td><td>{item.type}</td><td>{formatEur(item.price)}</td><td>{item.anchorPrice==null?'—':formatEur(item.anchorPrice)}</td></tr>)}</tbody></table></div>{list.items.length>50&&<p>Pregled prvih 50 od {list.items.length} stavki. Validacija obuhvaća cijeli cjenik.</p>}<div className="validator-actions"><button type="button" className="app-button app-button-primary" disabled={busy||blocked||blocking.length>0} onClick={onPublish}>{busy?'Objavljujemo…':'Objavi zamjenu cjenika'}</button><button type="button" className="app-button app-button-light" onClick={onCancel}>Odustani</button></div></section>
}
export function InstallationChoice({slug,onChoice}:{slug:string;onChoice?:(installation:boolean)=>void}){
  const [self,setSelf]=useState(false)
  const [sent,setSent]=useState(false)
  const [error,setError]=useState('')
  async function ask(){
    if(onChoice){onChoice(true);return}
    setError('')
    const response=await fetch('/api/publisher/upgrade',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({intent:'consultation',service:'installation',message:INSTALLATION.scope})}).catch(()=>null)
    if(response?.ok)setSent(true);else setError('Upit nije poslan. Pokušajte ponovno ili se javite na nepar@nepar.hr.')
  }
  return <section className="installation-choice"><h2>Vaš cjenik je spreman.</h2><p>Sljedeći korak: postavite ga na svoju web-stranicu.</p><div className="publication-actions"><button className="app-button app-button-light" type="button" onClick={()=>{setSelf(true);onChoice?.(false)}}>Ugradit ću sam — 0 €</button><button className="app-button app-button-primary" type="button" disabled={sent} onClick={()=>void ask()}>{sent?'Zahtjev je zaprimljen':`Neka NEPAR ugradi — ${formatEur(INSTALLATION.price)}`}</button></div>{error&&<p role="alert" className="app-error">{error}</p>}{self&&<><ShareAndPrintCard slug={slug} publicUrl={`${window.location.origin}/c/${slug}`}/><a href="/digitalni-cjenik-za-wordpress-webshop/">Upute za link, embed i redirect</a></>}</section>
}

export function OwnedArchive({slug}:{slug:string}){
  const [open,setOpen]=useState(false)
  const [page,setPage]=useState(0)
  const [versions,setVersions]=useState<Array<{id:string;sequence:number;published_at:string}>>([])
  const [error,setError]=useState('')
  useEffect(()=>{
    if(!open)return
    const controller=new AbortController()
    void fetch(`/api/tenants/${encodeURIComponent(slug)}/versions?page=${page}`,{credentials:'include',signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error('Verzije trenutačno nisu dostupne.');const data=await response.json() as {versions:typeof versions};setVersions(data.versions);setError('')}).catch(error=>{if(!controller.signal.aborted)setError(error instanceof Error?error.message:'Dohvat nije uspio.')})
    return()=>controller.abort()
  },[open,page,slug])
  return <details onToggle={event=>setOpen(event.currentTarget.open)}><summary>Vaše objavljene verzije — preuzimanje</summary><p>Preuzmite pojedinačne pohranjene CSV/XML verzije, uključujući one kojima je javni rok arhiviranja istekao.</p>{error&&<p role="alert">{error}</p>}{versions.map(version=><p key={version.id}>Verzija {version.sequence} · {untilLabel(version.published_at)} · <a href={`/api/tenants/${slug}/versions/${version.id}?format=csv`}>CSV</a> · <a href={`/api/tenants/${slug}/versions/${version.id}?format=xml`}>XML</a></p>)}<div className="publication-actions"><button type="button" disabled={page===0} onClick={()=>setPage(page-1)}>Prethodna</button><button type="button" disabled={versions.length<50} onClick={()=>setPage(page+1)}>Sljedeća</button></div></details>
}
