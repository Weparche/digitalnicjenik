import { beforeEach,afterEach,expect,it,vi } from 'vitest'
import { env } from 'cloudflare:test'
import { recordCheckerRun } from './_checker-history'
import { dispatchLifecycle,lifecycleStatement } from '../shared/lifecycle'
import { onRequestPost } from './api/digitalni-cjenik/check'
import { handleLeadRequest,type LeadEnv } from './_lead'
import type { WebsiteCheckResult } from '../shared/website-check'

const incomplete:WebsiteCheckResult={status:'red',message:'Nema cjenika.',details:{reachable:true,homepageReadable:true,https:true}}
const complete:WebsiteCheckResult={status:'green',message:'Prolazi.',details:{reachable:true,homepageReadable:true,https:true,pricePageFound:true,csvFound:true,xmlFound:true,csvUrl:'https://salon.hr/cjenik.csv',xmlUrl:'https://salon.hr/cjenik.xml',publicLinkUrl:'https://salon.hr/cjenik.csv',archiveFound:true,structureStatus:'pass',contentStatus:'pass',publicationFindings:[]}}
beforeEach(async()=>{await env.DB.batch(['lifecycle_events','checker_runs','lead_inquiries','lead_delivery_attempts','checker_rate_buckets'].map(table=>env.DB.prepare(`DELETE FROM ${table}`)))})
afterEach(()=>vi.unstubAllGlobals())
function mailRuntime(){const sent:Array<{to:string|string[];subject:string;text?:string;html?:string;replyTo?:unknown}>=[];return {sent,runtime:{DB:env.DB,EMAIL_FROM:'publisher@nepar.hr',EMAIL_TO:'nepar@nepar.hr',LIFECYCLE_EMAILS_ENABLED:'false',EMAIL:{send:async(message:typeof sent[number])=>{sent.push(message);return {messageId:'accepted-'+sent.length}}}}}}

it('records incomplete checks without creating or sending any scan notification',async()=>{
  const {runtime,sent}=mailRuntime(),now=new Date('2026-10-30T10:00:00Z')
  await recordCheckerRun(env.DB,'https://salon.hr/',incomplete,null,'landing',now)
  await recordCheckerRun(env.DB,'https://salon.hr/other',incomplete,null,'dashboard',now)
  expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM checker_runs').first())?.n).toBe(2)
  expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM lifecycle_events').first())?.n).toBe(0)
  await dispatchLifecycle(runtime,now)
  expect(sent).toHaveLength(0)
})
it('does not create checker notifications for a complete 9/9 result',async()=>{
  await recordCheckerRun(env.DB,'https://salon.hr/',complete,null,'dashboard')
  expect(await env.DB.prepare('SELECT score FROM checker_runs').first()).toMatchObject({score:9})
  expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM lifecycle_events').first())?.n).toBe(0)
})
it('public checker POST does not send mail, even when email is configured',async()=>{
  const {runtime,sent}=mailRuntime(),pending:Promise<unknown>[]=[]
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('missing',{status:404})))
  const response=await onRequestPost({request:new Request('https://app.test/api/digitalni-cjenik/check',{method:'POST',body:JSON.stringify({url:'https://example.com',source:'dashboard'})}),env:{...runtime,CHECKER_RATE_LIMIT_SECRET:'secret',DIGITAL_PRICE_LIST_DNS_RESOLVER:{resolve4:async()=>['93.184.216.34'],resolve6:async()=>[]}},waitUntil:promise=>{pending.push(promise)}})
  expect(response.status).toBe(200);await Promise.all(pending);expect(sent).toHaveLength(0)
  expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM lifecycle_events').first())?.n).toBe(0)
})
it('workspace contact sends the volunteered email and trusted stored analysis to ops exactly once',async()=>{
  const {runtime,sent}=mailRuntime(),run=await recordCheckerRun(env.DB,'https://salon.hr/',incomplete,null,'dashboard')
  const submissionId=crypto.randomUUID(),form=new FormData()
  Object.entries({submissionId,intent:'consultation',name:'Salon',email:'owner@salon.hr',website:'https://salon.hr/',message:'Pomozite s ovim rezultatom.',privacy:'on','cf-turnstile-response':'valid',context:JSON.stringify({workspaceContact:true,checkerRunId:run,checkerScore:9})}).forEach(([key,value])=>form.set(key,value))
  const leadEnv={...runtime,TURNSTILE_SECRET_KEY:'test',LEAD_RATE_LIMIT_SECRET:'test'} as LeadEnv
  const request=()=>new Request('https://app.test/api/leads/digitalni-cjenik',{method:'POST',headers:{origin:'https://app.test'},body:form})
  const verify=(async()=>Response.json({success:true,action:'turnstile-spin-v2',hostname:'app.test'})) as typeof fetch
  expect((await handleLeadRequest(request(),leadEnv,verify)).status).toBe(200)
  expect((await handleLeadRequest(request(),leadEnv,verify)).status).toBe(200)
  await dispatchLifecycle(runtime,new Date(),`lead:${submissionId}:ops`)
  expect(sent).toHaveLength(1);expect(sent[0].to).toBe('nepar@nepar.hr');expect(sent[0].text).toContain('owner@salon.hr');expect(sent[0].text).toContain('2/9 (spremljeni rezultat)');expect(sent[0].text).toContain('Web stranica dostupna');expect(sent[0].text).not.toContain('9/9')
  expect(await env.DB.prepare('SELECT lead_id FROM checker_runs WHERE id=?').bind(run).first()).toMatchObject({lead_id:submissionId})
})

it('suppresses scan-only events from older builds without blocking explicit inquiries',async()=>{
  const {runtime,sent}=mailRuntime()
  await lifecycleStatement(env.DB,{id:'retired-check',type:'inquiry_checker_attention',audience:'ops',payload:{message:'No user requested help'}}).run()
  await dispatchLifecycle(runtime)
  expect(sent).toHaveLength(0)
  expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM lifecycle_events').first())?.n).toBe(0)
})
