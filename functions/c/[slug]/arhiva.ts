import { publicationHtmlResponse, resolvePublicationSeo } from '../../_public-seo'
import { readPublications, type RuntimeEnv } from '../../_repository'
import { getPublicTenantAccess, publicGoneJson } from '../../_public-access'
import { retentionIsLive } from '../../../shared/publication-retention'

export const onRequestGet = async ({ request, params, env }: { request: Request; params: Record<string, string>; env: RuntimeEnv }) => {
  // Keep the JSON response useful to direct function tests/legacy callers, but
  // let browser navigation render the same archive UI as the root public route.
  if (env.ASSETS) {
    const shell = await env.ASSETS.fetch(new URL('/app-shell.html', request.url))
    const html = await shell.text()
    const page = await resolvePublicationSeo(env, params.slug, 'archive')
    return publicationHtmlResponse(html, page)
  }
  const access = await getPublicTenantAccess(env, params.slug)
  if (access.entitlement?.status === 'suspended') return publicGoneJson()
  const publications = (await readPublications(env, params.slug)).filter(publication => access.accessible || retentionIsLive(publication))
  return Response.json({ publications }, { headers: { 'cache-control': 'no-store' } })
}
