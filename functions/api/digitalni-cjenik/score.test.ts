import { afterEach, describe, expect, it, vi } from 'vitest'
import { analyzeDocument, runDigitalPriceListCheck } from './check'
import { technicalReport } from '../../../shared/website-check'

const resolver = { resolve4: async () => ['93.184.216.34'], resolve6: async () => [] }
afterEach(() => vi.unstubAllGlobals())
describe('document score evidence', () => {
  it('reuses the existing validator for supported complete rows', () => {
    expect(analyzeDocument('csv', 'Naziv;Vrsta;Cijena;Sidrena cijena;Poseban oblik prodaje\nŠišanje;Usluga;20;20;NE')).toMatchObject({ structure: 'pass', content: 'pass' })
  })
  it('does not turn a skipped CSV row into a content pass', () => {
    expect(analyzeDocument('csv', 'Naziv;Vrsta;Cijena;Sidrena cijena\nŠišanje;Usluga;20;20\nNedostaje cijena;Usluga;;20')).toMatchObject({ structure: 'warning', content: 'warning' })
  })
  it('uses raw compliance records to detect dropped XML rows', () => {
    const result = analyzeDocument('xml', '<pricelist><item><name>Šišanje</name><type>Usluga</type><price>20</price><anchorPrice>20</anchorPrice></item><item><name>Nedostaje cijena</name></item></pricelist>')
    expect(result).toMatchObject({ structure: 'warning', content: 'warning' })
  })
  it('keeps unsupported syntactically valid XML unknown', () => {
    expect(analyzeDocument('xml', '<catalog><entry amount="20">Usluga</entry></catalog>')).toMatchObject({ structure: 'unknown', content: 'unknown' })
  })
  it('finds a price list on the homepage, and distinguishes guessed feeds from HTML links', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname
      if (path === '/') return new Response('<html><h1>Cjenik usluga</h1><table><tr><th>Naziv usluge</th><th>Cijena</th></tr><tr><td>Šišanje</td><td>20 EUR</td></tr></table></html>', { headers: { 'content-type': 'text/html' } })
      if (path === '/cjenik.csv') return new Response('Naziv;Vrsta;Cijena;Sidrena cijena;Poseban oblik prodaje\nŠišanje;Usluga;20;20;NE')
      return new Response('Not found', { status: 404 })
    }))
    const result = await runDigitalPriceListCheck('example.hr', { DIGITAL_PRICE_LIST_DNS_RESOLVER: resolver })
    expect(result.details).toMatchObject({ pricePageFound: true, pricePageUrl: 'https://example.hr/', csvFound: true, structureStatus: 'pass', contentStatus: 'pass' })
    expect(technicalReport(result).checks.find((c) => c.id === 'link')?.status).toBe('missing')
  })
  it('does not declare absent files behind an unbranded 403 restriction', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Access denied', { status: 403 })))
    const result = await runDigitalPriceListCheck('example.hr', { DIGITAL_PRICE_LIST_DNS_RESOLVER: resolver })
    expect(result.details.fetchBlocked).toBe(true)
    expect(technicalReport(result)).toMatchObject({ score: 1, unknown: 8, attention: 0 })
  })
  it('does not treat a truncated large CSV as a verified document', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => new URL(String(input)).pathname === '/cjenik.csv'
      ? new Response('Naziv,Cijena\n' + 'Usluga,20\n'.repeat(18000))
      : new Response('<a href="/cjenik.csv">Cjenik</a>')))
    const result = await runDigitalPriceListCheck('example.hr', { DIGITAL_PRICE_LIST_DNS_RESOLVER: resolver })
    expect(result.details.csvFound).toBe(false)
    expect(result.details.networkIncomplete).toBe(true)
    expect(technicalReport(result).checks.find((c) => c.id === 'csv')?.status).toBe('unknown')
  })
})
