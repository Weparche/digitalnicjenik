import { updateDraft, readDraft, type RuntimeEnv } from '../../../../_repository'
import { accessErrorResponse, requireTenantAccess } from '../../../../_write-auth'
import { attachCanonicalTenant, errorStatus, parsePriceListInput, readJsonBody } from '../../../../_limits'

export const onRequestPatch = async ({ request, params, env }: { request: Request; params: Record<string, string>; env: RuntimeEnv }) => {
  try {
    const tenant = await requireTenantAccess({ request, env, slug: params.slug, operation: 'draft_patch' })
    const body = await readJsonBody(request) as { priceList?: unknown }
    if (body.priceList === undefined) return Response.json({ error: 'Normalized cjenik nedostaje.' }, { status: 400 })
    const list = attachCanonicalTenant(parsePriceListInput(body.priceList), tenant)
    return Response.json(await updateDraft(env, params.slug, params.id, list))
  } catch (caught) {
    return accessErrorResponse(caught) || Response.json({ error: caught instanceof Error ? caught.message : 'Dopuna drafta nije uspjela.' }, { status: errorStatus(caught) })
  }
}

export const onRequestGet = async ({ request, params, env }: { request: Request; params: Record<string, string>; env: RuntimeEnv }) => {
  try {
    await requireTenantAccess({ request, env, slug: params.slug, operation: 'draft_get' })
    const draft = await readDraft(env, params.slug, params.id)
    if (!draft) return Response.json({ error: 'Draft nije pronađen.' }, { status: 404 })
    return Response.json({ draft })
  } catch (caught) {
    return accessErrorResponse(caught) || Response.json({ error: caught instanceof Error ? caught.message : 'Pregled drafta nije uspio.' }, { status: 422 })
  }
}
