import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { env } from 'cloudflare:test'
import { checkerDay, consumeCheckerBudget, CheckerRateLimitError } from './_checker-quota'
import { onRequestPost as check } from './api/digitalni-cjenik/check'
import { onRequestPost as validate } from './api/validator/validate'
import { createSessionForUser } from './_auth'

const runtime = { DB: env.DB, CHECKER_RATE_LIMIT_SECRET: 'test-secret', ADMIN_EMAILS: 'nepar@nepar.hr' }
const request = (body: object, ip = '203.0.113.20', extra: Record<string,string> = {}) => new Request('https://app.test/api/check', {
  method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...extra }, body: JSON.stringify(body)
})
beforeEach(async () => { await env.DB.prepare('DELETE FROM checker_rate_buckets').run() })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

it('enforces three checks even for simultaneous requests and ignores spoofed forwarded IPs', async () => {
  const outcomes = await Promise.allSettled(Array.from({length: 8}, (_, i) => consumeCheckerBudget(request({}, '203.0.113.20', {'x-forwarded-for': '198.51.100.' + i}), runtime)))
  expect(outcomes.filter(o => o.status === 'fulfilled')).toHaveLength(3)
  expect(outcomes.filter(o => o.status === 'rejected' && o.reason instanceof CheckerRateLimitError)).toHaveLength(5)
  expect((await consumeCheckerBudget(request({}, '203.0.113.21'), runtime)).remaining).toBe(2)
})

it('resets at Zagreb midnight on daylight-saving transition days', async () => {
  expect(checkerDay(new Date('2026-10-25T12:00:00Z'))).toEqual({start:'2026-10-24T22:00:00.000Z', resetAt:'2026-10-25T23:00:00.000Z'})
  vi.useFakeTimers({toFake:['Date']})
  vi.setSystemTime(new Date('2026-10-25T22:59:59Z'))
  for (let i=0;i<3;i++) await consumeCheckerBudget(request({}), runtime)
  await expect(consumeCheckerBudget(request({}),runtime)).rejects.toThrow('rate_limited')
  vi.setSystemTime(new Date('2026-10-25T23:00:00Z'))
  expect((await consumeCheckerBudget(request({}), runtime)).remaining).toBe(2)
})

it('shares the limit across URL, CSV/XML and Excel and blocks a fake internal source before any scan', async () => {
  const csv = 'Naziv,Vrsta,Cijena,Sidrena cijena,Poseban oblik prodaje\\nŠišanje,Usluga,15,15,NE'.replace('\\n','\n')
  expect((await validate({request:request({csv}),env:runtime})).status).toBe(200)
  expect((await validate({request:request({format:'excel'}),env:runtime})).status).toBe(200)
  expect((await validate({request:request({csv}),env:runtime})).status).toBe(200)
  const dns = vi.fn(async () => ['93.184.216.34'])
  const denied = await check({request:request({url:'https://example.com',source:'internal'}),env:{...runtime,DIGITAL_PRICE_LIST_DNS_RESOLVER:{resolve4:dns,resolve6:async()=>[]}}})
  expect(denied.status).toBe(429)
  expect(denied.headers.get('retry-after')).toBeTruthy()
  expect(denied.headers.get('x-checker-remaining')).toBe('0')
  expect(dns).not.toHaveBeenCalled()
  expect((await validate({request:request({xml:'<cjenik/>'}),env:runtime})).status).toBe(429)
})

it('exempts verified admins and fails closed when quota storage is missing', async () => {
  const stamp = new Date().toISOString()
  await env.DB.prepare("INSERT OR IGNORE INTO auth_users(id,email,email_verified_at,created_at,updated_at) VALUES ('quota-admin','nepar@nepar.hr',?,?,?)").bind(stamp,stamp,stamp).run()
  const user = await env.DB.prepare("SELECT id FROM auth_users WHERE email='nepar@nepar.hr'").first<{id:string}>()
  const session = await createSessionForUser(runtime,user!.id)
  for (let i=0;i<4;i++) expect((await validate({request:request({format:'excel'},'203.0.113.20',{cookie:'nepar_session='+session.sessionToken}),env:runtime})).status).toBe(200)
  expect((await validate({request:request({format:'excel'}),env:{}})).status).toBe(503)
  expect((await check({request:request({url:'https://example.com'}),env:{}})).status).toBe(503)
})
