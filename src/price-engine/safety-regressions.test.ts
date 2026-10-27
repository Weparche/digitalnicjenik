import { describe, expect, it } from 'vitest'
import { parseXmlPriceList, parseXmlPriceListBrowser } from './xml'
import { validatePriceList } from './validate'
import { parsePriceListInput } from '../../functions/_limits'
import type { NormalizedPriceList } from './types'

const list: NormalizedPriceList = { tenant: { id: 't', slug: 't', name: 'Test' }, source: 'nepar', currency: 'EUR', updatedAt: '2026-10-27T00:00:00Z', items: [{ name: 'Test', type: 'Usluga', price: 10, anchorPrice: 10, specialSaleApplied: false }] }
describe('publication safety', () => {
  it('uses the same strict XML syntax and CDATA decoding in both runtimes', () => {
    for (const parse of [parseXmlPriceList, parseXmlPriceListBrowser]) {
      expect(parse('<priceList><item><name><![CDATA[A & B]]> &amp; C &#x20AC;</name><price>10</price></item></priceList>').items[0].name).toBe('A & B & C €')
      for (const xml of ['<priceList><item broken=unquoted><name>A</name><price>10</price></item></priceList>', '<priceList><item><name>A & B</name><price>10</price></item></priceList>', '<!DOCTYPE a [<!ENTITY x "test">]><a/>']) expect(() => parse(xml)).toThrow()
    }
  })
  it('never silently drops a malformed optional XML or JSON price', () => {
    expect(() => parseXmlPriceList('<priceList><item><name>A</name><price>10</price><unitPrice>garbage</unitPrice></item></priceList>')).toThrow('nije broj')
    for (const field of ['anchorPrice', 'salePrice', 'unitPrice', 'lowest30DayPrice']) expect(() => parsePriceListInput({ items: [{ ...list.items[0], [field]: 'garbage' }] })).toThrow('mora biti broj')
  })
  it('checks first-listing dates against the object timezone and permits today', () => {
    const future = { ...list, items: [{ ...list.items[0], isNewSinceReferenceDate: true, anchorReferenceDate: '2026-09-21' }] }
    const now = new Date('2026-09-20T22:30:00Z')
    expect(validatePriceList(future, { now, timeZone: 'Europe/Zagreb' }).status).toBe('ready_to_publish')
    expect(validatePriceList(future, { now, timeZone: 'UTC' }).status).toBe('invalid')
    expect(validatePriceList({ ...future, items: [{ ...future.items[0], anchorReferenceDate: '2030-01-01' }] }, { now }).status).toBe('invalid')
  })
  it('an exemption never permits an invalid supplied unit price', () => {
    const product = { ...list.items[0], type: 'Proizvod', externalId: 'p1', brand: 'bez marke', barcode: '96385074', availability: 'dostupno' as const, anchorReferenceDate: '2026-09-10', unit: null, unitPricingExemption: 'Nije primjenjivo' }
    expect(validatePriceList({ ...list, items: [{ ...product, unitPrice: -5 }] }).status).toBe('invalid')
    expect(validatePriceList({ ...list, items: [{ ...product, unitPrice: null }] }).status).toBe('ready_to_publish')
  })
})
