import { afterEach, describe, expect, it, vi } from 'vitest'
import csvFixture from '../../../test/fixtures/nepar-2026-10-27.csv?raw'
import xmlFixture from '../../../test/fixtures/nepar-2026-10-27.xml?raw'
import { analyzeDocument, runDigitalPriceListCheck } from './check'
import { parseMarketinoCsv } from '../../../src/price-engine/adapters/marketinoCsv'
import { parseXmlPriceList } from '../../../src/price-engine/xml'
import { validatePriceList } from '../../../src/price-engine/validate'
import { excelRowsToPriceList, suggestExcelMapping } from '../../../src/excel'
import { evaluateRequiredFields } from '../../../shared/compliance/checks'
import { complianceRules } from '../../../shared/compliance/rulesets'
import { parseCsvFeed, parseXmlFeed } from '../../../shared/compliance/document-parser'
import { technicalReport } from '../../../shared/website-check'

const headers = 'naziv_usluge;maloprodajna_cijena;sidrena_cijena;posebni_oblik_prodaje;naziv_posebnog_oblika_prodaje'
const csv = (price = '0', anchor = '0') => `${headers}\nBesplatna provjera;${price};${anchor};false;`
const xml = (price = '0', anchor = '0') => `<cjenik><usluga><naziv_usluge>Besplatna provjera</naziv_usluge><maloprodajna_cijena>${price}</maloprodajna_cijena><sidrena_cijena>${anchor}</sidrena_cijena><posebni_oblik_prodaje>false</posebni_oblik_prodaje></usluga></cjenik>`
const unknownCsv = 'other,value\nSomething,1'
const unknownXml = '<unknown><value>1</value></unknown>'
const resolver = { resolve4: async () => ['93.184.216.34'], resolve6: async () => [] }
async function check(csvBody?: string, xmlBody?: string) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const path = new URL(String(input)).pathname
    if (path === '/') return new Response('<a href="/cjenik.csv">CSV</a><a href="/cjenik.xml">XML</a><a href="/cjenik/arhiva">Arhiva prethodnih cjenika</a>')
    if (path === '/cjenik.csv' && csvBody != null) return new Response(csvBody, { headers: { 'content-type': 'text/csv' } })
    if (path === '/cjenik.xml' && xmlBody != null) return new Response(xmlBody, { headers: { 'content-type': 'application/xml' } })
    if (path.startsWith('/cjenik/arhiva')) return new Response('<h1>Arhiva cjenika</h1><a href="/cjenik.csv">Prethodni cjenik CSV 2026-10-27</a>')
    return new Response('Not found', { status: 404 })
  }))
  return runDigitalPriceListCheck('https://example.hr/', { DIGITAL_PRICE_LIST_DNS_RESOLVER: resolver })
}
afterEach(() => vi.unstubAllGlobals())

