import { normalizeBarcode, normalizeHeader, normalizeNumber, normalizeReferenceDate, parseAvailability, validateItems } from '../normalize'
import type { NormalizedPriceList, ParseResult, PriceSourceAdapter } from '../types'

function splitCsv(input: string, delimiter: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let field = ''; let quoted = false
  for (let i = 0; i < input.length; i += 1) {
    const character = input[i]; const next = input[i + 1]
    if (character === '"' && quoted && next === '"') { field += '"'; i += 1; continue }
    if (character === '"') { quoted = !quoted; continue }
    if (character === delimiter && !quoted) { row.push(field); field = ''; continue }
    if ((character === '\n' || character === '\r') && !quoted) { if (character === '\r' && next === '\n') i += 1; row.push(field); if (row.some((cell) => cell.trim())) rows.push(row); row = []; field = ''; continue }
    field += character
  }
  if (quoted) throw new Error('CSV sadrži nezatvorene navodnike. Provjerite izvoz datoteke.')
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}

const cleanHeader = normalizeHeader
// Alias order is priority order (e.g. SKU wins over a generic ID column).
const findColumn = (headers: string[], ...names: string[]) => {
  const cleaned = headers.map(cleanHeader)
  for (const name of names) {
    const index = cleaned.indexOf(name)
    if (index >= 0) return index
  }
  return -1
}
const booleanValue = (value: string | undefined): boolean | null => {
  const normalized = value?.trim().toLocaleLowerCase('hr-HR')
  if (!normalized) return null
  if (['da', 'yes', 'true', '1'].includes(normalized)) return true
  if (['ne', 'no', 'false', '0'].includes(normalized)) return false
  return null
}

