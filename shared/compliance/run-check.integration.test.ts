import { beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { renderCsv } from '../../src/price-engine/csv'
import { renderXml } from '../../src/price-engine/xml'
import type { NormalizedPriceList } from '../../src/price-engine/types'
import { runTenantCheck, type MonitorEnv } from './run-check'
import { claimManualRun, listMonitorTargets, readLatestRun, readState, selectRetryTargets } from './store'

const HOST = 'cjenik.acme.hr'
const STEM = 'trgovina_vukovarska-1_p-01_3_20261117-053000'
const NOW = new Date('2026-11-17T05:30:00Z') // 06:30 Zagreb, Tuesday
const monitorEnv = (): MonitorEnv => ({ DB: env.DB as unknown as MonitorEnv['DB'], DEMO_WRITE_TENANT: 'nepar' })

const payload = (count = 3): NormalizedPriceList => ({
  tenant: { id: 't-acme', slug: 'acme', name: 'Acme' },
  source: 'nepar',
  currency: 'EUR',
  updatedAt: '2026-11-17T05:00:00Z',
  items: Array.from({ length: count }, (_, index) => ({ name: `Usluga ${index + 1}`, type: 'Usluga', specialSaleApplied: false, externalId: `S${index + 1}`, unit: 'kom', price: 1 + index, anchorPrice: 1 + index })),
})

async function seed(options: { list?: NormalizedPriceList; profile?: 'products' | 'services'; entitlementEnd?: string; archive?: Array<{ stem: string; publishedAt: string; publicUntil: string | null }>; publishedAt?: string } = {}) {
  const list = options.list ?? payload()
  const iso = '2026-11-17T05:00:00Z'
  const statements = [
    env.DB.prepare("INSERT INTO tenants (id, slug, name, currency, created_at, updated_at) VALUES ('t-acme', 'acme', 'Acme', 'EUR', ?, ?)").bind(iso, iso),
    env.DB.prepare("INSERT INTO publication_metadata (tenant_id, object_type, object_address, object_code, next_publication_sequence, timezone, created_at, updated_at, compliance_profile) VALUES ('t-acme', 'Trgovina', 'Vukovarska 1', 'P-01', 4, 'Europe/Zagreb', ?, ?, ?)").bind(iso, iso, options.profile ?? 'products'),
    env.DB.prepare("INSERT INTO publication_targets (id, tenant_id, hostname, status, created_at, updated_at) VALUES ('tg1', 't-acme', ?, 'active', ?, ?)").bind(HOST, iso, iso),
    env.DB.prepare("INSERT INTO price_list_versions (id, tenant_id, hash, payload_json, created_at) VALUES ('v1', 't-acme', 'h', ?, ?)").bind(JSON.stringify(list), iso),
    env.DB.prepare("INSERT INTO price_publications (id, tenant_id, price_list_id, sequence, filename_stem, published_at, hash, payload_json, is_current) VALUES ('p3', 't-acme', 'v1', ?, ?, ?, 'h', ?, 1)").bind(Math.max(3, (options.archive?.length ?? 0) + 1), STEM, options.publishedAt ?? '2026-11-17T04:30:00Z', JSON.stringify(list)),
    env.DB.prepare("INSERT INTO entitlements (id, tenant_id, plan, status, period_start, period_end, created_at, updated_at) VALUES ('e1', 't-acme', 'publisher_self_service', 'active', ?, ?, ?, ?)").bind(iso, options.entitlementEnd ?? '2027-11-17T00:00:00Z', iso, iso),
    ...(options.archive ?? []).map((row, index) => env.DB.prepare("INSERT INTO price_publications (id, tenant_id, price_list_id, sequence, filename_stem, published_at, superseded_at, public_until, hash, payload_json, is_current) VALUES (?, 't-acme', 'v1', ?, ?, ?, ?, ?, 'h', ?, 0)").bind(`pa${index}`, index + 1, row.stem, row.publishedAt, row.publishedAt, row.publicUntil, JSON.stringify(list))),
  ]
  await env.DB.batch(statements)
}

type Overrides = Record<string, Response | (() => Response)>
function fakeFetch(overrides: Overrides = {}, list: NormalizedPriceList = payload()): typeof fetch {
  const disposition = (name: string) => ({ 'content-disposition': `inline; filename="${name}"` })
  const defaults: Overrides = {
    [`https://${HOST}/cjenik.csv`]: new Response(renderCsv(list), { status: 200, headers: disposition(`${STEM}.csv`) }),
    [`https://${HOST}/cjenik.xml`]: new Response(renderXml(list), { status: 200, headers: disposition(`${STEM}.xml`) }),
    [`https://${HOST}/arhiva`]: new Response('<html></html>', { status: 200 }),
  }
  const table = { ...defaults, ...overrides }
  return (async (input: RequestInfo | URL) => {
    const hit = table[String(input)]
    if (hit) return typeof hit === 'function' ? hit() : hit.clone()
    return new Response('ok', { status: 200 })
  }) as typeof fetch
}

describe('runTenantCheck', () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM monitor_runs'),
      env.DB.prepare('DELETE FROM monitor_state'),
      env.DB.prepare('DELETE FROM price_publications'),
      env.DB.prepare('DELETE FROM price_list_versions'),
      env.DB.prepare('DELETE FROM publication_targets'),
      env.DB.prepare('DELETE FROM publication_metadata'),
      env.DB.prepare('DELETE FROM entitlements'),
      env.DB.prepare('DELETE FROM tenant_members'),
      env.DB.prepare('DELETE FROM auth_users'),
      env.DB.prepare('DELETE FROM tenants'),
    ])
  })

  it('records an ok run with expected_rows from the payload and all hashes', async () => {
    await seed({ profile: 'services' })
    const result = await runTenantCheck(monitorEnv(), { slug: 'acme', trigger: 'cron', now: NOW, fetcher: fakeFetch() })
    expect(result.status).toBe('checked')
    if (result.status !== 'checked') return
    expect(result.run).toMatchObject({ overall: 'ok', csvStatus: 200, xmlStatus: 200, csvRows: 3, xmlRows: 3, expectedRows: 3, ruleset: 'nn-101-2026', profile: 'services', freshnessStatus: 'n/a' })
    expect(result.run.filenamePublicationMatch).toBe(true)
    expect(result.run.filenameRulesetMatch).toBe(true)
    expect(result.run.payloadSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(result.run.csvSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(result.run.xmlSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(result.alert).toBeNull()
    expect((await readLatestRun(monitorEnv().DB, 't-acme'))?.id).toBe(result.run.id)
  })
  it('monitors platform trial feeds at /c/slug rather than an unprovisioned subdomain', async () => {
    await seed({ profile: 'services' })
    await env.DB.prepare("UPDATE publication_targets SET hostname = 'acme.digitalnicjenik.nepar.hr' WHERE tenant_id = 't-acme'").run()
    const requested: string[] = []
    const fetcher: typeof fetch = async (input, init) => {
      requested.push(String(input))
      return fakeFetch()(String(input).replace('https://digitalnicjenik.nepar.hr/c/acme', `https://${HOST}`), init)
    }
    const result = await runTenantCheck(monitorEnv(), { slug: 'acme', trigger: 'cron', now: NOW, fetcher })
    expect(result.status === 'checked' && result.run.overall).toBe('ok')
    expect(requested).toContain('https://digitalnicjenik.nepar.hr/c/acme/cjenik.csv')
    expect(requested.some(url => url.includes('acme.digitalnicjenik'))).toBe(false)
  })

  it('a complete product list passes with every product field carried by CSV and XML', async () => {
    const products: NormalizedPriceList = {
      ...payload(),
      items: [
        { externalId: 'M-001', name: 'Mlijeko 1 l', type: 'Proizvod', anchorReferenceDate: '2025-05-02', brand: 'Dukat', barcode: '4006381333931', unit: 'l', unitPrice: 1.2, price: 1.2, anchorPrice: 1.1, specialSaleApplied: false, availability: 'dostupno' },
        { externalId: 'M-002', name: 'Kruh', type: 'Proizvod', anchorReferenceDate: '2025-05-02', brand: 'bez marke', barcode: '96385074', unit: 'kg', unitPrice: 1.98, price: 0.99, anchorPrice: 0.95, specialSaleApplied: false, availability: 'nedostupno' },
      ],
    }
    await seed({ list: products, profile: 'products', publishedAt: '2026-11-17T04:30:00Z' })
    const result = await runTenantCheck(monitorEnv(), { slug: 'acme', trigger: 'cron', now: NOW, fetcher: fakeFetch({}, products) })
    if (result.status !== 'checked') throw new Error('expected checked')
    expect(result.run).toMatchObject({ profile: 'products', overall: 'ok', csvRows: 2, xmlRows: 2, expectedRows: 2 })
    expect(result.run.issues.filter((issue) => issue.severity !== 'info')).toEqual([])
    expect(result.run.issues.some((issue) => issue.code === 'FIELD_NOT_IN_FEED' || issue.code === 'FIELD_NOT_IN_DATA_MODEL')).toBe(false)
  })

  it('names the product fields that are missing, with row counts', async () => {
    const products: NormalizedPriceList = {
      ...payload(),
      items: [
        { externalId: 'M-001', name: 'Mlijeko 1 l', type: 'Proizvod', anchorReferenceDate: '2025-05-02', brand: 'Dukat', barcode: '4006381333931', price: 1.2, anchorPrice: 1.1, specialSaleApplied: false, availability: 'dostupno' },
        { externalId: 'M-002', name: 'Kruh', type: 'Proizvod', anchorReferenceDate: '2025-05-02', price: 0.99, anchorPrice: 0.95, specialSaleApplied: false },
        { name: 'Sol', type: 'Proizvod', anchorReferenceDate: '2025-05-02', price: 0.5, specialSaleApplied: false },
      ],
    }
    await seed({ list: products, profile: 'products', publishedAt: '2026-11-17T04:30:00Z' })
    const result = await runTenantCheck(monitorEnv(), { slug: 'acme', trigger: 'cron', now: NOW, fetcher: fakeFetch({}, products) })
    if (result.status !== 'checked') throw new Error('expected checked')
    expect(result.run.overall).toBe('fail')
    const byField = Object.fromEntries(result.run.issues.filter((issue) => issue.code === 'MISSING_REQUIRED_FIELD').map((issue) => [issue.field, issue.rows]))
    expect(byField).toEqual({ externalId: 1, anchorPrice: 1, brand: 2, barcode: 2, availability: 2 })
  })

  it('fails with a precise issue when XML returns 404 and alerts once', async () => {
    await seed({ profile: 'services' })
    const fetcher = fakeFetch({ [`https://${HOST}/cjenik.xml`]: new Response('nf', { status: 404 }) })
    const first = await runTenantCheck(monitorEnv(), { slug: 'acme', trigger: 'cron', now: NOW, fetcher })
    const second = await runTenantCheck(monitorEnv(), { slug: 'acme', trigger: 'retry', now: new Date(NOW.getTime() + 3600_000), fetcher })
    if (first.status !== 'checked' || second.status !== 'checked') throw new Error('expected checked')
    expect(first.run.overall).toBe('fail')
    expect(first.run.xmlStatus).toBe(404)
    expect(first.run.csvStatus).toBe(200)
    expect(first.run.issues.find((issue) => issue.code === 'FEED_HTTP_ERROR')).toMatchObject({ field: 'xml', severity: 'fail', message: 'XML vraća HTTP 404.' })
    expect(first.alert).toBe('fail')
    expect(second.alert).toBeNull()
    expect((await readState(monitorEnv().DB, 't-acme')).alertOpen).toBe(true)
  })

  it('fails on a row-count mismatch between payload and CSV', async () => {
    await seed({ profile: 'services' })
    const fetcher = fakeFetch({}, payload(2))
    const result = await runTenantCheck(monitorEnv(), { slug: 'acme', trigger: 'cron', now: NOW, fetcher })
    if (result.status !== 'checked') throw new Error('expected checked')
    expect(result.run.overall).toBe('fail')
    expect(result.run.issues.filter((issue) => issue.code === 'ROW_COUNT_MISMATCH').map((issue) => issue.field).sort()).toEqual(['csv', 'xml'])
    expect(result.run).toMatchObject({ csvRows: 2, xmlRows: 2, expectedRows: 3 })
  })

  it('reports a malformed XML as unparseable', async () => {
    await seed({ profile: 'services' })
    const fetcher = fakeFetch({ [`https://${HOST}/cjenik.xml`]: new Response('<priceList><items><item></items>', { status: 200, headers: { 'content-disposition': `inline; filename="${STEM}.xml"` } }) })
    const result = await runTenantCheck(monitorEnv(), { slug: 'acme', trigger: 'cron', now: NOW, fetcher })
    if (result.status !== 'checked') throw new Error('expected checked')
    expect(result.run.overall).toBe('fail')
    expect(result.run.issues.some((issue) => issue.code === 'FEED_UNPARSEABLE' && issue.field === 'xml')).toBe(true)
  })

  it('splits filename signals: wrong generic name fails both, publication-only mismatch only one', async () => {
    await seed({ profile: 'services' })
    const generic = fakeFetch({ [`https://${HOST}/cjenik.csv`]: new Response(renderCsv(payload()), { status: 200, headers: { 'content-disposition': 'inline; filename="cjenik.csv"' } }) })
    const result = await runTenantCheck(monitorEnv(), { slug: 'acme', trigger: 'cron', now: NOW, fetcher: generic })
    if (result.status !== 'checked') throw new Error('expected checked')
    expect(result.run.overall).toBe('warn')
    expect(result.run.filenamePublicationMatch).toBe(false)
    expect(result.run.filenameRulesetMatch).toBe(false)
    expect(result.run.filenameCsv).toBe('cjenik.csv')
  })

  it('skips tenants whose entitlement expired (HTTP 410 is expected)', async () => {
    await seed({ entitlementEnd: '2026-10-01T00:00:00Z' })
    const result = await runTenantCheck(monitorEnv(), { slug: 'acme', trigger: 'cron', now: NOW, fetcher: fakeFetch() })
    expect(result).toEqual({ status: 'skipped', reason: 'not_live' })
    expect(await readLatestRun(monitorEnv().DB, 't-acme')).toBeNull()
    expect(await runTenantCheck(monitorEnv(), { slug: 'missing', trigger: 'cron', now: NOW })).toEqual({ status: 'skipped', reason: 'unknown_tenant' })
  })

  it('fails when a stale product publication is also missing required fields', async () => {
    const goods = { ...payload(), items: payload().items.map(item => ({ ...item, type: 'Proizvod' })) }
    await seed({ list: goods, profile: 'products', publishedAt: '2026-11-10T04:30:00Z' })
    const result = await runTenantCheck(monitorEnv(), { slug: 'acme', trigger: 'cron', now: NOW, fetcher: fakeFetch({}, goods) })
    if (result.status !== 'checked') throw new Error('expected checked')
    expect(result.run.freshnessStatus).toBe('warn')
    expect(result.run.overall).toBe('fail')
    expect(result.alert).toBe('fail')
    expect(result.run.issues.some((issue) => issue.code === 'MISSING_REQUIRED_FIELD' && issue.field === 'barcode' && issue.severity === 'warn')).toBe(true)
  })

  it('archive: a gap in public_until fails; smoke-checks the latest and oldest archived files', async () => {
    const archive = [
      { stem: 'trgovina_vukovarska-1_p-01_2_20261116-053000', publishedAt: '2026-11-16T05:30:00Z', publicUntil: '2026-12-16T05:30:00Z' },
      { stem: 'trgovina_vukovarska-1_p-01_1_20261102-053000', publishedAt: '2026-11-02T05:30:00Z', publicUntil: '2026-11-04T05:30:00Z' },
    ]
    await seed({ profile: 'services', archive })
    const result = await runTenantCheck(monitorEnv(), { slug: 'acme', trigger: 'cron', now: NOW, fetcher: fakeFetch() })
    if (result.status !== 'checked') throw new Error('expected checked')
    expect(result.run).toMatchObject({ archiveExpected: 2, archiveAvailable: 1, archiveLatestStatus: 200, archiveOldestStatus: 200, overall: 'fail' })
    expect(result.run.issues.some((issue) => issue.code === 'ARCHIVE_INCOMPLETE')).toBe(true)
  })

  it('archive: unreachable archived file fails', async () => {
    const stem = 'trgovina_vukovarska-1_p-01_2_20261116-053000'
    await seed({ profile: 'services', archive: [{ stem, publishedAt: '2026-11-16T05:30:00Z', publicUntil: '2026-12-16T05:30:00Z' }] })
    const fetcher = fakeFetch({ [`https://${HOST}/${stem}.csv`]: new Response('gone', { status: 404 }) })
    const result = await runTenantCheck(monitorEnv(), { slug: 'acme', trigger: 'cron', now: NOW, fetcher })
    if (result.status !== 'checked') throw new Error('expected checked')
    expect(result.run.archiveLatestStatus).toBe(404)
    expect(result.run.issues.some((issue) => issue.code === 'ARCHIVE_UNREACHABLE')).toBe(true)
  })

  it('alert sequence ok → fail → warn → ok yields fail then recovery only at the end', async () => {
    await seed({ profile: 'services' })
    const db = monitorEnv()
    const step = async (hours: number, fetcher: typeof fetch) => {
      const result = await runTenantCheck(db, { slug: 'acme', trigger: 'cron', now: new Date(NOW.getTime() + hours * 3600_000), fetcher })
      if (result.status !== 'checked') throw new Error('expected checked')
      return { overall: result.run.overall, alert: result.alert }
    }
    const down = fakeFetch({ [`https://${HOST}/cjenik.xml`]: new Response('x', { status: 500 }) })
    const genericName = fakeFetch({ [`https://${HOST}/cjenik.csv`]: new Response(renderCsv(payload()), { status: 200, headers: { 'content-disposition': 'inline; filename="cjenik.csv"' } }) })
    expect(await step(0, fakeFetch())).toEqual({ overall: 'ok', alert: null })
    expect(await step(1, down)).toEqual({ overall: 'fail', alert: 'fail' })
    expect(await step(2, genericName)).toEqual({ overall: 'warn', alert: null })
    expect(await step(3, fakeFetch())).toEqual({ overall: 'ok', alert: 'recovery' })
  })

  it('retry selection only picks warn/fail/unchecked tenants', async () => {
    await seed({ profile: 'services' })
    const db = monitorEnv().DB
    const targets = await listMonitorTargets(db)
    expect(targets.map((target) => target.slug)).toEqual(['acme'])
    const since = new Date(NOW.getTime() - 6 * 3600_000).toISOString()
    expect(await selectRetryTargets(db, targets, since)).toHaveLength(1) // never checked
    await runTenantCheck(monitorEnv(), { slug: 'acme', trigger: 'cron', now: NOW, fetcher: fakeFetch() })
    expect(await selectRetryTargets(db, targets, since)).toHaveLength(0) // healthy
    await runTenantCheck(monitorEnv(), { slug: 'acme', trigger: 'cron', now: new Date(NOW.getTime() + 1000), fetcher: fakeFetch({ [`https://${HOST}/cjenik.xml`]: new Response('x', { status: 500 }) }) })
    expect(await selectRetryTargets(db, targets, since)).toHaveLength(1) // failing
  })

  it('detects a changed anchor even when names, prices and row counts match', async () => {
    await seed({ profile: 'services' })
    const changed = payload()
    changed.items[0].anchorPrice = 9999
    const result = await runTenantCheck(monitorEnv(), { slug: 'acme', trigger: 'manual', now: NOW, fetcher: fakeFetch({}, changed) })
    if (result.status !== 'checked') throw new Error('expected checked')
    expect(result.run.overall).toBe('fail')
    expect(result.run.issues.filter(issue => issue.code === 'FEED_CONTENT_MISMATCH').map(issue => issue.field).sort()).toEqual(['csv', 'xml'])
  })

  it('checks the middle archived version and XML as well as CSV', async () => {
    await seed({ profile: 'services', archive: [1, 2, 3].map(index => ({ stem: `archive-${index}`, publishedAt: `2026-11-${10 + index}T05:00:00Z`, publicUntil: '2026-12-15T05:00:00Z' })) })
    const fetcher = fakeFetch({ [`https://${HOST}/archive-2.xml`]: new Response('gone', { status: 404 }) })
    const result = await runTenantCheck(monitorEnv(), { slug: 'acme', trigger: 'manual', now: NOW, fetcher })
    if (result.status !== 'checked') throw new Error('expected checked')
    expect(result.run.overall).toBe('fail')
    expect(result.run.issues.find(issue => issue.code === 'ARCHIVE_UNREACHABLE')?.message).toContain('archive-2')
  })

  it('includes an old publication superseded today in the retained archive window', async () => {
    await seed({ profile: 'services', archive: [{ stem: 'old-required', publishedAt: '2026-01-01T05:00:00Z', publicUntil: '2026-12-15T05:00:00Z' }] })
    await env.DB.prepare("UPDATE price_publications SET superseded_at = ? WHERE filename_stem = 'old-required'").bind(NOW.toISOString()).run()
    const result = await runTenantCheck(monitorEnv(), { slug: 'acme', trigger: 'manual', now: NOW, fetcher: fakeFetch({ [`https://${HOST}/old-required.csv`]: new Response('gone', { status: 404 }) }) })
    if (result.status !== 'checked') throw new Error('expected checked')
    expect(result.run.archiveExpected).toBe(1)
    expect(result.run.overall).toBe('fail')
  })

  it('manual runs are rate limited atomically', async () => {
    await seed({ profile: 'services' })
    const db = monitorEnv().DB
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => claimManualRun(db, 't-acme', NOW)))
    expect(results.filter(Boolean)).toHaveLength(1)
    expect(await claimManualRun(db, 't-acme', new Date(NOW.getTime() + 60_000))).toBe(false)
    expect(await claimManualRun(db, 't-acme', new Date(NOW.getTime() + 6 * 60_000))).toBe(true)
  })
})
