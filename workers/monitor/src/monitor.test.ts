import { beforeEach, describe, expect, it } from 'vitest'
import { env as testEnv } from 'cloudflare:test'
import { renderCsv } from '../../../src/price-engine/csv'
import { renderXml } from '../../../src/price-engine/xml'
import type { NormalizedPriceList } from '../../../src/price-engine/types'
import { checkAndAlert, RETRY_CRON, runScheduled, default as worker, type Env } from './index'
import { buildAlertMessage, sendAlert } from './alert'
import { runTenantCheck } from '../../../shared/compliance/run-check'
import { readLatestRun } from '../../../shared/compliance/store'

const HOST = 'cjenik.acme.hr'
const STEM = 'trgovina_vukovarska-1_p-01_3_20261117-053000'
const NOW = new Date('2026-11-17T05:30:00Z')

type Sent = { to: string; subject: string; text: string }
function makeEnv(sent: Sent[], overrides: Partial<Env> = {}): Env {
  return {
    DB: testEnv.DB as unknown as Env['DB'],
    DEMO_WRITE_TENANT: 'nepar',
    EMAIL_FROM: 'publisher@nepar.hr',
    EMAIL_TO: 'ops@nepar.hr',
    PUBLIC_APP_URL: 'https://digitalnicjenik.nepar.hr',
    MONITOR_SECRET: 'monitor-secret',
    EMAIL: { send: async (message) => { sent.push({ to: String(message.to), subject: message.subject, text: message.text ?? '' }); return {} } },
    ...overrides,
  }
}

const list: NormalizedPriceList = {
  tenant: { id: 't-acme', slug: 'acme', name: 'Acme' }, source: 'nepar', currency: 'EUR', updatedAt: '2026-11-17T05:00:00Z',
  items: [{ name: 'Usluga A', type: 'Usluga', specialSaleApplied: false, externalId: 'S1', price: 10, anchorPrice: 10 }, { name: 'Usluga B', type: 'Usluga', specialSaleApplied: false, externalId: 'S2', price: 20, anchorPrice: 20 }],
}

function feeds(xmlStatus = 200): typeof fetch {
  const disposition = (name: string) => ({ 'content-disposition': `inline; filename="${name}"` })
  return (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url === `https://${HOST}/cjenik.csv`) return new Response(renderCsv(list), { status: 200, headers: disposition(`${STEM}.csv`) })
    if (url === `https://${HOST}/cjenik.xml`) return xmlStatus === 200 ? new Response(renderXml(list), { status: 200, headers: disposition(`${STEM}.xml`) }) : new Response('x', { status: xmlStatus })
    return new Response('ok', { status: 200 })
  }) as typeof fetch
}

async function seed() {
  const iso = '2026-11-17T04:00:00Z'
  await testEnv.DB.batch([
    testEnv.DB.prepare("INSERT INTO tenants (id, slug, name, currency, created_at, updated_at) VALUES ('t-acme', 'acme', 'Acme d.o.o.', 'EUR', ?, ?)").bind(iso, iso),
    testEnv.DB.prepare("INSERT INTO publication_metadata (tenant_id, object_type, object_address, object_code, next_publication_sequence, timezone, created_at, updated_at, compliance_profile) VALUES ('t-acme', 'Trgovina', 'Vukovarska 1', 'P-01', 4, 'Europe/Zagreb', ?, ?, 'services')").bind(iso, iso),
    testEnv.DB.prepare("INSERT INTO publication_targets (id, tenant_id, hostname, status, created_at, updated_at) VALUES ('tg1', 't-acme', ?, 'active', ?, ?)").bind(HOST, iso, iso),
    testEnv.DB.prepare("INSERT INTO price_list_versions (id, tenant_id, hash, payload_json, created_at) VALUES ('v1', 't-acme', 'h', ?, ?)").bind(JSON.stringify(list), iso),
    testEnv.DB.prepare("INSERT INTO price_publications (id, tenant_id, price_list_id, sequence, filename_stem, published_at, hash, payload_json, is_current) VALUES ('p3', 't-acme', 'v1', 3, ?, ?, 'h', ?, 1)").bind(STEM, iso, JSON.stringify(list)),
    testEnv.DB.prepare("INSERT INTO entitlements (id, tenant_id, plan, status, period_start, period_end, created_at, updated_at) VALUES ('e1', 't-acme', 'publisher_self_service', 'active', ?, '2027-11-17T00:00:00Z', ?, ?)").bind(iso, iso, iso),
    testEnv.DB.prepare("INSERT INTO auth_users (id, email, created_at, updated_at) VALUES ('u1', 'vlasnik@acme.hr', ?, ?)").bind(iso, iso),
    testEnv.DB.prepare("INSERT INTO tenant_members (id, tenant_id, user_id, role, created_at) VALUES ('m1', 't-acme', 'u1', 'owner', ?)").bind(iso),
  ])
}

