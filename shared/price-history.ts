import type {NormalizedPriceItem} from '../src/price-engine/types'
import {isServiceItem} from '../src/price-engine/profile'

export const HISTORY_BATCH_SIZE=40
export const HISTORY_MAX_VERSIONS=100
const tz='Europe/Zagreb'
const DAY=86400000
export type HistorySnapshot={id:string;published_at:string;superseded_at:string|null;is_current:number}
export type HistoryObservation={publicationId:string;itemKey:string;price:number|null}
export type HistoryResult={index:number;key:string;name:string;status:'complete'|'partial'|'missing'|'ambiguous';lowest:number|null;observations:{from:string;price:number}[];reason:string;identity:'code'|'ean'|'barcode'|'name'}
export const localTime=(value:Date)=>new Intl.DateTimeFormat('sv-SE',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(value).replace(' ','T')
export function zagrebTimeToIso(value:string){
 const local=value.length===16?value+':00':value
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(local))throw new Error('Unesite stvarni datum i vrijeme početka akcije.')
 const utc=Date.parse(local+'Z')
 const candidates=[1,2].map(offset=>new Date(utc-offset*3600000)).filter(d=>Number.isFinite(d.getTime())&&localTime(d)===local)
 if(candidates.length!==1)throw new Error('Vrijeme početka akcije nije jednoznačno zbog promjene sata. Odaberite drugo vrijeme.')
 return candidates[0].toISOString()
}
export function historyWindow(start:string){
 const asOf=Date.parse(start)
 if(!Number.isFinite(asOf))throw new Error('Datum početka akcije nije valjan.')
 const local=localTime(new Date(asOf))
 const earlier=new Date(Date.parse(local+'Z')-30*DAY).toISOString().slice(0,19)
 return {from:zagrebTimeToIso(earlier),to:new Date(asOf).toISOString()}
}
export function historyIdentity(item:Pick<NormalizedPriceItem,'type'|'externalId'|'eanBarcode'|'barcode'|'name'>){
 const kind=isServiceItem({...item,price:0})?'s:':'p:'
 const code=item.externalId?.trim(),ean=item.eanBarcode?.trim(),barcode=item.barcode?.trim()
 if(code)return {key:kind+'code:'+code,identity:'code' as const}
 if(ean)return {key:kind+'ean:'+ean,identity:'ean' as const}
 if(barcode)return {key:kind+'barcode:'+barcode,identity:'barcode' as const}
 return {key:kind+'name:'+item.name.trim(),identity:'name' as const}
}
export function observedRetailPrice(item:Pick<NormalizedPriceItem,'price'|'salePrice'|'specialSaleApplied'>){
 if(item.salePrice!=null&&item.specialSaleApplied!==true)return null
 const price=item.specialSaleApplied===true&&item.salePrice!=null?item.salePrice:item.price
 return typeof price==='number'&&Number.isFinite(price)&&price>=0?price:null
}
export function calculateHistory(items:NormalizedPriceItem[],snapshots:HistorySnapshot[],observations:HistoryObservation[],window:{from:string;to:string},truncated=false):HistoryResult[]{
 const sorted=[...snapshots].sort((a,b)=>a.published_at.localeCompare(b.published_at))
 const groups=new Map<string,HistoryObservation[]>()
 for(const observation of observations){const key=JSON.stringify([observation.publicationId,observation.itemKey]);const group=groups.get(key)??[];group.push(observation);groups.set(key,group)}
 const identities=items.map(historyIdentity)
 const counts=new Map<string,number>()
 for(const {key} of identities)counts.set(key,(counts.get(key)??0)+1)
 const from=Date.parse(window.from),to=Date.parse(window.to)
 const timeline=sorted.filter(s=>Date.parse(s.published_at)<to)
 const fullTimeline=!truncated&&timeline.length>0&&Date.parse(timeline[0].published_at)<=from&&timeline.every((s,i)=>{
   const end=s.superseded_at?Date.parse(s.superseded_at):s.is_current===1?Infinity:NaN
   const next=i+1<timeline.length?Date.parse(timeline[i+1].published_at):to
   return Number.isFinite(Date.parse(s.published_at))&&end>=next&&(i+1===timeline.length||end===next)
 })
 return items.map((item,index)=>{
   const {key,identity}=identities[index]
   const values:HistoryResult['observations']=[]
   let ambiguous=(counts.get(key)??0)>1,missing=false
   for(const snapshot of timeline){
     const rows=groups.get(JSON.stringify([snapshot.id,key]))??[]
     if(rows.length>1){ambiguous=true;continue}
     if(rows.length!==1||rows[0].price==null||!Number.isFinite(rows[0].price)||rows[0].price<0){missing=true;continue}
     const price=rows[0].price
     if(!values.length||values[values.length-1].price!==price)values.push({from:new Date(Math.max(from,Date.parse(snapshot.published_at))).toISOString(),price})
   }
   const lowest=values.reduce<number|null>((min,x)=>min===null?x.price:Math.min(min,x.price),null)
   const status:HistoryResult['status']=ambiguous?'ambiguous':!values.length?'missing':!fullTimeline||missing?'partial':'complete'
   const reason=status==='ambiguous'?'Više stavki ima isti identifikator. Provjerite šifru ili barkod.':status==='missing'?'Nema podataka o ovoj stavci u promatranom razdoblju.':status==='partial'?'Nedostaje dio razdoblja ili stavka nije zabilježena u svakoj objavi. Pronađeni minimum nije dovoljan za potvrdu.': 'Objave pokrivaju cijelo razdoblje. Potvrdite da su to sve stvarno primijenjene cijene.'
   return {index,key,name:item.name,status,lowest,observations:values,reason,identity}
 })
}
