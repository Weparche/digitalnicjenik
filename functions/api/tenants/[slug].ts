import { resolveSession } from '../../_auth'
import { bootstrapFromFixture, readCurrentPublication, readMetadataForSlug, readPublications, readEntitlement, type RuntimeEnv } from '../../_repository'
import { applyPublicAccessHeaders, getPublicTenantAccess, publicGoneJson } from '../../_public-access'
import type { AuthEnv } from '../../_auth'

export const onRequestGet = async ({ request, params, env }: { request: Request; params: Record<string, string>; env: RuntimeEnv & AuthEnv }) => {
  try {
    const session = await resolveSession(env, request)
    const isOwner = Boolean(session?.tenants.some((tenant) => tenant.slug === params.slug))
    const access = await getPublicTenantAccess(env, params.slug)

    if (!access.accessible && access.tenant && !isOwner) return publicGoneJson()

    const existing = await readCurrentPublication(env, params.slug)
    const publication = existing ?? (
      (!access.tenant || params.slug === (env.DEMO_WRITE_TENANT || 'nepar') || params.slug === 'patrisa-sisa')
        && (await bootstrapFromFixture(env, request, params.slug))
        ? await readCurrentPublication(env, params.slug)
        : null
    )
    if (!publication && !isOwner) return Response.json({ error: 'Cjenik nije pronađen ili D1 nije spreman.' }, { status: 404 })

    const liveAccess = await getPublicTenantAccess(env, params.slug)
    const headers = new Headers({ 'content-type': 'application/json; charset=utf-8' })
    if (!isOwner) applyPublicAccessHeaders(headers, liveAccess)
    else headers.set('cache-control', 'no-store')

    return new Response(JSON.stringify({
      priceList: publication?.payload ?? null,
      publication,
      metadata: await readMetadataForSlug(env, params.slug),
      publications: await readPublications(env, params.slug, !isOwner),
      entitlement: await readEntitlement(env, params.slug),
      access: liveAccess,
      ownerView: isOwner,
    }), { status: 200, headers })
  } catch { return Response.json({ error: 'Cjenik nije pronađen ili D1 nije spreman.' }, { status: 404 }) }
}
