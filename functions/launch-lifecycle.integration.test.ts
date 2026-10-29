import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { env } from 'cloudflare:test'
import { createDraft,publishDraft,readCurrentPublication,type RuntimeEnv } from './_repository'
import { onRequestGet as csv } from './c/[slug]/aktualni.csv'
import { onRequestGet as xml } from './c/[slug]/aktualni.xml'
import { onRequestGet as html } from './c/[slug]/index'
import { onRequestGet as archived } from './c/[slug]/[filename].csv'
import { resolvePublicationSeo,listIndexablePublicationUrls } from './_public-seo'
import { applyOperation } from './_operations'
import { dailyPublication } from '../shared/daily-publication'
import { dispatchLifecycle,scheduleLifecycle,lifecycleStatement,periodLifecycleStatements,type EntitlementRow } from '../shared/lifecycle'
import { runTenantCheck } from '../shared/compliance/run-check'
import { zagrebEndOfDay,zagrebTime } from '../shared/zagreb-time'
import type { NormalizedPriceList } from '../src/price-engine/types'
import { placeOrder } from './_orders'

const NOW=new Date('2026-11-02T05:30:00.000Z') // Monday 06:30 in Zagreb, following Sunday's expiry.
const END='2026-11-01T09:00:00.000Z'
const GRACE='2026-11-08T09:00:00.000Z'
const tenant={id:'launch-store',slug:'launch-store',name:'Launch store'}
const list:NormalizedPriceList={tenant,source:'nepar',currency:'EUR',updatedAt:'2026-10-30T05:30:00.000Z',items:[{externalId:'M1',name:'Milk',type:'Proizvod',brand:'Dukat',barcode:'4006381333931',unit:'l',unitPrice:1.2,price:1.2,anchorPrice:1.1,anchorReferenceDate:'2025-05-02',specialSaleApplied:false,availability:'dostupno'}]}
const runtime:RuntimeEnv={DB:env.DB,DAILY_PUBLICATION_ENABLED:'true',ASSETS:{fetch:async()=>new Response('<!doctype html><html><head></head><body><div id="root"></div></body></html>')}}
const billing={customerType:'company',billingName:tenant.name,oib:'69435151530',address:'Ilica 10',postalCity:'10000 Zagreb',email:'old@example.hr'}
const actor={id:'admin',email:'nepar@nepar.hr',type:'admin' as const}
const row=async()=>(await env.DB.prepare('SELECT * FROM entitlements WHERE tenant_id=?').bind(tenant.id).first<EntitlementRow>())!
async function seed(){
  const draft=await createDraft(runtime,tenant.slug,list,'prices.csv','test')
  expect(draft.validation.blockingCount).toBe(0)
  await env.DB.batch([
    env.DB.prepare("UPDATE publication_metadata SET object_type='trgovina',object_address='Ilica 10',object_code='P1',compliance_profile='products',updated_at=? WHERE tenant_id=?").bind(list.updatedAt,tenant.id),
    env.DB.prepare("INSERT INTO entitlements(id,tenant_id,plan,status,period_start,period_end,paid_confirmed_at,grace_until,created_at,updated_at) VALUES ('store-ent',?,'publisher_self_service','active','2025-11-01',?,'2025-11-01',?,?,?)").bind(tenant.id,END,GRACE,list.updatedAt,list.updatedAt),
  ])
  return (await publishDraft(runtime,tenant.slug,draft.draft!.id,false,{now:new Date(list.updatedAt)})).publication!
}
beforeEach(async()=>{
  vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(NOW)
  await env.DB.batch(['lifecycle_events','admin_audit','payment_orders','monitor_incidents','daily_publication_jobs','monitor_runs','monitor_state','sync_logs','price_publications','price_list_versions','price_uploads','publication_targets','publication_metadata','entitlements','tenant_members','auth_sessions','auth_users','tenants'].map(table=>env.DB.prepare(`DELETE FROM ${table}`)))
})
afterEach(()=>vi.useRealTimers())

