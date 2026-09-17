import { bootstrapFromFixture, readCurrentPublication, readMetadataForSlug, readPublications, readEntitlement, type RuntimeEnv } from '../../_repository'

export const onRequestGet = async ({ request, params, env }: { request: Request; params: Record<string, string>; env: RuntimeEnv }) => {
  try {
    const existing = await readCurrentPublication(env, params.slug)
    const publication = existing ?? (await bootstrapFromFixture(env, request, params.slug) ? await readCurrentPublication(env, params.slug) : null)
    if (!publication) return Response.json({ error: 'Cjenik nije pronađen ili D1 nije spreman.' }, { status: 404 })
    return Response.json({ priceList: publication.payload, publication, metadata: await readMetadataForSlug(env, params.slug), publications: await readPublications(env, params.slug), entitlement: await readEntitlement(env, params.slug) })
  } catch { return Response.json({ error: 'Cjenik nije pronađen ili D1 nije spreman.' }, { status: 404 }) }
}
