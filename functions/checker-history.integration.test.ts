import { beforeEach,afterEach,expect,it,vi } from 'vitest'
import { env } from 'cloudflare:test'
import { checkerHistoryUrl,recordCheckerRun,checkerRunCounts } from './_checker-history'
import { onRequestPost as check } from './api/digitalni-cjenik/check'
import { onRequestGet as history } from './api/ops/checks'
import { createSessionForUser } from './_auth'
import { handleLeadRequest,type LeadEnv } from './_lead'
import type { WebsiteCheckResult } from '../shared/website-check'

const runtime={DB:env.DB,ADMIN_EMAILS:'nepar@nepar.hr'}
const result:WebsiteCheckResult={status:'red',message:'No file',details:{reachable:true,homepageReadable:true,https:true,csvFound:false,xmlFound:false}}
async function adminRequest(query=''){
  const stamp=new Date().toISOString()
  await env.DB.prepare("INSERT OR IGNORE INTO auth_users(id,email,email_verified_at,created_at,updated_at) VALUES ('checker-admin','nepar@nepar.hr',?,?,?)").bind(stamp,stamp,stamp).run()
  const session=await createSessionForUser(runtime,'checker-admin')
  return new Request('https://app.test/api/ops/checks'+query,{headers:{cookie:'nepar_session='+session.sessionToken}})
}
beforeEach(async()=>{await env.DB.batch([env.DB.prepare('DELETE FROM checker_runs'),env.DB.prepare('DELETE FROM lead_inquiries'),env.DB.prepare('DELETE FROM lead_delivery_attempts'),env.DB.prepare('DELETE FROM checker_rate_buckets')])})
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers()})

