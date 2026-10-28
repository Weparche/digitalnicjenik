import { afterEach, describe, expect, it, vi } from 'vitest'
import csvFixture from '../../../test/fixtures/nepar-2026-10-27.csv?raw'
import xmlFixture from '../../../test/fixtures/nepar-2026-10-27.xml?raw'
import autogubicCsv from '../../../test/fixtures/autogubic-v1-en.csv?raw'
import autogubicXml from '../../../test/fixtures/autogubic-v1-en.xml?raw'
import { RULES, ruleFor } from '../../../shared/compliance/legal-profile'
import { analyzeDocument, parsePublicationName, runDigitalPriceListCheck } from './check'
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
        // A missing or invalid retail/anchor price is a binding-data defect, so content fails.
        expect(analysis.status).toBe('fail')
        expect(analysis.totalFindings).toBeGreaterThan(0)
        expect(analysis.findings[0].level).toBe('error')
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
    expect(analysis).toMatchObject({ itemCount: 34, totalFindings: 34, status: 'fail' })
    expect(analysis.findings).toHaveLength(20)
    expect(analyzeDocument('csv', body + '\n' + 'x'.repeat(128 * 1024)).status).toBe('unknown')
  })
})

describe('aggregate and backward compatible checker contract', () => {
  it.each([
    [csv(), unknownXml, 'pass', 'green'],
    [unknownCsv, xml(), 'pass', 'green'],
    [csv('10', ''), xml(), 'fail', 'yellow'],
    [csv(), xml('10', ''), 'fail', 'yellow'],
    [unknownCsv, unknownXml, 'unknown', 'green'], // legacy discovery: a generic document is available
    [undefined, xml(), 'pass', 'green'],
    [undefined, xml('10', ''), 'fail', 'yellow'],
  ] as const)('aggregates both formats without allowing unknown to cancel confirmation (%#)', async (csvBody, xmlBody, contentStatus, status) => {
    const result = await check(csvBody, xmlBody)
    expect(result).toMatchObject({ status, message: expect.any(String), details: { contentStatus, structureStatus: contentStatus === 'unknown' ? 'unknown' : 'pass', csvFound: csvBody != null, xmlFound: xmlBody != null, csvUrl: csvBody ? 'https://example.hr/cjenik.csv' : null, xmlUrl: xmlBody ? 'https://example.hr/cjenik.xml' : null } })
    expect(result.details.csvAnalysis?.format).toBe('csv')
    expect(result.details.xmlAnalysis?.format).toBe('xml')
  })
  it('freezes the real NEPAR 2026-10-27 regression at 23 services, four missing anchors per format, 7/9 when the publication filename is also unverified', async () => {
    const result = await check(csvFixture, xmlFixture)
    expect(result.status).toBe('yellow')
    for (const analysis of [result.details.csvAnalysis, result.details.xmlAnalysis]) {
      expect(analysis).toMatchObject({ fetched: true, structureRecognized: true, itemCount: 23, totalFindings: 4, structureStatus: 'pass', contentStatus: 'fail' })
      expect(analysis?.findings.every(f => f.field === 'anchorPrice' && f.itemName && /Nedostaje sidrena/.test(f.message) && f.level === 'error' && f.source === 'binding')).toBe(true)
    }
    expect(technicalReport(result).score).toBe(7)
  })
})

const pickSemantics = (items: Array<{ name: string; type?: string; price: number; anchorPrice?: number | null; specialSaleApplied?: boolean | null; specialSaleName?: string | null }>) =>
  items.map(({ name, type, price, anchorPrice, specialSaleApplied, specialSaleName }) => ({ name, type, price, anchorPrice, specialSaleApplied, specialSaleName }))
