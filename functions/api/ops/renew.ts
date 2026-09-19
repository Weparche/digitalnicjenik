import { renewEntitlement, type TrialEnv } from '../../_trial'
import { resolveTenant } from '../../_repository'
import { AccessDeniedError, accessErrorResponse } from '../../_write-auth'

/** Ops-only: extend entitlement by MAX(now, period_end) + 1 year. */
export const onRequestPost = async ({ request, env }: { request: Request; env: TrialEnv }) => {
  try {
    const key = env.OPERATOR_WRITE_KEY
    const auth = request.headers.get('authorization') || ''
    if (!key || auth !== `Bearer ${key}`) {
      throw new AccessDeniedError(401, 'unauthorized', 'Operator key required.')
    }
    const body = await request.json() as { slug?: string }
    if (!body.slug) return Response.json({ ok: false, error: 'invalid_input' }, { status: 400 })
    const tenant = await resolveTenant(env, body.slug)
    if (!tenant) return Response.json({ ok: false, error: 'not_found' }, { status: 404 })
    const result = await renewEntitlement(env, tenant.id)
    return Response.json({ ok: true, slug: tenant.slug, periodEnd: result.periodEnd })
  } catch (error) {
    const denied = accessErrorResponse(error)
    if (denied) return denied
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'renew_failed' }, { status: 500 })
  }
}
