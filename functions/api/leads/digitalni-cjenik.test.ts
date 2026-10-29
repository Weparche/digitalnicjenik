import { beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from 'cloudflare:test'
import { dispatchLifecycle } from '../../../shared/lifecycle'
import { handleLeadRequest, hmacIp, sanitizeLeadFilename, validateLeadAttachment, type LeadEnv } from '../../_lead'

const leadEnv = () => ({
  DB: env.DB,
  DRAFTS:{put:async()=>({})},
  CF_ACCOUNT_ID: 'account-id',
  CF_EMAIL_API_TOKEN: 'secret-token',
  EMAIL_FROM: 'publisher@nepar.hr',
  EMAIL_TO: 'nepar@nepar.hr',
  TURNSTILE_SECRET_KEY: 'turnstile-secret',
  LEAD_RATE_LIMIT_SECRET: 'rate-limit-secret',
}) as unknown as LeadEnv

function request(fields: Record<string, string> = {}, file?: File) {
  const form = new FormData()
  Object.entries({ intent: 'implementation', name: 'Salon Test', email: 'vlasnik@example.hr', privacy: 'on', platform: 'wordpress', materials: 'csv', 'cf-turnstile-response': 'valid-token', ...fields }).forEach(([key, value]) => form.set(key, value))
  if (file) form.set('attachment', file, file.name)
  return new Request('https://digitalnicjenik.nepar.hr/api/leads/digitalni-cjenik', { method: 'POST', headers: { origin: 'https://digitalnicjenik.nepar.hr', 'cf-connecting-ip': '203.0.113.20' }, body: form })
}

function successfulFetch() {
  return vi.fn(async (input: RequestInfo | URL) => String(input).includes('siteverify')
    ? Response.json({ success: true, action: 'turnstile-spin-v2', hostname: 'digitalnicjenik.nepar.hr' })
    : Response.json({ success: true, result: { delivered: ['nepar@nepar.hr'], queued: [], permanent_bounces: [] } })) as unknown as typeof fetch
}

describe('digitalni cjenik lead delivery',()=>{
  beforeEach(async()=>{
    await env.DB.batch(['lifecycle_events','lead_inquiries','lead_delivery_attempts','acquisition_attributions'].map(table=>env.DB.prepare(`DELETE FROM ${table}`)))
  })
  it('validates Turnstile and commits an inquiry, attachment pointer and two durable events',async()=>{
    const fetcher=successfulFetch()
    const response=await handleLeadRequest(request({name:'<Salon & Co>'},new File(['name;price\nHair;20'],'../cjenik.csv',{type:'text/csv'})),leadEnv(),fetcher)
    expect(response.status).toBe(200)
    expect((fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1)
    expect(await env.DB.prepare('SELECT name,email,attachment_name FROM lead_inquiries').first()).toEqual({name:'<Salon & Co>',email:'vlasnik@example.hr',attachment_name:'cjenik.csv'})
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM lifecycle_events').first<{n:number}>())?.n).toBe(2)
    const sent:Array<{html?:string;to:string|string[];replyTo?:unknown}>=[]
    await dispatchLifecycle({DB:env.DB,EMAIL_FROM:'publisher@nepar.hr',EMAIL_TO:'nepar@nepar.hr',LIFECYCLE_EMAILS_ENABLED:'true',EMAIL:{send:async message=>{sent.push(message);return {messageId:'accepted'}}}})
    expect(sent).toHaveLength(2)
    expect(sent.some(mail=>mail.html?.includes('&lt;Salon &amp; Co&gt;'))).toBe(true)
    expect(sent.every(mail=>JSON.stringify(mail.replyTo).includes('nepar@nepar.hr'))).toBe(true)
    expect(await env.DB.prepare('SELECT status FROM lead_delivery_attempts').first()).toMatchObject({status:'stored'})
  })
  it('rejects cross-origin requests and failed Turnstile without storing an inquiry',async()=>{
    const cross=request();cross.headers.set('origin','https://attacker.example')
    expect((await handleLeadRequest(cross,leadEnv(),successfulFetch())).status).toBe(403)
    const fetcher=vi.fn(async()=>Response.json({success:false})) as unknown as typeof fetch
    expect((await handleLeadRequest(request(),leadEnv(),fetcher)).status).toBe(403)
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM lead_inquiries').first<{n:number}>())?.n).toBe(0)
  })
  it('enforces five attempts per hour with the atomic trigger',async()=>{
    for(let index=0;index<5;index++)expect((await handleLeadRequest(request({email:`test${index}@example.hr`}),leadEnv(),successfulFetch())).status).toBe(200)
    expect((await handleLeadRequest(request(),leadEnv(),successfulFetch())).status).toBe(429)
  })
  it('stores the selected plan and volunteered checker context without sending routine leads to ops',async()=>{
    const response=await handleLeadRequest(request({intent:'plugin',context:JSON.stringify({selectedPlan:'link',checkerScore:6,website:'https://salon.hr/'})}),leadEnv(),successfulFetch())
    expect(response.status).toBe(200)
    const row=await env.DB.prepare('SELECT selected_plan,context_json FROM lead_inquiries').first<{selected_plan:string;context_json:string}>()
    expect(row?.selected_plan).toBe('link')
    expect(JSON.parse(row!.context_json).context).toMatchObject({checkerScore:6,website:'https://salon.hr/'})
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM lifecycle_events WHERE audience='ops'").first<{n:number}>())?.n).toBe(0)
  })
  it('acknowledges durable storage even when later transport is unavailable',async()=>{
    const response=await handleLeadRequest(request(),leadEnv(),successfulFetch())
    expect(response.status).toBe(200)
    await dispatchLifecycle({DB:env.DB,EMAIL_FROM:'publisher@nepar.hr',LIFECYCLE_EMAILS_ENABLED:'true',EMAIL:{send:async()=>{throw new Error('connection lost')}}})
    expect(await env.DB.prepare('SELECT status FROM lifecycle_events LIMIT 1').first()).toMatchObject({status:'attention'})
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM lead_inquiries').first<{n:number}>())?.n).toBe(1)
  })
  it('deduplicates client retries using the same submission ID',async()=>{
    const fields={submissionId:crypto.randomUUID()}
    await handleLeadRequest(request(fields),leadEnv(),successfulFetch())
    await handleLeadRequest(request(fields),leadEnv(),successfulFetch())
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM lead_inquiries').first<{n:number}>())?.n).toBe(1)
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM lifecycle_events').first<{n:number}>())?.n).toBe(2)
  })
  it('stores valid attribution and ignores invalid attribution',async()=>{
    const touch={attribution_id:'11111111-1111-4111-8111-111111111111',utm_source:'kpdinfo.com',utm_medium:'owned_context',utm_campaign:'nepar_digitalni_cjenik',utm_content:'after-result',referrer_host:'kpdinfo.com',landing_path:'/objava-digitalnog-cjenika/',first_seen:'2026-10-26T12:00:00.000Z'}
    await handleLeadRequest(request({attribution:JSON.stringify(touch)}),leadEnv(),successfulFetch())
    await handleLeadRequest(request({attribution:JSON.stringify({...touch,attribution_id:'bad'})}),leadEnv(),successfulFetch())
    expect((await env.DB.prepare('SELECT utm_source FROM acquisition_attributions').all()).results).toEqual([{utm_source:'kpdinfo.com'}])
  })
})

describe('lead attachment security', () => {
  it('sanitizes traversal and validates supported content signatures', async () => {
    expect(sanitizeLeadFilename('../../račun.csv')).toBe('račun.csv')
    await expect(validateLeadAttachment(new File(['Naziv;Cijena\nUsluga;10'], 'cjenik.csv', { type: 'text/csv' }))).resolves.toMatchObject({ filename: 'cjenik.csv' })
    await expect(validateLeadAttachment(new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])], 'cjenik.pdf', { type: 'application/pdf' }))).resolves.toMatchObject({ type: 'application/pdf' })
    await expect(validateLeadAttachment(new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], 'cjenik.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))).resolves.toMatchObject({ filename: 'cjenik.xlsx' })
  })

  it('rejects MIME spoofing, empty content and invalid file magic', async () => {
    await expect(validateLeadAttachment(new File(['<html>not csv</html>'], 'cjenik.csv', { type: 'text/html' }))).rejects.toThrow('file_rejected')
    await expect(validateLeadAttachment(new File([], 'prazno.pdf', { type: 'application/pdf' }))).rejects.toThrow('file_rejected')
    await expect(validateLeadAttachment(new File(['fake'], 'slika.png', { type: 'image/png' }))).rejects.toThrow('file_rejected')
  })
})
