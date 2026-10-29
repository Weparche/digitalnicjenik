import type { D1DatabaseLike } from './db'
import { emailConfigured, sendTransactionalEmail, type EmailEnv } from './email'
import { entitlementAccess } from './entitlements'
import { formatCents, orderLabel, planForOrder, type OrderKind } from './payment'
import { PLANS, formatEur } from './pricing'
import type { Entitlement } from '../src/price-engine/types'
import { zagrebTime } from './zagreb-time'

export type LifecycleEnv = EmailEnv & { DB: D1DatabaseLike; PUBLIC_APP_URL?: string; LIFECYCLE_EMAILS_ENABLED?: string }
export type LifecycleEvent = {
  id: string; tenantId?: string | null; type: string; entityId?: string | null; periodKey?: string | null;
  audience?: 'owner' | 'ops' | 'email'; email?: string | null; due?: string; payload?: Record<string, unknown>
}
type EventRow = { id: string; tenant_id: string | null; event_type: string; entity_id: string | null; period_key: string | null; audience: string; recipient_email: string | null; payload_json: string; scheduled_at: string }
type TenantRow = { id: string; slug: string; name: string }
type OrderRow = { reference: string; kind: OrderKind; status: string; amount_cents: number; payment_reported_at: string | null; created_at: string; confirmed_period_end:string|null;confirmed_plan:string|null }
export type EntitlementRow = { id: string; tenant_id: string; plan: Entitlement['plan']; status: Entitlement['status']; period_start: string | null; period_end: string | null; paid_confirmed_at: string | null; grace_until: string | null; updated_at?: string }
export function mapEntitlement(row: EntitlementRow): Entitlement {
  return { id: row.id, tenantId: row.tenant_id, plan: row.plan, status: row.status, periodStart: row.period_start, periodEnd: row.period_end, paidConfirmedAt: row.paid_confirmed_at, graceUntil: row.grace_until }
}
export const periodKeyFor = (row: Pick<EntitlementRow, 'id' | 'period_start' | 'period_end'>) => `${row.id}:${row.period_start}:${row.period_end}`
export function lifecycleStatement(db: D1DatabaseLike, event: LifecycleEvent, guard?: { sql: string; values: unknown[] }) {
  const stamp = new Date().toISOString()
  return db.prepare(`INSERT OR IGNORE INTO lifecycle_events (id,tenant_id,event_type,entity_id,period_key,audience,recipient_email,payload_json,scheduled_at,created_at,updated_at)
    SELECT ?,?,?,?,?,?,?,?,?,?,?${guard ? ' WHERE ' + guard.sql : ''}`)
    .bind(event.id, event.tenantId ?? null, event.type, event.entityId ?? null, event.periodKey ?? null, event.audience ?? 'owner', event.email ?? null, JSON.stringify(event.payload ?? {}), event.due ?? stamp, stamp, stamp, ...(guard?.values ?? []))
}

