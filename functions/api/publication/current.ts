import { readPublicationForHost, readMetadataForSlug, readEntitlement, type RuntimeEnv } from '../../_repository'
import { applyPublicAccessHeaders, getPublicTenantAccess, publicGoneJson } from '../../_public-access'

export const onRequestGet = async ({ request, env }: { request: Request; env: RuntimeEnv }) => {
  const publication = await readPublicationForHost(env, new URL(request.url).hostname)
  if (!publication) return Response.json({ error: 'Publication target nije pronađen.' }, { status: 404 })
  const access = await getPublicTenantAccess(env, publication.payload.tenant.slug)
  if (!access.accessible) return publicGoneJson()
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8' })
  applyPublicAccessHeaders(headers, access)
  return new Response(JSON.stringify({
    publication,
    metadata: await readMetadataForSlug(env, publication.payload.tenant.slug),
    entitlement: await readEntitlement(env, publication.payload.tenant.slug),
    access,
  }), { status: 200, headers })
}