const recommendedCsv = 'naziv_usluge,maloprodajna_cijena,posebni_oblik_prodaje,naziv_posebnog_oblika_prodaje,sidrena_cijena\nRadni sat autoservisa,75.00,false,,75.00'
const recommendedXml = '<cjenik><usluge><usluga><naziv_usluge>Radni sat autoservisa</naziv_usluge><maloprodajna_cijena valuta="EUR">75.00</maloprodajna_cijena><posebni_oblik_prodaje>false</posebni_oblik_prodaje><naziv_posebnog_oblika_prodaje></naziv_posebnog_oblika_prodaje><sidrena_cijena valuta="EUR">75.00</sidrena_cijena></usluga></usluge></cjenik>'
const withDate = <T,>(now: string, run: () => T): T => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(now))
  try { return run() } finally { vi.useRealTimers() }
}

describe('semantic structure: the Odluka prescribes data, not column or element names', () => {
  it('passes the original Auto Gubić English CSV', () => {
    expect(pickSemantics(parseMarketinoCsv(autogubicCsv).priceList.items)).toEqual([{ name: 'Radni sat autoservisa', type: 'Usluga', price: 75, anchorPrice: 75, specialSaleApplied: false, specialSaleName: null }])
    const analysis = analyzeDocument('csv', autogubicCsv)
    expect(analysis).toMatchObject({ structureStatus: 'pass', itemCount: 1, contentStatus: 'pass', status: 'pass', totalFindings: 0 })
    expect(analysis.recommendations).toEqual([expect.objectContaining({ rule: 'schema.alias', level: 'info', source: 'recommendation', message: expect.stringContaining('„service_name”') })])
    expect(analysis.recommendations?.[0].message).toContain('nije zakonska obveza')
  })

  it('passes the original Auto Gubić English XML with camelCase <service> elements', () => {
    const analysis = analyzeDocument('xml', autogubicXml)
    expect(analysis).toMatchObject({ structureStatus: 'pass', itemCount: 1, contentStatus: 'pass', totalFindings: 0 })
    expect(analysis.recommendations?.[0]).toMatchObject({ level: 'info', message: expect.stringContaining('„retailPrice”') })
  })

  it('normalizes English and NEPAR-recommended names to the same model, without recommendations for the latter', () => {
    const expected = pickSemantics(parseXmlPriceList(autogubicXml).items)
    expect(pickSemantics(parseXmlPriceList(recommendedXml).items)).toEqual(expected)
    expect(pickSemantics(parseMarketinoCsv(autogubicCsv).priceList.items)).toEqual(expected)
    expect(pickSemantics(parseMarketinoCsv(recommendedCsv).priceList.items)).toEqual(expected)
    for (const [kind, body] of [['csv', recommendedCsv], ['xml', recommendedXml]] as const) {
      expect(analyzeDocument(kind, body)).toMatchObject({ contentStatus: 'pass', totalFindings: 0, recommendations: [] })
    }
  })

  it('accepts a service first listed after 10 September 2026 with its date and no nova_stavka flag', () => withDate('2026-10-27T12:00:00Z', () => {
    const body = 'naziv_usluge,maloprodajna_cijena,posebni_oblik_prodaje,naziv_posebnog_oblika_prodaje,sidrena_cijena,datum_referentne_cijene\nNova usluga,49.90,false,,49.90,2026-10-15'
    const dated = '<cjenik><usluga><naziv_usluge>Nova usluga</naziv_usluge><maloprodajna_cijena>49.90</maloprodajna_cijena><posebni_oblik_prodaje>false</posebni_oblik_prodaje><sidrena_cijena>49.90</sidrena_cijena><datum_referentne_cijene>2026-10-15</datum_referentne_cijene></usluga></cjenik>'
    for (const [kind, source] of [['csv', body], ['xml', dated], ['csv', body.replace('datum_referentne_cijene', 'reference_date')]] as const) {
      expect(analyzeDocument(kind, source)).toMatchObject({ contentStatus: 'pass', totalFindings: 0 })
    }
  }))

  it('treats nova_stavka=true without a date as a warning, never as a required field', () => {
    const analysis = analyzeDocument('csv', 'naziv_usluge,maloprodajna_cijena,posebni_oblik_prodaje,sidrena_cijena,nova_stavka\nNova usluga,49.90,false,49.90,true')
    expect(analysis).toMatchObject({ contentStatus: 'warning', totalFindings: 1 })
    expect(analysis.findings[0]).toMatchObject({ rule: 'anchor.date.new-without-date', level: 'warning', source: 'official-clarification' })
  })

  it('recognizes an English file without an anchor price but fails its content', () => {
    const analysis = analyzeDocument('csv', 'service_name,retail_price,special_sale,special_sale_name\nRadni sat,75.00,false,')
    expect(analysis).toMatchObject({ structureRecognized: true, structureStatus: 'pass', itemCount: 1, contentStatus: 'fail' })
    expect(analysis.findings).toEqual([expect.objectContaining({ rule: 'service.anchor.missing', level: 'error', source: 'binding', itemName: 'Radni sat' })])
  })

  it('never lets a draft or recommendation produce an error', () => {
    expect(ruleFor('draft.rule', { 'draft.rule': { level: 'error', source: 'draft', basis: 'Nacrt pravilnika, listopad 2026.' } }).level).toBe('info')
    expect(ruleFor('nepar.rule', { 'nepar.rule': { level: 'error', source: 'recommendation', basis: 'NEPAR' } }).level).toBe('warning')
    for (const definition of Object.values(RULES)) if (definition.level === 'error') expect(['binding', 'official-clarification']).toContain(definition.source)
    expect(RULES['schema.alias']).toMatchObject({ level: 'info', source: 'recommendation' })
  })
})

