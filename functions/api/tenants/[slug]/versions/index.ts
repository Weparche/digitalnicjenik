import { requireTenantAccess,accessErrorResponse } from '../../../../_write-auth'
import type { RuntimeEnv } from '../../../../_repository'
export const onRequestGet=async({request,params,env}:{request:Request;params:Record<string,string>;env:RuntimeEnv})=>{
  try{
    const tenant=await requireTenantAccess({request,env,slug:params.slug,operation:'draft_get'})
    const offset=Math.max(0,Math.floor(Number(new URL(request.url).searchParams.get('page'))||0))*50
    const rows=await env.DB!.prepare('SELECT id,sequence,published_at FROM price_publications WHERE tenant_id=? ORDER BY sequence DESC LIMIT 50 OFFSET ?').bind(tenant.id,offset).all()
    return Response.json({versions:rows.results},{headers:{'cache-control':'no-store'}})
  }catch(error){return accessErrorResponse(error)??new Response('Download failed',{status:500,headers:{'cache-control':'no-store'}})}
}