export function parseMarketinoCsv(csv: string, tenant = { id: 'marketino-demo', slug: 'marketino-demo', name: 'Marketino demo' }, options: { inspection?: boolean } = {}): ParseResult {
  const firstLine = csv.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? ''
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows = splitCsv(csv.replace(/^\uFEFF/, ''), delimiter)
  if (!rows.length) throw new Error('CSV je prazan. Izvezite cjenik s barem jednim artiklom.')
  const headers = rows[0]
  const groupIndex = findColumn(headers, 'grupa*', 'grupa', 'kategorija', 'category', 'categories')
  const nameIndex = findColumn(headers, 'naziv*', 'naziv', 'naziv proizvoda', 'naziv usluge', 'name', 'usluga')
  const typeIndex = findColumn(headers, 'vrsta*', 'vrsta', 'type')
  const idIndex = findColumn(headers, 'interna šifra', 'interna sifra', 'sku', 'šifra', 'šifra proizvoda', 'sifra', 'sifra proizvoda', 'id')
  const priceIndex = findColumn(headers, 'cijena*', 'cijena', 'maloprodajna cijena', 'cena', 'price', 'regular price')
  const saleIndex = findColumn(headers, 'akcijska cijena', 'akcijska cijena*', 'akcija', 'sale price')
  const anchorIndex = findColumn(headers, 'sidrena cijena', 'sidrena cijena*', 'dodatna cijena', 'anchor price', 'reference price', 'sidrena cijena 10.9.2026.', 'sidrena cijena 10. 9. 2026.', 'dodatna cijena 10.9.2026.')
  const specialSaleAppliedIndex = findColumn(headers, 'poseban oblik prodaje', 'posebni oblik prodaje', 'special sale applied', 'poseban oblik prodaje (da/ne)', 'posebni oblik prodaje (da/ne)')
  const specialSaleNameIndex = findColumn(headers, 'naziv posebnog oblika prodaje', 'poseban oblik prodaje naziv', 'special sale name')
  const unitIndex = findColumn(headers, 'jedinica', 'jedinica mjere', 'unit')
  const unitPriceIndex = findColumn(headers, 'cijena za jedinicu mjere', 'cijena po jedinici mjere', 'jedinična cijena', 'jedinicna cijena', 'unit price')
  const brandIndex = findColumn(headers, 'marka', 'brend', 'brand', 'brands')
  const barcodeIndex = findColumn(headers, 'barkod', 'barcode', 'ean', 'gtin', 'bar kod', 'gtin, upc, ean, or isbn')
  const availabilityIndex = findColumn(headers, 'dostupnost', 'dostupno', 'availability', 'dostupno/nedostupno', 'in stock?')
  const referenceDateIndex = findColumn(headers, 'datum referentne cijene', 'datum sidrene cijene', 'referentni datum', 'anchor reference date')
  const lowestIndex = findColumn(headers, 'najniža cijena u 30 dana', 'najniza cijena u 30 dana', 'lowest 30 day price')
  const newIndex = findColumn(headers, 'nova stavka', 'nova usluga', 'new service')
  const exemptionIndex = findColumn(headers, 'razlog izuzeća cijene po jedinici')
  if (nameIndex < 0 || priceIndex < 0) throw new Error('Nisu pronađeni obavezni stupci “Naziv*” i “Cijena*”. Provjerite da je ovo CSV izvoz cjenika.')
  const warnings: ParseResult['warnings'] = []
  const sourceRows: number[] = []
  const items = rows.slice(1).flatMap((row, index) => {
    try {
    const name = row[nameIndex]?.trim() ?? ''; const price = normalizeNumber(row[priceIndex]);
    if (!name && !row.some(Boolean)) return []
    if (!name || price == null) {
      warnings.push({
        row: index + 2,
        field: !name ? 'name' : 'price',
        itemName: name || undefined,
        message: !name ? 'nedostaje naziv.' : !row[priceIndex]?.trim() ? 'nedostaje maloprodajna cijena.' : 'cijena nije broj.',
      })
      return []
    }
    const salePrice = saleIndex >= 0 ? normalizeNumber(row[saleIndex]) : null
    for (const [label, column] of [['Akcijska cijena', saleIndex], ['Sidrena cijena', anchorIndex], ['Cijena za jedinicu mjere', unitPriceIndex]] as const) {
      if (column >= 0 && row[column]?.trim() && normalizeNumber(row[column]) == null) throw new Error(`CSV redak ${index + 2}: ${label} nije broj. Provjerite izvorni podatak.`)
    }
    const rawType = row[typeIndex]?.trim() || (cleanHeader(headers[nameIndex]) === 'naziv usluge' ? 'Usluga' : '')
    // WooCommerce exports use the product kind (simple, variable, ...) as "Type"; those are all goods.
    const type = rawType === '2' ? 'Usluga' : /^(simple|variable|variation|grouped|external)$/i.test(rawType) ? 'Proizvod' : rawType || undefined
    const dateRaw = referenceDateIndex >= 0 ? row[referenceDateIndex]?.trim() : headers.some(header => /sidrena cijena.*10\.\s*9\.\s*2026/i.test(header)) ? '2026-09-10' : ''
    const date = normalizeReferenceDate(dateRaw)
    if (dateRaw && !date) throw new Error(`CSV redak ${index + 2}: datum referentne cijene nije valjan.`)
    const lowest = lowestIndex >= 0 ? normalizeNumber(row[lowestIndex]) : null
    if (lowestIndex >= 0 && row[lowestIndex]?.trim() && lowest == null) throw new Error(`CSV redak ${index + 2}: najniža cijena nije broj.`)
    const historical = { ...(date ? { anchorReferenceDate: date } : {}), ...(lowest != null ? { lowest30DayPrice: lowest } : {}), ...(newIndex >= 0 ? { isNewSinceReferenceDate: booleanValue(row[newIndex]) === true } : {}), ...(exemptionIndex >= 0 ? { unitPricingExemption: row[exemptionIndex]?.trim() || null } : {}) }
    sourceRows.push(index + 2)
    return [{ ...historical, externalId: row[idIndex]?.trim() || undefined, category: row[groupIndex]?.trim() || undefined, name, type, price, salePrice, anchorPrice: anchorIndex >= 0 ? normalizeNumber(row[anchorIndex]) : null, specialSaleApplied: specialSaleAppliedIndex >= 0 ? booleanValue(row[specialSaleAppliedIndex]) : null, specialSaleName: specialSaleNameIndex >= 0 ? row[specialSaleNameIndex]?.trim() || null : null, ...(unitIndex >= 0 ? { unit: row[unitIndex]?.trim() || null } : {}), ...(unitPriceIndex >= 0 ? { unitPrice: normalizeNumber(row[unitPriceIndex]) } : {}), ...(brandIndex >= 0 ? { brand: row[brandIndex]?.trim() || null } : {}), ...(barcodeIndex >= 0 ? { barcode: normalizeBarcode(row[barcodeIndex]) || null } : {}), ...(availabilityIndex >= 0 ? { availability: parseAvailability(row[availabilityIndex]) } : {}) }]
    } catch (caught) {
      if (!options.inspection) throw caught
      warnings.push({ row: index + 2, itemName: row[nameIndex]?.trim(), message: caught instanceof Error ? caught.message : 'Neispravan redak.' })
      return []
    }
  })
  const validItems = validateItems(items)
  if (!validItems.length && !options.inspection) throw new Error('CSV nema nijedan valjan artikl s nazivom i cijenom.')
  const priceList: NormalizedPriceList = { tenant, source: 'marketino-csv', currency: 'EUR', updatedAt: new Date().toISOString(), items: validItems }
  return { priceList, warnings, sourceRows, rowCount: rows.length - 1 }
}

export class MarketinoCsvAdapter implements PriceSourceAdapter {
  id = 'marketino-csv' as const
  name = 'Marketino CSV'
  constructor(private readonly fixture: string) {}
  async load(input?: unknown) { return parseMarketinoCsv(typeof input === 'string' ? input : this.fixture).priceList }
}
