import {useEffect,useMemo,useRef,useState} from 'react'
import {formatEur} from '../shared/pricing'
import {HISTORY_BATCH_SIZE,historyIdentity,localTime,zagrebTimeToIso,type HistoryResult} from '../shared/price-history'
import type {NormalizedPriceItem} from './price-engine/types'

type Reply={window:{from:string;to:string};results:HistoryResult[];truncated:boolean}
const dateLabel=(value:string)=>new Intl.DateTimeFormat('hr-HR',{timeZone:'Europe/Zagreb',dateStyle:'short',timeStyle:'short'}).format(new Date(value))
export function PriceHistoryPanel({slug,items,onApply}:{slug:string;items:NormalizedPriceItem[];onApply?:(values:Record<number,number>)=>void}){
 const [open,setOpen]=useState(false)
 const [start,setStart]=useState(()=>localTime(new Date()).slice(0,16))
 const [filter,setFilter]=useState(onApply?'sale':'all')
 const [search,setSearch]=useState('')
 const [page,setPage]=useState(0)
 const [reply,setReply]=useState<{key:string;data:Reply}|null>(null)
 const [confirmed,setConfirmed]=useState(false)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const controller=useRef<AbortController|null>(null)
 const counts=useMemo(()=>{const m=new Map<string,number>();items.forEach(x=>{const k=historyIdentity(x).key;m.set(k,(m.get(k)??0)+1)});return m},[items])
 const selected=useMemo(()=>items.map((item,index)=>({item,index})).filter(({item})=>(filter!=='sale'||item.specialSaleApplied===true)&&(!search||[item.name,item.externalId,item.eanBarcode,item.barcode].some(x=>x?.toLocaleLowerCase('hr-HR').includes(search.toLocaleLowerCase('hr-HR'))))),[items,filter,search])
 const effectivePage=Math.min(page,Math.max(0,Math.ceil(selected.length/HISTORY_BATCH_SIZE)-1))
 const batch=selected.slice(effectivePage*HISTORY_BATCH_SIZE,(effectivePage+1)*HISTORY_BATCH_SIZE)
 const key=JSON.stringify([slug,start,batch.map(({item,index})=>[index,item.name,item.type,item.externalId,item.eanBarcode,item.barcode,item.price,item.salePrice,item.specialSaleApplied,item.lowest30DayPrice])])
 const data=reply?.key===key?reply.data:null
 useEffect(()=>{controller.current?.abort();setBusy(false);setConfirmed(false);setError('');return()=>controller.current?.abort()},[key])
 async function calculate(){
   setError('');setConfirmed(false);setReply(null)
   let iso:string
   try{iso=zagrebTimeToIso(start)}catch(e){setError((e as Error).message);return}
   controller.current?.abort()
   const request=new AbortController();controller.current=request;setBusy(true)
   try{
     const response=await fetch('/api/tenants/'+encodeURIComponent(slug)+'/price-history',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({start:iso,items:batch.map(x=>x.item)}),signal:request.signal})
     const result=await response.json()
     if(!response.ok)throw new Error(result.error||'Izračun nije dostupan.')
     if(!request.signal.aborted)setReply({key,data:result as Reply})
   }catch(e){if(!request.signal.aborted)setError(e instanceof Error?e.message:'Izračun nije uspio.')}
   finally{if(!request.signal.aborted)setBusy(false)}
 }
 const applicable:Record<number,number>={}
 if(data)for(const result of data.results){
   const row=batch[result.index];if(!row)continue
   if(result.status==='complete'&&result.lowest!=null&&(counts.get(result.key)??0)===1&&row.item.specialSaleApplied===true&&row.item.lowest30DayPrice==null)applicable[row.index]=result.lowest
 }
 return <details className="workspace-surface price-history-panel" open={open} onToggle={e=>setOpen(e.currentTarget.open)}>
  <summary>Najniža cijena u prethodnih 30 dana</summary>
  {open&&<div className="price-history-content">
   <p>Privatna evidencija iz svih objavljenih verzija, uključujući one izvan javne arhive od 15 dana. Ne uključuje cijene koje niste objavili u NEPAR-u.</p>
   <p>Odaberite stvarni početak posebnog oblika prodaje. Za akciju koja već traje unesite njezin izvorni početak, ne današnji datum. Kod rasprodaje ili sezonskog sniženja koje se nastavlja provjerite primjenjivu referentnu cijenu.</p>
   <label>Početak akcije (hrvatsko vrijeme)<input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)} max={localTime(new Date()).slice(0,16)}/></label>
   <label>Prikaži stavke<select value={filter} onChange={e=>{setFilter(e.target.value);setPage(0)}}><option value="all">Sve stavke</option><option value="sale">Samo stavke s posebnom prodajom</option></select></label>
   <label>Pretraži stavke<input value={search} onChange={e=>{setSearch(e.target.value);setPage(0)}} placeholder="Naziv, šifra ili barkod"/></label>
   <div className="publication-actions"><button type="button" className="app-button app-button-primary" disabled={busy||!batch.length||!start} onClick={()=>void calculate()}>{busy?'Izračunavamo…':'Izračunaj najniže cijene'}</button><button type="button" className="app-button app-button-light" disabled={effectivePage===0||busy} onClick={()=>setPage(effectivePage-1)}>Prethodne</button><button type="button" className="app-button app-button-light" disabled={(effectivePage+1)*HISTORY_BATCH_SIZE>=selected.length||busy} onClick={()=>setPage(effectivePage+1)}>Sljedeće</button></div>
   <p>Prikaz {selected.length?effectivePage*HISTORY_BATCH_SIZE+1:0}–{Math.min((effectivePage+1)*HISTORY_BATCH_SIZE,selected.length)} od {selected.length} stavki. Izračun je ograničen na {HISTORY_BATCH_SIZE} stavki odjednom.</p>
   {error&&<p role="alert" className="app-error">{error}</p>}
   {data&&<><p role="status">Razdoblje: {dateLabel(data.window.from)} – {dateLabel(data.window.to)} (bez cijene na početku nove akcije). {data.truncated?'Previše verzija za potpun izračun; rezultat je nepotpun.':''}</p>
    <div className="validator-table-wrap"><table><thead><tr><th>Stavka</th><th>Najniža zabilježena</th><th>Pokriće</th><th>Povijest cijena</th></tr></thead><tbody>{data.results.map(result=>{const row=batch[result.index];const duplicate=(counts.get(result.key)??0)>1;return <tr key={result.index}><td>{result.name}</td><td>{result.lowest==null?'—':formatEur(result.lowest)}{row?.item.lowest30DayPrice!=null&&<small>Unesena: {formatEur(row.item.lowest30DayPrice)}{result.lowest!=null&&row.item.lowest30DayPrice!==result.lowest?' – provjerite razliku':''}</small>}</td><td><strong>{duplicate?'Dvostruki identifikator':result.status==='complete'?'30 dana objava':result.status==='partial'?'Nepotpuno':result.status==='ambiguous'?'Nejednoznačno':'Nema podataka'}</strong><small>{result.reason}{result.identity==='name'?' Podudaranje prema nazivu; provjerite da je ista stavka.':''}</small></td><td>{result.observations.length?<details><summary>{result.observations.length} zabilježenih cijena</summary>{result.observations.map((o,i)=><p key={i}>{dateLabel(o.from)} · {formatEur(o.price)}</p>)}</details>:'—'}</td></tr>})}</tbody></table></div>
    {onApply&&Object.keys(applicable).length>0&&<><label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Potvrđujem stvarni početak akcije, identitet stavki i da su sve primijenjene cijene u ovom razdoblju obuhvaćene objavama.</label><button type="button" className="app-button app-button-primary" disabled={!confirmed||busy} onClick={()=>{onApply(applicable);setConfirmed(false);setReply(null)}}>Prenesi potvrđene najniže cijene ({Object.keys(applicable).length})</button></>}
    <p>Za nepotpunu povijest koristite vlastitu evidenciju. Izračun ne potvrđuje pravnu usklađenost i ne prepisuje već unesene vrijednosti niti bazne cijene.</p>
   </>}
  </div>}
 </details>
}