const DAY = 86_400_000
export function zagrebParts(date: Date) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zagreb', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(p => [p.type, p.value]))
}
export const zagrebDay = (date: Date) => { const p = zagrebParts(date); return `${p.year}-${p.month}-${p.day}` }
const dayDistance = (end: string, now: Date) => Math.round((Date.parse(zagrebDay(new Date(end))) - Date.parse(zagrebDay(now))) / DAY)
export function periodLifecycleStatements(db:D1DatabaseLike,row:EntitlementRow,now=new Date(),guard?:{sql:string;values:unknown[]}) {
  if(!row.period_end||row.status==='suspended')return []
  const key=periodKeyFor(row)
  const stages:Array<[string,number]>=[]
  const end=Date.parse(row.period_end)
  if(row.status==='trial')stages.push(['trial_expiring',end-3*3_600_000],['trial_expired',end])
  else if(row.paid_confirmed_at){
    for(const days of [30,7,1]){
      const date=new Date(Date.parse(zagrebDay(new Date(end)))-days*DAY).toISOString().slice(0,10)
      stages.push([`renewal_${days}d`,Date.parse(zagrebTime(date))])
    }
    if(row.grace_until)stages.push(['grace_started',end],['grace_3d',Date.parse(row.grace_until)-3*DAY],['deactivated',Date.parse(row.grace_until)])
  }
  return stages.filter(([,due])=>due>=now.getTime()).map(([type,due])=>lifecycleStatement(db,{id:`${key}:${type}`,tenantId:row.tenant_id,type,entityId:row.id,periodKey:key,due:new Date(due).toISOString()},guard))
}
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const when = (value: string) => new Intl.DateTimeFormat('hr-HR', { timeZone: 'Europe/Zagreb', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

/** Schedule only the currently relevant milestone; never replay historical stages. */
export async function scheduleLifecycle(env: LifecycleEnv, now = new Date(), after = '') {
  const rows = await env.DB.prepare("SELECT * FROM entitlements WHERE tenant_id > ? AND plan != 'validator' AND status != 'suspended' ORDER BY tenant_id LIMIT 50").bind(after).all<EntitlementRow>()
  const stamp = now.toISOString()
  for (const row of rows.results) {
    if (!row.period_end) continue
    const key = periodKeyFor(row)
    const planned=periodLifecycleStatements(env.DB,row,now)
    if(planned.length)await env.DB.batch(planned)
    const access = entitlementAccess(mapEntitlement(row), now.getTime())
    const order = await env.DB.prepare("SELECT reference FROM payment_orders WHERE tenant_id = ? AND status = 'pending' AND kind IN ('web_link','publisher','web_publisher') ORDER BY created_at DESC LIMIT 1").bind(row.tenant_id).first<{ reference: string }>()
    let type: string | undefined
    const remaining = Date.parse(row.period_end) - now.getTime()
    if (row.status === 'trial') {
      if (remaining > 0 && remaining <= 3 * 3_600_000 && !order) type = 'trial_expiring'
      if (remaining <= 0 && remaining > -DAY) type = 'trial_expired'
    } else if (row.paid_confirmed_at) {
      if (access.state === 'grace') {
        const graceRemaining = Date.parse(access.graceUntil!) - now.getTime()
        // The entry notice is relevant only near entry; no old "seven days" notice on day six.
        if (remaining <= 0 && remaining > -3_600_000) type = 'grace_started'
        else if (graceRemaining <= 3 * DAY && graceRemaining > 3 * DAY - 3_600_000) type = 'grace_3d'
      } else if (access.state === 'expired') {
        const end = access.accessUntil ?? row.period_end
        if (now.getTime() - Date.parse(end) >= 0 && now.getTime() - Date.parse(end) < DAY) type = 'deactivated'
      } else if (access.state === 'active' && Number(zagrebParts(now).hour) >= 9) {
        const days = dayDistance(row.period_end, now)
        if ([30, 7, 1].includes(days)) type = `renewal_${days}d`
      }
    }
    if (type) await lifecycleStatement(env.DB, { id: `${key}:${type}`, tenantId: row.tenant_id, type, entityId: row.id, periodKey: key, due: stamp }).run()
  }
  const orders = await env.DB.prepare("SELECT reference,tenant_id FROM payment_orders WHERE status = 'pending' AND payment_reported_at IS NULL AND created_at <= ? AND created_at > ? LIMIT 100").bind(new Date(now.getTime() - DAY).toISOString(), new Date(now.getTime() - 2 * DAY).toISOString()).all<{ reference: string; tenant_id: string }>()
  for (const order of orders.results) await lifecycleStatement(env.DB, { id: `order:${order.reference}:reminder`, tenantId: order.tenant_id, type: 'payment_reminder_24h', entityId: order.reference }).run()
  if (rows.results.length === 50) await scheduleLifecycle(env, now, rows.results[49].tenant_id)
}

/** Reminders the scheduler creates on its own. They wait for LIFECYCLE_EMAILS_ENABLED; everything else is a
 * direct answer to something that just happened (order, payment, inquiry, monitor incident) and is always sent. */
const SCHEDULED_EVENTS = ['trial_expiring','trial_expired','grace_started','grace_3d','deactivated','payment_reminder_24h']
const isScheduledEvent = (type: string) => SCHEDULED_EVENTS.includes(type) || type.startsWith('renewal_')
const SCHEDULED_EVENT_SQL = `(event_type IN (${SCHEDULED_EVENTS.map(type => `'${type}'`).join(',')}) OR event_type LIKE 'renewal_%')`

async function eligible(env: LifecycleEnv, event: EventRow, now: Date) {
  // A reminder that missed its moment (switch was off, outage) is dropped, never sent late.
  if (isScheduledEvent(event.event_type) && now.getTime() - Date.parse(event.scheduled_at) >= DAY) return false
  const row = event.tenant_id ? await env.DB.prepare('SELECT * FROM entitlements WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1').bind(event.tenant_id).first<EntitlementRow>() : null
  if (row?.status === 'suspended' && !event.event_type.startsWith('payment_') && event.event_type !== 'order_received') return false
  if (event.period_key) {
    if (!row || periodKeyFor(row) !== event.period_key) return false
    const access = entitlementAccess(mapEntitlement(row), now.getTime())
    if (event.event_type === 'trial_expiring') {
      if(access.state !== 'trial')return false
      const pending=await env.DB.prepare("SELECT number FROM payment_orders WHERE tenant_id=? AND status='pending' AND kind!='installation' LIMIT 1").bind(event.tenant_id).first()
      if(pending)return false
    }
    if (event.event_type === 'trial_expired' && (row.status !== 'trial' || access.live)) return false
    if (event.event_type.startsWith('renewal_') && (access.state !== 'active' || dayDistance(row.period_end!, now) !== Number(event.event_type.match(/\d+/)?.[0]))) return false
    if (event.event_type.startsWith('grace_') && access.state !== 'grace') return false
    if (event.event_type === 'deactivated' && access.live) return false
  }
  if (['payment_reminder_24h','payment_reported_customer','payment_reported_ops','payment_confirmed','order_received'].includes(event.event_type)) {
    const order = await env.DB.prepare('SELECT status,payment_reported_at FROM payment_orders WHERE reference = ? AND tenant_id = ?').bind(event.entity_id, event.tenant_id).first<{ status: string; payment_reported_at: string | null }>()
    if (!order || order.status === 'cancelled') return false
    if (event.event_type === 'payment_reminder_24h' && (order.status !== 'pending' || order.payment_reported_at)) return false
    if (event.event_type === 'order_received' && order.status !== 'pending') return false
    if (event.event_type === 'payment_confirmed' && order.status !== 'paid') return false
  }
  if (event.event_type === 'daily_publish_failed') {
    const payload = JSON.parse(event.payload_json) as { day?: string }
    const pub = await env.DB.prepare('SELECT published_at FROM price_publications WHERE tenant_id = ? AND is_current = 1').bind(event.tenant_id).first<{ published_at: string }>()
    if (!row || !entitlementAccess(mapEntitlement(row), now.getTime()).live || payload.day !== zagrebDay(now) || (pub && zagrebDay(new Date(pub.published_at)) === payload.day)) return false
  }
  if (event.event_type === 'monitor_problem') {
    const incident = await env.DB.prepare('SELECT resolved_at FROM monitor_incidents WHERE id = ?').bind(event.entity_id).first<{ resolved_at: string | null }>()
    if (!incident || incident.resolved_at) return false
  }
  return true
}

export async function lifecycleMessage(env: LifecycleEnv, event: EventRow) {
  const origin = (env.PUBLIC_APP_URL || 'https://digitalnicjenik.nepar.hr').replace(/\/$/, '')
  const tenant = event.tenant_id ? await env.DB.prepare('SELECT id,slug,name FROM tenants WHERE id = ?').bind(event.tenant_id).first<TenantRow>() : null
  const ent = event.tenant_id ? await env.DB.prepare('SELECT * FROM entitlements WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1').bind(event.tenant_id).first<EntitlementRow>() : null
  const pending = tenant ? await env.DB.prepare("SELECT reference,payment_reported_at FROM payment_orders WHERE tenant_id = ? AND status = 'pending' AND kind IN ('web_link','publisher','web_publisher') ORDER BY created_at DESC LIMIT 1").bind(tenant.id).first<{ reference: string;payment_reported_at:string|null }>() : null
  const order = event.entity_id ? await env.DB.prepare('SELECT * FROM payment_orders WHERE reference = ? AND tenant_id = ?').bind(event.entity_id, event.tenant_id).first<OrderRow>() : null
  const payload = JSON.parse(event.payload_json) as Record<string, string>
  const confirmed=event.event_type==='payment_confirmed'
  const targetPlan=order?(confirmed?order.confirmed_plan:planForOrder(order.kind)):ent?.plan
  const plan = PLANS[targetPlan === 'managed' ? 2 : targetPlan === 'publisher_self_service' ? 1 : 0]
  const paidEnd=confirmed?order?.confirmed_period_end:ent?.period_end
  const publicUrl = `${origin}/c/${tenant?.slug ?? ''}`
  let cta = 'Otvori dashboard'
  let url = pending ? `${origin}/app?order=${encodeURIComponent(pending.reference)}` : `${origin}/app`
  let subject = 'NEPAR digitalni cjenik'
  let lines: string[] = []
  const titles: Record<string,string> = {
    trial_expiring: 'Vaša besplatna objava uskoro istječe.', trial_expired: 'Vaš digitalni cjenik više nije aktivan.',
    grace_started: 'Pretplata je istekla — cjenik ostaje aktivan još 7 dana.', grace_3d: 'Cjenik će biti deaktiviran za 3 dana.', deactivated: 'Digitalni cjenik je deaktiviran.',
    renewal_30d: 'Vaša pretplata istječe za 30 dana.', renewal_7d: 'Vaš digitalni cjenik istječe za 7 dana.', renewal_1d: 'Vaš digitalni cjenik istječe sutra.',
    order_received: 'Narudžba je zaprimljena — podaci za uplatu', payment_reminder_24h: 'Podsjetnik: uplata još nije evidentirana',
    payment_reported_customer: 'Zaprimili smo vašu prijavu uplate.', payment_reported_ops: 'Nova prijavljena uplata', payment_confirmed: 'Uplata potvrđena — vaš digitalni cjenik je aktivan.',
    daily_publish_failed: 'Potrebna provjera: današnja objava cjenika nije uspjela', monitor_problem: payload.headline || 'Potrebna provjera digitalnog cjenika', monitor_recovery: 'Cjenik je ponovno dostupan', inquiry_received: 'Upit je zaprimljen', inquiry_ops: 'Novi zahtjev za NEPAR uslugu',
  }
  subject = titles[event.event_type] ?? subject
  if (tenant) lines.push(tenant.name,...(order?.kind==='installation'?[]:[`${plan.name} — ${formatEur(plan.price, true)}`]), `Javni cjenik: ${publicUrl}`)
  if (paidEnd&&order?.kind!=='installation') lines.push(`Plaćeno razdoblje / rok objave: ${when(paidEnd)}`)
  if (event.event_type.startsWith('grace_') && ent?.grace_until) lines.push(`Cjenik ostaje aktivan do ${when(ent.grace_until)}.`)
  if (event.event_type === 'deactivated' || event.event_type === 'trial_expired') lines.push('Aktualni javni link više nije aktivan. Podaci nisu izgubljeni; dashboard i zadržane verzije ostaju dostupni. Obnova ponovno aktivira isti link.')
  if (event.event_type.startsWith('trial_')) cta = pending ? 'Otvori narudžbu' : `Zadrži isti link — ${formatEur(PLANS[0].price, true)}`
  if (event.event_type.startsWith('renewal_') || event.event_type.startsWith('grace_') || event.event_type === 'deactivated') {
    cta = pending ? 'Otvori narudžbu' : event.event_type === 'deactivated' ? 'Ponovno aktiviraj' : 'Obnovi'
    if (!pending) url = `${origin}/app?renew=1`
    if (ent?.plan === 'managed' && !pending) lines.push('Web + Publisher obnavlja se dogovorom s NEPAR-om; odgovorite na ovu poruku.')
    if(pending?.payment_reported_at)lines.push('Uplata je prijavljena i čeka potvrdu. Ne trebate ponovno uplatiti.')
  }
  if (order) {
    lines.push(`${orderLabel(order.kind)} — ${formatCents(order.amount_cents)}`, `Referenca: ${order.reference}`)
    url = `${origin}/app?order=${encodeURIComponent(order.reference)}`
    if (['order_received','payment_reminder_24h'].includes(event.event_type)) {
      lines.push('Primatelj: Nepar, vl. Ivan Gorupić', 'IBAN: HR0623600001103276807', `Model: HR00 · poziv na broj: ${order.reference}`, 'HUB-3 2D barkod dostupan je na stranici narudžbe.'); cta = 'Uplatio sam'
    }
    if (order.payment_reported_at && order.status === 'pending') lines.push('Prijavu uplate smo zaprimili. Provjerit ćemo uplatu i aktivirati/produljiti paket nakon potvrde. Ne trebate ponovno uplatiti.')
    if (event.event_type === 'payment_confirmed') {
      if (order.kind === 'installation') { subject = 'Uplata za standardnu ugradnju je potvrđena'; lines.push('Ugradnju dogovaramo zasebno. Ova uplata ne produljuje pretplatu.') }
      else if (ent?.status === 'suspended') { subject = 'Uplata je potvrđena — pristup je još suspendiran'; lines.push('Javni pristup zahtijeva zasebnu reaktivaciju administratora.') }
      else if (ent?.plan === 'publisher_self_service' || ent?.plan === 'managed') lines.push('Cijene sada možete uređivati direktno u dashboardu.')
      cta = 'Otvori dashboard'
    }
    if (event.audience === 'ops') { subject += ` — ${tenant?.name ?? ''} — ${formatCents(order.amount_cents)} — ${order.reference}`; url = `${origin}/admin?tab=uplate&order=${encodeURIComponent(order.reference)}`; cta = 'Otvori narudžbu u adminu' }
  }
  if (event.event_type.startsWith('monitor_') || event.event_type === 'daily_publish_failed') lines.push(payload.message ?? 'Provjerite stanje objave u dashboardu.')
  if (event.audience === 'ops' && !order) { url = `${origin}/admin?tab=cjenici&tenant=${encodeURIComponent(tenant?.slug ?? '')}`; cta = 'Otvori admin' }
  if (event.event_type.startsWith('inquiry_')) lines.push(payload.message ?? 'Javit ćemo vam se nakon pregleda upita.')
  const text = [subject, '', ...lines, '', `${cta}: ${url}`, ...(event.event_type === 'payment_confirmed' && order?.kind !== 'installation' && tenant ? [`Otvori cjenik: ${publicUrl}`] : [])].join('\n')
  return { subject, text, html: `<html lang="hr"><body style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#17212b"><h1 style="font-size:23px">${escape(subject)}</h1>${lines.map(line => `<p>${escape(line)}</p>`).join('')}<p><a href="${escape(url)}">${escape(cta)}</a></p>${event.event_type === 'payment_confirmed' && order?.kind !== 'installation' && tenant ? `<p><a href="${escape(publicUrl)}">Otvori cjenik</a></p>` : ''}<p>Odgovorite na ovu poruku za pomoć: nepar@nepar.hr.</p></body></html>` }
}

export async function dispatchLifecycle(env: LifecycleEnv, now = new Date(), eventId?: string) {
  if (!emailConfigured(env)) return
  const scheduled = env.LIFECYCLE_EMAILS_ENABLED === 'true' ? '' : ` AND NOT ${SCHEDULED_EVENT_SQL}`
  const events = await env.DB.prepare(`SELECT * FROM lifecycle_events WHERE (status = 'pending' OR (status = 'processing' AND lease_until < ?)) AND scheduled_at <= ?${scheduled}${eventId ? ' AND id = ?' : ''} ORDER BY scheduled_at LIMIT 25`).bind(now.toISOString(), now.toISOString(), ...(eventId ? [eventId] : [])).all<EventRow>()
  for (const event of events.results) {
    const token = crypto.randomUUID()
    const claim = await env.DB.prepare("UPDATE lifecycle_events SET status='processing',lease_token=?,lease_until=?,updated_at=? WHERE id=? AND (status='pending' OR (status='processing' AND lease_until < ?))").bind(token, new Date(now.getTime()+300_000).toISOString(), now.toISOString(), event.id, now.toISOString()).run()
    if (!claim.meta?.changes) continue
    if (!await eligible(env,event,now)) { await env.DB.prepare("UPDATE lifecycle_events SET status='cancelled',lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=?").bind(event.id,token).run(); continue }
    const recipients = event.audience === 'owner'
      ? (await env.DB.prepare('SELECT u.email FROM tenant_members m JOIN auth_users u ON u.id=m.user_id WHERE m.tenant_id=? AND u.email_verified_at IS NOT NULL').bind(event.tenant_id).all<{email:string}>()).results.map(row=>row.email)
      : [event.audience === 'ops' ? env.EMAIL_TO || 'nepar@nepar.hr' : event.recipient_email || '']
    let attention = !recipients.filter(Boolean).length
    let retry = false
    for (const recipient of [...new Set(recipients.filter(Boolean).map(email=>email.trim().toLowerCase()))]) {
      await env.DB.prepare("INSERT OR IGNORE INTO lifecycle_deliveries(event_id,recipient,status) VALUES (?,?,'pending')").bind(event.id,recipient).run()
      const delivery = await env.DB.prepare('SELECT status,attempts FROM lifecycle_deliveries WHERE event_id=? AND recipient=?').bind(event.id,recipient).first<{status:string;attempts:number}>()
      if (delivery?.status === 'accepted') continue
      if (delivery?.status === 'sending' || delivery?.status === 'uncertain') { attention = true; continue }
      if ((delivery?.attempts ?? 0) >= 3) { attention=true; continue }
      if (!await eligible(env,event,now)) { retry = false; break }
      await env.DB.prepare("UPDATE lifecycle_deliveries SET status='sending',attempts=attempts+1,attempted_at=? WHERE event_id=? AND recipient=?").bind(now.toISOString(),event.id,recipient).run()
      try {
        const message = await lifecycleMessage(env,event)
        const receipt = await sendTransactionalEmail(env,{to:recipient,...message,replyTo:{email:'nepar@nepar.hr',name:'NEPAR'} })
        await env.DB.prepare("UPDATE lifecycle_deliveries SET status='accepted',sent_at=?,provider_id=?,provider_status=?,error=NULL WHERE event_id=? AND recipient=?").bind(new Date().toISOString(),receipt?.messageId ?? null,receipt?.status ?? 'accepted',event.id,recipient).run()
      } catch (error) {
        const definite = error instanceof Error && ['email_misconfigured','email_rejected','email_rate_limited'].includes(error.message)
        const safeRetry = error instanceof Error && error.message === 'email_rate_limited'
        await env.DB.prepare('UPDATE lifecycle_deliveries SET status=?,error=? WHERE event_id=? AND recipient=?').bind(definite?'failed':'uncertain',error instanceof Error?error.message:'unknown',event.id,recipient).run()
        retry ||= safeRetry
        attention ||= !safeRetry
      }
    }
    await env.DB.prepare('UPDATE lifecycle_events SET status=?,lease_token=NULL,lease_until=NULL,updated_at=? WHERE id=? AND lease_token=?').bind(attention?'attention':retry?'pending':'completed',new Date().toISOString(),event.id,token).run()
  }
}
