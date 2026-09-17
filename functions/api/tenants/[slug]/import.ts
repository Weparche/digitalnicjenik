import { parseMarketinoCsv } from '../../../../src/price-engine/adapters/marketinoCsv'
import { createDraft, type RuntimeEnv } from '../../../_repository'

export const onRequestPost = async ({ request, params, env }: { request: Request; params: Record<string, string>; env: RuntimeEnv }) => {
  try {
    if (params.slug !== (env.DEMO_WRITE_TENANT || 'nepar')) return Response.json({ error: 'Ovaj tenant nije omogućen za demo write workflow.' }, { status: 403 })
    if (!env.DB) return Response.json({ error: 'D1 binding DB nije konfiguriran.' }, { status: 503 })
    const body = await request.json() as { csv?: unknown; name?: string; sourceFilename?: string }
    if (typeof body.csv !== 'string' || !body.csv.trim()) return Response.json({ error: 'CSV sadržaj nedostaje.' }, { status: 400 })
    if (body.csv.length > 2_000_000) return Response.json({ error: 'CSV datoteka je prevelika.' }, { status: 413 })
    const parsed = parseMarketinoCsv(body.csv, { id: params.slug, slug: params.slug, name: body.name || 'NEPAR' })
    const result = await createDraft(env, params.slug, { ...parsed.priceList, source: 'marketino-csv' as const, tenant: { ...parsed.priceList.tenant, id: params.slug, slug: params.slug } }, body.sourceFilename || 'marketino-artikli.csv', 'marketino-csv')
    return Response.json({ draft: result.draft, validation: result.validation, warnings: parsed.warnings })
  } catch (caught) { return Response.json({ error: caught instanceof Error ? caught.message : 'CSV import nije uspio.' }, { status: 422 }) }
}
