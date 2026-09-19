import { renderXml } from '../src/price-engine/xml'
import { fileResponse, getPublicPublication, publicGoneResponse } from './_price-list'
import type { RuntimeEnv } from './_repository'

export const onRequestGet = async ({ request, env }: { request: Request; env: RuntimeEnv }) => {
  const { publication, access } = await getPublicPublication(request, undefined, env)
  if (access && !access.accessible) return publicGoneResponse()
  return publication ? fileResponse(renderXml(publication.payload), 'xml', publication.filenameStem, access) : new Response('Not found', { status: 404 })
}
