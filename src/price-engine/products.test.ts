import { describe, expect, it } from 'vitest'
import { parseMarketinoCsv } from './adapters/marketinoCsv'
import { deterministicHash } from './hash'
import { renderCsv } from './csv'
import { isValidGtin, normalizeBarcode, parseAvailability } from './normalize'
import { usesProductStructure } from './profile'
import { validatePriceList } from './validate'
import { parseXmlPriceList, parseXmlItemRecords, renderXml } from './xml'
import type { NormalizedPriceItem, NormalizedPriceList } from './types'

const tenant = { id: 't', slug: 't', name: 'Trgovina d.o.o.' }
const product = (overrides: Partial<NormalizedPriceItem> = {}): NormalizedPriceItem => ({
  externalId: 'M-001', category: 'Mliječni', name: 'Mlijeko 1 l', type: 'Proizvod', brand: 'Dukat', barcode: '4006381333931', unit: 'l', unitPrice: 1.2,
  price: 1.2, anchorPrice: 1.1, anchorReferenceDate: '2025-05-02', specialSaleApplied: false, availability: 'dostupno', ...overrides,
})
const list = (items: NormalizedPriceItem[]): NormalizedPriceList => ({ tenant, source: 'nepar', currency: 'EUR', updatedAt: '2026-11-17T05:00:00Z', items })

const PRODUCT_CSV = [
  'Grupa,Naziv,Vrsta,Interna šifra,Cijena,Akcijska cijena,Poseban oblik prodaje,Naziv posebnog oblika prodaje,Sidrena cijena,Jedinica,Marka,Barkod,Cijena za jedinicu mjere,Dostupnost',
  'Mliječni,Mlijeko 1 l,Proizvod,M-001,1.20,,NE,,1.10,l,Dukat,4006381333931,1.20,dostupno',
  'Pekarski,Kruh,Proizvod,M-002,0.99,,NE,,0.95,kom,bez marke,,,nedostupno',
].join('\r\n')

describe('barcode and availability helpers', () => {
  it('validates GS1 check digits for EAN-8/13, UPC-A and GTIN-14', () => {
    expect(isValidGtin('4006381333931')).toBe(true) // EAN-13
    expect(isValidGtin('96385074')).toBe(true) // EAN-8
    expect(isValidGtin('036000291452')).toBe(true) // UPC-A
    expect(isValidGtin('4006381333932')).toBe(false) // wrong check digit
    expect(isValidGtin('12345')).toBe(false)
    expect(isValidGtin('40063813339AB')).toBe(false)
  })
  it('normalises barcodes without losing leading zeros and reads availability words', () => {
    expect(normalizeBarcode(' 0385 0123 ')).toBe('03850123')
    expect(normalizeBarcode(4006381333931)).toBe('4006381333931')
    expect(parseAvailability('Dostupno')).toBe('dostupno')
    expect(parseAvailability('NE')).toBe('nedostupno')
    expect(parseAvailability('možda')).toBeNull()
    expect(parseAvailability('')).toBeNull()
  })
})

describe('product file structure', () => {
  it('only lists containing non-service items get the product columns; service feeds are unchanged', () => {
    const services = list([{ name: 'Šišanje', type: 'Usluga', price: 15, anchorPrice: 15, specialSaleApplied: false }])
    expect(usesProductStructure(services)).toBe(false)
    expect(renderCsv(services).split('\r\n')[0]).toBe('﻿Grupa,Naziv,Vrsta,Interna šifra,Cijena,Akcijska cijena,Poseban oblik prodaje,Naziv posebnog oblika prodaje,Sidrena cijena,Jedinica')
    expect(renderXml(services)).not.toContain('<brand>')

    const products = list([product()])
    expect(usesProductStructure(products)).toBe(true)
    expect(renderCsv(products).split('\r\n')[0]).toMatch(/,Jedinica,Marka,Barkod,Cijena za jedinicu mjere,Dostupnost,Datum referentne cijene/)
  })

  it('CSV round-trips brand, barcode, unit price and availability', () => {
    const parsed = parseMarketinoCsv(PRODUCT_CSV, tenant).priceList
    expect(parsed.items[0]).toMatchObject({ externalId: 'M-001', brand: 'Dukat', barcode: '4006381333931', unit: 'l', unitPrice: 1.2, availability: 'dostupno' })
    expect(parsed.items[1]).toMatchObject({ brand: 'bez marke', barcode: null, availability: 'nedostupno' })
    const again = parseMarketinoCsv(renderCsv(parsed), tenant).priceList
    expect(again.items.map(({ name, brand, barcode, unit, unitPrice, availability }) => ({ name, brand, barcode, unit, unitPrice, availability })))
      .toEqual(parsed.items.map(({ name, brand, barcode, unit, unitPrice, availability }) => ({ name, brand, barcode, unit, unitPrice, availability })))
  })

  it('keeps leading zeros of barcodes through CSV and Excel-like numeric cells', () => {
    const csv = PRODUCT_CSV.replace('4006381333931', '03850123')
    expect(parseMarketinoCsv(csv, tenant).priceList.items[0]!.barcode).toBe('03850123')
  })

  it('XML round-trips the product fields and escapes text', () => {
    const items = list([product({ brand: 'Ben & Jerry\'s', name: 'Sladoled <vanilija>' })])
    const xml = renderXml(items)
    expect(xml).toContain('<brand>Ben &amp; Jerry&apos;s</brand>')
    expect(xml).toContain('<barcode>4006381333931</barcode>')
    expect(xml).toContain('<unitPrice currency="EUR">1.20</unitPrice>')
    expect(xml).toContain('<availability>dostupno</availability>')
    const parsed = parseXmlPriceList(xml, tenant).items[0]!
    expect(parsed).toMatchObject({ name: 'Sladoled <vanilija>', brand: "Ben & Jerry's", barcode: '4006381333931', externalId: 'M-001', unit: 'l', unitPrice: 1.2, availability: 'dostupno' })
    expect(parseXmlItemRecords(xml)[0]).toMatchObject({ brand: "Ben & Jerry's", barcode: '4006381333931', availability: 'dostupno' })
  })
})

