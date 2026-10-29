import { resolveSession, type AuthEnv } from '../../_auth'
import { recordUpgradeRequest, type TrialEnv } from '../../_trial'
import { accessErrorResponse } from '../../_write-auth'
import { recordAttribution } from '../../_acquisition'
import { dispatchLifecycle } from '../../../shared/lifecycle'
import { templateId } from '../../../shared/web-templates'

export const onRequestPost = async ({ request, env, waitUntil }: { request: Request; env: TrialEnv & AuthEnv; waitUntil?: (p:Promise<unknown>)=>void }) => {
  try {
    if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({ok:false,error:'invalid_origin'},{status:403})
    const session = await resolveSession(env, request)
    if (!session || !session.tenants[0]) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }
    const body = await request.json() as { intent?: 'self_service' | 'implementation' | 'consultation'; message?: string; attribution?: unknown; service?:string; templateId?:string }
    if (!body.intent || !['self_service', 'implementation', 'consultation'].includes(body.intent)) {
      return Response.json({ ok: false, error: 'invalid_input' }, { status: 400 })
    }
    const tenant = session.tenants[0]
    await recordUpgradeRequest(env, { tenantId: tenant.id, intent: body.intent, email: session.user.email, message: body.message, service:body.service==='installation'?'installation':undefined,templateId:templateId(body.templateId) })
    const openRequest = await env.DB?.prepare(
      `SELECT id FROM upgrade_requests WHERE tenant_id = ? AND intent = ? AND status = 'open' ORDER BY created_at DESC LIMIT 1`,
    ).bind(tenant.id, body.intent).first<{ id: string }>()
    if (openRequest) await recordAttribution(env.DB, 'upgrade', openRequest.id, body.attribution)
    if (env.DB) waitUntil?.(dispatchLifecycle({...env,DB:env.DB}))
    return Response.json({ ok: true })
  } catch (error) {
    const denied = accessErrorResponse(error)
    if (denied) return denied
    return Response.json({ ok: false, error: 'send_failed' }, { status: 500 })
  }
}
