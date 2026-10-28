import { renewEntitlement, type TrialEnv } from '../../_trial'
import { sendPaymentConfirmedEmail } from '../../_orders'
import { resolveTenant } from '../../_repository'
import { AccessDeniedError, accessErrorResponse, operatorAuthorized } from '../../_write-auth'

/** Ops-only: the bank transfer landed. Activates the pending order (Web Link year or Publisher upgrade). */
export const onRequestPost = async ({ request, env }: { request: Request; env: TrialEnv }) => {
  try {
    if (!operatorAuthorized(env, request)) {
      throw new AccessDeniedError(401, 'unauthorized', 'Operator key required.')
    }
    const body = await request.json() as { slug?: string }
    if (!body.slug) return Response.json({ ok: false, error: 'invalid_input' }, { status: 400 })
    const tenant = await resolveTenant(env, body.slug)
    if (!tenant) return Response.json({ ok: false, error: 'not_found' }, { status: 404 })
    const result = await renewEntitlement(env, tenant.id)
    if (result.order) {
      await sendPaymentConfirmedEmail(env, { email: result.order.email, slug: tenant.slug, plan: result.plan, periodEnd: result.periodEnd, origin: new URL(request.url).origin })
    }
    return Response.json({ ok: true, slug: tenant.slug, plan: result.plan, periodEnd: result.periodEnd, reference: result.order?.reference ?? null })
  } catch (error) {
    const denied = accessErrorResponse(error)
    if (denied) return denied
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'renew_failed' }, { status: 500 })
  }
}
