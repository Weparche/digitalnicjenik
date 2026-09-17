import { readPublicationForHost, readMetadataForSlug, readEntitlement, type RuntimeEnv } from '../../_repository'

export const onRequestGet = async ({ request, env }: { request: Request; env: RuntimeEnv }) => {
  const publication = await readPublicationForHost(env, new URL(request.url).hostname)
  if (!publication) return Response.json({ error: 'Publication target nije pronađen.' }, { status: 404 })
  return Response.json({ publication, metadata: await readMetadataForSlug(env, publication.payload.tenant.slug), entitlement: await readEntitlement(env, publication.payload.tenant.slug) })
}
