import { publicationHtmlResponse, resolvePublicationSeo } from '../../_public-seo'
import type { RuntimeEnv } from '../../_repository'

export const onRequestGet = async ({ request, params, env }: { request: Request; params: Record<string, string>; env: RuntimeEnv }) => {
  if (!env.ASSETS) return new Response('Not found', { status: 404 })
  const shell = await env.ASSETS.fetch(new URL('/app-shell.html', request.url))
  const html = await shell.text()
  const page = await resolvePublicationSeo(env, params.slug, 'current')
  return publicationHtmlResponse(html, page)
}
