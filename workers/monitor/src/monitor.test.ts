import { beforeEach, describe, expect, it } from 'vitest'
import { env as testEnv } from 'cloudflare:test'
import { renderCsv } from '../../../src/price-engine/csv'
import { renderXml } from '../../../src/price-engine/xml'
import type { NormalizedPriceList } from '../../../src/price-engine/types'
import { checkAndAlert, RETRY_CRON, runScheduled, default as worker, type Env } from './index'
import { buildAlertMessage, sendAlert } from './alert'
import { runTenantCheck } from '../../../shared/compliance/run-check'
import { processMonitorJob } from './queue'
import type { MonitorMessage } from '../../../shared/compliance/jobs'
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
    MONITOR_QUEUE: { send: async () => {} },
    MONITOR_SECRET: 'monitor-secret',
    LIFECYCLE_EMAILS_ENABLED:'true',
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
      testEnv.DB.prepare('DELETE FROM lifecycle_events'),
      testEnv.DB.prepare('DELETE FROM monitor_incidents'),
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
    await testEnv.DB.prepare("UPDATE auth_users SET email_verified_at=created_at").run()
  })

  it('notifies only the current owner once per continuous incident and once on recovery',async()=>{
    const sent:Sent[]=[]
    const runtime=makeEnv(sent)
    await checkAndAlert(runtime,'acme','cron',NOW,feeds(404))
    expect(sent.map(mail=>mail.to)).toEqual(['vlasnik@acme.hr'])
    expect(sent[0].subject).toContain('CSV/XML')
    await checkAndAlert(runtime,'acme','retry',new Date(NOW.getTime()+3600_000),feeds(404))
    expect(sent).toHaveLength(1)
    await checkAndAlert(runtime,'acme','cron',new Date(NOW.getTime()+86_400_000),feeds())
    expect(sent).toHaveLength(2)
    expect(sent[1].to).toBe('vlasnik@acme.hr')
    expect((await testEnv.DB.prepare("SELECT COUNT(*) AS n FROM lifecycle_events WHERE event_type='monitor_recovery'").first<{n:number}>())?.n).toBe(1)
  })
  it('does not blindly resend an ambiguous transport outcome',async()=>{
    let attempts=0
    const runtime=makeEnv([],{EMAIL:{send:async()=>{attempts++;throw new Error('connection lost')}}})
    await checkAndAlert(runtime,'acme','cron',NOW,feeds(500))
    await checkAndAlert(runtime,'acme','retry',new Date(NOW.getTime()+3600_000),feeds(500))
    expect(attempts).toBe(1)
    expect(await testEnv.DB.prepare('SELECT status FROM lifecycle_deliveries').first()).toMatchObject({status:'uncertain'})
  })
  it('retries a known rate-limit rejection through the durable outbox',async()=>{
    const sent:Sent[]=[]
    let limited=true
    const runtime=makeEnv(sent,{EMAIL:{send:async message=>{
      if(limited)throw new Error('email_rate_limited')
      sent.push({to:String(message.to),subject:message.subject,text:message.text??''});return {messageId:'ok'}
    }}})
    await checkAndAlert(runtime,'acme','cron',NOW,feeds(500))
    limited=false
    await checkAndAlert(runtime,'acme','retry',new Date(NOW.getTime()+3600_000),feeds(500))
    expect(sent.map(mail=>mail.to)).toEqual(['vlasnik@acme.hr'])
  })

  it('scheduled retry only re-checks tenants that are warn/fail or unchecked', async () => {
    const sent: Sent[] = []
    const pending: MonitorMessage[] = []
    const env = makeEnv(sent, { MONITOR_QUEUE: { send: async body => { pending.push(body) } } })
    const drain = async (fetcher: typeof fetch) => {
      while (pending.length) {
        const body = pending.shift()!
        if ('jobId' in body) await processMonitorJob(env, body.jobId, fetcher)
      }
    }
    expect(await runScheduled(env, '30 4 * * *', NOW)).toMatchObject({ trigger: 'cron', tenants: 1 })
    await drain(feeds())
    expect(await runScheduled(env, RETRY_CRON, new Date(NOW.getTime() + 3600_000))).toMatchObject({ trigger: 'retry', tenants: 0 })
    await runScheduled(env, '30 4 * * *', new Date(NOW.getTime() + 7200_000))
    await drain(feeds(500))
    expect(await runScheduled(env, RETRY_CRON, new Date(NOW.getTime() + 10_800_000))).toMatchObject({ tenants: 1 })
    await drain(feeds())
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
        expect(response.status).toBe(202)
        expect(body).toMatchObject({ status: 'queued' })
        expect(await readLatestRun(env.DB, 't-acme')).toBeNull()
      } finally {
        globalThis.fetch = realFetch
      }
    })
  })
})
