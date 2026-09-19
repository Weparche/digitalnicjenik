import { beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from 'cloudflare:test'
import { handleLeadRequest, hmacIp, sanitizeLeadFilename, validateLeadAttachment, type LeadEnv } from '../../_lead'

const leadEnv = () => ({
  DB: env.DB,
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

describe('digitalni cjenik lead delivery', () => {
  beforeEach(async () => { await env.DB.prepare('DELETE FROM lead_delivery_attempts').run() })

  it('validates Turnstile, sends escaped content through Email REST and stores no PII in D1', async () => {
    const fetcher = successfulFetch()
    const response = await handleLeadRequest(request({ name: '<Salon & Co>', context: JSON.stringify({ checkerStatus: 'green', discoveredUrls: ['https://example.hr/cjenik.csv'] }) }, new File(['Naziv;Cijena\nŠišanje;20'], '../cjenik.csv', { type: 'text/csv' })), leadEnv(), fetcher)
    expect(response.status).toBe(200)
    const calls = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls
    expect(calls).toHaveLength(2)
    const emailBody = JSON.parse(String((calls[1][1] as RequestInit).body)) as { html: string; reply_to: { address: string }; attachments: Array<{ filename: string }> }
    expect(emailBody.html).toContain('&lt;Salon &amp; Co&gt;')
    expect(emailBody.reply_to.address).toBe('vlasnik@example.hr')
    expect(emailBody.attachments[0].filename).toBe('cjenik.csv')
    const rows = await env.DB.prepare('SELECT ip_hash, status FROM lead_delivery_attempts').all<{ ip_hash: string; status: string }>()
    expect(rows.results).toHaveLength(1)
    expect(JSON.stringify(rows.results)).not.toContain('vlasnik@example.hr')
    expect(rows.results[0]).toMatchObject({ status: 'sent', ip_hash: await hmacIp('203.0.113.20', 'rate-limit-secret') })
  })

  it('rejects cross-origin requests and Turnstile failures before email sending', async () => {
    const crossOrigin = request()
    crossOrigin.headers.set('origin', 'https://attacker.example')
    expect((await handleLeadRequest(crossOrigin, leadEnv(), successfulFetch())).status).toBe(403)
    const fetcher = vi.fn(async () => Response.json({ success: false, 'error-codes': ['invalid-input-response'] })) as unknown as typeof fetch
    const failed = await handleLeadRequest(request(), leadEnv(), fetcher)
    expect(failed.status).toBe(403)
    expect(await failed.json()).toMatchObject({ code: 'turnstile_failed' })
    expect((fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1)
  })

  it('enforces five attempts per hour with an atomic D1 trigger', async () => {
    const fetcher = successfulFetch()
    for (let index = 0; index < 5; index += 1) expect((await handleLeadRequest(request({ email: `test${index}@example.hr` }), leadEnv(), fetcher)).status).toBe(200)
    const sixth = await handleLeadRequest(request({ email: 'sixth@example.hr' }), leadEnv(), fetcher)
    expect(sixth.status).toBe(429)
    expect(await sixth.json()).toMatchObject({ code: 'rate_limited' })
    expect((await env.DB.prepare('SELECT COUNT(*) AS count FROM lead_delivery_attempts').first<{ count: number }>())?.count).toBe(5)
  })

  it('accepts plugin intent and labels the outbound email', async () => {
    const fetcher = successfulFetch()
    const response = await handleLeadRequest(request({ intent: 'plugin', message: 'Trebam WordPress plugin' }), leadEnv(), fetcher)
    expect(response.status).toBe(200)
    const emailBody = JSON.parse(String(((fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[1][1] as RequestInit).body)) as { subject: string; html: string }
    expect(emailBody.subject).toContain('Plugin (49,90 €)')
    expect(emailBody.html).toContain('Plugin (49,90 €)')
  })

  it('reports Email API errors without claiming success', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => String(input).includes('siteverify')
      ? Response.json({ success: true, action: 'turnstile-spin-v2', hostname: 'digitalnicjenik.nepar.hr' })
      : Response.json({ success: false, errors: [{ code: 10002 }] }, { status: 500 })) as unknown as typeof fetch
    const response = await handleLeadRequest(request(), leadEnv(), fetcher)
    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({ code: 'send_failed' })
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
