import { renderCsv } from '../src/price-engine/csv'
import { fileResponse, getPublicPublication } from './_price-list'
import type { RuntimeEnv } from './_repository'

export const onRequestGet = async ({ request, env }: { request: Request; env: RuntimeEnv }) => {
  const publication = await getPublicPublication(request, undefined, env)
  return publication ? fileResponse(renderCsv(publication.payload), 'csv', publication.filenameStem) : new Response('Not found', { status: 404 })
}
