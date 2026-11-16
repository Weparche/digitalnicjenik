import {useEffect,useMemo,useRef,useState} from 'react'
import {formatEur} from '../shared/pricing'
import {HISTORY_BATCH_SIZE,historyIdentity,localTime,zagrebTimeToIso,type HistoryResult} from '../shared/price-history'
import {calculateImportedHistory,parseHistoryImport,historyImportTemplate,HISTORY_IMPORT_MAX_BYTES,type ImportedInterval} from '../shared/imported-price-history'
import type {NormalizedPriceItem} from './price-engine/types'

type Reply={window:{from:string;to:string};results:HistoryResult[];truncated:boolean;source?:string}
const dateLabel=(value:string)=>new Intl.DateTimeFormat('hr-HR',{timeZone:'Europe/Zagreb',dateStyle:'short',timeStyle:'short'}).format(new Date(value))
export function PriceHistoryPanel({slug,items,onApply,allowServer=true}:{slug:string;items:NormalizedPriceItem[];onApply?:(values:Record<number,number>)=>void;allowServer?:boolean}){
 const [open,setOpen]=useState(false)
 const [imported,setImported]=useState<ImportedInterval[]|null>(null)
 const [importName,setImportName]=useState('')
 const [importRevision,setImportRevision]=useState(0)
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
 const key=JSON.stringify([slug,start,importRevision,batch.map(({item,index})=>[index,item.name,item.type,item.externalId,item.eanBarcode,item.barcode,item.price,item.salePrice,item.specialSaleApplied,item.lowest30DayPrice])])
 const data=reply?.key===key?reply.data:null
 useEffect(()=>{controller.current?.abort();setBusy(false);setConfirmed(false);setError('');return()=>controller.current?.abort()},[key])
 async function calculate(){
   setError('');setConfirmed(false);setReply(null)
   let iso:string
   try{iso=zagrebTimeToIso(start)}catch(e){setError((e as Error).message);return}
   if(imported){try{setReply({key,data:calculateImportedHistory(batch.map(x=>x.item),imported,iso)})}catch(e){setError(e instanceof Error?e.message:'Izračun nije uspio.')}return}
   if(!allowServer){setError('Prije prve objave učitajte prethodnu povijest cijena iz vlastite evidencije.');return}
   controller.current?.abort()
   const request=new AbortController();controller.current=request;setBusy(true)
   try{
     const response=await fetch('/api/tenants/'+encodeURIComponent(slug)+'/price-history',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({start:iso,items:batch.map(x=>x.item)}),signal:request.signal})
     const result=await response.json() as Reply & {error?:string}
     if(!response.ok)throw new Error(result.error||'Izračun nije dostupan.')
     if(!request.signal.aborted)setReply({key,data:result as Reply})
   }catch(e){if(!request.signal.aborted)setError(e instanceof Error?e.message:'Izračun nije uspio.')}
   finally{if(!request.signal.aborted)setBusy(false)}
 }
 async function loadHistory(file?:File){if(!file)return;setReply(null);setConfirmed(false);setError('');setImported(null);setImportName('');try{if(file.size>HISTORY_IMPORT_MAX_BYTES)throw new Error('Datoteka povijesti smije imati najviše 2 MB.');setImported(parseHistoryImport(await file.text()));setImportName(file.name);setImportRevision(x=>x+1)}catch(e){setError(e instanceof Error?e.message:'Uvoz nije uspio.')}}
 function downloadHistoryTemplate(){const url=URL.createObjectURL(new Blob([historyImportTemplate(items)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='povijest-cijena-predlozak.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 const applicable:Record<number,number>={}
 if(data)for(const result of data.results){
   const row=batch[result.index];if(!row)continue
   if(result.status==='complete'&&result.lowest!=null&&result.lowest>0&&(counts.get(result.key)??0)===1&&row.item.specialSaleApplied===true&&row.item.lowest30DayPrice==null)applicable[row.index]=result.lowest
 }
 return <details className="workspace-surface price-history-panel" open={open} onToggle={e=>setOpen(e.currentTarget.open)}>
  <summary>Najniža cijena u prethodnih 30 dana</summary>
  {open&&<div className="price-history-content">
   <p>{allowServer?'Privatna evidencija iz svih objavljenih verzija, uključujući one izvan javne arhive od 15 dana.':'Za prvu objavu možete koristiti vlastitu evidenciju cijena.'} Povijest koju uvezete koristi se lokalno u ovom pregledniku; u nacrt se prenose samo potvrđeni iznosi.</p><div className="workspace-surface"><strong>Uvezite postojeću povijest</strong><p>Preuzmite predložak s ključevima stavki. Za svaku stavku upišite sva razdoblja stvarnih cijena (vrijeme od/do: GGGG-MM-DDTHH:MM, hrvatsko vrijeme), uključujući cijenu koja je vrijedila na početku 30-dnevnog razdoblja. Dodajte retke za svaku promjenu.</p><button className="app-button app-button-light" type="button" onClick={downloadHistoryTemplate}>Preuzmi predložak povijesti (CSV)</button><label>Učitaj povijest cijena (CSV)<input type="file" accept=".csv,text/csv" onChange={e=>{void loadHistory(e.target.files?.[0]);e.target.value=''}}/></label>{importName&&<p role="status">Učitano: {importName} · {imported?.length} razdoblja. <button type="button" className="workspace-button-link" onClick={()=>{setImported(null);setImportName('');setImportRevision(x=>x+1)}}>Ukloni uvoz</button></p>}</div>
   <p>Odaberite stvarni početak posebnog oblika prodaje. Za akciju koja već traje unesite njezin izvorni početak, ne današnji datum. Kod rasprodaje ili sezonskog sniženja koje se nastavlja provjerite primjenjivu referentnu cijenu.</p>
   <label>Početak akcije (hrvatsko vrijeme)<input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)} max={localTime(new Date()).slice(0,16)}/></label>
   <label>Prikaži stavke<select value={filter} onChange={e=>{setFilter(e.target.value);setPage(0)}}><option value="all">Sve stavke</option><option value="sale">Samo stavke s posebnom prodajom</option></select></label>
   <label>Pretraži stavke<input value={search} onChange={e=>{setSearch(e.target.value);setPage(0)}} placeholder="Naziv, šifra ili barkod"/></label>
   <div className="publication-actions"><button type="button" className="app-button app-button-primary" disabled={busy||!batch.length||!start||(!allowServer&&!imported)} onClick={()=>void calculate()}>{busy?'Izračunavamo…':'Izračunaj najniže cijene'}</button><button type="button" className="app-button app-button-light" disabled={effectivePage===0||busy} onClick={()=>setPage(effectivePage-1)}>Prethodne</button><button type="button" className="app-button app-button-light" disabled={(effectivePage+1)*HISTORY_BATCH_SIZE>=selected.length||busy} onClick={()=>setPage(effectivePage+1)}>Sljedeće</button></div>
   <p>Prikaz {selected.length?effectivePage*HISTORY_BATCH_SIZE+1:0}–{Math.min((effectivePage+1)*HISTORY_BATCH_SIZE,selected.length)} od {selected.length} stavki. Izračun je ograničen na {HISTORY_BATCH_SIZE} stavki odjednom.</p>
   {error&&<p role="alert" className="app-error">{error}</p>}
   {data&&<><p role="status">Razdoblje: {dateLabel(data.window.from)} – {dateLabel(data.window.to)} (bez cijene na početku nove akcije). {data.truncated?'Previše verzija za potpun izračun; rezultat je nepotpun.':''}</p>
    <div className="validator-table-wrap"><table><thead><tr><th>Stavka</th><th>Najniža zabilježena</th><th>Pokriće</th><th>Povijest cijena</th></tr></thead><tbody>{data.results.map(result=>{const row=batch[result.index];const duplicate=(counts.get(result.key)??0)>1;return <tr key={result.index}><td>{result.name}</td><td>{result.lowest==null?'—':formatEur(result.lowest)}{row?.item.lowest30DayPrice!=null&&<small>Unesena: {formatEur(row.item.lowest30DayPrice)}{result.lowest!=null&&row.item.lowest30DayPrice!==result.lowest?' – provjerite razliku':''}</small>}</td><td><strong>{duplicate?'Dvostruki identifikator':result.status==='complete'?data.source==='imported_history'?'30 dana uvoza':'30 dana objava':result.status==='partial'?'Nepotpuno':result.status==='ambiguous'?'Nejednoznačno':'Nema podataka'}</strong><small>{result.reason}{result.identity==='name'?' Podudaranje prema nazivu; provjerite da je ista stavka.':''}</small></td><td>{result.observations.length?<details><summary>{result.observations.length} zabilježenih cijena</summary>{result.observations.map((o,i)=><p key={i}>{dateLabel(o.from)} · {formatEur(o.price)}</p>)}</details>:'—'}</td></tr>})}</tbody></table></div>
    {onApply&&Object.keys(applicable).length>0&&<><label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Potvrđujem stvarni početak akcije, identitet stavki i da su sve primijenjene cijene u ovom razdoblju obuhvaćene evidencijom.</label><button type="button" className="app-button app-button-primary" disabled={!confirmed||busy} onClick={()=>{onApply(applicable);setConfirmed(false);setReply(null)}}>Prenesi potvrđene najniže cijene ({Object.keys(applicable).length})</button></>}
    <p>Za nepotpunu povijest koristite vlastitu evidenciju. Izračun ne potvrđuje pravnu usklađenost i ne prepisuje već unesene vrijednosti niti bazne cijene.</p>
   </>}
  </div>}
 </details>
}
