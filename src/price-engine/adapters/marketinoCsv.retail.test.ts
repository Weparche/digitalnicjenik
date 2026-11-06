import { describe, expect, it } from 'vitest'
import { parseMarketinoCsv } from './marketinoCsv'

// Header layout used by large Croatian retail chains (e.g. Konzum) for daily price lists.
const header = 'NAZIV PROIZVODA,ŠIFRA PROIZVODA,MARKA PROIZVODA,NETO KOLIČINA,JEDINICA MJERE,MALOPRODAJNA CIJENA,CIJENA ZA JEDINICU MJERE,MPC ZA VRIJEME POSEBNOG OBLIKA PRODAJE,NAJNIŽA CIJENA U POSLJEDNJIH 30 DANA,SIDRENA CIJENA NA 2.5.2025,BARKOD,KATEGORIJA PROIZVODA'

describe('retail chain CSV headers', () => {
  it('maps sale price, 30-day lowest price, brand, category and a dated anchor column', () => {
    const csv = `${header}\nKROASAN KAKAO 225 g,91022305,BELINO,0.23 kg,ko,1.95,8.67,1.49,1.49,1.95,5301000235412,HRANA\n`
    const { priceList, warnings } = parseMarketinoCsv(csv, undefined, { inspection: true })
    expect(warnings).toEqual([])
    const [item] = priceList.items
    expect(item).toMatchObject({ name: 'KROASAN KAKAO 225 g', brand: 'BELINO', category: 'HRANA', price: 1.95, salePrice: 1.49, lowest30DayPrice: 1.49, anchorPrice: 1.95, anchorReferenceDate: '2025-05-02' })
  })

  it('uses the special-sale price as the effective price when MPC is empty, as a warning', () => {
    const csv = `${header}\nSIR MOZZARELLA 3x100 g,91015079,K PLUS,0.30 kg,ko,,7.63,2.29,2.27,2.99,3850334456533,HRANA\n`
    const { priceList, warnings } = parseMarketinoCsv(csv, undefined, { inspection: true })
    expect(priceList.items[0]).toMatchObject({ name: 'SIR MOZZARELLA 3x100 g', price: 2.29, salePrice: null, specialSaleApplied: true, lowest30DayPrice: 2.27 })
    expect(warnings).toEqual([expect.objectContaining({ row: 2, imported: true, rule: 'item.price.alternative-column' })])
    expect(warnings[0]?.message).toContain('MPC ZA VRIJEME POSEBNOG OBLIKA PRODAJE')
  })

  it('keeps a row with neither price as a missing-price error', () => {
    const csv = `${header}\nSIR BEZ CIJENE,91015080,K PLUS,0.30 kg,ko,,,,,2.99,3850334456533,HRANA\n`
    const { priceList, warnings } = parseMarketinoCsv(csv, undefined, { inspection: true })
    expect(priceList.items).toEqual([])
    expect(warnings).toEqual([expect.objectContaining({ field: 'price', message: 'nedostaje važeća cijena (ni maloprodajna ni cijena posebnog oblika prodaje).' })])
    expect(warnings[0]?.imported).toBeUndefined()
  })

  it('derives the special-sale flag from the special-sale column', () => {
    const csv = `${header}\nA,1,M,1 kg,kg,2.00,2.00,1.50,1.50,2.00,3850334456533,HRANA\nB,2,M,1 kg,kg,3.00,3.00,,3.00,3.00,3850334456533,HRANA\n`
    const items = parseMarketinoCsv(csv).priceList.items
    expect(items.map((item) => [item.price, item.salePrice, item.specialSaleApplied])).toEqual([[2, 1.5, true], [3, null, false]])
  })

  it('keeps inferring 10. 9. 2026. from the existing service header', () => {
    const csv = 'Naziv,Cijena,Sidrena cijena 10.9.2026.,Vrsta\nŠišanje,15,15,Usluga\n'
    expect(parseMarketinoCsv(csv).priceList.items[0]?.anchorReferenceDate).toBe('2026-09-10')
  })
})
