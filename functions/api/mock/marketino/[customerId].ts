import { getPublicList } from '../../../_price-list'
import type { RuntimeEnv } from '../../../_repository'

export const onRequestGet = async ({ request, params, env }: { request: Request; params: Record<string, string>; env: RuntimeEnv }) => {
  const list = await getPublicList(request, 'nepar', env)
  if (!list) return Response.json({ error: 'Mock source trenutno nije dostupan.' }, { status: 503 })
  return Response.json({ customerId: params.customerId, updatedAt: list.updatedAt, items: list.items })
}
