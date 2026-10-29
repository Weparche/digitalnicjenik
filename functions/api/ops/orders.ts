import type { AuthEnv } from '../../_auth'
import { requireAdmin,opsError,OPS_HEADERS } from '../../_admin-auth'
import { AccessDeniedError } from '../../_write-auth'
import { parseOrderInput } from '../../_orders'
import { orderAmountCents,type OrderKind } from '../../../shared/payment'
import { lifecycleStatement,dispatchLifecycle } from '../../../shared/lifecycle'
import { sha256Hex } from '../../_auth'

/** Human-approved quotes only. Public checkout cannot order a website. */
export const onRequestPost=async({request,env,waitUntil}:{request:Request;env:AuthEnv;waitUntil?:(p:Promise<unknown>)=>void})=>{
  try {
    const actor=await requireAdmin(request,env)
    if(!env.DB) throw new Error('db_unavailable')
    const body=await request.json() as Record<string,unknown>
    if(!['web_publisher','installation'].includes(String(body.kind))) throw new AccessDeniedError(400,'invalid_kind','Odaberite Web + Publisher ili standardnu ugradnju.')
    const fields=parseOrderInput({...body,kind:'web_link'})
    const tenant=await env.DB.prepare('SELECT id FROM tenants WHERE slug=?').bind(String(body.slug??'')).first<{id:string}>()
    if(!tenant) throw new AccessDeniedError(404,'tenant_missing','Prvo povežite upit s potvrđenom objavom korisnika.')
    const kind=body.kind as OrderKind
    const stamp=new Date().toISOString()
    const operation=String(body.requestKey??'')
    const reason=String(body.reason??'').trim()
    if(operation.length<8||operation.length>100||reason.length<3) throw new AccessDeniedError(400,'reason_required','Unesite razlog i identifikator operacije.')
    const hash=await sha256Hex(JSON.stringify({tenant:tenant.id,kind,fields,reason}))
    const replay=await env.DB.prepare('SELECT request_hash,new_json FROM admin_audit WHERE request_key=?').bind(operation).first<{request_hash:string;new_json:string}>()
    if(replay){
      if(replay.request_hash!==hash)throw new AccessDeniedError(409,'idempotency_conflict','Identifikator pripada drugoj operaciji.')
      return Response.json({ok:true,...JSON.parse(replay.new_json),repeated:true},{headers:OPS_HEADERS})
    }
    if(kind==='web_publisher'){
      const conflict=await env.DB.prepare("SELECT reference FROM payment_orders WHERE tenant_id=? AND status='pending' AND kind NOT IN ('web_publisher','installation')").bind(tenant.id).first<{reference:string}>()
      if(conflict)throw new AccessDeniedError(409,'pending_order_conflict',`Najprije razriješite otvorenu narudžbu ${conflict.reference}.`)
    }
    const existing=await env.DB.prepare("SELECT reference FROM payment_orders WHERE tenant_id=? AND kind=? AND status='pending'").bind(tenant.id,kind).first<{reference:string}>()
    if(existing) return Response.json({ok:true,reference:existing.reference},{headers:OPS_HEADERS})
    const attempt=crypto.randomUUID()
    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO admin_audit(id,request_key,request_hash,actor_id,actor_email,actor_type,action,tenant_id,reason,old_json,new_json,created_at) VALUES (?,?,?,?,?,?,'create_quote_order',?,?, '{}',?,?)").bind(attempt,operation,hash,actor.id,actor.email,actor.type,tenant.id,reason,JSON.stringify({kind,amount:orderAmountCents(kind)}),stamp),
      env.DB.prepare(`INSERT INTO payment_orders(tenant_id,kind,installation,amount_cents,customer_type,billing_name,oib,address,postal_city,email,status,created_at,updated_at)
        SELECT ?,?,0,?,?,?,?,?,?,?,'pending',?,? WHERE EXISTS(SELECT 1 FROM admin_audit WHERE id=?) AND NOT EXISTS(SELECT 1 FROM payment_orders WHERE tenant_id=? AND status='pending' AND (kind=? OR (?='web_publisher' AND kind!='installation')))` ).bind(tenant.id,kind,orderAmountCents(kind),fields.customerType,fields.billingName,fields.oib,fields.address,fields.postalCity,fields.email,stamp,stamp,attempt,tenant.id,kind,kind),
      env.DB.prepare("UPDATE payment_orders SET reference=strftime('%Y',created_at)||'-'||number WHERE tenant_id=? AND kind=? AND reference IS NULL").bind(tenant.id,kind),
      env.DB.prepare("INSERT OR IGNORE INTO lifecycle_events(id,tenant_id,event_type,entity_id,audience,payload_json,scheduled_at,created_at,updated_at) SELECT 'order:'||reference||':received',tenant_id,'order_received',reference,'owner','{}',?,?,? FROM payment_orders WHERE tenant_id=? AND kind=? AND status='pending'").bind(stamp,stamp,stamp,tenant.id,kind),
      env.DB.prepare("UPDATE admin_audit SET order_reference=(SELECT reference FROM payment_orders WHERE tenant_id=? AND kind=? AND status='pending'),new_json=json_set(new_json,'$.reference',(SELECT reference FROM payment_orders WHERE tenant_id=? AND kind=? AND status='pending')) WHERE id=?").bind(tenant.id,kind,tenant.id,kind,attempt),
    ])
    waitUntil?.(dispatchLifecycle({...env,DB:env.DB}))
    const saved=await env.DB.prepare('SELECT request_hash,new_json,order_reference FROM admin_audit WHERE request_key=?').bind(operation).first<{request_hash:string;new_json:string;order_reference:string|null}>()
    if(!saved?.order_reference)throw new AccessDeniedError(409,'pending_order_conflict','Otvorena je druga narudžba. Osvježite pregled.')
    if(saved.request_hash!==hash)throw new AccessDeniedError(409,'idempotency_conflict','Identifikator pripada drugoj operaciji.')
    return Response.json({ok:true,...JSON.parse(saved.new_json)},{headers:OPS_HEADERS})
  } catch(error) {return opsError(error)}
}
