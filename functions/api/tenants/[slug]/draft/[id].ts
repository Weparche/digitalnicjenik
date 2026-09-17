import { updateDraft, readDraft, type RuntimeEnv } from '../../../../_repository'
import type { NormalizedPriceList } from '../../../../../src/price-engine/types'

export const onRequestPatch = async ({ request, params, env }: { request: Request; params: Record<string, string>; env: RuntimeEnv }) => {
  try {
    if (params.slug !== (env.DEMO_WRITE_TENANT || 'nepar')) return Response.json({ error: 'Ovaj tenant nije omogućen za demo write workflow.' }, { status: 403 })
    const body = await request.json() as { priceList?: NormalizedPriceList }
    if (!body.priceList) return Response.json({ error: 'Normalized cjenik nedostaje.' }, { status: 400 })
    return Response.json(await updateDraft(env, params.slug, params.id, body.priceList))
  } catch (caught) { return Response.json({ error: caught instanceof Error ? caught.message : 'Dopuna drafta nije uspjela.' }, { status: 422 }) }
}

export const onRequestGet = async ({ params, env }: { params: Record<string, string>; env: RuntimeEnv }) => {
  if (params.slug !== (env.DEMO_WRITE_TENANT || 'nepar')) return Response.json({ error: 'Pregled produkcijskog drafta zahtijeva autentikaciju/operator pristup.' }, { status: 403 })
  return Response.json({ draft: await readDraft(env, params.slug, params.id) })
}
