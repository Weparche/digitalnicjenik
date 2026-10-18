import { describe, expect, it } from 'vitest'
import { renderCsv } from '../../src/price-engine/csv'
import { renderXml } from '../../src/price-engine/xml'
import type { NormalizedPriceList } from '../../src/price-engine/types'
import { compareFeedToPayload, parseCsvFeed, parseCsvRows, parseXmlFeed, sha256Hex } from './document-parser'

const list: NormalizedPriceList = {
  tenant: { id: 't', slug: 't', name: 'Test' },
  source: 'nepar',
  currency: 'EUR',
  updatedAt: '2026-11-17T00:00:00Z',
  items: [
    { name: 'Mlijeko, 1 l', category: 'Mliječni', type: 'Proizvod', externalId: 'A1', price: 1.2, anchorPrice: 1.1, unit: 'l' },
    { name: '-Akcija "veliki"', price: 3.5, salePrice: 2.5, specialSaleApplied: true, specialSaleName: 'Black Friday' },
    { name: 'Višeredni\nnaziv', price: 4 },
  ],
}

describe('feed parsing round-trips the renderers', () => {
  it('csv: quoted commas, quotes, newlines, formula guard and BOM', () => {
    const feed = parseCsvFeed(renderCsv(list))
    expect(feed.records).toHaveLength(3)
    expect(feed.records[0]).toMatchObject({ name: 'Mlijeko, 1 l', externalId: 'A1', price: '1.20', anchorPrice: '1.10', unit: 'l' })
    expect(compareFeedToPayload(list.items, feed)).toEqual({ missing: 0, unexpected: 0 })
  })
  it('xml: counts items and carries no šifra/unit', () => {
    const feed = parseXmlFeed(renderXml(list))
    expect(feed.records).toHaveLength(3)
    expect(feed.records[0]).toMatchObject({ name: 'Mlijeko, 1 l', price: '1.20' })
    expect(compareFeedToPayload(list.items, feed)).toEqual({ missing: 0, unexpected: 0 })
  })
  it('detects missing and unexpected rows', () => {
    const tampered = parseCsvFeed(renderCsv({ ...list, items: [list.items[0]!, { name: 'Intruz', price: 9 }, list.items[2]!] }))
    expect(compareFeedToPayload(list.items, tampered)).toEqual({ missing: 1, unexpected: 1 })
  })
})

describe('product feeds', () => {
  const products: NormalizedPriceList = {
    ...list,
    items: [{ externalId: 'M-001', name: 'Mlijeko, 1 l', type: 'Proizvod', brand: 'Dukat', barcode: '4006381333931', unit: 'l', unitPrice: 1.2, price: 1.2, anchorPrice: 1.1, specialSaleApplied: false, availability: 'dostupno' }],
  }
  it('CSV and XML expose brand, barcode, unit price and availability to the monitor', () => {
    const fromCsv = parseCsvFeed(renderCsv(products)).records[0]!
    expect(fromCsv).toMatchObject({ externalId: 'M-001', brand: 'Dukat', barcode: '4006381333931', unit: 'l', unitPrice: '1.20', availability: 'dostupno' })
    const fromXml = parseXmlFeed(renderXml(products)).records[0]!
    expect(fromXml).toMatchObject({ externalId: 'M-001', brand: 'Dukat', barcode: '4006381333931', unit: 'l', unitPrice: '1.20', availability: 'dostupno' })
    expect(compareFeedToPayload(products.items, parseCsvFeed(renderCsv(products)))).toEqual({ missing: 0, unexpected: 0 })
  })
})

describe('parseCsvRows', () => {
  it('handles CRLF, LF and an unterminated quote', () => {
    expect(parseCsvRows('a,b\r\n1,2\n3,4')).toEqual([['a', 'b'], ['1', '2'], ['3', '4']])
    expect(() => parseCsvRows('a,"b')).toThrow()
  })
  it('rejects CSV without Naziv/Cijena columns', () => {
    expect(() => parseCsvFeed('x,y\n1,2')).toThrow()
  })
  it('rejects malformed XML', () => {
    expect(() => parseXmlFeed('<priceList><items><item></items></priceList>')).toThrow()
  })
})

describe('sha256Hex', () => {
  it('matches the known digest of "abc"', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})
