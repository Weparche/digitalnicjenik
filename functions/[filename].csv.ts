import { renderCsv } from '../src/price-engine/csv'
import { fileResponse, publicationByStem } from './_price-list'
import type { RuntimeEnv } from './_repository'

export const onRequestGet = async ({ request, params, env }: { request: Request; params: Record<string, string>; env: RuntimeEnv }) => {
  const publication = await publicationByStem(request, params.filename, env)
  return publication ? fileResponse(renderCsv(publication.payload), 'csv', publication.filenameStem) : new Response('Not found', { status: 404 })
}
