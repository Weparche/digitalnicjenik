import { afterEach, describe, expect, it, vi } from 'vitest'
import { analyzeDocument, runDigitalPriceListCheck } from './check'
import { technicalReport } from '../../../shared/website-check'

const resolver = { resolve4: async () => ['93.184.216.34'], resolve6: async () => [] }

const serviceCsv = [
  'naziv_usluge;maloprodajna_cijena;sidrena_cijena;posebni_oblik_prodaje;naziv_posebnog_oblika_prodaje',
  'Radni sat;75;75;false;',
].join('\n')

const productCsv = [
  'Naziv proizvoda;Maloprodajna cijena;Type;Sidrena cijena;Poseban oblik prodaje;Šifra;Marka;Barkod;Dostupnost',
  'Tipkovnica;49.90;simple;49.90;false;TIP-1;Logitech;1234567890128;dostupno',
].join('\n')

const mixedCsv = [
  'Naziv;Maloprodajna cijena;Vrsta;Sidrena cijena;Poseban oblik prodaje;Šifra;Marka;Barkod;Dostupnost',
  'Montaža;20;Usluga;20;false;;;;',
  'Tipkovnica;49.90;Proizvod;49.90;false;TIP-1;Logitech;1234567890128;dostupno',
].join('\n')

const ambiguousCsv = [
  'Naziv;Maloprodajna cijena;Sidrena cijena;Poseban oblik prodaje',
  'Stavka;10;10;false',
].join('\n')

afterEach(() => vi.unstubAllGlobals())

describe('non-scoring price-list classification', () => {
  it('classifies an explicit service list as service', () => {
    const analysis = analyzeDocument('csv', serviceCsv)
    expect(analysis.priceListKind).toBe('service')
    expect(analysis.priceListKindEvidence).toContain('signal usluge')
  })

  it('classifies WooCommerce/product signals as product', () => {
    const analysis = analyzeDocument('csv', productCsv)
    expect(analysis.priceListKind).toBe('product')
    expect(analysis.priceListKindEvidence).toContain('signal proizvoda')
  })

  it('classifies a list with explicit services and products as mixed', () => {
    const analysis = analyzeDocument('csv', mixedCsv)
    expect(analysis.priceListKind).toBe('mixed')
  })

  it('keeps an ambiguous generic name/price list unknown instead of assuming product', () => {
    const analysis = analyzeDocument('csv', ambiguousCsv)
    expect(analysis.priceListKind).toBe('unknown')
    expect(analysis.priceListKindEvidence).toContain('Nema dovoljno pouzdanih signala')
  })

  it('exposes the aggregate kind in checker details without adding a scoring check', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname
      if (path === '/') return new Response('<a href="/cjenik.csv">CSV</a>')
      if (path === '/cjenik.csv') return new Response(serviceCsv, { headers: { 'content-type': 'text/csv' } })
      return new Response('Not found', { status: 404 })
    }))

    const result = await runDigitalPriceListCheck('https://example.hr/', { DIGITAL_PRICE_LIST_DNS_RESOLVER: resolver })
    expect(result.details.priceListKind).toBe('service')
    expect(result.details.priceListKindEvidence).toContain('CSV:')
    const report = technicalReport(result)
    expect(report.checks).toHaveLength(9)
    expect(report.checks.some((check) => check.id === ('freshness' as never))).toBe(false)
  })
})
