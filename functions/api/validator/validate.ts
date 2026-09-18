import { parseMarketinoCsv } from '../../../src/price-engine/adapters/marketinoCsv'
import { importIssuesFromParseWarnings, mergeValidationIssues, validatePriceList } from '../../../src/price-engine/validate'
import { parseXmlPriceList } from '../../../src/price-engine/xml'

export const onRequestPost = async ({ request }: { request: Request }) => {
  try {
    const contentLength = Number(request.headers.get('content-length') || 0)
    if (Number.isFinite(contentLength) && contentLength > 2_200_000) return Response.json({ error: 'Zahtjev je prevelik.' }, { status: 413 })
    const body = await request.json() as { csv?: unknown; xml?: unknown }
    const hasCsv = typeof body.csv === 'string' && body.csv.trim().length > 0
    const hasXml = typeof body.xml === 'string' && body.xml.trim().length > 0
    if (hasCsv === hasXml) return Response.json({ error: 'Pošaljite CSV ili XML sadržaj.' }, { status: 400 })
    const source = hasXml ? body.xml as string : body.csv as string
    if (new TextEncoder().encode(source).byteLength > 2_000_000) return Response.json({ error: 'Datoteka je prevelika.' }, { status: 413 })
    const parsed = hasXml
      ? { priceList: parseXmlPriceList(source, { id: 'nepar', slug: 'nepar', name: 'NEPAR' }), warnings: [] }
      : parseMarketinoCsv(source)
    const importIssues = importIssuesFromParseWarnings(parsed.warnings, hasXml ? 'xml' : 'csv')
    const validation = mergeValidationIssues(validatePriceList(parsed.priceList), importIssues)
    return Response.json({ priceList: parsed.priceList, warnings: parsed.warnings, validation })
  } catch (caught) { return Response.json({ error: caught instanceof Error ? caught.message : 'Provjera datoteke nije uspjela.' }, { status: 422 }) }
}
