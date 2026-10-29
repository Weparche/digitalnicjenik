import { beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { onRequestGet } from './tenants'
import { onRequestPost as renew } from './renew'

const KEY = 'ops-key'
const iso = '2026-11-01T00:00:00Z'
const get = (auth?: string) => onRequestGet({ request: new Request('https://x.test/api/ops/tenants', { headers: auth ? { authorization: auth } : {} }), env: { ...env, OPERATOR_WRITE_KEY: KEY } as never })

describe('ops tenants overview', () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM monitor_runs'),
      env.DB.prepare('DELETE FROM entitlements'),
      env.DB.prepare('DELETE FROM tenant_members'),
      env.DB.prepare('DELETE FROM auth_users'),
      env.DB.prepare('DELETE FROM tenants'),
      env.DB.prepare("INSERT INTO tenants (id, slug, name, currency, created_at, updated_at) VALUES ('t1', 'acme', 'Acme', 'EUR', ?, ?)").bind(iso, iso),
      env.DB.prepare("INSERT INTO entitlements (id, tenant_id, plan, status, period_start, period_end, created_at, updated_at) VALUES ('e1', 't1', 'publisher_self_service', 'trial', ?, '2026-11-08T00:00:00Z', ?, ?)").bind(iso, iso, iso),
      env.DB.prepare("INSERT INTO auth_users (id, email, created_at, updated_at) VALUES ('u1', 'vlasnik@acme.hr', ?, ?)").bind(iso, iso),
      env.DB.prepare("INSERT INTO tenant_members (id, tenant_id, user_id, role, created_at) VALUES ('m1', 't1', 'u1', 'owner', ?)").bind(iso),
    ])
  })

  it('requires the operator key', async () => {
    expect((await get()).status).toBe(401)
    expect((await get('Bearer nope')).status).toBe(401)
  })

  it('lists tenants with entitlement, owner and latest monitor result', async () => {
    await env.DB.prepare("INSERT INTO monitor_runs (id, tenant_id, checked_at, run_trigger, ruleset, profile, overall) VALUES ('r1', 't1', '2026-11-05T05:00:00Z', 'cron', 'nn-101-2026', 'products', 'warn')").run()
    const body = await (await get(`Bearer ${KEY}`)).json() as { tenants: Array<Record<string, unknown>> }
    expect(body.tenants).toEqual([{ slug: 'acme', name: 'Acme', plan: 'publisher_self_service', status: 'trial', periodEnd: '2026-11-08T00:00:00Z', ownerEmail: 'vlasnik@acme.hr', monitorOverall: 'warn', monitorCheckedAt: '2026-11-05T05:00:00Z', request: null, order: null }])
  })

  it('renew activates a lapsed tenant for a year from now and requires the key', async () => {
    const call = (auth?: string) => renew({ request: new Request('https://x.test/api/ops/renew', { method: 'POST', headers: auth ? { authorization: auth } : {}, body: JSON.stringify({ slug: 'acme', action:'activate', reason:'Manual demonstration', requestKey:'ops-activate-test' }) }), env: { ...env, OPERATOR_WRITE_KEY: KEY } as never })
    expect((await call()).status).toBe(401)
    const before = Date.now()
    const result = await (await call(`Bearer ${KEY}`)).json() as { ok: boolean; periodEnd: string }
    expect(result.ok).toBe(true)
    expect(new Date(result.periodEnd).getTime()).toBeGreaterThanOrEqual(before + 364 * 86_400_000)
    const row = await env.DB.prepare("SELECT status FROM entitlements WHERE id = 'e1'").first<{ status: string }>()
    expect(row?.status).toBe('active')
  })
})
