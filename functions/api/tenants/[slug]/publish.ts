import { publishDraft, type RuntimeEnv } from '../../../_repository'
import { accessErrorResponse, requireTenantAccess } from '../../../_write-auth'
import { errorStatus, readJsonBody } from '../../../_limits'

export const onRequestPost = async ({ request, params, env }: { request: Request; params: Record<string, string>; env: RuntimeEnv }) => {
  try {
    await requireTenantAccess({ request, env, slug: params.slug, operation: 'publish' })
    const body = await readJsonBody(request) as { draftId?: string }
    if (!body.draftId) return Response.json({ error: 'Draft ID nedostaje.' }, { status: 400 })
    return Response.json(await publishDraft(env, params.slug, body.draftId))
  } catch (caught) {
    return accessErrorResponse(caught) || Response.json({ error: caught instanceof Error ? caught.message : 'Objava nije uspjela.' }, { status: errorStatus(caught) })
  }
}
