import { beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import fixture from '../../marketino-artikli?raw'
import { onRequestPost as importTenant } from '../../functions/api/tenants/[slug]/import'
import { onRequestPatch as patchDraft, onRequestGet as getDraft } from '../../functions/api/tenants/[slug]/draft/[id]'
import { onRequestPost as publishTenant } from '../../functions/api/tenants/[slug]/publish'
import { onRequestGet as getRootCsv } from '../../functions/cjenik.csv'
import { createDraft, type RuntimeEnv } from '../../functions/_repository'
import { parseMarketinoCsv } from './adapters/marketinoCsv'
import { validatePriceList } from './validate'
import type { NormalizedPriceList } from './types'

const operatorKey = 'test-operator-write-key'

function withSecrets(base: typeof env): RuntimeEnv {
  return {
    ...base,
    OPERATOR_WRITE_KEY: operatorKey,
    DEMO_WRITE_RATE_LIMIT_SECRET: 'demo-rate-secret',
    LEAD_RATE_LIMIT_SECRET: 'demo-rate-secret',
    DEMO_WRITE_TENANT: 'nepar',
    DEMO_PUBLIC_HOSTNAME: 'digitalnicjenik.nepar.hr',
  }
}

async function seedOtherTenant(runtime: RuntimeEnv) {
  const list = parseMarketinoCsv(fixture, { id: 'acme', slug: 'acme', name: 'Acme' }).priceList
  const completed = {
    ...list,
    items: list.items.slice(0, 1).map((item) => ({ ...item, type: 'Usluga', anchorPrice: item.price, specialSaleApplied: false, isNewSinceReferenceDate: false })),
  }
  await createDraft(runtime, 'acme', completed, 'acme.csv', 'marketino-csv')
  return completed
}

describe('tenant write access control', () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM sync_logs'),
      env.DB.prepare('DELETE FROM price_publications'),
      env.DB.prepare('DELETE FROM price_list_versions'),
      env.DB.prepare('DELETE FROM price_uploads'),
      env.DB.prepare('DELETE FROM publication_targets'),
      env.DB.prepare('DELETE FROM publication_metadata'),
      env.DB.prepare('DELETE FROM entitlements'),
      env.DB.prepare('DELETE FROM integrations'),
      env.DB.prepare('DELETE FROM price_lists'),
      env.DB.prepare('DELETE FROM tenants'),
      env.DB.prepare('DELETE FROM demo_write_rate_buckets'),
      env.DB.prepare('DELETE FROM checker_rate_buckets'),
    ])
  })

  it('allows anonymous demo import and rejects unauthenticated non-demo writes', async () => {
    const runtime = withSecrets(env)
    const demo = await importTenant({
      request: new Request('https://demo.test/api/tenants/nepar/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': '198.51.100.10' },
        body: JSON.stringify({ csv: fixture, sourceFilename: 'demo.csv' }),
      }),
      params: { slug: 'nepar' },
      env: runtime,
    })
    expect(demo.status).toBe(200)

    const denied = await importTenant({
      request: new Request('https://demo.test/api/tenants/acme/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csv: fixture }),
      }),
      params: { slug: 'acme' },
      env: runtime,
    })
    expect(denied.status).toBe(401)

    const wrong = await importTenant({
      request: new Request('https://demo.test/api/tenants/acme/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer wrong-key' },
        body: JSON.stringify({ csv: fixture }),
      }),
      params: { slug: 'acme' },
      env: runtime,
    })
    expect(wrong.status).toBe(401)
  })

  it('allows operator key for non-demo tenant and canonicalizes payload tenant', async () => {
    const runtime = withSecrets(env)
    await seedOtherTenant(runtime)
    const response = await importTenant({
      request: new Request('https://demo.test/api/tenants/acme/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${operatorKey}` },
        body: JSON.stringify({
          priceList: {
            items: [{ name: 'Usluga', price: 12, type: 'Usluga', unit: 'kom', isNewSinceReferenceDate: true, anchorPrice: 10, specialSaleApplied: false }],
            currency: 'EUR',
          },
          sourceFilename: 'json-import.json',
        }),
      }),
      params: { slug: 'acme' },
      env: runtime,
    })
    expect(response.status).toBe(200)
    const payload = await response.json() as { draft: { normalizedPayload: NormalizedPriceList } }
    expect(payload.draft.normalizedPayload.tenant).toEqual({ id: 'acme', slug: 'acme', name: 'Acme' })
    expect(payload.draft.normalizedPayload.items[0]).toMatchObject({ unit: 'kom', isNewSinceReferenceDate: true })
  })

  it('rejects cross-tenant draft access and customer publication host mutations', async () => {
    const runtime = withSecrets(env)
    const other = await seedOtherTenant(runtime)
    const otherDraft = await createDraft(runtime, 'acme', other, 'other.csv', 'marketino-csv')
    const demoImport = await importTenant({
      request: new Request('https://demo.test/api/tenants/nepar/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': '198.51.100.11' },
        body: JSON.stringify({ csv: fixture }),
      }),
      params: { slug: 'nepar' },
      env: runtime,
    })
    const demo = await demoImport.json() as { draft: { id: string } }

    const stolen = await getDraft({
      request: new Request('https://demo.test/api/tenants/nepar/draft/' + otherDraft.draft!.id),
      params: { slug: 'nepar', id: otherDraft.draft!.id },
      env: runtime,
    })
    expect(stolen.status).toBe(404)

    const operatorCross = await patchDraft({
      request: new Request('https://demo.test/api/tenants/acme/draft/' + demo.draft.id, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${operatorKey}` },
        body: JSON.stringify({ priceList: { items: other.items } }),
      }),
      params: { slug: 'acme', id: demo.draft.id },
      env: runtime,
    })
    expect([403, 404, 422]).toContain(operatorCross.status)

    await env.DB.prepare("INSERT INTO publication_targets (id, tenant_id, hostname, status, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?)").bind('target-customer', 'acme', 'customer.example.com', new Date().toISOString(), new Date().toISOString()).run()
    const customerHost = await importTenant({
      request: new Request('https://customer.example.com/api/tenants/nepar/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': '198.51.100.12' },
        body: JSON.stringify({ csv: fixture }),
      }),
      params: { slug: 'nepar' },
      env: runtime,
    })
    expect(customerHost.status).toBe(403)
  })

  it('rate-limits demo mutations and keeps public reads open', async () => {
    const runtime = withSecrets(env)
    const windowStart = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000).toISOString()
    await env.DB.prepare('INSERT INTO demo_write_rate_buckets (ip_hash, window_start, attempt_count, updated_at) VALUES (?, ?, 30, ?)').bind(
      // pre-seed will be overwritten by real hash on first request; instead loop until 429
      'seed', windowStart, new Date().toISOString(),
    ).run()

    let limited = false
    for (let index = 0; index < 35; index += 1) {
      const response = await importTenant({
        request: new Request('https://demo.test/api/tenants/nepar/import', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.50' },
          body: JSON.stringify({ csv: 'Naziv*;Cijena*\nA;1\n', sourceFilename: `n${index}.csv` }),
        }),
        params: { slug: 'nepar' },
        env: runtime,
      })
      if (response.status === 429) {
        limited = true
        break
      }
    }
    expect(limited).toBe(true)

    const publicRead = await getRootCsv({ request: new Request('https://demo.test/cjenik.csv'), env: runtime })
    expect([200, 404]).toContain(publicRead.status)
  })

  it('blocks ready_to_publish when an import row is skipped', async () => {
    const csv = 'Naziv*;Cijena*;Vrsta*\nValjana;10;Usluga\nBezCijene;;Usluga\n'
    const parsed = parseMarketinoCsv(csv)
    expect(parsed.warnings.length).toBe(1)
    const { importIssuesFromParseWarnings, mergeValidationIssues } = await import('./validate')
    const validation = mergeValidationIssues(validatePriceList(parsed.priceList), importIssuesFromParseWarnings(parsed.warnings, 'csv'))
    expect(validation.issues[0]).toMatchObject({ code: 'IMPORT_ROW_SKIPPED', source: 'csv', field: 'price' })
    expect(validation.status).toBe('invalid')
    expect(validation.blockingCount).toBeGreaterThan(0)
  })
})
