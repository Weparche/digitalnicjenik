import { beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { placeOrder, readPendingOrder } from './_orders'
import { renewEntitlement, type TrialEnv } from './_trial'

const runtime = { DB: env.DB } as unknown as TrialEnv
const DAY = 86_400_000
const billing = { customerType: 'company', billingName: 'Auto Gubić d.o.o.', oib: '69435151530', address: 'Zagrebačka 123', postalCity: '10000 Zagreb', email: 'info@autogubic.hr' }
const tenant = (slug: string) => ({ id: `t-${slug}`, slug, name: slug })

async function seed(slug: string, entitlement: { plan: string; status: string; periodStart: string; periodEnd: string }) {
  const stamp = '2026-10-26T09:00:00Z'
  await env.DB.batch([
    env.DB.prepare("INSERT INTO tenants (id, slug, name, currency, created_at, updated_at) VALUES (?, ?, ?, 'EUR', ?, ?)").bind(`t-${slug}`, slug, slug, stamp, stamp),
    env.DB.prepare('INSERT INTO entitlements (id, tenant_id, plan, status, period_start, period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(`e-${slug}`, `t-${slug}`, entitlement.plan, entitlement.status, entitlement.periodStart, entitlement.periodEnd, stamp, stamp),
  ])
}
const entitlementOf = (slug: string) => env.DB.prepare('SELECT plan, status, period_start, period_end FROM entitlements WHERE id = ?').bind(`e-${slug}`)
  .first<{ plan: string; status: string; period_start: string; period_end: string }>()

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM admin_audit'),
    env.DB.prepare('DELETE FROM payment_orders'),
    env.DB.prepare('DELETE FROM entitlements'),
    env.DB.prepare('DELETE FROM tenants'),
  ])
})

describe('free publication orders', () => {
  it('preserves the free deadline on ordering and keeps the reference on resubmit', async () => {
    // Published Mon 10:00 (Zagreb), free until Tue 10:00; the customer orders on Tue 09:55.
    await seed('auto-gubic', { plan: 'web_link', status: 'trial', periodStart: '2026-10-26T09:00:00Z', periodEnd: '2026-10-27T09:00:00Z' })
    const first = await placeOrder(runtime, tenant('auto-gubic'), { kind: 'web_link', installation: true, ...billing }, new Date('2026-10-27T08:55:00Z'))
    expect(first.activeUntil).toBe('2026-10-27T09:00:00Z')
    expect((await entitlementOf('auto-gubic'))?.period_end).toBe('2026-10-27T09:00:00Z')
    expect(first.order.amount_cents).toBe(4980)
    expect(first.order.reference).toBe(`2026-${first.order.number}`)

    const again = await placeOrder(runtime, tenant('auto-gubic'), { kind: 'web_link', installation: false, ...billing, billingName: 'Auto Gubić j.d.o.o.' }, new Date('2026-10-28T20:00:00Z'))
    expect(again.order.reference).toBe(first.order.reference)
    expect(again.order.billing_name).toBe('Auto Gubić j.d.o.o.')
    expect(again.order.amount_cents).toBe(1990)
    expect(again.activeUntil).toBe('2026-10-27T09:00:00Z')
    expect((await entitlementOf('auto-gubic'))?.period_end).toBe('2026-10-27T09:00:00Z')
  })

  it('validates billing details before saving', async () => {
    await seed('salon', { plan: 'web_link', status: 'trial', periodStart: '2026-10-26T09:00:00Z', periodEnd: '2026-10-27T09:00:00Z' })
    await expect(placeOrder(runtime, tenant('salon'), { kind: 'web_link', ...billing, oib: '12345678901' })).rejects.toMatchObject({ code: 'invalid_oib' })
    await expect(placeOrder(runtime, tenant('salon'), { kind: 'web_link', ...billing, customerType: 'person', oib: '' }, new Date('2026-10-26T10:00:00Z'))).resolves.toBeTruthy()
    expect(await readPendingOrder(runtime, 't-salon')).toMatchObject({ customer_type: 'person', oib: null })
  })

  it('gives concurrent orders distinct DB-generated references and one pending order per tenant', async () => {
    await seed('a', { plan: 'web_link', status: 'trial', periodStart: '2026-10-26T09:00:00Z', periodEnd: '2026-10-27T09:00:00Z' })
    await seed('b', { plan: 'web_link', status: 'trial', periodStart: '2026-10-26T09:00:00Z', periodEnd: '2026-10-27T09:00:00Z' })
    const now = new Date('2026-10-26T10:00:00Z')
    const [a, b] = await Promise.all([
      placeOrder(runtime, tenant('a'), { kind: 'web_link', ...billing }, now),
      placeOrder(runtime, tenant('b'), { kind: 'web_link', ...billing }, now),
    ])
    expect(a.order.reference).not.toBe(b.order.reference)
    await Promise.all([1, 2, 3].map(() => placeOrder(runtime, tenant('a'), { kind: 'web_link', ...billing }, now)))
    const pending = await env.DB.prepare("SELECT COUNT(*) AS n FROM payment_orders WHERE tenant_id = 't-a' AND status = 'pending'").first<{ n: number }>()
    expect(pending?.n).toBe(1)
  })
})

