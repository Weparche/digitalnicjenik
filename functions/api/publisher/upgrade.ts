import { resolveSession, type AuthEnv } from '../../_auth'
import { sendPublisherUpgradeRequest, type TrialEnv } from '../../_trial'
import { readCurrentPublication, readEntitlement } from '../../_repository'
import { accessErrorResponse } from '../../_write-auth'

export const onRequestPost = async ({ request, env }: { request: Request; env: TrialEnv & AuthEnv }) => {
  try {
    const session = await resolveSession(env, request)
    if (!session || !session.tenants[0]) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }
    const body = await request.json() as { intent?: 'self_service' | 'implementation' | 'consultation'; message?: string }
    if (!body.intent || !['self_service', 'implementation', 'consultation'].includes(body.intent)) {
      return Response.json({ ok: false, error: 'invalid_input' }, { status: 400 })
    }
    const tenant = session.tenants[0]
    const origin = new URL(request.url).origin
    const publication = await readCurrentPublication(env, tenant.slug)
    const entitlement = await readEntitlement(env, tenant.slug)
    await sendPublisherUpgradeRequest(env, {
      intent: body.intent,
      email: session.user.email,
      businessName: tenant.name,
      tenantSlug: tenant.slug,
      publicUrl: `${origin}/c/${tenant.slug}`,
      csvUrl: `${origin}/c/${tenant.slug}/cjenik.csv`,
      xmlUrl: `${origin}/c/${tenant.slug}/cjenik.xml`,
      trialEndsAt: entitlement?.periodEnd ?? null,
      lastPublicationId: publication?.id ?? null,
      message: body.message,
    })
    return Response.json({ ok: true })
  } catch (error) {
    const denied = accessErrorResponse(error)
    if (denied) return denied
    return Response.json({ ok: false, error: 'send_failed' }, { status: 500 })
  }
}
