import { renderXml } from '../../../src/price-engine/xml'
import { fileResponse, getPublicPublication } from '../../_price-list'
import type { RuntimeEnv } from '../../_repository'

export const onRequestGet = async ({ request, params, env }: { request: Request; params: Record<string, string>; env: RuntimeEnv }) => {
  const publication = await getPublicPublication(request, params.slug, env)
  return publication ? fileResponse(renderXml(publication.payload), 'xml', publication.filenameStem) : new Response('Not found', { status: 404 })
}
