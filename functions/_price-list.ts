import { parseMarketinoCsv } from '../src/price-engine/adapters/marketinoCsv'
import { bootstrapFromFixture, readCurrentPublication, readPublicationByStem, readPublicationForHost, type RuntimeEnv } from './_repository'
import { applyPublicAccessHeaders, getPublicTenantAccess, publicGoneResponse, type PublicTenantAccess } from './_public-access'

export async function getPublicPublication(request: Request, slug: string | undefined, env: RuntimeEnv) {
  if (slug) {
    const access = await getPublicTenantAccess(env, slug)
    if (!access.accessible && access.tenant) return { publication: null, access }
    if (!access.accessible && !access.tenant && slug !== (env.DEMO_WRITE_TENANT || 'nepar')) {
      return { publication: null, access }
    }
    const current = await readCurrentPublication(env, slug)
    if (current) return { publication: current, access }
    if (slug === (env.DEMO_WRITE_TENANT || 'nepar') || slug === 'patrisa-sisa') {
      const bootstrapped = await bootstrapFromFixture(env, request, slug)
      const publication = bootstrapped && env.DB ? await readCurrentPublication(env, slug) : null
      return { publication, access: await getPublicTenantAccess(env, slug) }
    }
    return { publication: null, access }
  }
  const publication = await readPublicationForHost(env, new URL(request.url).hostname)
  if (!publication) return { publication: null, access: null as PublicTenantAccess | null }
  const access = await getPublicTenantAccess(env, publication.payload.tenant.slug)
  if (!access.accessible) return { publication: null, access }
  return { publication, access }
}

export async function getPublicList(request: Request, slug: string, env: RuntimeEnv = {}) {
  const { publication, access } = await getPublicPublication(request, slug, env)
  if (access && !access.accessible) return null
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
  const access = await getPublicTenantAccess(env, publication.payload.tenant.slug)
  if (!access.accessible) return null
  const hostname = new URL(request.url).hostname
  return (await readPublicationForHost(env, hostname))?.tenantId === publication.tenantId ? publication : null
}

export function fileResponse(body: string, extension: 'csv' | 'xml', stem: string, access?: PublicTenantAccess | null) {
  const headers = new Headers({
    'content-type': extension === 'csv' ? 'text/csv; charset=utf-8' : 'application/xml; charset=utf-8',
    'content-disposition': `inline; filename="${stem}.${extension}"`,
  })
  if (access) applyPublicAccessHeaders(headers, access)
  else headers.set('cache-control', 'public, max-age=60')
  return new Response(body, { headers })
}

export { publicGoneResponse, applyPublicAccessHeaders, getPublicTenantAccess }
