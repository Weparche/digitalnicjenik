import { resolveSession, type AuthEnv } from '../_auth'
import { paymentView, placeOrder, readPendingOrder, sendOrderEmails } from '../_orders'
import { readEntitlement } from '../_repository'
import type { TrialEnv } from '../_trial'
import { accessErrorResponse } from '../_write-auth'
import { featuresForPlan } from '../../shared/entitlements'
import { upgradeAvailable } from '../../shared/payment'

type Env = TrialEnv & AuthEnv
const noStore = { 'cache-control': 'no-store' }

/** The signed-in owner's licence state and pending bank-transfer order (with the HUB-3 payload). */
export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    const session = await resolveSession(env, request)
    const tenant = session?.tenants[0]
    if (!tenant) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401, headers: noStore })
    const entitlement = await readEntitlement(env, tenant.slug)
    const order = await readPendingOrder(env, tenant.id)
    return Response.json({
      ok: true,
      entitlement: entitlement ? { plan: entitlement.plan, status: entitlement.status, periodStart: entitlement.periodStart, periodEnd: entitlement.periodEnd } : null,
      features: featuresForPlan(entitlement?.plan),
      upgradeAvailable: upgradeAvailable(entitlement),
      order: order ? paymentView(order, tenant.slug) : null,
    }, { headers: noStore })
  } catch (error) {
    return accessErrorResponse(error) ?? Response.json({ ok: false, error: 'orders_unavailable' }, { status: 500, headers: noStore })
  }
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    const session = await resolveSession(env, request)
    const tenant = session?.tenants[0]
    if (!tenant) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401, headers: noStore })
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const result = await placeOrder(env, tenant, body)
    const payment = paymentView(result.order, tenant.slug)
    await sendOrderEmails(env, tenant, payment, result.activeUntil, new URL(request.url).origin)
    return Response.json({ ok: true, order: payment, activeUntil: result.activeUntil }, { headers: noStore })
  } catch (error) {
    return accessErrorResponse(error) ?? Response.json({ ok: false, error: 'order_failed' }, { status: 500, headers: noStore })
  }
}
