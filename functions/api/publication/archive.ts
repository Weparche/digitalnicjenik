import { readPublicationForHost, readPublications, type RuntimeEnv } from '../../_repository'
import { getPublicTenantAccess } from '../../_public-access'
import { retentionIsLive } from '../../../shared/publication-retention'

export const onRequestGet = async ({ request, env }: { request: Request; env: RuntimeEnv }) => {
  const publication = await readPublicationForHost(env, new URL(request.url).hostname)
  if (!publication) return Response.json({ publications: [] })
  const publications = await readPublications(env, publication.payload.tenant.slug)
  const access = await getPublicTenantAccess(env, publication.payload.tenant.slug)
  const visible = access.entitlement?.status === 'suspended' ? [] : publications.filter(item => access.accessible || retentionIsLive(item))
  return Response.json({ priceList: visible[0]?.payload ?? null, publications: visible.map((item) => ({ ...item, csvUrl: '/' + item.filenameStem + '.csv', xmlUrl: '/' + item.filenameStem + '.xml' })) }, { headers: { 'cache-control': 'no-store' } })
}
