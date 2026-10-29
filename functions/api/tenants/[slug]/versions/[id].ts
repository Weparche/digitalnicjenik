import { requireTenantAccess,accessErrorResponse } from '../../../../_write-auth'
import type { RuntimeEnv } from '../../../../_repository'
import type { NormalizedPriceList } from '../../../../../src/price-engine/types'
import { renderCsv } from '../../../../../src/price-engine/csv'
import { renderXml } from '../../../../../src/price-engine/xml'
export const onRequestGet=async({request,params,env}:{request:Request;params:Record<string,string>;env:RuntimeEnv})=>{
  try{
    const tenant=await requireTenantAccess({request,env,slug:params.slug,operation:'draft_get'})
    const row=await env.DB!.prepare('SELECT filename_stem,payload_json FROM price_publications WHERE id=? AND tenant_id=?').bind(params.id,tenant.id).first<{filename_stem:string;payload_json:string}>()
    if(!row)return new Response('Not found',{status:404,headers:{'cache-control':'no-store'}})
    const format=new URL(request.url).searchParams.get('format')==='xml'?'xml':'csv'
    const list=JSON.parse(row.payload_json) as NormalizedPriceList
    return new Response(format==='xml'?renderXml(list):renderCsv(list),{headers:{'content-type':format==='xml'?'application/xml; charset=utf-8':'text/csv; charset=utf-8','content-disposition':`attachment; filename="${row.filename_stem}.${format}"`,'cache-control':'no-store'}})
  }catch(error){return accessErrorResponse(error)??new Response('Download failed',{status:500,headers:{'cache-control':'no-store'}})}
}
