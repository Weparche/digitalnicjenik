import { readPublications, resolveTenant, type RuntimeEnv } from '../../_repository'
import { getPublicTenantAccess } from '../../_public-access'
import { retentionIsLive } from '../../../shared/publication-retention'

/** Public retained archives survive ordinary subscription expiry; suspension remains a block. */
export const onRequestGet = async ({ request, env }: { request: Request; env: RuntimeEnv }) => {
  const slug = new URL(request.url).searchParams.get('slug') || ''
  if (!env.DB || !await resolveTenant(env, slug)) return Response.json({ error: 'not_found' }, { status: 404 })
  const access = await getPublicTenantAccess(env, slug)
  if (access.entitlement?.status === 'suspended') return Response.json({ error: 'unavailable' }, { status: 410 })
  const visible = (await readPublications(env, slug)).filter(publication => access.accessible || retentionIsLive(publication))
  return Response.json({ priceList: visible[0]?.payload ?? null, publications: visible }, { headers: { 'cache-control': 'no-store' } })
}