describe('shared service parsing and price semantics', () => {
  it('preserves the explicit date in a reference-price header when spaces become underscores', () => {
    const source = csv().replace('sidrena_cijena', 'sidrena_cijena_10.9.2026.')
    for (const body of [source, source.replaceAll('_', ' ')]) expect(parseMarketinoCsv(body).priceList.items[0]).toMatchObject({ anchorPrice: 0, anchorReferenceDate: '2026-09-10' })
  })
  it.each(['0', '0.00', '0,00'])('accepts explicit service zero %s through CSV, XML, Excel, validation and monitor', zero => {
    for (const body of [csv(zero), csv(zero).replaceAll('_', ' '), '\uFEFF  NAZIV__USLUGE ; MALOPRODAJNA  CIJENA ; SIDRENA_CIJENA ;POSEBNI_OBLIK_PRODAJE\nBesplatna provjera;0;0;false']) {
      const parsed = parseMarketinoCsv(body)
      expect(parsed.priceList.items[0]).toMatchObject({ type: 'Usluga', price: 0, anchorPrice: 0 })
      expect(validatePriceList(parsed.priceList).issues).toEqual([])
      expect(evaluateRequiredFields(parsed.priceList.items, complianceRules['nn-101-2026'].profiles.services)).toEqual([])
      expect(analyzeDocument('csv', body).status).toBe('pass')
    }
    const list = parseXmlPriceList(xml(zero, zero))
    expect(validatePriceList(list).issues).toEqual([])
    expect(analyzeDocument('xml', xml(zero, zero)).status).toBe('pass')
    const rows = [headers.split(';'), ['Besplatna provjera', zero, zero, 'false', '']]
    const excel = excelRowsToPriceList({ name: 'Cjenik', rows }, 0, suggestExcelMapping(rows[0]))
    expect(validatePriceList(excel.priceList).issues).toEqual([])
    expect(parseCsvFeed(csv().replaceAll(';', ',')).records[0]).toMatchObject({ type: 'Usluga', price: '0', anchorPrice: '0' })
    expect(parseXmlFeed(xml()).records[0]).toMatchObject({ type: 'Usluga', price: '0', anchorPrice: '0' })
  })
  it.each(['', ' ', '-1', 'abc'])('keeps invalid regular or reference value %j as a named finding', value => {
    for (const [kind, build] of [['csv', csv], ['xml', xml]] as const) {
      for (const body of [build(value, '10'), build('10', value)]) {
        const analysis = analyzeDocument(kind, body)
        expect(analysis.status).toBe('warning')
        expect(analysis.totalFindings).toBeGreaterThan(0)
        expect(analysis.findings[0].itemName).toBe('Besplatna provjera')
      }
    }
  })
  it('retains original row numbers after skipped CSV rows and keeps uploads blocked', () => {
    const body = `${headers}\nPrva;abc;1;false;\nDruga;1;;false;`
    const parsed = parseMarketinoCsv(body)
    expect(parsed.warnings[0]).toMatchObject({ row: 2, itemName: 'Prva' })
    expect(analyzeDocument('csv', body).findings).toEqual(expect.arrayContaining([expect.objectContaining({ row: 3, itemName: 'Druga', field: 'anchorPrice' })]))
    expect(() => parseXmlPriceList(xml('abc'))).toThrow()
  })
  it('analyzes all 34 findings before capping the payload at 20', () => {
    const body = headers + '\n' + Array.from({ length: 34 }, (_, i) => `Usluga ${i};10;;false;`).join('\n')
    const analysis = analyzeDocument('csv', body)
    expect(analysis).toMatchObject({ itemCount: 34, totalFindings: 34, status: 'warning' })
    expect(analysis.findings).toHaveLength(20)
    expect(analyzeDocument('csv', body + '\n' + 'x'.repeat(128 * 1024)).status).toBe('unknown')
  })
})

describe('aggregate and backward compatible checker contract', () => {
  it.each([
    [csv(), unknownXml, 'pass', 'green'],
    [unknownCsv, xml(), 'pass', 'green'],
    [csv('10', ''), xml(), 'warning', 'yellow'],
    [csv(), xml('10', ''), 'warning', 'yellow'],
    [unknownCsv, unknownXml, 'unknown', 'green'], // legacy discovery: a generic document is available
    [undefined, xml(), 'pass', 'green'],
    [undefined, xml('10', ''), 'warning', 'yellow'],
  ] as const)('aggregates both formats without allowing unknown to cancel confirmation (%#)', async (csvBody, xmlBody, contentStatus, status) => {
    const result = await check(csvBody, xmlBody)
    expect(result).toMatchObject({ status, message: expect.any(String), details: { contentStatus, structureStatus: contentStatus === 'unknown' ? 'unknown' : 'pass', csvFound: csvBody != null, xmlFound: xmlBody != null, csvUrl: csvBody ? 'https://example.hr/cjenik.csv' : null, xmlUrl: xmlBody ? 'https://example.hr/cjenik.xml' : null } })
    expect(result.details.csvAnalysis?.format).toBe('csv')
    expect(result.details.xmlAnalysis?.format).toBe('xml')
  })
  it('freezes the real NEPAR regression at 23 services, four missing anchors per format, 8/9', async () => {
    const result = await check(csvFixture, xmlFixture)
    expect(result.status).toBe('yellow')
    for (const analysis of [result.details.csvAnalysis, result.details.xmlAnalysis]) {
      expect(analysis).toMatchObject({ fetched: true, structureRecognized: true, itemCount: 23, totalFindings: 4, structureStatus: 'pass', contentStatus: 'warning' })
      expect(analysis?.findings.every(f => f.field === 'anchorPrice' && f.itemName && /Nedostaje sidrena/.test(f.message))).toBe(true)
    }
    expect(technicalReport(result).score).toBe(8)
  })
})
