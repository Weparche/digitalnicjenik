import { resolveSession,type AuthEnv } from '../../_auth'
import { AccessDeniedError } from '../../_write-auth'
import { opsError,OPS_HEADERS } from '../../_admin-auth'
import { dispatchLifecycle,lifecycleStatement } from '../../../shared/lifecycle'
export const onRequestPost=async({request,env,waitUntil}:{request:Request;env:AuthEnv;waitUntil?:(p:Promise<unknown>)=>void})=>{
  try {
    if(request.headers.get('origin')!==new URL(request.url).origin) throw new AccessDeniedError(403,'invalid_origin','Zahtjev mora doći s ove stranice.')
    const session=await resolveSession(env,request)
    if(!session||!env.DB) throw new AccessDeniedError(401,'unauthorized','Prijava je obavezna.')
    const body=await request.json() as {reference?:string}
    const order=await env.DB.prepare('SELECT tenant_id,status FROM payment_orders WHERE reference=?').bind(body.reference??'').first<{tenant_id:string;status:string}>()
    if(!order||!session.tenants.some(tenant=>tenant.id===order.tenant_id)) throw new AccessDeniedError(404,'order_missing','Narudžba nije pronađena.')
    if(order.status!=='pending') throw new AccessDeniedError(409,'not_pending','Narudžba više ne čeka uplatu.')
    const guard={sql:"EXISTS(SELECT 1 FROM payment_orders WHERE reference=? AND status='pending' AND payment_reported_at IS NOT NULL)",values:[body.reference]}
    await env.DB.batch([
      env.DB.prepare("UPDATE payment_orders SET payment_reported_at=COALESCE(payment_reported_at,?),updated_at=? WHERE reference=? AND status='pending'").bind(new Date().toISOString(),new Date().toISOString(),body.reference),
      lifecycleStatement(env.DB,{id:`order:${body.reference}:reported:owner`,tenantId:order.tenant_id,type:'payment_reported_customer',entityId:body.reference},guard),
      lifecycleStatement(env.DB,{id:`order:${body.reference}:reported:ops`,tenantId:order.tenant_id,type:'payment_reported_ops',entityId:body.reference,audience:'ops'},guard),
    ])
    waitUntil?.(dispatchLifecycle({...env,DB:env.DB}))
    return Response.json({ok:true},{headers:OPS_HEADERS})
  } catch(error) {return opsError(error)}
}
