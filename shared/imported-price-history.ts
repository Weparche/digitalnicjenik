import {splitCsv} from '../src/price-engine/adapters/marketinoCsv'
import {normalizeNumber} from '../src/price-engine/normalize'
import type {NormalizedPriceItem} from '../src/price-engine/types'
import {historyIdentity,historyWindow,zagrebTimeToIso,type HistoryResult} from './price-history'
export type ImportedInterval={key:string;from:string;to:string;price:number}
export const HISTORY_IMPORT_HEADER=['Ključ stavke','Vrijedi od','Vrijedi do','Maloprodajna cijena']
export const HISTORY_IMPORT_MAX_BYTES=2_000_000
export function historyImportTemplate(items:NormalizedPriceItem[]){
 const escape=(s:string)=>'"'+s.replaceAll('"','""')+'"'
 return [HISTORY_IMPORT_HEADER.join(';'),...items.map(i=>[escape(historyIdentity(i).key),'','',''].join(';'))].join('\r\n')+'\r\n'
}
export function parseHistoryImport(text:string):ImportedInterval[]{
 if(new TextEncoder().encode(text).length>HISTORY_IMPORT_MAX_BYTES)throw new Error('Datoteka povijesti smije imati najviše 2 MB.')
 const rows=splitCsv(text.replace(/^\uFEFF/,''),';')
 if(rows[0]?.map(s=>s.trim()).join(';')!==HISTORY_IMPORT_HEADER.join(';'))throw new Error('Koristite predložak s četiri stupca: ključ stavke, početak, kraj i cijena.')
 if(rows.length>20001)throw new Error('Najviše 20.000 redaka povijesti po datoteci.')
 return rows.slice(1).map((r,i)=>{
  if(r.length!==4||!r[0]?.trim())throw new Error('Neispravan redak '+(i+2)+'.')
  let from:string,to:string
  try{from=zagrebTimeToIso(r[1].trim());to=zagrebTimeToIso(r[2].trim())}catch{throw new Error('Neispravno vrijeme u retku '+(i+2)+'. Koristite GGGG-MM-DDTHH:MM (hrvatsko vrijeme).')}
  const price=normalizeNumber(r[3])
  if(Date.parse(from)>=Date.parse(to)||price==null||price<0)throw new Error('Neispravno razdoblje ili cijena u retku '+(i+2)+'.')
  return {key:r[0].trim(),from,to,price}
 })
}
export function calculateImportedHistory(items:NormalizedPriceItem[],intervals:ImportedInterval[],start:string){
 const window=historyWindow(start),from=Date.parse(window.from),to=Date.parse(window.to)
 const groups=new Map<string,ImportedInterval[]>()
 for(const row of intervals){if(Date.parse(row.to)<=from||Date.parse(row.from)>=to)continue;const list=groups.get(row.key)??[];list.push(row);groups.set(row.key,list)}
 const counts=new Map<string,number>()
 for(const i of items){const {key}=historyIdentity(i);counts.set(key,(counts.get(key)??0)+1)}
 const results:HistoryResult[]=items.map((item,index)=>{
  const {key,identity}=historyIdentity(item),rows=(groups.get(key)??[]).sort((a,b)=>a.from.localeCompare(b.from))
  const observations:HistoryResult['observations']=[]
  let cursor=from,complete=true,overlap=false
  for(const row of rows){const start=Math.max(from,Date.parse(row.from)),end=Math.min(to,Date.parse(row.to))
    if(start<cursor)overlap=true
    if(start!==cursor)complete=false
    cursor=Math.max(cursor,end)
    if(!observations.length||observations.at(-1)?.price!==row.price)observations.push({from:new Date(start).toISOString(),price:row.price})
  }
  const ambiguous=overlap||(counts.get(key)??0)>1
  const status:HistoryResult['status']=ambiguous?'ambiguous':!rows.length?'missing':complete&&cursor===to?'complete':'partial'
  return {index,key,identity,name:item.name,status,lowest:rows.length?Math.min(...rows.map(r=>r.price)):null,observations,reason:status==='complete'?'Uvezena razdoblja pokrivaju cijelih 30 dana. Potvrdite stvarne primijenjene cijene.':status==='ambiguous'?'Razdoblja se preklapaju ili ključ stavke nije jedinstven.':status==='missing'?'Za ovu stavku nema uvezenih razdoblja.':'Uvezena razdoblja ne pokrivaju cijeli prethodni period.'}
 })
 return {window,results,truncated:false,source:'imported_history' as const}
}
