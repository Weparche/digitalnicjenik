import { beforeEach,expect,it,vi } from 'vitest'
import { env } from 'cloudflare:test'
import { applyOperation } from './_operations'
import { placeOrder } from './_orders'
import { entitlementAccess,entitlementIsLive } from '../shared/entitlements'
import { mapEntitlement,dispatchLifecycle,scheduleLifecycle,type EntitlementRow } from '../shared/lifecycle'
import { requireAdmin } from './_admin-auth'
import { sha256Hex,requestMagicLink,consumeMagicLink } from './_auth'
import { onRequestPost as report } from './api/orders/report'
import { onRequestGet as dashboard } from './api/ops/dashboard'

const now=new Date('2026-11-02T09:00:00.000Z') // Monday after Sunday's paid expiry.
const tenant={id:'launch-tenant',slug:'launch',name:'Launch salon'}
const actor={id:'admin-test',email:'nepar@nepar.hr',type:'admin' as const}
const billing={customerType:'company',billingName:'Launch salon',oib:'69435151530',address:'Ilica 10',postalCity:'10000 Zagreb',email:'owner@example.hr'}
const runtime={DB:env.DB,ADMIN_EMAILS:'nepar@nepar.hr'}
async function entitlement(){return (await env.DB.prepare('SELECT * FROM entitlements WHERE tenant_id=?').bind(tenant.id).first<EntitlementRow>())!}
async function session(email:string,id:string){
  await env.DB.prepare('INSERT INTO auth_users(id,email,email_verified_at,created_at,updated_at) VALUES (?,?,?,?,?)').bind(id,email,now.toISOString(),now.toISOString(),now.toISOString()).run()
  await env.DB.prepare('INSERT INTO auth_sessions(id,user_id,token_hash,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?,?)').bind(id,id,await sha256Hex(id),'2099-01-01',now.toISOString(),now.toISOString()).run()
  return new Request('https://app.test/api/ops/dashboard',{headers:{cookie:`nepar_session=${id}`}})
}
beforeEach(async()=>{
  await env.DB.batch([
    env.DB.prepare('DELETE FROM lifecycle_events'),env.DB.prepare('DELETE FROM admin_audit'),env.DB.prepare('DELETE FROM payment_orders'),
    env.DB.prepare('DELETE FROM entitlements'),env.DB.prepare('DELETE FROM tenants'),env.DB.prepare('DELETE FROM auth_sessions'),env.DB.prepare('DELETE FROM magic_link_tokens'),env.DB.prepare('DELETE FROM auth_users'),
  ])
  await env.DB.batch([
    env.DB.prepare("INSERT INTO tenants(id,slug,name,currency,created_at,updated_at) VALUES (?,?,?,'EUR',?,?)").bind(tenant.id,tenant.slug,tenant.name,now.toISOString(),now.toISOString()),
    env.DB.prepare("INSERT INTO entitlements(id,tenant_id,plan,status,period_start,period_end,created_at,updated_at) VALUES ('launch-ent',?,'web_link','trial','2026-10-31T09:00:00.000Z','2026-11-01T09:00:00.000Z',?,?)").bind(tenant.id,now.toISOString(),now.toISOString()),
  ])
})
it('does not extend a trial on order/report; a concrete confirmed annual payment enables grace',async()=>{
  const placed=await placeOrder(runtime,tenant,{kind:'publisher',...billing},now)
  expect(placed.order.amount_cents).toBe(4990)
  expect(placed.activeUntil).toBe('2026-11-01T09:00:00.000Z')
  expect(entitlementIsLive(mapEntitlement(await entitlement()),now.getTime())).toBe(false)
  const result=await applyOperation(env.DB,actor,tenant,{action:'confirm_payment',reference:placed.order.reference},now)
  expect(result.plan).toBe('publisher_self_service')
  const row=await entitlement()
  expect(row.grace_until).toBe(new Date(Date.parse(row.period_end!)+7*86_400_000).toISOString())
  expect(entitlementAccess(mapEntitlement(row),Date.parse(row.period_end!)).state).toBe('grace')
  expect(entitlementIsLive(mapEntitlement(row),Date.parse(row.grace_until!)-1)).toBe(true)
  expect(entitlementIsLive(mapEntitlement(row),Date.parse(row.grace_until!))).toBe(false)
})
it('confirms the same order concurrently once, with one audit and one confirmation event',async()=>{
  const {order}=await placeOrder(runtime,tenant,{kind:'web_link',...billing},now)
  const input={action:'confirm_payment',reference:order.reference}
  await Promise.all([applyOperation(env.DB,actor,tenant,input,now),applyOperation(env.DB,actor,tenant,input,now)])
  const first=await entitlement()
  await applyOperation(env.DB,actor,tenant,input,new Date(now.getTime()+86_400_000))
  expect((await entitlement()).period_end).toBe(first.period_end)
  expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_audit').first<{n:number}>())?.n).toBe(1)
  expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM lifecycle_events WHERE event_type='payment_confirmed'").first<{n:number}>())?.n).toBe(1)
})
it('legacy paid grace survives the weekend; report does not lengthen grace; renewal uses paid end, not grace end',async()=>{
  await env.DB.prepare("UPDATE entitlements SET status='active',paid_confirmed_at='2025-11-01',grace_until='2026-11-08T09:00:00.000Z'").run()
  expect(entitlementAccess(mapEntitlement(await entitlement()),now.getTime()).state).toBe('grace')
  const {order}=await placeOrder(runtime,tenant,{kind:'web_link',...billing},now)
  await env.DB.prepare('UPDATE payment_orders SET payment_reported_at=? WHERE reference=?').bind(now.toISOString(),order.reference).run()
  expect((await entitlement()).grace_until).toBe('2026-11-08T09:00:00.000Z')
  await applyOperation(env.DB,actor,tenant,{action:'confirm_payment',reference:order.reference},now)
  expect((await entitlement()).period_end).toBe(new Date(now.getTime()+365*86_400_000).toISOString())
})
it('requires an admin session on all operational reads; admin does not need membership',async()=>{
  await expect(requireAdmin(new Request('https://app.test/api/ops/dashboard'),runtime)).rejects.toMatchObject({status:401})
  const owner=await session('owner@example.hr','owner-test')
  await expect(requireAdmin(owner,runtime)).rejects.toMatchObject({status:403})
  const admin=await session('nepar@nepar.hr','admin-test')
  expect(await requireAdmin(admin,runtime)).toMatchObject({email:'nepar@nepar.hr'})
  const response=await dashboard({request:admin,env:runtime})
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('no-store')
})
it('admin magic link is single-use and preserves a safe admin destination',async()=>{
  let body=''
  const authEnv={...runtime,LEAD_RATE_LIMIT_SECRET:'test-secret',EMAIL_FROM:'publisher@nepar.hr',EMAIL:{send:async(message:{text?:string})=>{body=message.text??'';return {messageId:'fake'}}}}
  await requestMagicLink(new Request('https://app.test/api/auth/magic-link'),authEnv,'nepar@nepar.hr',fetch,'/admin?tab=uplate&order=2026-1')
  const token=body.match(/token=([a-f0-9]+)/)?.[1]
  expect(token).toBeTruthy()
  const results=await Promise.allSettled([consumeMagicLink(authEnv,token!),consumeMagicLink(authEnv,token!)])
  expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1)
  const success=results.find(result=>result.status==='fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<typeof consumeMagicLink>>>
  expect(success.value.returnPath).toBe('/admin?tab=uplate&order=2026-1')
})
it('reporting a payment creates exactly two notifications and never activates a trial',async()=>{
  await session('owner@example.hr','owner-test')
  await env.DB.prepare("INSERT INTO tenant_members(id,tenant_id,user_id,role,created_at) VALUES ('owner-member',?,'owner-test','owner',?)").bind(tenant.id,now.toISOString()).run()
  const {order}=await placeOrder(runtime,tenant,{kind:'web_link',...billing},now)
  const request=()=>new Request('https://app.test/api/orders/report',{method:'POST',headers:{origin:'https://app.test',cookie:'nepar_session=owner-test','content-type':'application/json'},body:JSON.stringify({reference:order.reference})})
  expect((await report({request:request(),env:runtime})).status).toBe(200)
  expect((await report({request:request(),env:runtime})).status).toBe(200)
  expect((await entitlement()).status).toBe('trial')
  expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM lifecycle_events WHERE event_type LIKE 'payment_reported_%'").first<{n:number}>())?.n).toBe(2)
})
