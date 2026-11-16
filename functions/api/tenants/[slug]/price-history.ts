import {requireOwnerOrOperator,accessErrorResponse} from '../../../_write-auth'
import {readJsonBody,parsePriceListInput,errorStatus,ValidationInputError} from '../../../_limits'
import type {RuntimeEnv} from '../../../_repository'
import {calculateHistory,historyIdentity,historyWindow,observedRetailPrice,HISTORY_BATCH_SIZE,HISTORY_MAX_VERSIONS,type HistorySnapshot,type HistoryObservation} from '../../../../shared/price-history'
const headers={'cache-control':'private, no-store','x-robots-tag':'noindex, nofollow'}
// All persisted versions, not merely publicly retained files. Query a bounded subset of fields.
export const onRequestPost=async({request,params,env}:{request:Request;params:Record<string,string>;env:RuntimeEnv})=>{
 try{
  const tenant=await requireOwnerOrOperator({request,env,slug:params.slug})
  const raw=await readJsonBody(request,120000) as {items?:unknown;start?:unknown}
  if(!raw||!Array.isArray(raw.items)||!raw.items.length||raw.items.length>HISTORY_BATCH_SIZE)throw new ValidationInputError('Odaberite najviše '+HISTORY_BATCH_SIZE+' stavki po izračunu.')
  if(typeof raw.start!=='string'||!Number.isFinite(Date.parse(raw.start))||Date.parse(raw.start)>Date.now()+60000)throw new ValidationInputError('Odaberite datum i vrijeme početka akcije koji nije u budućnosti.')
  const items=parsePriceListInput({items:raw.items}).items
  const window=historyWindow(raw.start)
  const db=env.DB!
  // Include the version already in force at the beginning of the window.
  const preceding=await db.prepare('SELECT id,published_at,superseded_at,is_current FROM price_publications WHERE tenant_id=? AND published_at<=? ORDER BY published_at DESC,sequence DESC LIMIT 1').bind(tenant.id,window.from).first<HistorySnapshot>()
  const rows=await db.prepare('SELECT id,published_at,superseded_at,is_current FROM price_publications WHERE tenant_id=? AND published_at>? AND published_at<? ORDER BY published_at ASC,sequence ASC LIMIT ?').bind(tenant.id,window.from,window.to,HISTORY_MAX_VERSIONS+1).all<HistorySnapshot>()
  const truncated=rows.results.length>HISTORY_MAX_VERSIONS
  const snapshots=[...(preceding?[preceding]:[]),...rows.results.slice(0,HISTORY_MAX_VERSIONS)]
  const keys=[...new Set(items.map(x=>historyIdentity(x).key))]
  const observations:HistoryObservation[]=[]
  // Keep D1 response small even with 5,000 items per version. Never fetch unrelated item payloads.
  const keySql="(CASE WHEN lower(coalesce(json_extract(j.value,'$.type'),'')) LIKE '%uslug%' OR lower(coalesce(json_extract(j.value,'$.type'),'')) LIKE '%service%' THEN 's:' ELSE 'p:' END || CASE WHEN trim(coalesce(json_extract(j.value,'$.externalId'),''))<>'' THEN 'code:'||trim(json_extract(j.value,'$.externalId')) WHEN trim(coalesce(json_extract(j.value,'$.eanBarcode'),''))<>'' THEN 'ean:'||trim(json_extract(j.value,'$.eanBarcode')) WHEN trim(coalesce(json_extract(j.value,'$.barcode'),''))<>'' THEN 'barcode:'||trim(json_extract(j.value,'$.barcode')) ELSE 'name:'||trim(coalesce(json_extract(j.value,'$.name'),'')) END)"
  for(let i=0;i<snapshots.length;i+=10){
   const ids=snapshots.slice(i,i+10).map(s=>s.id)
   const result=await db.prepare("SELECT p.id AS publicationId,"+keySql+" AS itemKey,json_extract(j.value,'$.price') AS price,json_extract(j.value,'$.salePrice') AS salePrice,json_extract(j.value,'$.specialSaleApplied') AS flag,COUNT(*) AS matchCount FROM price_publications p JOIN json_each(p.payload_json,'$.items') j WHERE p.tenant_id=? AND p.id IN (SELECT value FROM json_each(?)) AND "+keySql+" IN (SELECT value FROM json_each(?)) GROUP BY p.id,itemKey").bind(tenant.id,JSON.stringify(ids),JSON.stringify(keys)).all<{publicationId:string;itemKey:string;price:number;salePrice:number|null;flag:number|null;matchCount:number}>()
   for(const row of result.results){const observation={publicationId:row.publicationId,itemKey:row.itemKey,price:observedRetailPrice({price:row.price,salePrice:row.salePrice,specialSaleApplied:row.flag===1?true:row.flag===0?false:null})};observations.push(observation);if(row.matchCount>1)observations.push({...observation,price:null})}
  }
  return Response.json({window,results:calculateHistory(items,snapshots,observations,window,truncated),truncated,source:'published_versions'},{headers})
 }catch(error){const denied=accessErrorResponse(error);if(denied){denied.headers.set('cache-control','private, no-store');return denied}return Response.json({error:error instanceof ValidationInputError?error.message:'Izračun povijesti trenutačno nije dostupan. Provjerite datum i pokušajte ponovno.'},{status:errorStatus(error,422),headers})}
}
