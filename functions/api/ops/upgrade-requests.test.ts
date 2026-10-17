import { beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { onRequestGet } from './tenants'
import { onRequestPost as renew } from './renew'
import { recordUpgradeRequest } from '../../_trial'

const KEY = 'ops-key'
const iso = '2026-11-01T00:00:00Z'
const get = () => onRequestGet({ request: new Request('https://x.test/api/ops/tenants', { headers: { authorization: `Bearer ${KEY}` } }), env: { ...env, OPERATOR_WRITE_KEY: KEY } as never })
const doRenew = () => renew({ request: new Request('https://x.test/api/ops/renew', { method: 'POST', headers: { authorization: `Bearer ${KEY}` }, body: JSON.stringify({ slug: 'acme' }) }), env: { ...env, OPERATOR_WRITE_KEY: KEY } as never })
const input = { tenantId: 't1', intent: 'self_service' as const, email: 'vlasnik@acme.hr' }

describe('upgrade requests ("čeka uplatu")', () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM upgrade_requests'),
      env.DB.prepare('DELETE FROM entitlements'),
      env.DB.prepare('DELETE FROM tenants'),
      env.DB.prepare("INSERT INTO tenants (id, slug, name, currency, created_at, updated_at) VALUES ('t1', 'acme', 'Acme', 'EUR', ?, ?)").bind(iso, iso),
      env.DB.prepare("INSERT INTO entitlements (id, tenant_id, plan, status, period_start, period_end, created_at, updated_at) VALUES ('e1', 't1', 'publisher_self_service', 'trial', ?, '2026-11-08T00:00:00Z', ?, ?)").bind(iso, iso, iso),
    ])
  })

  it('lists the payment request ahead of a help request', async () => {
    await env.DB.prepare("INSERT INTO upgrade_requests (id, tenant_id, intent, requester_email, status, created_at) VALUES ('q1', 't1', 'consultation', 'v@acme.hr', 'open', '2026-11-05T00:00:00Z')").run()
    await recordUpgradeRequest(env as never, input)
    const body = await (await get()).json() as { tenants: Array<{ request: { intent: string; email: string } | null }> }
    expect(body.tenants[0]!.request).toMatchObject({ intent: 'self_service', email: 'vlasnik@acme.hr' })
  })

  it('a repeated request refreshes the open one instead of duplicating', async () => {
    await recordUpgradeRequest(env as never, input)
    await recordUpgradeRequest(env as never, { ...input, message: 'ponovno' })
    const open = await env.DB.prepare("SELECT message FROM upgrade_requests WHERE status = 'open'").all<{ message: string | null }>()
    expect(open.results).toEqual([{ message: 'ponovno' }])
  })

  it('renew closes open requests, and a new one can be opened afterwards', async () => {
    await recordUpgradeRequest(env as never, input)
    await doRenew()
    const after = await env.DB.prepare('SELECT status, handled_at FROM upgrade_requests').all<{ status: string; handled_at: string | null }>()
    expect(after.results).toHaveLength(1)
    expect(after.results[0]!.status).toBe('done')
    expect(after.results[0]!.handled_at).not.toBeNull()
    const body = await (await get()).json() as { tenants: Array<{ request: unknown }> }
    expect(body.tenants[0]!.request).toBeNull()
    await recordUpgradeRequest(env as never, input)
    expect((await env.DB.prepare("SELECT count(*) c FROM upgrade_requests WHERE status = 'open'").first<{ c: number }>())?.c).toBe(1)
  })
})
