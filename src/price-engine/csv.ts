import { usesProductStructure } from './profile'
import type { NormalizedPriceList } from './types'

const protectSpreadsheetFormula = (value: string) => /^[=+\-@]/.test(value) || /^[\t\r\n]/.test(value) ? "'" + value : value
const escapeCsv = (value: unknown, protectFormula = true) => {
  const rawValue = value === null || value === undefined ? '' : String(value)
  const stringValue = protectFormula ? protectSpreadsheetFormula(rawValue) : rawValue
  return /[",\n\r]/.test(stringValue) ? `"${stringValue.replaceAll('"', '""')}"` : stringValue
}

export const CSV_BASE_HEADER = ['Grupa', 'Naziv', 'Vrsta', 'Interna šifra', 'Cijena', 'Akcijska cijena', 'Poseban oblik prodaje', 'Naziv posebnog oblika prodaje', 'Sidrena cijena', 'Jedinica']
export const CSV_PRODUCT_HEADER = ['Marka', 'Barkod', 'Cijena za jedinicu mjere', 'Dostupnost']

export function renderCsv(priceList: NormalizedPriceList): string {
  const products = usesProductStructure(priceList)
  const header = products ? [...CSV_BASE_HEADER, ...CSV_PRODUCT_HEADER] : CSV_BASE_HEADER
  const rows = priceList.items.map((item) => {
    const base = [
      item.category ?? '', item.name, item.type ?? '', item.externalId ?? '',
      item.price.toFixed(2), item.salePrice == null ? '' : item.salePrice.toFixed(2), item.specialSaleApplied === true ? 'DA' : item.specialSaleApplied === false ? 'NE' : '', item.specialSaleName ?? '', item.anchorPrice == null ? '' : item.anchorPrice.toFixed(2), item.unit ?? '',
    ]
    return products
      ? [...base, item.brand ?? '', item.barcode ?? '', item.unitPrice == null ? '' : item.unitPrice.toFixed(2), item.availability ?? '']
      : base
  })
  // Price columns are not formula-protected (they are numbers); the barcode is text but digits only, so no guard needed either.
  const numeric = new Set([4, 5, 8, 12])
  return '\uFEFF' + [header, ...rows].map((row) => row.map((value, index) => escapeCsv(value, !numeric.has(index))).join(',')).join('\r\n') + '\r\n'
}
