import { afterEach, describe, expect, it, vi } from 'vitest'
import { technicalReport } from '../../../shared/website-check'
import { parsePublicationName, runDigitalPriceListCheck } from './check'

const resolver = {
  resolve4: async () => ['93.184.216.34'],
  resolve6: async () => [],
}

function routeFetch(routes: Record<string, Response | (() => Response)>, fallback = new Response('Not found', { status: 404 })) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(input.toString())
    const route = routes[url.pathname]
    return typeof route === 'function' ? route() : route ?? fallback
  })
}

function largeCsv(rows = 18_071) {
  return [
    'Naziv;Vrsta;Cijena;Sidrena cijena;Poseban oblik prodaje',
    ...Array.from({ length: rows }, (_, index) => `Usluga ${index + 1};Usluga;${10 + (index % 50)},00;${10 + (index % 50)},00;NE`),
  ].join('\n')
}

afterEach(() => vi.unstubAllGlobals())

describe('large digital price lists', () => {
  it('accepts the Croatian DD.MM.YYYY_HH:MM publication timestamp used by large shops', () => {
    const parsed = parsePublicationName('https://example.com/cjenici/webshop_Spinel-34-Umag_WEB-01_30_27.10.2026_05:00.csv')
    expect(parsed).not.toBeNull()
    expect(parsed?.storage).toBe(30)
    expect(parsed?.stamp).toBe('27.10.2026_05:00')
    expect(parsed?.time).toBe(Date.parse('2026-10-27T05:00:00Z'))
  })

  it('detects and samples a CSV much larger than 128 KB without reporting a network failure', async () => {
    const csv = largeCsv()
    expect(new TextEncoder().encode(csv).byteLength).toBeGreaterThan(128 * 1024)

    const current = '/cjenici/webshop_Spinel-34-Umag_WEB-01_30_27.10.2026_05:00.csv'
    const previous = '/cjenici/webshop_Spinel-34-Umag_WEB-01_29_26.10.2026_05:00.csv'
    const pricePage = `<!doctype html><html><body><h1>Cjenik</h1><a href="${current}">Današnji CSV</a><a href="${previous}">Prethodni CSV</a></body></html>`

    const fetch = routeFetch({
      '/': () => new Response('<a href="/cjenici/">Cjenik</a>', { status: 200, headers: { 'content-type': 'text/html' } }),
      '/cjenici/': () => new Response(pricePage, { status: 200, headers: { 'content-type': 'text/html' } }),
      [current]: () => new Response(csv, { status: 200, headers: { 'content-type': 'text/csv; charset=utf-8' } }),
      [previous]: () => new Response(csv, { status: 200, headers: { 'content-type': 'text/csv; charset=utf-8' } }),
    })
    vi.stubGlobal('fetch', fetch)

    const checked = await runDigitalPriceListCheck('https://example.com', { DIGITAL_PRICE_LIST_DNS_RESOLVER: resolver })
    const report = technicalReport(checked)

    expect(checked.status).toBe('green')
    expect(checked.details.csvFound).toBe(true)
    expect(checked.details.csvUrl).toBe(`https://example.com${current}`)
    expect(checked.details.networkIncomplete).toBe(false)
    expect(checked.details.structureStatus).toBe('pass')
    expect(checked.details.contentStatus).toBe('unknown')
    expect(checked.details.csvAnalysis?.structureReasons.join(' ')).toContain('uzorku')
    expect(checked.details.archiveFound).toBe(true)
    expect(report.checks.find(check => check.id === 'xml')?.status).toBe('not_applicable')
    expect(report.score).toBeGreaterThanOrEqual(8)
  })
})
