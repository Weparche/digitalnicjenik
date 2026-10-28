import { expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { createPrivateDraft, startTrialClaim, provisionTrialFromToken, type TrialEnv } from './_trial'
import { readCurrentPublication, readMetadataForSlug } from './_repository'
import type { NormalizedPriceList } from '../src/price-engine/types'

const prices: NormalizedPriceList = { tenant: { id: 'draft', slug: 'draft', name: 'Draft' }, source: 'nepar', currency: 'EUR', updatedAt: '2026-10-26T00:00:00Z', items: [{ name: 'Šišanje', type: 'Usluga', price: 15, anchorPrice: 14, specialSaleApplied: false }] }
const details = { objectType: 'usluzni-objekt', objectAddress: 'Ilica 10, 10000 Zagreb', objectCode: 'P1', workingDays: [1, 2, 3, 4, 5, 6] }
function setup() {
  const objects = new Map<string, string>(); const mail: string[] = []
  const runtime: TrialEnv = {
    DB: env.DB as unknown as TrialEnv['DB'],
    DRAFTS: { put: async (key, value) => { objects.set(key, value) }, get: async key => objects.has(key) ? { text: async () => objects.get(key)! } : null },
    EMAIL_FROM: 'publisher@nepar.hr', EMAIL: { send: async message => { mail.push(message.text || ''); return {} } },
    AUTH_RATE_LIMIT_SECRET: 'local-test-secret', TURNSTILE_SECRET_KEY: 'local-turnstile-secret',
  }
  const request = new Request('https://digitalnicjenik.nepar.hr/api/trials/start', { method: 'POST', headers: { 'cf-connecting-ip': '203.0.113.99' } })
  const turnstile = (async () => Response.json({ success: true, action: 'turnstile-spin-v2', hostname: 'digitalnicjenik.nepar.hr' })) as typeof fetch
  return { runtime, request, turnstile, mail }
}

it('refuses public trial claims for an incomplete draft even through a direct backend call', async () => {
  const { runtime, request, turnstile, mail } = setup()
  const invalid = { ...prices, items: [{ ...prices.items[0], anchorPrice: null }] }
  const draft = await createPrivateDraft(runtime, invalid, 'cjenik.csv', 'nepar', [], details)
  await expect(startTrialClaim(request, runtime, { draftId: draft.draftId, email: 'invalid@example.hr', businessName: 'Salon Incomplete', slug: 'salon-incomplete', turnstileToken: 'local' }, turnstile)).rejects.toMatchObject({ code: 'draft_not_ready' })
  expect(mail).toHaveLength(0)
  expect(await readCurrentPublication(runtime, 'salon-incomplete')).toBeNull()
})

it('requires object metadata before sending a trial claim', async () => {
  const { runtime, request, turnstile, mail } = setup()
  const draft = await createPrivateDraft(runtime, prices, 'cjenik.csv', 'nepar')
  await expect(startTrialClaim(request, runtime, { draftId: draft.draftId, email: 'missing@example.hr', businessName: 'Salon Metadata', slug: 'salon-metadata', turnstileToken: 'local' }, turnstile)).rejects.toMatchObject({ code: 'publication_details_required' })
  expect(mail).toHaveLength(0)
})

it('publishes a verified valid trial with the real object address and services profile', async () => {
  const { runtime, request, turnstile, mail } = setup()
  const draft = await createPrivateDraft(runtime, prices, 'cjenik.csv', 'nepar', [], details)
  await startTrialClaim(request, runtime, { draftId: draft.draftId, email: 'valid@example.hr', businessName: 'Salon Real Address', slug: 'salon-real-address', turnstileToken: 'local' }, turnstile)
  const token = mail[0]?.match(/token=([a-f0-9]+)/)?.[1]
  expect(token).toBeTruthy()
  await provisionTrialFromToken(runtime, token!)
  const publication = await readCurrentPublication(runtime, 'salon-real-address')
  expect(publication?.filenameStem).toContain('ilica-10-10000-zagreb_p1')
  expect((await readMetadataForSlug(runtime, 'salon-real-address'))?.workingDays).toEqual([1, 2, 3, 4, 5, 6])
  const profile = await env.DB.prepare("SELECT compliance_profile FROM publication_metadata m JOIN tenants t ON t.id=m.tenant_id WHERE t.slug='salon-real-address'").first<{ compliance_profile: string }>()
  expect(profile?.compliance_profile).toBe('services')  // The free publication is a 24 h Web Link; the publish guard accepts the web_link plan.
  const entitlement = await env.DB.prepare("SELECT e.plan, e.status, e.period_start, e.period_end FROM entitlements e JOIN tenants t ON t.id=e.tenant_id WHERE t.slug='salon-real-address'").first<{ plan: string; status: string; period_start: string; period_end: string }>()
  expect(entitlement).toMatchObject({ plan: 'web_link', status: 'trial' })
  expect(Date.parse(entitlement!.period_end) - Date.parse(entitlement!.period_start)).toBe(24 * 3_600_000)
  expect(mail[0]).toContain('besplatna 24 sata')
})
