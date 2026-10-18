import type { NormalizedPriceList } from '../price-engine/types'

/** Source of truth for the downloadable NEPAR-format examples (public/examples/nepar-format-primjer-usluge.*). */
export const NEPAR_FORMAT_EXAMPLE: NormalizedPriceList = {
  tenant: { id: 'primjer', slug: 'primjer', name: 'Primjer frizerski salon' },
  source: 'nepar',
  currency: 'EUR',
  updatedAt: '2026-11-17T05:30:00.000Z',
  items: [
    { category: 'Šišanje', name: 'Muško šišanje', type: 'Usluga', externalId: 'FR-001', price: 15, anchorPrice: 15, specialSaleApplied: false },
    { category: 'Šišanje', name: 'Žensko šišanje', type: 'Usluga', externalId: 'FR-002', price: 21, anchorPrice: 18, specialSaleApplied: false },
    { category: 'Bojanje', name: 'Bojanje kose', type: 'Usluga', externalId: 'FR-010', price: 40, anchorPrice: 45, specialSaleApplied: true, specialSaleName: 'Jesenska akcija' },
  ],
}
