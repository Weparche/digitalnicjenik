import { describe, expect, it } from 'vitest'
import hokCsv from '../../public/examples/primjer-digitalni-cjenik-usluge-2026.csv?raw'
import hokXml from '../../public/examples/primjer-digitalni-cjenik-usluge-2026.xml?raw'
import { parseMarketinoCsv } from './adapters/marketinoCsv'
import { normalizeNumber } from './normalize'
import { parseXmlPriceList, renderXml } from './xml'
import { validatePriceList } from './validate'
import { deterministicPublicationHash } from './hash'
import { renderCsv } from './csv'
import { compareFeedToPayload, parseCsvFeed, parseXmlFeed } from '../../shared/compliance/document-parser'
import { parsePublicationDetails } from '../../shared/publication-details'
import { technicalReport } from '../../shared/website-check'
import { excelRowsToPriceList, suggestExcelMapping } from '../excel'
import type { NormalizedPriceList } from './types'

const list: NormalizedPriceList = { tenant: { id: 't', slug: 'salon', name: 'Salon' }, source: 'nepar', currency: 'EUR', updatedAt: '2026-10-26T12:00:00Z', items: [{ name: 'Šišanje', type: 'Usluga', price: 15, anchorPrice: 14, specialSaleApplied: false }] }

describe('publication regressions from the audit', () => {
  it('rejects the entire XML when a later row has an invalid price or missing name', () => {
    const valid = '<item><name>Šišanje</name><price>15</price><type>Usluga</type><anchorPrice>14</anchorPrice><specialSaleApplied>false</specialSaleApplied></item>'
    expect(() => parseXmlPriceList(`<priceList>${valid}<item><name>Druga usluga</name><price>tekst</price></item></priceList>`)).toThrow('XML stavka 2')
    expect(() => parseXmlPriceList(`<priceList>${valid}<item><price>20</price></item></priceList>`)).toThrow('nedostaje naziv')
  })
  it('imports both published HOK service examples without losing anchor or sale fields', () => {
    for (const parsed of [parseMarketinoCsv(hokCsv).priceList, parseXmlPriceList(hokXml)]) {
      expect(parsed.items).toHaveLength(3)
      expect(parsed.items[0]).toMatchObject({ type: 'Usluga', anchorPrice: 15, specialSaleApplied: false })
      expect(parsed.items[2]).toMatchObject({ type: 'Usluga', anchorPrice: 40, specialSaleApplied: true, specialSaleName: 'Akcija' })
      expect(validatePriceList(parsed).status).toBe('ready_to_publish')
    }
  })
  it.each(['10abc20', 'od 10 EUR', '10-20', '10,2,3', '1.23.4'])('rejects ambiguous numeric content %s', text => {
    expect(normalizeNumber(text)).toBeNull()
  })
  it.each([['1.234,50 €', 1234.5], ['1,234.50 EUR', 1234.5], ['15,20', 15.2]])('accepts an unambiguous formatted amount %s', (text, expected) => {
    expect(normalizeNumber(text)).toBe(expected)
  })
  it('does not infer a negative sale flag from a missing CSV column', () => {
    const parsed = parseMarketinoCsv('Naziv;Vrsta;Cijena;Sidrena cijena\nŠišanje;Usluga;15;14').priceList
    expect(parsed.items[0].specialSaleApplied).toBeNull()
    expect(validatePriceList(parsed).blockingCount).toBeGreaterThan(0)
  })
  it('detects tampering with anchor price in either feed', () => {
    const changed = { ...list, items: [{ ...list.items[0], anchorPrice: 9999 }] }
    for (const feed of [parseCsvFeed(renderCsv(changed)), parseXmlFeed(renderXml(changed))]) {
      expect(compareFeedToPayload(list.items, feed)).toEqual({ missing: 1, unexpected: 1 })
    }
  })
  it('rejects empty lists and inconsistent sale prices', () => {
    expect(validatePriceList({ ...list, items: [] }).status).toBe('invalid')
    expect(validatePriceList({ ...list, items: [{ ...list.items[0], salePrice: 16, specialSaleApplied: true, specialSaleName: 'Akcija' }] }).status).toBe('invalid')
  })
  it('requires actual publication metadata instead of substituting a business name', () => {
    expect(() => parsePublicationDetails(undefined)).toThrow()
    expect(() => parsePublicationDetails({ objectType: 'salon', objectAddress: '', objectCode: '1' })).toThrow()
    expect(parsePublicationDetails({ objectType: 'salon', objectAddress: 'Ilica 10, Zagreb', objectCode: 'P1' })).toMatchObject({ objectAddress: 'Ilica 10, Zagreb' })
  })
  it('permits a new daily publication with identical product prices while deduping within a day', async () => {
    const metadata = { objectType: 'trgovina', objectAddress: 'Ilica 10', objectCode: '1', timezone: 'Europe/Zagreb', nextPublicationSequence: 1 }
    const first = await deterministicPublicationHash(list, metadata, '2026-11-17')
    expect(await deterministicPublicationHash(list, metadata, '2026-11-17')).toBe(first)
    expect(await deterministicPublicationHash(list, metadata, '2026-11-18')).not.toBe(first)
  })
  it('does not penalize a site for using only one supported machine format', () => {
    const report = technicalReport({ status: 'green', details: { reachable: true, homepageReadable: true, https: true, pricePageFound: true, csvFound: true, xmlFound: false, publicLinkUrl: 'https://example.hr/cjenik.csv', archiveFound: true, structureStatus: 'pass', contentStatus: 'pass', publicationFindings: [] } })
    expect(report).toMatchObject({ score: 9, attention: 0, tone: 'green' })
    expect(report.checks.find(check => check.id === 'machine')).toMatchObject({ status: 'pass', evidence: expect.stringContaining('XML nije objavljen — nije obvezan') })
    expect(report.checks.some(check => check.id === 'csv' || check.id === 'xml')).toBe(false)
  })
  it('keeps historical price evidence through CSV, XML and feed verification', () => {
    const historical = { ...list, items: [{ ...list.items[0], anchorReferenceDate: '2026-10-01', isNewSinceReferenceDate: true, price: 20, salePrice: 12, specialSaleApplied: true, specialSaleName: 'Akcija', lowest30DayPrice: 16 }] }
    expect(validatePriceList(historical).status).toBe('ready_to_publish')
    for (const imported of [parseMarketinoCsv(renderCsv(historical)).priceList, parseXmlPriceList(renderXml(historical))]) {
      expect(imported.items[0]).toMatchObject({ anchorReferenceDate: '2026-10-01', isNewSinceReferenceDate: true, lowest30DayPrice: 16 })
      expect(validatePriceList(imported).status).toBe('ready_to_publish')
    }
    for (const [render, parse] of [[renderCsv, parseCsvFeed], [renderXml, parseXmlFeed]] as const) {
      expect(compareFeedToPayload(historical.items, parse(render(historical)))).toEqual({ missing: 0, unexpected: 0 })
      const changed = { ...historical, items: [{ ...historical.items[0], lowest30DayPrice: 19 }] }
      expect(compareFeedToPayload(historical.items, parse(render(changed)))).toEqual({ missing: 1, unexpected: 1 })
    }
  })
  it('requires a reference date for new services and separate lowest-price evidence for a sale', () => {
    expect(validatePriceList({ ...list, items: [{ ...list.items[0], isNewSinceReferenceDate: true }] }).status).toBe('manual_review')
    expect(validatePriceList({ ...list, items: [{ ...list.items[0], specialSaleApplied: true, specialSaleName: 'Akcija' }] }).issues.some(issue => issue.message.includes('30 dana'))).toBe(true)
    expect(() => parseMarketinoCsv('Naziv;Cijena;Datum referentne cijene\nTest;10;2026-02-30')).toThrow('datum')
  })
  it('maps Excel history and reports a malformed optional price instead of dropping it', () => {
    const headers = ['Naziv', 'Cijena', 'Vrsta', 'Sidrena cijena', 'Datum referentne cijene', 'Najniža cijena u 30 dana', 'Nova stavka']
    const sheet = { name: 'Cjenik', rows: [headers, ['Nova usluga', 12, 'Usluga', 14, '1.10.2026.', 16, 'DA']] }
    const imported = excelRowsToPriceList(sheet, 0, suggestExcelMapping(headers))
    expect(imported.priceList.items[0]).toMatchObject({ anchorReferenceDate: '2026-10-01', lowest30DayPrice: 16, isNewSinceReferenceDate: true })
    sheet.rows[1][5] = 'od 16'
    expect(excelRowsToPriceList(sheet, 0, suggestExcelMapping(headers)).issues).toContainEqual(expect.objectContaining({ severity: 'error', code: 'IMPORT_ROW_SKIPPED' }))
  })
})
