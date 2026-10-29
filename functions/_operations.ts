import type { D1DatabaseLike } from '../shared/db'
import { PAID_GRACE_MS } from '../shared/entitlements'
import { lifecycleStatement, periodLifecycleStatements, type EntitlementRow } from '../shared/lifecycle'
import { planForOrder, type OrderKind } from '../shared/payment'
import { sha256Hex } from './_auth'
import type { AdminActor } from './_admin-auth'
import { AccessDeniedError } from './_write-auth'

type Tenant = { id:string; slug:string; name:string }
type AuditRow = { request_hash:string; new_json:string }
type PaidOrder = { number:number; reference:string; tenant_id:string; kind:OrderKind; status:string; confirmed_period_end:string|null; confirmed_plan:string|null }
export async function currentEntitlement(db:D1DatabaseLike,tenantId:string) {
  const row=await db.prepare('SELECT * FROM entitlements WHERE tenant_id=? ORDER BY created_at DESC LIMIT 1').bind(tenantId).first<EntitlementRow>()
  if(!row) throw new AccessDeniedError(404,'entitlement_missing','Licenca nije pronađena.')
  return row
}
export async function applyOperation(db:D1DatabaseLike,actor:AdminActor,tenant:Tenant,input:Record<string,unknown>,now=new Date()) {
  const action=String(input.action??'')
  const reference=typeof input.reference==='string'?input.reference:null
  if(!['confirm_payment','activate','extend','set_expiry','change_plan','suspend','reactivate','confirm_legacy_paid','cancel_order'].includes(action)) throw new AccessDeniedError(400,'invalid_action','Odaberite operaciju.')
  const reason=action==='confirm_payment'?'Potvrđena bankovna uplata':String(input.reason??'').trim().slice(0,500)
  if(reason.length<3) throw new AccessDeniedError(400,'reason_required','Unesite razlog operacije.')
  const key=action==='confirm_payment'?`payment:${reference}`:String(input.requestKey??'')
  if(!key||key.length>180) throw new AccessDeniedError(400,'request_key_required','Nedostaje identifikator operacije.')
  const hash=await sha256Hex(JSON.stringify({tenantId:tenant.id,action,reference,reason,plan:input.plan,periodEnd:input.periodEnd}))
  const previous=await db.prepare('SELECT request_hash,new_json FROM admin_audit WHERE request_key=?').bind(key).first<AuditRow>()
  if(previous) {
    if(previous.request_hash!==hash) throw new AccessDeniedError(409,'idempotency_conflict','Identifikator već pripada drugoj operaciji.')
    return {...JSON.parse(previous.new_json),repeated:true}
  }
  const old=await currentEntitlement(db,tenant.id)
  const order=reference?await db.prepare('SELECT * FROM payment_orders WHERE reference=? AND tenant_id=?').bind(reference,tenant.id).first<PaidOrder>():null
  if(['confirm_payment','cancel_order'].includes(action)&&!order) throw new AccessDeniedError(404,'order_missing','Narudžba nije pronađena.')
  if(action==='confirm_payment'&&order?.status==='paid') return {plan:order.confirmed_plan??old.plan,periodEnd:order.confirmed_period_end??old.period_end,repeated:true}
  if(order&&order.status!=='pending') throw new AccessDeniedError(409,'order_not_pending','Narudžba više ne čeka obradu.')
  const pending=await db.prepare("SELECT reference FROM payment_orders WHERE tenant_id=? AND status='pending' LIMIT 1").bind(tenant.id).first<{reference:string}>()
  if(!['confirm_payment','cancel_order','suspend'].includes(action)&&pending) throw new AccessDeniedError(409,'pending_order_conflict',`Prvo potvrdite ili otkažite otvorenu narudžbu ${pending.reference}.`)
  const stamp=now.toISOString()
  const next={...old}
  const yearEnd=()=>new Date(Math.max(now.getTime(),old.status==='trial'?0:Date.parse(old.period_end??'')||0)+365*86_400_000).toISOString()
  if(action==='confirm_payment'&&order) {
    const target=planForOrder(order.kind)
    if(target) {
      if(order.kind==='publisher_upgrade'&&(old.plan!=='web_link'||!old.period_end||Date.parse(old.period_end)<=now.getTime())) throw new AccessDeniedError(409,'upgrade_expired','Nadogradnja zahtijeva još aktivno plaćeno razdoblje Web Linka.')
      next.plan=target
      if(order.kind!=='publisher_upgrade') {next.period_start=stamp;next.period_end=yearEnd();next.paid_confirmed_at=stamp}
      next.status=old.status==='suspended'?'suspended':'active'
    }
  } else if(action==='activate'||action==='extend') {
    next.status=old.status==='suspended'?'suspended':'active';next.period_start=stamp;next.period_end=yearEnd()
    // Manual activation is not evidence of a bank payment for this new period.
    next.paid_confirmed_at=null
  } else if(action==='set_expiry') {
    const end=typeof input.periodEnd==='string'?Date.parse(input.periodEnd):NaN
    if(!Number.isFinite(end)) throw new AccessDeniedError(400,'invalid_date','Unesite valjan datum isteka.')
    next.period_end=new Date(end).toISOString()
    next.paid_confirmed_at=null
  } else if(action==='change_plan') {
    if(!['web_link','publisher_self_service','managed'].includes(String(input.plan))) throw new AccessDeniedError(400,'invalid_plan','Odaberite godišnji paket.')
    next.plan=input.plan as EntitlementRow['plan']
  } else if(action==='suspend') next.status='suspended'
  else if(action==='reactivate') next.status=Date.parse(old.period_end??'')>now.getTime()?'active':'expired'
  else if(action==='confirm_legacy_paid') {
    if(old.status==='trial'||old.plan==='validator'||!old.period_end) throw new AccessDeniedError(409,'not_annual','Besplatna objava nije potvrđeno godišnje razdoblje.')
    next.paid_confirmed_at=stamp
  }
  next.grace_until=next.period_end&&next.paid_confirmed_at?new Date(Date.parse(next.period_end)+PAID_GRACE_MS).toISOString():null
  const attempt=crypto.randomUUID()
  const result={plan:next.plan,status:next.status,periodEnd:next.period_end,graceUntil:next.grace_until,reference,action}
  const oldGuard='EXISTS(SELECT 1 FROM entitlements WHERE id=? AND updated_at IS ? AND plan=? AND status=? AND period_start IS ? AND period_end IS ? AND paid_confirmed_at IS ? AND grace_until IS ?)'
  const oldValues=[old.id,old.updated_at??null,old.plan,old.status,old.period_start,old.period_end,old.paid_confirmed_at,old.grace_until]
  const orderGuard=order?" AND EXISTS(SELECT 1 FROM payment_orders WHERE number=? AND status='pending')":''
  const audit=db.prepare(`INSERT OR IGNORE INTO admin_audit(id,request_key,request_hash,actor_id,actor_email,actor_type,action,tenant_id,order_reference,reason,old_json,new_json,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${oldGuard}${orderGuard}`)
    .bind(attempt,key,hash,actor.id,actor.email,actor.type,action,tenant.id,reference,reason,JSON.stringify(old),JSON.stringify(result),stamp,...oldValues,...(order?[order.number]:[]))
  const guard={sql:'EXISTS(SELECT 1 FROM admin_audit WHERE id=?)',values:[attempt]}
  const statements=[audit]
  if(action!=='cancel_order'&&(action!=='confirm_payment'||order?.kind!=='installation')) {
    statements.push(db.prepare(`UPDATE entitlements SET plan=?,status=?,period_start=?,period_end=?,paid_confirmed_at=?,grace_until=?,updated_at=? WHERE id=? AND ${guard.sql}`).bind(next.plan,next.status,next.period_start,next.period_end,next.paid_confirmed_at,next.grace_until,stamp,old.id,attempt))
    if(next.period_end!==old.period_end||next.period_start!==old.period_start) statements.push(db.prepare(`UPDATE lifecycle_events SET status='cancelled',lease_token=NULL,lease_until=NULL,updated_at=? WHERE tenant_id=? AND period_key IS NOT NULL AND status IN ('pending','processing','attention') AND ${guard.sql}`).bind(stamp,tenant.id,attempt))
    statements.push(...periodLifecycleStatements(db,next,now,guard))
  }
  if(order) {
    statements.push(db.prepare(`UPDATE payment_orders SET status=?,paid_at=?,updated_at=?,confirmed_period_end=?,confirmed_plan=? WHERE number=? AND ${guard.sql}`).bind(action==='cancel_order'?'cancelled':'paid',action==='cancel_order'?null:stamp,stamp,next.period_end,next.plan,order.number,attempt))
    if(action==='confirm_payment') statements.push(lifecycleStatement(db,{id:`order:${order.reference}:confirmed`,tenantId:tenant.id,type:'payment_confirmed',entityId:order.reference},guard))
  }
  await db.batch(statements)
  const saved=await db.prepare('SELECT request_hash,new_json FROM admin_audit WHERE request_key=?').bind(key).first<AuditRow>()
  if(saved&&saved.request_hash===hash) return JSON.parse(saved.new_json) as typeof result
  if(action==='confirm_payment') {
    const paid=await db.prepare("SELECT confirmed_period_end,confirmed_plan FROM payment_orders WHERE reference=? AND tenant_id=? AND status='paid'").bind(reference,tenant.id).first<{confirmed_period_end:string;confirmed_plan:string}>()
    if(paid) return {plan:paid.confirmed_plan,periodEnd:paid.confirmed_period_end,repeated:true}
  }
  throw new AccessDeniedError(409,'state_changed','Podaci su promijenjeni. Osvježite pregled i pokušajte ponovno.')
}
