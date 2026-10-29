import { beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { onRequestGet, onRequestPost } from './monitor'
import { insertRun } from '../../../../shared/compliance/store'
import type { MonitorRunRecord } from '../../../../shared/compliance/types'

const KEY = 'operator-key'
const iso = '2026-11-17T04:00:00Z'
const call = (handler: typeof onRequestGet | typeof onRequestPost, extra: Record<string, unknown> = {}, headers: Record<string, string> = { authorization: `Bearer ${KEY}` }, slug = 'acme', host = 'digitalnicjenik.nepar.hr') =>
  handler({
    request: new Request(`https://${host}/api/tenants/${slug}/monitor`, { method: handler === onRequestGet ? 'GET' : 'POST', headers }),
    params: { slug },
    env: { ...env, OPERATOR_WRITE_KEY: KEY, DEMO_WRITE_TENANT: 'nepar', DEMO_PUBLIC_HOSTNAME: 'digitalnicjenik.nepar.hr', ...extra } as never,
  })

const run = (overrides: Partial<MonitorRunRecord> = {}): MonitorRunRecord => ({
  id: crypto.randomUUID(), tenantId: 't-acme', publicationId: null, checkedAt: iso, trigger: 'cron', ruleset: 'nn-101-2026', profile: 'products', overall: 'ok',
  csvStatus: 200, xmlStatus: 200, csvRows: 2, xmlRows: 2, expectedRows: 2, prevRows: null, filenamePublicationMatch: true, filenameRulesetMatch: true,
  filenameCsv: 'a.csv', filenameXml: 'a.xml', freshnessStatus: 'ok', archiveExpected: 0, archiveAvailable: 0, archiveLatestStatus: null, archiveOldestStatus: null,
  payloadSha256: null, csvSha256: null, xmlSha256: null, issues: [], durationMs: 5, publishedAt: iso, publicationSequence: 1, ...overrides,
})

describe('monitor API', () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM monitor_runs'),
      env.DB.prepare('DELETE FROM monitor_state'),
      env.DB.prepare('DELETE FROM publication_targets'),
      env.DB.prepare('DELETE FROM publication_metadata'),
      env.DB.prepare('DELETE FROM entitlements'),
      env.DB.prepare('DELETE FROM tenants'),
      env.DB.prepare("INSERT INTO tenants (id, slug, name, currency, created_at, updated_at) VALUES ('t-acme', 'acme', 'Acme', 'EUR', '2026-11-17T00:00:00Z', '2026-11-17T00:00:00Z')"),
    ])
    await env.DB.prepare("INSERT INTO entitlements(id,tenant_id,plan,status,period_end,created_at,updated_at) VALUES ('e-acme','t-acme','publisher_self_service','active','2099-01-01',?,?)").bind(iso,iso).run()
  })

  it('requires owner or operator access, even for the demo tenant', async () => {
    expect((await call(onRequestGet, {}, {})).status).toBe(401)
    expect((await call(onRequestGet, {}, { authorization: 'Bearer wrong' })).status).toBe(401)
    expect((await call(onRequestPost, {}, {}, 'nepar')).status).toBe(401)
    expect((await call(onRequestGet, {}, { authorization: `Bearer ${KEY}` }, 'missing')).status).toBe(404)
  })

  it('GET returns the latest run, compact history and applicable ruleset', async () => {
    await insertRun(env.DB as never, run({ id: 'older', checkedAt: '2026-11-16T04:00:00Z', overall: 'warn' }))
    await insertRun(env.DB as never, run({ id: 'newest', issues: [{ code: 'X', severity: 'info', message: 'm' }] }))
    const body = await (await call(onRequestGet)).json() as { latest: { id: string; issues: unknown[] }; history: Array<{ id: string; issues?: unknown }>; ruleset: { id: string }; profile: { id: string } }
    expect(body.latest.id).toBe('newest')
    expect(body.latest.issues).toHaveLength(1)
    expect(body.history.map((item) => item.id)).toEqual(['newest', 'older'])
    expect(body.history[0]).not.toHaveProperty('issues')
    expect(body.ruleset.id).toBe('nn-101-2026')
    expect(body.profile.id).toBe('products')
  })

  it('GET works before the first run', async () => {
    const body = await (await call(onRequestGet)).json() as { latest: unknown; history: unknown[] }
    expect(body.latest).toBeNull()
    expect(body.history).toEqual([])
  })

  it('POST delegates to the monitor Worker via the service binding and rate-limits atomically', async () => {
    const calls: Array<{ url: string; auth: string | null; body: unknown }> = []
    const MONITOR = {
      fetch: async (input: Request | string, init?: RequestInit) => {
        calls.push({ url: String(input), auth: new Headers(init?.headers).get('authorization'), body: JSON.parse(String(init?.body)) })
        return Response.json({ status: 'checked', run: run({ trigger: 'manual' }) })
      },
    }
    const responses = await Promise.all([1, 2, 3].map(() => call(onRequestPost, { MONITOR, MONITOR_SECRET: 'm-secret' })))
    expect(responses.map((response) => response.status).sort()).toEqual([200, 429, 429])
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ url: 'https://digitalnicjenik-monitor/run', auth: 'Bearer m-secret', body: { slug: 'acme' } })
    const limited = responses.find((response) => response.status === 429)!
    expect(limited.headers.get('retry-after')).toBe('300')
  })

  it('POST reports a missing binding and worker failures', async () => {
    expect((await call(onRequestPost)).status).toBe(503)
    const broken = { fetch: async () => new Response('x', { status: 500 }) }
    expect((await call(onRequestPost, { MONITOR: broken, MONITOR_SECRET: 's' })).status).toBe(502)
  })

  it('POST returns 202 for queued work and GET exposes progress without private payloads', async () => {
    const MONITOR = { fetch: async () => Response.json({ status: 'queued', jobId: 'job-1' }, { status: 202 }) }
    const response = await call(onRequestPost, { MONITOR, MONITOR_SECRET: 's' })
    expect(response.status).toBe(202)
    expect(await response.json()).toMatchObject({ status: 'queued', jobId: 'job-1' })
    await env.DB.prepare("INSERT INTO monitor_jobs (id, tenant_id, slug, run_trigger, status, requested_at, updated_at, cursor, total, payload_json) VALUES ('job-1', 't-acme', 'acme', 'manual', 'running', ?, ?, 10, 35, 'private')").bind(iso, iso).run()
    const body = await (await call(onRequestGet)).json() as { job: Record<string, unknown> }
    expect(body.job).toMatchObject({ id: 'job-1', status: 'running', checked: 10, total: 35 })
    expect(body.job).not.toHaveProperty('payload_json')
  })
})
