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
    { category: 'Bojanje', name: 'Bojanje kose', type: 'Usluga', externalId: 'FR-010', price: 40, anchorPrice: 45, lowest30DayPrice: 45, specialSaleApplied: true, specialSaleName: 'Jesenska akcija' },
  ],
}

/** Source of truth for public/examples/nepar-format-primjer-proizvodi.* (cjenik proizvoda: puni skup polja iz čl. III Odluke). */
export const NEPAR_PRODUCT_FORMAT_EXAMPLE: NormalizedPriceList = {
  tenant: { id: 'primjer-trgovina', slug: 'primjer-trgovina', name: 'Primjer trgovina' },
  source: 'nepar',
  currency: 'EUR',
  updatedAt: '2026-11-17T05:30:00.000Z',
  items: [
    { category: 'Mliječni proizvodi', name: 'Mlijeko 2,8% mm, 1 l', type: 'Proizvod', anchorReferenceDate: '2025-05-02', externalId: 'MLI-001', brand: 'Primjer mljekara', barcode: '4006381333931', unit: 'l', unitPrice: 1.19, price: 1.19, anchorPrice: 1.09, specialSaleApplied: false, availability: 'dostupno' },
    { category: 'Pekarski proizvodi', name: 'Kruh bijeli, 500 g', type: 'Proizvod', anchorReferenceDate: '2025-05-02', externalId: 'PEK-014', brand: 'bez marke', barcode: '96385074', unit: 'kg', unitPrice: 1.98, price: 0.99, anchorPrice: 0.95, specialSaleApplied: false, availability: 'nedostupno' },
    { category: 'Pića', name: 'Sok od jabuke, 1 l', type: 'Proizvod', anchorReferenceDate: '2025-05-02', externalId: 'PIC-203', brand: 'Primjer sokovi', barcode: '4012345678901', unit: 'l', unitPrice: 1.79, price: 1.79, salePrice: 1.49, lowest30DayPrice: 1.79, anchorPrice: 1.79, specialSaleApplied: true, specialSaleName: 'Jesenska akcija', availability: 'dostupno' },
  ],
}
