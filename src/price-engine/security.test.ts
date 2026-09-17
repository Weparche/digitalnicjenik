import { describe, expect, it } from 'vitest'
import { renderCsv } from './csv'
import { deterministicHash } from './hash'
import type { NormalizedPriceList } from './types'

const list: NormalizedPriceList = {
  tenant: { id: 'tenant-a', slug: 'tenant-a', name: 'Tenant A' },
  source: 'marketino-csv',
  currency: 'EUR',
  updatedAt: '2026-09-17T12:00:00.000Z',
  items: [{ externalId: '1', category: 'Usluge', name: 'Usluga', type: 'Usluga', price: 20, anchorPrice: null, salePrice: null, specialSaleApplied: null, specialSaleName: null }],
}

describe('publication security boundaries', () => {
  it('neutralizes spreadsheet formulas in text fields but leaves numeric prices numeric', () => {
    const csv = renderCsv({ ...list, items: [{ ...list.items[0], name: '=SUM(A1:A2)', category: '+import', externalId: '@sku' }] })
    expect(csv).toContain("'=SUM(A1:A2)")
    expect(csv).toContain("'+import")
    expect(csv).toContain("'@sku")
    expect(csv).toContain(',20.00,')
  })

  it('includes regulatory completion in the canonical hash', async () => {
    const anchor = { ...list, items: [{ ...list.items[0], anchorPrice: 18 }] }
    const specialSale = { ...list, items: [{ ...list.items[0], specialSaleApplied: true, specialSaleName: 'Rasprodaja' }] }
    expect(await deterministicHash(list)).not.toBe(await deterministicHash(anchor))
    expect(await deterministicHash(list)).not.toBe(await deterministicHash(specialSale))
  })
})
