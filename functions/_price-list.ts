import { parseMarketinoCsv } from '../src/price-engine/adapters/marketinoCsv'
import { bootstrapFromFixture, readCurrentPublication, readPublicationByStem, readPublicationForHost, type RuntimeEnv } from './_repository'

export async function getPublicPublication(request: Request, slug: string | undefined, env: RuntimeEnv) {
  if (slug) {
    const current = await readCurrentPublication(env, slug)
    if (current) return current
    const bootstrapped = await bootstrapFromFixture(env, request, slug)
    return bootstrapped && env.DB ? readCurrentPublication(env, slug) : null
  }
  return readPublicationForHost(env, new URL(request.url).hostname)
}

export async function getPublicList(request: Request, slug: string, env: RuntimeEnv = {}) {
  const publication = await getPublicPublication(request, slug, env)
  if (publication) return publication.payload
  if (env.DB) return null
  const response = await fetch(new URL('/marketino-artikli', request.url))
  if (!response.ok) return null
  const parsed = parseMarketinoCsv(await response.text(), { id: 'nepar', slug, name: slug === 'patrisa-sisa' ? 'Patriša Šiša' : 'NEPAR' })
  return { ...parsed.priceList, source: 'nepar' as const }
}

export async function publicationByStem(request: Request, stem: string, env: RuntimeEnv) {
  const publication = await readPublicationByStem(env, stem, true)
  if (!publication) return null
  const hostname = new URL(request.url).hostname
  return (await readPublicationForHost(env, hostname))?.tenantId === publication.tenantId ? publication : null
}

export function fileResponse(body: string, extension: 'csv' | 'xml', stem: string) {
  return new Response(body, { headers: { 'content-type': extension === 'csv' ? 'text/csv; charset=utf-8' : 'application/xml; charset=utf-8', 'content-disposition': `inline; filename="${stem}.${extension}"`, 'cache-control': 'public, max-age=60' } })
}