describe('publication file names and archive evidence', () => {
  const site = 'https://autogubic.example'
  const v1 = '/cjenik/usluzni-objekt_samoborska-cesta-344-10000-zagreb_1_0001_20260916T140627+0200'
  const v2 = '/cjenik/usluzni-objekt_samoborska-cesta-344-10000-zagreb_1_0002_20261027T150000+0100'
  const pricePage = (archiveLinks: string) => `<!doctype html><html><body><h1>Cjenik usluga</h1><table><tr><th>Naziv usluge</th><th>Cijena</th></tr><tr><td>Radni sat autoservisa</td><td>75,00 €</td></tr></table><a href="/cjenik/aktualni.csv">CSV</a><a href="/cjenik/aktualni.xml">XML</a>${archiveLinks}</body></html>`
  function stubSite(routes: Record<string, () => Response>) {
    const fetch = vi.fn(async (input: RequestInfo | URL) => (routes[new URL(String(input)).pathname] ?? (() => new Response('Not found', { status: 404 })))())
    vi.stubGlobal('fetch', fetch)
    return fetch
  }
  const html = (body: string) => () => new Response(body, { headers: { 'content-type': 'text/html' } })
  const redirect = (location: string) => () => new Response(null, { status: 302, headers: { Location: location } })

  it.each([
    [`${site}${v1}.csv`, { storage: 1, stamp: '20260916T140627+0200', time: Date.parse('2026-09-16T14:06:27+02:00') }],
    [`${site}${v1.replace('+', '%2B')}.xml`, { storage: 1, stamp: '20260916T140627+0200' }],
    ['https://nepar.hr/cjenici/mrezna-stranica_koprivnicka-ulica-52-10000-zagreb_WEB-NEPAR-01_01_2026-09-15_22-45-00.csv', { storage: 1, stamp: '2026-09-15_22-45-00' }],
    ['https://example.hr/cjenik/usluzni-objekt_ilica-10_poslovnica-1_7_20260917-143500.csv', { storage: 7, stamp: '20260917-143500' }],
  ])('reads the prescribed parts from %s', (url, expected) => {
    expect(parsePublicationName(url)).toMatchObject(expected)
  })

  it.each(['https://example.hr/cjenik.csv', 'https://example.hr/cjenik/aktualni.xml', 'https://example.hr/a_b_1_20260916T140627.csv', 'https://example.hr/a_b_c_x_20260916T140627.csv'])('does not treat %s as a versioned publication', (url) => {
    expect(parsePublicationName(url)).toBeNull()
  })

  it('confirms the archive from an earlier versioned file, follows stable aliases and never probes /cjenik/arhiva', async () => {
    const fetch = stubSite({
      '/': html('<a href="/cjenik">Cjenik</a>'),
      '/cjenik': html(pricePage(`<h2>Prethodne verzije</h2><a href="${v1}.csv">CSV</a><a href="${v1}.xml">XML</a>`)),
      '/cjenik/aktualni.csv': redirect(`${v2}.csv`),
      '/cjenik/aktualni.xml': redirect(`${v2}.xml`),
      [`${v2}.csv`]: () => new Response(recommendedCsv, { headers: { 'content-type': 'text/csv' } }),
      [`${v2}.xml`]: () => new Response(recommendedXml, { headers: { 'content-type': 'application/xml' } }),
      [`${v1}.csv`]: () => new Response(autogubicCsv, { headers: { 'content-type': 'text/csv' } }),
      [`${v1}.xml`]: () => new Response(autogubicXml, { headers: { 'content-type': 'application/xml' } }),
    })
    const result = await runDigitalPriceListCheck(site, { DIGITAL_PRICE_LIST_DNS_RESOLVER: resolver })
    expect(result.details).toMatchObject({ csvUrl: `${site}${v2}.csv`, xmlUrl: `${site}${v2}.xml`, archiveFound: true, archiveUrl: expect.stringContaining('_0001_'), contentStatus: 'pass', structureStatus: 'pass' })
    expect(result.details.publicationFindings?.some((finding) => finding.level === 'warning')).toBe(false)
    expect(technicalReport(result)).toMatchObject({ score: 9, tone: 'green' })
    expect(fetch.mock.calls.some(([input]) => String(input).includes('arhiva'))).toBe(false)
  })

  it('reports an unverifiable archive and an unidentified versioned file without declaring them missing', async () => {
    stubSite({
      '/': html('<a href="/cjenik.csv">CSV</a>'),
      '/cjenik.csv': () => new Response(recommendedCsv, { headers: { 'content-type': 'text/csv' } }),
    })
    const result = await runDigitalPriceListCheck(site, { DIGITAL_PRICE_LIST_DNS_RESOLVER: resolver })
    const report = technicalReport(result)
    expect(report.checks.find((check) => check.id === 'archive')).toMatchObject({ status: 'unknown', evidence: expect.stringContaining('Arhivu prethodnih objava nije moguće potvrditi') })
    expect(result.details.publicationFindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'publication.filename.unverified', level: 'warning' }),
      expect.objectContaining({ rule: 'publication.single-format', level: 'info' }),
    ]))
    expect(report.tone).toBe('yellow')
  })

  it('reports a linked earlier publication removed within 30 days as missing', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-27T12:00:00Z'))
    try {
      const old = '/cjenik/usluzni-objekt_ilica-10_poslovnica-1_0001_20261020T080000+0200'
      const current = '/cjenik/usluzni-objekt_ilica-10_poslovnica-1_0002_20261025T080000+0200'
      stubSite({
        '/': html(pricePage(`<a href="${current}.csv">Aktualni CSV</a><a href="${old}.csv">Prethodni CSV</a>`)),
        [`${current}.csv`]: () => new Response(recommendedCsv, { headers: { 'content-type': 'text/csv' } }),
      })
      const result = await runDigitalPriceListCheck(site, { DIGITAL_PRICE_LIST_DNS_RESOLVER: resolver })
      expect(result.details).toMatchObject({ archiveFound: false, archiveRemoved: true })
      expect(technicalReport(result).checks.find((check) => check.id === 'archive')?.status).toBe('missing')
    } finally { vi.useRealTimers() }
  })
})
