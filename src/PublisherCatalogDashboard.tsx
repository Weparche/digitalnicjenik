import {useEffect,useState} from 'react'
import {IconArrowUpRight,IconFileText,IconPlus,IconRefresh} from '@tabler/icons-react'
import {BusinessProfilesPanel} from './BusinessProfiles'
import {untilLabel} from './licenceView'
import type {PublisherTenant} from './PublisherAuth'

export type CatalogSummary={id:string;slug:string;name:string;merchantIdentifier:string|null;merchantType:'legal'|'natural'|null;objectCode:string|null;objectAddress:string|null;publishedAt:string|null;sequence:number|null;itemCount:number|null;formatVersion:string|null;plan:string|null;accessState:string;accessUntil:string|null;publicLive:boolean}
export function groupCatalogs(catalogs:CatalogSummary[]){
  const groups=new Map<string,{label:string;catalogs:CatalogSummary[]}>()
  for(const catalog of catalogs){
    const identified=Boolean(catalog.merchantIdentifier&&catalog.merchantType)
    const key=identified?catalog.merchantType+':'+catalog.merchantIdentifier:'unassigned'
    const label=identified?(catalog.merchantType==='legal'?'OIB':'Matični broj')+': '+catalog.merchantIdentifier:'Bez potvrđenog identifikatora trgovca'
    const group=groups.get(key)??{label,catalogs:[]}
    group.catalogs.push(catalog);groups.set(key,group)
  }
  return [...groups.entries()].map(([key,value])=>({key,...value}))
}
function status(c:CatalogSummary){
  if(!c.publishedAt)return 'Nema objave'
  if(!c.publicLive)return 'Javni link nije aktivan'
  if(c.accessState==='grace')return 'Obnova čeka uplatu'
  if(c.accessState==='trial')return 'Probna objava'
  if(c.formatVersion!=='nn-132-2026')return 'Potreban novi format'
  return 'Objavljen'
}
export function PublisherCatalogDashboard({tenants}:{tenants:PublisherTenant[]}){
  const [catalogs,setCatalogs]=useState<CatalogSummary[]|null>(null)
  const [error,setError]=useState('')
  const [attempt,setAttempt]=useState(0)
  const [query,setQuery]=useState('')
  const [onlyAttention,setOnlyAttention]=useState(false)
  useEffect(()=>{
    const controller=new AbortController()
    setError('');setCatalogs(null)
    void fetch('/api/publisher/catalogs',{credentials:'include',cache:'no-store',signal:controller.signal})
      .then(async response=>{if(!response.ok)throw new Error('Pregled cjenika trenutačno nije dostupan.');return response.json() as Promise<{catalogs:CatalogSummary[]}>})
      .then(data=>{if(!controller.signal.aborted)setCatalogs(data.catalogs)})
      .catch(()=>{if(!controller.signal.aborted)setError('Pregled cjenika trenutačno nije dostupan.')})
    return()=>controller.abort()
  },[attempt])
  const attention=(c:CatalogSummary)=>!c.publicLive||c.accessState==='grace'||c.accessState==='trial'||c.formatVersion!=='nn-132-2026'
  const filtered=(catalogs??[]).filter(c=>(!onlyAttention||attention(c))&&[c.name,c.slug,c.objectCode,c.objectAddress,c.merchantIdentifier].some(s=>s?.toLocaleLowerCase('hr').includes(query.trim().toLocaleLowerCase('hr'))))
  const groups=groupCatalogs(filtered)
  const addUrl=tenants.length?'/app?new=1&add=1&tab=cjenik':'/app?new=1&tab=cjenik'
  return <div className="catalog-dashboard">
    <BusinessProfilesPanel/>
    <section className="workspace-surface catalog-intro"><div><h2>Upravljajte svim cjenicima na jednom mjestu</h2><p>Svaka poslovnica, web ili zasebna ponuda ima svoj javni link, arhivu i licencu.</p></div><a className="app-button app-button-primary" href={addUrl}><IconPlus size={19}/>Dodaj cjenik</a></section>
    {catalogs&&<><div className="catalog-metrics" aria-label="Sažetak cjenika">
      <div><span>Cjenici</span><strong>{catalogs.length}</strong></div><div><span>Objavljeni i dostupni</span><strong>{catalogs.filter(c=>c.publicLive).length}</strong></div><div><span>Za pregled</span><strong>{catalogs.filter(attention).length}</strong></div>
    </div><div className="catalog-filter"><label>Pretraži cjenike<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Naziv, oznaka ili adresa"/></label><label className="catalog-check"><input type="checkbox" checked={onlyAttention} onChange={e=>setOnlyAttention(e.target.checked)}/>Samo za pregled</label><button type="button" className="workspace-button" onClick={()=>setAttempt(n=>n+1)}><IconRefresh size={17}/>Osvježi</button></div></>}
    {error&&<section className="workspace-surface"><p role="alert">{error}</p><button className="workspace-button" onClick={()=>setAttempt(n=>n+1)}>Pokušaj ponovno</button>{tenants.map(t=><p key={t.id}><a href={'/app?tenant='+encodeURIComponent(t.slug)+'&tab=cjenik'}>{t.name}</a></p>)}</section>}
    {!catalogs&&!error&&<p role="status">Učitavamo cjenike…</p>}
    {catalogs?.length===0&&<section className="workspace-surface"><h2>Još nemate cjenik</h2><p>Učitajte prvi CSV ili XML i pripremite javnu objavu.</p><a className="workspace-button" href={addUrl}>Pripremi prvi cjenik</a></section>}
    {catalogs&&catalogs.length>0&&!filtered.length&&<p role="status">Nema cjenika koji odgovaraju pretrazi.</p>}
    {groups.map(group=><section className="catalog-group" key={group.key}><h2>{group.label} <span>· {group.catalogs.length}</span></h2><div className="catalog-grid">{group.catalogs.map(c=>{
      const url='/c/'+encodeURIComponent(c.slug)
      const edit='/app?tenant='+encodeURIComponent(c.slug)
      return <article className="workspace-surface catalog-card" key={c.id}><div className="catalog-card-heading"><IconFileText size={25}/><div><h3>{c.name}</h3><p>{c.objectCode?'Oznaka '+c.objectCode+' · ':''}{c.objectAddress||c.slug}</p></div></div><span className={'catalog-status'+(attention(c)?' catalog-attention':'')}>{status(c)}</span><dl className="catalog-facts"><div><dt>Stavke</dt><dd>{c.itemCount??'—'}</dd></div><div><dt>Verzija</dt><dd>{c.sequence??'—'}</dd></div><div><dt>Zadnja objava</dt><dd>{c.publishedAt?untilLabel(c.publishedAt):'—'}</dd></div></dl><div className="catalog-actions"><a className="app-button app-button-primary" href={edit+'&tab=cjenik'}>Uredi cjenik</a><a className="workspace-button" href={edit+'&tab=objava'}>Objava i arhiva</a>{c.publicLive&&<a className="workspace-button" href={url} target="_blank" rel="noreferrer">Javni link <IconArrowUpRight size={16}/></a>}</div></article>
    })}</div></section>)}
  </div>
}
