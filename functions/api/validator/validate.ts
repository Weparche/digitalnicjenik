import { parseMarketinoCsv } from '../../../src/price-engine/adapters/marketinoCsv'
import { importIssuesFromParseWarnings, mergeValidationIssues, validatePriceList } from '../../../src/price-engine/validate'
import { parseXmlPriceList } from '../../../src/price-engine/xml'

import { requireAdmin } from '../../_admin-auth'
import type { AuthEnv } from '../../_auth'
import { consumeCheckerBudget, CheckerRateLimitError, CHECKER_LIMIT_MESSAGE, checkerQuotaHeaders, checkerLimitHeaders, type CheckerQuota } from '../../_checker-quota'

export const onRequestPost = async ({ request, env }: { request: Request; env: AuthEnv }) => {
  try {
    const contentLength = Number(request.headers.get('content-length') || 0)
    if (Number.isFinite(contentLength) && contentLength > 2_200_000) return Response.json({ error: 'Zahtjev je prevelik.' }, { status: 413 })
    const body = await request.json() as { csv?: unknown; xml?: unknown; format?: unknown }
    const hasCsv = typeof body.csv === 'string' && body.csv.trim().length > 0
    const hasXml = typeof body.xml === 'string' && body.xml.trim().length > 0
    const excel = body.format === 'excel' && !hasCsv && !hasXml
    if (!excel && hasCsv === hasXml) return Response.json({ error: 'Pošaljite CSV ili XML sadržaj.' }, { status: 400 })
    const source = excel ? '' : hasXml ? body.xml as string : body.csv as string
    if (new TextEncoder().encode(source).byteLength > 2_000_000) return Response.json({ error: 'Datoteka je prevelika.' }, { status: 413 })
    let internal = false
    try { await requireAdmin(request, env); internal = true } catch { /* public validator */ }
    let quota: CheckerQuota | undefined
    try {
      if (!internal) quota = await consumeCheckerBudget(request, env)
    } catch (error) {
      if (error instanceof CheckerRateLimitError) return Response.json({ error: CHECKER_LIMIT_MESSAGE, code: 'rate_limited' }, { status: 429, headers: checkerLimitHeaders(error) })
      return Response.json({ error: 'Provjeru trenutačno nije moguće dovršiti. Pokušajte ponovno.' }, { status: 503, headers: { 'cache-control': 'no-store' } })
    }
    if (excel) return Response.json({ ok: true }, { headers: quota ? checkerQuotaHeaders(quota) : { 'cache-control': 'no-store' } })
    const parsed = hasXml
      ? { priceList: parseXmlPriceList(source, { id: 'nepar', slug: 'nepar', name: 'NEPAR' }), warnings: [] }
      : parseMarketinoCsv(source)
    const importIssues = importIssuesFromParseWarnings(parsed.warnings, hasXml ? 'xml' : 'csv')
    const validation = mergeValidationIssues(validatePriceList(parsed.priceList), importIssues)
    return Response.json({ priceList: parsed.priceList, warnings: parsed.warnings, validation }, { headers: quota ? checkerQuotaHeaders(quota) : { 'cache-control': 'no-store' } })
  } catch (caught) { return Response.json({ error: caught instanceof Error ? caught.message : 'Provjera datoteke nije uspjela.' }, { status: 422 }) }
}
