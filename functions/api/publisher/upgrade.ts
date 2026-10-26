import { resolveSession, type AuthEnv } from '../../_auth'
import { recordUpgradeRequest, sendPublisherUpgradeRequest, type TrialEnv } from '../../_trial'
import { readCurrentPublication, readEntitlement } from '../../_repository'
import { accessErrorResponse } from '../../_write-auth'
import { recordAttribution } from '../../_acquisition'

export const onRequestPost = async ({ request, env }: { request: Request; env: TrialEnv & AuthEnv }) => {
  try {
    const session = await resolveSession(env, request)
    if (!session || !session.tenants[0]) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }
    const body = await request.json() as { intent?: 'self_service' | 'implementation' | 'consultation'; message?: string; attribution?: unknown }
    if (!body.intent || !['self_service', 'implementation', 'consultation'].includes(body.intent)) {
      return Response.json({ ok: false, error: 'invalid_input' }, { status: 400 })
    }
    const tenant = session.tenants[0]
    const origin = new URL(request.url).origin
    await recordUpgradeRequest(env, { tenantId: tenant.id, intent: body.intent, email: session.user.email, message: body.message })
    const openRequest = await env.DB?.prepare(
      `SELECT id FROM upgrade_requests WHERE tenant_id = ? AND intent = ? AND status = 'open' ORDER BY created_at DESC LIMIT 1`,
    ).bind(tenant.id, body.intent).first<{ id: string }>()
    if (openRequest) await recordAttribution(env.DB, 'upgrade', openRequest.id, body.attribution)
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
