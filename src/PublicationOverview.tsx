import { useEffect,useState } from 'react'
import type { NormalizedPriceList,PricePublication,ValidationIssue } from './price-engine/types'
import { ShareAndPrintCard } from './ShareAndPrintCard'
import { INSTALLATION,formatEur } from '../shared/pricing'
import { untilLabel } from './licenceView'
import { IconArrowUpRight,IconUpload } from '@tabler/icons-react'

export function PublicationOverview({slug,publication,list,active,onReplace}:{slug:string;publication:PricePublication|null;list:NormalizedPriceList|null;active:boolean;onReplace:()=>void}){
  const [copied,setCopied]=useState(false)
  const url=`${window.location.origin}/c/${slug}`
  return <section className="publication-overview"><div className="workspace-publication-heading"><div><h2>Vaša posljednja objava</h2><a className="workspace-url" href={url} target="_blank" rel="noreferrer">{url.replace(/^https?:\/\//,'')} <IconArrowUpRight size={15}/></a></div><button type="button" className="app-button app-button-primary" onClick={onReplace}><IconUpload size={18}/>Zamijeni cjenik</button></div><dl className="publication-facts"><div><dt>Zadnja objava</dt><dd>{publication?untilLabel(publication.publishedAt):'Još nema objave'}</dd></div><div><dt>Stavke u cjeniku</dt><dd>{publication?.payload.items.length??list?.items.length??0}</dd></div><div><dt>Verzija</dt><dd>{publication?`v${publication.sequence}`:'—'}</dd></div></dl><p>Cijene ažurirate u svojoj datoteci i učitate novu verziju. Postojeći cjenik ostaje dostupan dok ne objavite zamjenu.</p><div className="publication-actions"><a href={`${url}/cjenik.csv`}>Preuzmi CSV</a><a href={`${url}/cjenik.xml`}>Preuzmi XML</a><a href={`${url}?print=1`} target="_blank" rel="noreferrer">Ispiši / PDF</a><button type="button" className="app-link-button" onClick={()=>void navigator.clipboard?.writeText(url).then(()=>setCopied(true))}>{copied?'Link je kopiran':'Kopiraj link'}</button></div></section>
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
    const response=await fetch('/api/publisher/upgrade',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({tenant:slug,intent:'consultation',service:'installation',message:INSTALLATION.scope})}).catch(()=>null)
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