it('records the real public checker result without registration, bodies, IPs or query tokens',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('not found',{status:404})))
  const response=await check({request:new Request('https://app.test/api/digitalni-cjenik/check',{method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':'203.0.113.20'},body:JSON.stringify({url:'https://example.com/?private_token=secret#email',source:'landing',email:'invented@example.hr'})}),env:{...runtime,CHECKER_RATE_LIMIT_SECRET:'secret',DIGITAL_PRICE_LIST_DNS_RESOLVER:{resolve4:async()=>['93.184.216.34'],resolve6:async()=>[]}}})
  expect(response.status).toBe(200)
  const output=await response.json() as {checkerRunId:string;report:{score:number}}
  const row=await env.DB.prepare('SELECT * FROM checker_runs WHERE id=?').bind(output.checkerRunId).first()
  expect(row).toMatchObject({hostname:'example.com',url:'https://example.com/',score:output.report.score,lead_id:null,source:'landing'})
  expect(JSON.parse(String(row?.checks_json))).toHaveLength(9)
  expect(JSON.stringify(row)).not.toMatch(/private_token|203\.0\.113|invented@example|not found/)
  expect(response.headers.get('cache-control')).toBe('no-store')
})
it('never breaks the public checker when history storage is unavailable',async()=>{
  const error=vi.spyOn(console,'error').mockImplementation(()=>{})
  await expect(recordCheckerRun({prepare:()=>{throw new Error('storage down')},batch:async()=>[]},'https://example.com/',result,null,'landing')).resolves.toBeNull()
  error.mockRestore()
  expect(checkerHistoryUrl('https://name:password@example.com/feed.csv?token=secret#x')).toBe('https://example.com/feed.csv')
  expect(checkerHistoryUrl('javascript:alert(1)')).toBeNull()
})
it('requires admin authorization and returns no-store on both denied and successful reads',async()=>{
  const anonymous=await history({request:new Request('https://app.test/api/ops/checks'),env:runtime})
  expect(anonymous.status).toBe(401);expect(anonymous.headers.get('cache-control')).toBe('no-store')
  const stamp=new Date().toISOString()
  await env.DB.prepare("INSERT OR IGNORE INTO auth_users(id,email,email_verified_at,created_at,updated_at) VALUES ('checker-owner','owner@example.hr',?,?,?)").bind(stamp,stamp,stamp).run()
  const session=await createSessionForUser(runtime,'checker-owner')
  expect((await history({request:new Request('https://app.test/api/ops/checks',{headers:{cookie:'nepar_session='+session.sessionToken}}),env:runtime})).status).toBe(403)
  const response=await history({request:await adminRequest(),env:runtime})
  expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store')
})
it('filters domain/score and exact Zagreb calendar days across daylight saving changes',async()=>{
  const first=await recordCheckerRun(env.DB,'https://salon.hr/',result,null,'landing')
  const second=await recordCheckerRun(env.DB,'https://other.hr/',result,null,'dashboard')
  await env.DB.prepare("UPDATE checker_runs SET checked_at='2026-10-24T22:30:00.000Z' WHERE id=?").bind(first).run() // Oct 25, 00:30 CEST
  await env.DB.prepare("UPDATE checker_runs SET checked_at='2026-10-25T23:30:00.000Z' WHERE id=?").bind(second).run() // Oct 26, 00:30 CET
  const response=await history({request:await adminRequest('?q=salon&score=incomplete&from=2026-10-25&to=2026-10-25'),env:runtime})
  const data=await response.json() as {runs:Array<{hostname:string;lead_email:string|null;checks:unknown[]}>}
  expect(data.runs).toHaveLength(1);expect(data.runs[0]).toMatchObject({hostname:'salon.hr',lead_email:null});expect(data.runs[0].checks).toHaveLength(9)
  const empty=await history({request:await adminRequest('?score=9'),env:runtime});expect(await empty.json()).toMatchObject({runs:[]})
  expect((await history({request:await adminRequest('?from=2026-02-31'),env:runtime})).status).toBe(400)
})
it('counts today in Zagreb and paginates without dropping the fifty-first result',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-30T00:10:00Z'))
  for(let n=0;n<51;n++)await recordCheckerRun(env.DB,'https://salon.hr/'+n,result,null,'dashboard')
  await env.DB.prepare("UPDATE checker_runs SET checked_at='2026-10-29T23:30:00.000Z'").run() // Today in Zagreb, yesterday in UTC.
  expect(await checkerRunCounts(env.DB)).toMatchObject({today:51,last7days:51,total:51})
  const page1=await (await history({request:await adminRequest(),env:runtime})).json() as {runs:Array<{id:string}>;hasMore:boolean}
  const page2=await (await history({request:await adminRequest('?page=1'),env:runtime})).json() as {runs:Array<{id:string}>;hasMore:boolean}
  expect(page1.runs).toHaveLength(50);expect(page1.hasMore).toBe(true);expect(page2.runs).toHaveLength(1);expect(page2.hasMore).toBe(false)
  expect(new Set([...page1.runs,...page2.runs].map(row=>row.id)).size).toBe(51)
})
it('shows volunteered lead email only on the exact related run, never another domain',async()=>{
  const run=await recordCheckerRun(env.DB,'https://salon.hr/',result,null,'landing')
  const other=await recordCheckerRun(env.DB,'https://other.hr/',result,null,'landing')
  const form=new FormData()
  Object.entries({intent:'consultation',name:'Salon Test',email:'volunteered@example.hr',website:'https://salon.hr/',privacy:'on','cf-turnstile-response':'valid',context:JSON.stringify({checkerRunId:run})}).forEach(([key,value])=>form.set(key,value))
  const leadEnv={DB:env.DB,EMAIL_FROM:'publisher@nepar.hr',EMAIL_TO:'nepar@nepar.hr',CF_ACCOUNT_ID:'test',CF_EMAIL_API_TOKEN:'test',TURNSTILE_SECRET_KEY:'test',LEAD_RATE_LIMIT_SECRET:'secret'} as LeadEnv
  const response=await handleLeadRequest(new Request('https://app.test/api/leads/digitalni-cjenik',{method:'POST',headers:{origin:'https://app.test'},body:form}),leadEnv,(async()=>Response.json({success:true,action:'turnstile-spin-v2',hostname:'app.test'})) as typeof fetch)
  expect(response.status).toBe(200)
  expect((await env.DB.prepare('SELECT lead_id FROM checker_runs WHERE id=?').bind(run).first())?.lead_id).toBeTruthy()
  expect((await env.DB.prepare('SELECT lead_id FROM checker_runs WHERE id=?').bind(other).first())?.lead_id).toBeNull()
  form.set('context',JSON.stringify({checkerRunId:other}));form.set('email','different@example.hr')
  expect((await handleLeadRequest(new Request('https://app.test/api/leads/digitalni-cjenik',{method:'POST',headers:{origin:'https://app.test'},body:form}),leadEnv,(async()=>Response.json({success:true,action:'turnstile-spin-v2',hostname:'app.test'})) as typeof fetch)).status).toBe(200)
  const data=await (await history({request:await adminRequest(),env:runtime})).json() as {runs:Array<{id:string;lead_email:string|null}>}
  expect(data.runs.find(row=>row.id===run)?.lead_email).toBe('volunteered@example.hr');expect(data.runs.find(row=>row.id===other)?.lead_email).toBeNull()
})
it('keeps legacy checks unscored instead of inventing nine historical results',async()=>{
  await env.DB.prepare("INSERT INTO checker_runs(id,checked_at,url,hostname,status,score,unknown_count,checks_json,discovered_urls_json,source) VALUES ('legacy-test',?,'https://old.hr/','old.hr','green',NULL,9,'[]','[]','legacy')").bind(new Date().toISOString()).run()
  const data=await (await history({request:await adminRequest(),env:runtime})).json()
  expect(data).toMatchObject({runs:[{hostname:'old.hr',source:'legacy',score:null,checks:[],lead_email:null}]})
  const filtered=await (await history({request:await adminRequest('?score=9'),env:runtime})).json()
  expect(filtered).toMatchObject({runs:[]})
})
