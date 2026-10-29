import { requireAdmin,opsError } from '../../_admin-auth'
import type { AuthEnv } from '../../_auth'
import { renderCsv } from '../../../src/price-engine/csv'
import { renderXml } from '../../../src/price-engine/xml'
import type { NormalizedPriceList } from '../../../src/price-engine/types'
export const onRequestGet=async({request,env}:{request:Request;env:AuthEnv})=>{
  try{
    await requireAdmin(request,env)
    const params=new URL(request.url).searchParams
    const row=await env.DB!.prepare('SELECT p.payload_json,p.filename_stem FROM price_publications p JOIN tenants t ON t.id=p.tenant_id WHERE p.id=? AND t.slug=?').bind(params.get('id'),params.get('tenant')).first<{payload_json:string;filename_stem:string}>()
    if(!row)return new Response('Not found',{status:404,headers:{'cache-control':'no-store'}})
    const format=params.get('format')==='xml'?'xml':'csv'
    const list=JSON.parse(row.payload_json) as NormalizedPriceList
    return new Response(format==='xml'?renderXml(list):renderCsv(list),{headers:{'content-type':format==='xml'?'application/xml; charset=utf-8':'text/csv; charset=utf-8','content-disposition':`attachment; filename="${row.filename_stem}.${format}"`,'cache-control':'no-store'}})
  }catch(error){return opsError(error)}
}
