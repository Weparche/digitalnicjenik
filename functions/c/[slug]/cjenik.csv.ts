import { renderCsv } from '../../../src/price-engine/csv'
import { fileResponse, getPublicPublication, publicGoneResponse } from '../../_price-list'
import type { RuntimeEnv } from '../../_repository'

export const onRequestGet = async ({ request, params, env }: { request: Request; params: Record<string, string>; env: RuntimeEnv }) => {
  const { publication, access } = await getPublicPublication(request, params.slug, env)
  if (access && !access.accessible) return publicGoneResponse()
  return publication ? fileResponse(renderCsv(publication.payload), 'csv', publication.filenameStem, access) : new Response('Not found', { status: 404 })
}