it('keeps HTML, CSV, XML and embed available throughout paid grace, then returns 410 at its exact end',async()=>{
  await seed()
  const get=async(handler:typeof csv,path:string)=>handler({request:new Request('https://app.test/c/'+tenant.slug+path),params:{slug:tenant.slug},env:runtime})
  for(const instant of [END,new Date(Date.parse(GRACE)-1).toISOString()]){
    vi.setSystemTime(new Date(instant))
    for(const [handler,path] of [[csv,'/aktualni.csv'],[xml,'/aktualni.xml'],[html,''],[html,'?embed=1']] as const)expect((await get(handler,path)).status).toBe(200)
    expect((await resolvePublicationSeo(runtime,tenant.slug,'current')).index).toBe(true)
    expect((await listIndexablePublicationUrls(runtime)).length).toBe(4)
  }
  vi.setSystemTime(new Date(GRACE))
  for(const [handler,path] of [[csv,'/aktualni.csv'],[xml,'/aktualni.xml'],[html,''],[html,'?embed=1']] as const)expect((await get(handler,path)).status).toBe(410)
  expect((await listIndexablePublicationUrls(runtime)).length).toBe(0)
})
it('allows manual and automatic publication during grace and automates only the published product state',async()=>{
  const original=await seed()
  const unsaved=await createDraft(runtime,tenant.slug,{...list,items:[{...list.items[0],price:99}]},'unfinished.csv','owner')
  expect(unsaved.draft).toBeTruthy()
  const daily=await dailyPublication({...runtime,DB:env.DB},tenant.slug,NOW)
  expect(daily.status).toBe('published')
  const current=await readCurrentPublication(runtime,tenant.slug)
  expect(current?.payload.items[0].price).toBe(1.2)
  expect(current?.sequence).toBe(original.sequence+1)
  expect((await dailyPublication({...runtime,DB:env.DB},tenant.slug,NOW)).status).toBe('already_published')
  const manual=await createDraft(runtime,tenant.slug,{...list,items:[{...list.items[0],price:2}]},'replacement.csv','owner')
  expect((await publishDraft(runtime,tenant.slug,manual.draft!.id)).changed).toBe(true)
})
it('atomically refuses to overwrite a newer manual publication',async()=>{
  const original=await seed()
  const daily=await createDraft(runtime,tenant.slug,{...list,updatedAt:NOW.toISOString()},'daily.csv','daily-publication')
  const manual=await createDraft(runtime,tenant.slug,{...list,items:[{...list.items[0],price:8}]},'manual.csv','owner')
  await env.DB.prepare('UPDATE price_uploads SET base_publication_id=?,base_metadata_updated_at=? WHERE id=?').bind(original.id,list.updatedAt,daily.draft!.id).run()
  let raced=false
  const wrapped={...runtime,DB:{prepare:(sql:string)=>env.DB.prepare(sql),batch:async(statements:Parameters<NonNullable<RuntimeEnv['DB']>['batch']>[0])=>{
    if(!raced){raced=true;await publishDraft(runtime,tenant.slug,manual.draft!.id)}
    return env.DB.batch(statements as never)
  }}}
  await expect(publishDraft(wrapped,tenant.slug,daily.draft!.id,false,{now:NOW,expectedCurrentId:original.id})).rejects.toThrow()
  expect((await readCurrentPublication(runtime,tenant.slug))?.payload.items[0].price).toBe(8)
  expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM price_publications WHERE is_current=1').first<{n:number}>())?.n).toBe(1)
})
it('does not give trial, pending or free manual activation grace; suspension also blocks retained files',async()=>{
  const original=await seed()
  await env.DB.prepare("UPDATE entitlements SET status='trial',paid_confirmed_at=NULL,grace_until=NULL").run()
  const {order}=await placeOrder(runtime,tenant,{kind:'web_link',...billing},NOW)
  const context={request:new Request('https://app.test/c/launch-store/aktualni.csv'),params:{slug:tenant.slug},env:runtime}
  expect((await csv(context)).status).toBe(410)
  await applyOperation(env.DB,actor,tenant,{action:'cancel_order',reference:order.reference,reason:'Test cancellation',requestKey:'cancel-trial'},NOW)
  await applyOperation(env.DB,actor,tenant,{action:'activate',reason:'Free demonstration',requestKey:'free-activate'},NOW)
  expect((await row()).paid_confirmed_at).toBeNull()
  expect((await row()).grace_until).toBeNull()
  await applyOperation(env.DB,actor,tenant,{action:'suspend',reason:'Test suspension',requestKey:'suspend-test'},NOW)
  expect((await csv(context)).status).toBe(410)
  expect((await archived({...context,params:{slug:tenant.slug,filename:original.filenameStem}})).status).toBe(404)
})
it('retains immutable archive files after grace expires',async()=>{
  const original=await seed()
  vi.setSystemTime(new Date(GRACE))
  const response=await archived({request:new Request(`https://app.test/c/${tenant.slug}/${original.filenameStem}.csv`),params:{slug:tenant.slug,filename:original.filenameStem},env:runtime})
  expect(response.status).toBe(200)
})
it('uses current verified owners at send, preserves sent history and sets Reply-To',async()=>{
  await seed()
  await env.DB.batch([
    env.DB.prepare("INSERT INTO auth_users(id,email,email_verified_at,created_at,updated_at) VALUES ('owner','old@example.hr',?,?,?)").bind(NOW.toISOString(),NOW.toISOString(),NOW.toISOString()),
    env.DB.prepare("INSERT INTO tenant_members(id,tenant_id,user_id,role,created_at) VALUES ('member',?,'owner','owner',?)").bind(tenant.id,NOW.toISOString()),
  ])
  await lifecycleStatement(env.DB,{id:'owner-test',tenantId:tenant.id,type:'inquiry_received'}).run()
  await env.DB.prepare("UPDATE auth_users SET email='new@example.hr'").run()
  const sent:Array<{to:string|string[];replyTo?:unknown}>=[]
  const mailEnv={DB:env.DB,LIFECYCLE_EMAILS_ENABLED:'true',EMAIL_FROM:'publisher@nepar.hr',EMAIL:{send:async(message:{to:string|string[];replyTo?:unknown})=>{sent.push(message);return {messageId:'provider-1'}}}}
  await dispatchLifecycle(mailEnv,NOW)
  expect(sent[0]).toMatchObject({to:'new@example.hr',replyTo:{email:'nepar@nepar.hr'}})
  await env.DB.prepare("UPDATE auth_users SET email='third@example.hr'").run()
  await dispatchLifecycle(mailEnv,NOW)
  expect(sent).toHaveLength(1)
  expect(await env.DB.prepare('SELECT recipient,status,provider_id FROM lifecycle_deliveries').first()).toMatchObject({recipient:'new@example.hr',status:'accepted',provider_id:'provider-1'})
  await env.DB.prepare('UPDATE auth_users SET email_verified_at=NULL').run()
  await lifecycleStatement(env.DB,{id:'unverified-test',tenantId:tenant.id,type:'inquiry_received'}).run()
  await dispatchLifecycle(mailEnv,NOW)
  expect(sent).toHaveLength(1)
  expect(await env.DB.prepare("SELECT status FROM lifecycle_events WHERE id='unverified-test'").first()).toMatchObject({status:'attention'})
})
it('deduplicates grace events and cancels the old period on confirmed renewal',async()=>{
  await seed()
  vi.setSystemTime(new Date(END))
  await scheduleLifecycle({DB:env.DB},new Date(END));await scheduleLifecycle({DB:env.DB},new Date(END))
  expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM lifecycle_events WHERE event_type='grace_started'").first<{n:number}>())?.n).toBe(1)
  const {order}=await placeOrder(runtime,tenant,{kind:'publisher',...billing},new Date(END))
  await applyOperation(env.DB,actor,tenant,{action:'confirm_payment',reference:order.reference},new Date(END))
  expect((await row()).period_end).toBe(new Date(Date.parse(END)+365*86_400_000).toISOString())
  expect(await env.DB.prepare("SELECT status FROM lifecycle_events WHERE event_type='grace_started' ORDER BY scheduled_at LIMIT 1").first()).toMatchObject({status:'cancelled'})
})
it('plans renewal at 09:00 Zagreb across daylight-saving changes, without retroactive reminders',async()=>{
  await seed()
  const entitlement={...await row(),period_start:'2026-02-01',period_end:'2026-04-05T10:00:00.000Z',grace_until:'2026-04-12T10:00:00.000Z'}
  const statements=periodLifecycleStatements(env.DB,entitlement,new Date('2026-02-01'))
  await env.DB.batch(statements)
  const events=(await env.DB.prepare("SELECT event_type,scheduled_at FROM lifecycle_events WHERE event_type LIKE 'renewal_%' ORDER BY scheduled_at").all<{event_type:string;scheduled_at:string}>()).results
  expect(events.map(event=>event.scheduled_at)).toEqual(['2026-03-06T08:00:00.000Z','2026-03-29T07:00:00.000Z','2026-04-04T07:00:00.000Z'])
  expect(zagrebEndOfDay('2026-03-29')).toBe('2026-03-29T21:59:59.999Z')
  expect(zagrebTime('2026-10-25',7,15)).toBe('2026-10-25T06:15:00.000Z')
})
it('watchdog alerts each audience once at 07:15 Zagreb, including Web Link',async()=>{
  await seed()
  await env.DB.prepare("UPDATE entitlements SET plan='web_link'").run()
  expect((await dailyPublication({...runtime,DB:env.DB},tenant.slug,new Date('2026-11-02T06:14:00Z'),true)).status).toBe('outside_watchdog')
  for(let i=0;i<2;i++)await dailyPublication({...runtime,DB:env.DB},tenant.slug,new Date('2026-11-02T06:15:00Z'),true)
  expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM lifecycle_events WHERE event_type='daily_publish_failed'").first<{n:number}>())?.n).toBe(2)
})
it('continues Publisher monitoring during paid grace, but skips it after deactivation',async()=>{
  await seed()
  const failed:typeof fetch=async()=>new Response('down',{status:503})
  expect((await runTenantCheck({DB:env.DB},{slug:tenant.slug,trigger:'manual',now:NOW,fetcher:failed})).status).toBe('checked')
  expect(await runTenantCheck({DB:env.DB},{slug:tenant.slug,trigger:'manual',now:new Date(GRACE),fetcher:failed})).toMatchObject({status:'skipped',reason:'not_live'})
})
it('sends transactional mail while reminders are switched off, and drops reminders that missed their moment',async()=>{
  const sent:Array<{to:string|string[]}>=[]
  const mailEnv=(enabled:string)=>({DB:env.DB,LIFECYCLE_EMAILS_ENABLED:enabled,EMAIL_FROM:'publisher@nepar.hr',EMAIL:{send:async(message:{to:string|string[]})=>{sent.push(message);return {messageId:'provider-1'}}}})
  await lifecycleStatement(env.DB,{id:'inquiry-now',type:'inquiry_received',audience:'email',email:'kupac@example.hr',due:NOW.toISOString()}).run()
  await lifecycleStatement(env.DB,{id:'reminder-now',type:'trial_expiring',audience:'email',email:'kupac@example.hr',due:NOW.toISOString()}).run()
  await dispatchLifecycle(mailEnv('false'),NOW)
  expect(sent).toHaveLength(1)
  expect(await env.DB.prepare("SELECT status FROM lifecycle_events WHERE id='reminder-now'").first()).toMatchObject({status:'pending'})
  // Switching reminders on two days later must not replay the stale one.
  await dispatchLifecycle(mailEnv('true'),new Date(NOW.getTime()+2*86_400_000))
  expect(sent).toHaveLength(1)
  expect(await env.DB.prepare("SELECT status FROM lifecycle_events WHERE id='reminder-now'").first()).toMatchObject({status:'cancelled'})
})
