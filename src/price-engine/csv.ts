import type { NormalizedPriceList } from './types'

const protectSpreadsheetFormula = (value: string) => /^[=+\-@]/.test(value) || /^[\t\r\n]/.test(value) ? "'" + value : value
const escapeCsv = (value: unknown, protectFormula = true) => {
  const rawValue = value === null || value === undefined ? '' : String(value)
  const stringValue = protectFormula ? protectSpreadsheetFormula(rawValue) : rawValue
  return /[",\n\r]/.test(stringValue) ? `"${stringValue.replaceAll('"', '""')}"` : stringValue
}

export function renderCsv(priceList: NormalizedPriceList): string {
  const header = ['Grupa', 'Naziv', 'Vrsta', 'Interna šifra', 'Cijena', 'Akcijska cijena', 'Poseban oblik prodaje', 'Naziv posebnog oblika prodaje', 'Sidrena cijena', 'Jedinica']
  const rows = priceList.items.map((item) => [
    item.category ?? '', item.name, item.type ?? '', item.externalId ?? '',
    item.price.toFixed(2), item.salePrice == null ? '' : item.salePrice.toFixed(2), item.specialSaleApplied === true ? 'DA' : item.specialSaleApplied === false ? 'NE' : '', item.specialSaleName ?? '', item.anchorPrice == null ? '' : item.anchorPrice.toFixed(2), item.unit ?? '',
  ])
  return '\uFEFF' + [header, ...rows].map((row) => row.map((value, index) => escapeCsv(value, index !== 4 && index !== 5 && index !== 8)).join(',')).join('\r\n') + '\r\n'
}