describe('payment confirmation', () => {
  it('activates Web Link for a year from now after the free publication and marks the order paid', async () => {
    await seed('auto-gubic', { plan: 'web_link', status: 'trial', periodStart: '2026-10-26T09:00:00Z', periodEnd: '2026-10-27T09:00:00Z' })
    const { order } = await placeOrder(runtime, tenant('auto-gubic'), { kind: 'web_link', ...billing }, new Date('2026-10-26T10:00:00Z'))
    const now = new Date('2026-10-27T12:00:00Z')
    const result = await renewEntitlement(runtime, 't-auto-gubic', now, order.reference!)
    expect(result).toMatchObject({ plan: 'web_link', periodEnd: new Date(now.getTime() + 365 * DAY).toISOString() })
    expect(await entitlementOf('auto-gubic')).toMatchObject({ plan: 'web_link', status: 'active', period_start: now.toISOString() })
    const paid = await env.DB.prepare('SELECT status, paid_at FROM payment_orders WHERE number = ?').bind(order.number).first<{ status: string; paid_at: string }>()
    expect(paid).toEqual({ status: 'paid', paid_at: now.toISOString() })
  })

  it('upgrades to Publisher within 30 days without extending the period', async () => {
    const activated = '2026-10-01T10:00:00Z'
    await seed('salon', { plan: 'web_link', status: 'active', periodStart: activated, periodEnd: '2027-10-01T10:00:00Z' })
    const placed = await placeOrder(runtime, tenant('salon'), { kind: 'publisher_upgrade', ...billing }, new Date(Date.parse(activated) + 20 * DAY))
    expect(placed.order.amount_cents).toBe(3000)
    expect(placed.activeUntil).toBe('2027-10-01T10:00:00Z')
    const result = await renewEntitlement(runtime, 't-salon', new Date(Date.parse(activated) + 21 * DAY), placed.order.reference!)
    expect(result).toMatchObject({ plan: 'publisher_self_service', periodEnd: '2027-10-01T10:00:00Z' })
    expect(await entitlementOf('salon')).toMatchObject({ plan: 'publisher_self_service', status: 'active', period_start: activated, period_end: '2027-10-01T10:00:00Z' })
  })

  it('refuses the +30 € upgrade after the 30-day window', async () => {
    const activated = '2026-10-01T10:00:00Z'
    await seed('late', { plan: 'web_link', status: 'active', periodStart: activated, periodEnd: '2027-10-01T10:00:00Z' })
    await expect(placeOrder(runtime, tenant('late'), { kind: 'publisher_upgrade', ...billing }, new Date(Date.parse(activated) + 31 * DAY)))
      .rejects.toMatchObject({ code: 'upgrade_window_closed', status: 409 })
  })
})
