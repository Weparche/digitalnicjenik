import { parseMarketinoCsv } from '../../../src/price-engine/adapters/marketinoCsv'
import { validatePriceList } from '../../../src/price-engine/validate'

export const onRequestPost = async ({ request }: { request: Request }) => {
  try {
    const contentLength = Number(request.headers.get('content-length') || 0)
    if (Number.isFinite(contentLength) && contentLength > 2_200_000) return Response.json({ error: 'Zahtjev je prevelik.' }, { status: 413 })
    const body = await request.json() as { csv?: unknown }
    if (typeof body.csv !== 'string' || !body.csv.trim()) return Response.json({ error: 'CSV sadržaj nedostaje.' }, { status: 400 })
    if (new TextEncoder().encode(body.csv).byteLength > 2_000_000) return Response.json({ error: 'CSV datoteka je prevelika.' }, { status: 413 })
    const parsed = parseMarketinoCsv(body.csv)
    return Response.json({ priceList: parsed.priceList, warnings: parsed.warnings, validation: validatePriceList(parsed.priceList) })
  } catch (caught) { return Response.json({ error: caught instanceof Error ? caught.message : 'Provjera CSV-a nije uspjela.' }, { status: 422 }) }
}
