import { afterEach, describe, expect, it, vi } from 'vitest'
import { runDigitalPriceListCheck } from './check'
import { technicalReport } from '../../../shared/website-check'

const resolver = { resolve4: async () => ['93.184.216.34'], resolve6: async () => [] }
const html = (body: string) => new Response(body, { headers: { 'content-type': 'text/html' } })
function fixture(routes: Record<string, Response>) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => routes[new URL(String(input)).pathname] ?? new Response('missing', { status: 404 })))
}
afterEach(() => vi.unstubAllGlobals())

describe('Checker v4 API integration', () => {
  it('detects school course reference price without pretending CSV/XML was published', async () => {
    fixture({ '/': html('<!doctype html><html><h2>Grupna nastava</h2><p>65 € mjesečno</p><p>Bazna cijena 65 € na 10.9.2026.</p></html>') })
    const checked = await runDigitalPriceListCheck('https://skolagitare.com.hr/', { DIGITAL_PRICE_LIST_DNS_RESOLVER: resolver })
    expect(checked.details.visiblePrices?.rows).toMatchObject([{ name:'Grupna nastava', currentPrice:65, basePrice:65, status:'paired' }])
    expect(checked.details.pricePageFound).toBe(true)
    expect(checked.details.csvFound).toBe(false)
    expect(checked.details.xmlFound).toBe(false)
    expect(technicalReport(checked).checks.find(c=>c.id==='machine')?.status).toBe('missing')
  })

  it('inspects linked inner price page and keeps the homepage link evidence separate', async () => {
    fixture({
      '/': html('<h1>Škola gitare</h1><a href="/cjenik">Cjenik</a>'),
      '/cjenik': html('<h1>Cjenik</h1><h3>Online nastava</h3><p>25 €</p><p>Sidrena cijena na 10.09.2026.: 25 €</p>'),
    })
    const checked = await runDigitalPriceListCheck('https://example.hr/', { DIGITAL_PRICE_LIST_DNS_RESOLVER: resolver })
    expect(checked.details.visiblePrices?.rows).toMatchObject([{ name: 'Online nastava', basePrice:25, url:'https://example.hr/cjenik' }])
    expect(checked.details.visiblePrices?.pagesScanned).toBeGreaterThanOrEqual(2)
    expect(checked.details.csvFound).toBe(false)
  })

  it('does not treat inaccessible HTML content as proved absence of displayed prices', async () => {
    fixture({ '/': new Response('Please wait while your request is being verified...', { status:403, headers:{'content-type':'text/html'} }) })
    const checked = await runDigitalPriceListCheck('https://example.hr/', { DIGITAL_PRICE_LIST_DNS_RESOLVER: resolver })
    expect(checked.details.visiblePrices?.status).toBe('unavailable')
    expect(checked.details.visiblePrices?.rows).toHaveLength(0)
  })
})