describe('product validation (NN 101/2026-1213, čl. III)', () => {
  const issuesFor = (item: NormalizedPriceItem) => validatePriceList(list([item]))
  const fields = (item: NormalizedPriceItem) => issuesFor(item).issues.map((issue) => `${issue.field}:${issue.severity}`)

  it('a complete product is ready to publish', () => {
    expect(issuesFor(product()).status).toBe('ready_to_publish')
  })

  it('requires šifra, marka, dostupnost and sidrena cijena (blocking review)', () => {
    const result = issuesFor(product({ externalId: undefined, brand: '', availability: null, anchorPrice: null }))
    expect(result.status).toBe('manual_review')
    expect(result.issues.map((issue) => `${issue.field}:${issue.severity}`).sort()).toEqual(['anchorPrice:manual_review', 'availability:manual_review', 'brand:manual_review', 'externalId:manual_review'])
  })

  it('requires a barcode; checksum problems remain visible warnings', () => {
    expect(fields(product({ barcode: null }))).toEqual(['barcode:manual_review'])
    expect(fields(product({ barcode: '3850123456780' }))).toEqual(['barcode:warning'])
    expect(issuesFor(product({ barcode: null })).status).toBe('manual_review')
  })

  it('unit and unit price must come together', () => {
    expect(fields(product({ unitPrice: null }))).toEqual(['unitPrice:manual_review'])
    expect(fields(product({ unit: null }))).toEqual(['unit:manual_review'])
    expect(fields(product({ unit: null, unitPrice: null }))).toEqual(['unit:manual_review', 'unitPrice:manual_review'])
    expect(fields(product({ unit: null, unitPrice: null, unitPricingExemption: 'Cijena po jedinici nije primjenjiva: obrazloženo izuzeće.' }))).toEqual([])
  })

  it('services are not asked for product fields', () => {
    const service: NormalizedPriceItem = { name: 'Šišanje', type: 'Usluga', price: 15, anchorPrice: 15, specialSaleApplied: false }
    expect(issuesFor(service).issues).toEqual([])
  })
})

describe('publication hash', () => {
  it('is unchanged for items without product fields and changes when a product field changes', async () => {
    const plain = list([{ name: 'Šišanje', type: 'Usluga', price: 15, anchorPrice: 15 }])
    // Fixed value: the canonical form of pre-existing (service) publications must never drift.
    expect(await deterministicHash(plain)).toBe(await deterministicHash(list([{ name: 'Šišanje', type: 'Usluga', price: 15, anchorPrice: 15, brand: null, barcode: null, availability: null }])))
    const a = await deterministicHash(list([product()]))
    expect(await deterministicHash(list([product({ availability: 'nedostupno' })]))).not.toBe(a)
    expect(await deterministicHash(list([product({ barcode: '3850123456782' })]))).not.toBe(a)
  })
})

describe('WooCommerce product export is recognised without renaming columns', () => {
  const WOO = [
    'ID,Type,SKU,"GTIN, UPC, EAN, or ISBN",Name,Published,"In stock?",Stock,"Sale price","Regular price",Categories,Brands',
    '11,simple,M-001,4006381333931,"Mlijeko 1 l",1,1,40,,1.20,"Mliječni",Dukat',
    '12,simple,M-002,,"Kruh 500 g",1,0,0,,0.99,"Pekarski",',
  ].join('\n')

  it('maps SKU, GTIN, brand, stock and the regular price; "simple" becomes a product', () => {
    const items = parseMarketinoCsv(WOO, tenant).priceList.items
    expect(items[0]).toMatchObject({ externalId: 'M-001', barcode: '4006381333931', brand: 'Dukat', availability: 'dostupno', price: 1.2, category: 'Mliječni', type: 'Proizvod', name: 'Mlijeko 1 l' })
    expect(items[1]).toMatchObject({ externalId: 'M-002', barcode: null, brand: null, availability: 'nedostupno', type: 'Proizvod' })
  })

  it('what is still missing (anchor price, brand) is reported rather than guessed', () => {
    const result = validatePriceList(parseMarketinoCsv(WOO, tenant).priceList)
    const missing = result.issues.map((issue) => `${issue.row}:${issue.field}`)
    expect(missing).toContain('2:anchorPrice')
    expect(missing).toContain('3:brand')
    expect(result.status).toBe('manual_review')
  })
})
