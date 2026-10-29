import { resolveSession, type AuthEnv } from '../_auth'
import { paymentView, placeOrder, readPendingOrder, type OrderRow } from '../_orders'
import { readEntitlement } from '../_repository'
import type { TrialEnv } from '../_trial'
import { accessErrorResponse } from '../_write-auth'
import { featuresForPlan } from '../../shared/entitlements'
import { upgradeAvailable } from '../../shared/payment'
import { entitlementAccess } from '../../shared/entitlements'
import { dispatchLifecycle } from '../../shared/lifecycle'

type Env = TrialEnv & AuthEnv
const noStore = { 'cache-control': 'no-store' }

/** The signed-in owner's licence state and pending bank-transfer order (with the HUB-3 payload). */
export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    const session = await resolveSession(env, request)
    const reference = new URL(request.url).searchParams.get('order')
    const selected = reference && env.DB ? await env.DB.prepare('SELECT * FROM payment_orders WHERE reference=?').bind(reference).first<OrderRow>() : null
    const tenant = selected ? session?.tenants.find(t => t.id === selected.tenant_id) : session?.tenants[0]
    if (!tenant) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401, headers: noStore })
    const entitlement = await readEntitlement(env, tenant.slug)
    const order = reference ? selected?.tenant_id === tenant.id ? selected : null : await readPendingOrder(env, tenant.id)
    if (reference && !order) return Response.json({ ok:false,error:'order_missing' },{status:404,headers:noStore})
    return Response.json({
      ok: true,
      entitlement,
      access: entitlementAccess(entitlement),
      features: featuresForPlan(entitlement?.plan),
      upgradeAvailable: upgradeAvailable(entitlement),
      order: order ? paymentView(order, tenant.slug) : null,
    }, { headers: noStore })
  } catch (error) {
    return accessErrorResponse(error) ?? Response.json({ ok: false, error: 'orders_unavailable' }, { status: 500, headers: noStore })
  }
}

export const onRequestPost = async ({ request, env, waitUntil }: { request: Request; env: Env; waitUntil?: (p: Promise<unknown>) => void }) => {
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({ok:false,error:'invalid_origin'},{status:403,headers:noStore})
    const session = await resolveSession(env, request)
    const tenant = session?.tenants[0]
    if (!tenant) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401, headers: noStore })
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const result = await placeOrder(env, tenant, body)
    const payment = paymentView(result.order, tenant.slug)
    if (env.DB) waitUntil?.(dispatchLifecycle({...env,DB:env.DB}))
    return Response.json({ ok: true, order: payment, activeUntil: result.activeUntil }, { headers: noStore })
  } catch (error) {
    return accessErrorResponse(error) ?? Response.json({ ok: false, error: 'order_failed' }, { status: 500, headers: noStore })
  }
}