describe('monitor worker', () => {
  beforeEach(async () => {
    await testEnv.DB.batch([
      testEnv.DB.prepare('DELETE FROM monitor_runs'),
      testEnv.DB.prepare('DELETE FROM monitor_state'),
      testEnv.DB.prepare('DELETE FROM price_publications'),
      testEnv.DB.prepare('DELETE FROM price_list_versions'),
      testEnv.DB.prepare('DELETE FROM publication_targets'),
      testEnv.DB.prepare('DELETE FROM publication_metadata'),
      testEnv.DB.prepare('DELETE FROM entitlements'),
      testEnv.DB.prepare('DELETE FROM tenant_members'),
      testEnv.DB.prepare('DELETE FROM auth_users'),
      testEnv.DB.prepare('DELETE FROM tenants'),
    ])
    await seed()
  })

  it('e-mails owner and ops once on fail, then once on recovery', async () => {
    const sent: Sent[] = []
    const env = makeEnv(sent)
    await checkAndAlert(env, 'acme', 'cron', NOW, feeds(404))
    expect(sent.map((mail) => mail.to).sort()).toEqual(['ops@nepar.hr', 'vlasnik@acme.hr'])
    expect(sent[0]!.subject).toContain('Cjenik nije ispravno objavljen')
    expect(sent[0]!.text).toContain('KRITIČNO — XML vraća HTTP 404.')
    expect(sent[0]!.text).toContain('CSV je uredan.')
    expect(sent[0]!.text).toContain('prije 08:00')

    await checkAndAlert(env, 'acme', 'retry', new Date(NOW.getTime() + 3600_000), feeds(404))
    expect(sent).toHaveLength(2) // deduped

    sent.length = 0
    await checkAndAlert(env, 'acme', 'cron', new Date(NOW.getTime() + 86_400_000), feeds())
    expect(sent.map((mail) => mail.subject)).toEqual(['Cjenik je ponovno ispravan — Acme d.o.o.', 'Cjenik je ponovno ispravan — Acme d.o.o.'])
  })

  it('a failing recipient does not block the others', async () => {
    const sent: Sent[] = []
    const env = makeEnv(sent, { EMAIL: { send: async (message) => { if (String(message.to).startsWith('vlasnik')) throw new Error('bounce'); sent.push({ to: String(message.to), subject: message.subject, text: message.text ?? '' }); return {} } } })
    const result = await runTenantCheck(env, { slug: 'acme', trigger: 'cron', now: NOW, fetcher: feeds(500) })
    if (result.status !== 'checked' || !result.alert) throw new Error('expected an alert')
    const outcome = await sendAlert(env, result.alert, result.run, result.tenant)
    expect(outcome).toEqual({ sent: ['ops@nepar.hr'], failed: ['vlasnik@acme.hr'] })
  })

  it('retries a failed owner delivery without waiting 24 hours', async () => {
    const sent: Sent[] = []
    let rejectOwner = true
    const deliveryEnv = makeEnv(sent, { EMAIL: { send: async message => {
      if (rejectOwner && String(message.to).startsWith('vlasnik')) throw new Error('temporary failure')
      sent.push({ to: String(message.to), subject: message.subject, text: message.text ?? '' }); return {}
    } } })
    await checkAndAlert(deliveryEnv, 'acme', 'cron', NOW, feeds(500))
    rejectOwner = false
    await checkAndAlert(deliveryEnv, 'acme', 'retry', new Date(NOW.getTime() + 3600_000), feeds(500))
    expect(sent.some(mail => mail.to === 'vlasnik@acme.hr')).toBe(true)
  })

  it('scheduled retry only re-checks tenants that are warn/fail or unchecked', async () => {
    const sent: Sent[] = []
    const env = makeEnv(sent)
    const first = await runScheduled(env, '30 4 * * *', NOW, feeds())
    expect(first).toMatchObject({ trigger: 'cron', tenants: 1 })
    const retryHealthy = await runScheduled(env, RETRY_CRON, new Date(NOW.getTime() + 3600_000), feeds())
    expect(retryHealthy).toMatchObject({ trigger: 'retry', tenants: 0 })
    // A failing tenant is picked up again by the retry pass.
    await runScheduled(env, '30 4 * * *', new Date(NOW.getTime() + 7200_000), feeds(500))
    expect(await runScheduled(env, RETRY_CRON, new Date(NOW.getTime() + 10_800_000), feeds())).toMatchObject({ tenants: 1, ok: 1 })
  })

  it('alert text escapes HTML and never claims legal proof', () => {
    const message = buildAlertMessage('fail', {
      id: 'r', tenantId: 't', publicationId: null, checkedAt: NOW.toISOString(), trigger: 'cron', ruleset: 'nn-101-2026', profile: 'products', overall: 'fail',
      csvStatus: 200, xmlStatus: 404, csvRows: 1, xmlRows: null, expectedRows: 1, prevRows: null, filenamePublicationMatch: null, filenameRulesetMatch: null,
      filenameCsv: null, filenameXml: null, freshnessStatus: 'ok', archiveExpected: 0, archiveAvailable: 0, archiveLatestStatus: null, archiveOldestStatus: null,
      payloadSha256: null, csvSha256: null, xmlSha256: null, durationMs: 1, publishedAt: null, publicationSequence: null,
      issues: [{ code: 'X', severity: 'fail', message: '<script>alert(1)</script>' }],
    }, { name: 'Acme' })
    expect(message.html).not.toContain('<script>')
    expect(message.text).toContain('nije pravni dokaz')
  })

  describe('POST /run', () => {
    const call = (init: RequestInit, env: Env) => worker.fetch(new Request('https://monitor.test/run', init), env)

    it('rejects missing or wrong secret and bad input', async () => {
      const env = makeEnv([])
      expect((await call({ method: 'POST', body: '{}' }, env)).status).toBe(401)
      expect((await call({ method: 'POST', headers: { authorization: 'Bearer nope' }, body: '{}' }, env)).status).toBe(401)
      expect((await call({ method: 'POST', headers: { authorization: 'Bearer monitor-secret' }, body: '{}' }, env)).status).toBe(400)
      expect((await call({ method: 'GET' }, env)).status).toBe(405)
      expect((await worker.fetch(new Request('https://monitor.test/other'), env)).status).toBe(404)
    })

    it('runs a manual check through the shared code path', async () => {
      const env = makeEnv([])
      // The shared runner uses global fetch; stub it for this call.
      const realFetch = globalThis.fetch
      globalThis.fetch = feeds()
      try {
        const response = await call({ method: 'POST', headers: { authorization: 'Bearer monitor-secret' }, body: JSON.stringify({ slug: 'acme' }) }, env)
        const body = await response.json() as { status: string; run?: { trigger: string; overall: string } }
        expect(body).toMatchObject({ status: 'checked', run: { trigger: 'manual', overall: 'ok' } })
        expect((await readLatestRun(env.DB, 't-acme'))?.trigger).toBe('manual')
      } finally {
        globalThis.fetch = realFetch
      }
    })
  })
})
