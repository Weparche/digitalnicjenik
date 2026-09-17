import { normalizeNumber, validateItems } from '../normalize'
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
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}

const cleanHeader = (header: string) => header.replace(/^\uFEFF/, '').trim().toLocaleLowerCase('hr-HR')
const findColumn = (headers: string[], ...names: string[]) => headers.findIndex((header) => names.includes(cleanHeader(header)))
const booleanValue = (value: string | undefined): boolean | null => {
  const normalized = value?.trim().toLocaleLowerCase('hr-HR')
  if (!normalized) return null
  if (['da', 'yes', 'true', '1'].includes(normalized)) return true
  if (['ne', 'no', 'false', '0'].includes(normalized)) return false
  return null
}

export function parseMarketinoCsv(csv: string, tenant = { id: 'marketino-demo', slug: 'marketino-demo', name: 'Marketino demo' }): ParseResult {
  const firstLine = csv.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? ''
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows = splitCsv(csv.replace(/^\uFEFF/, ''), delimiter)
  if (!rows.length) throw new Error('CSV je prazan. Izvezite cjenik s barem jednim artiklom.')
  const headers = rows[0]
  const groupIndex = findColumn(headers, 'grupa*', 'grupa', 'kategorija', 'category')
  const nameIndex = findColumn(headers, 'naziv*', 'naziv', 'name', 'usluga')
  const typeIndex = findColumn(headers, 'vrsta*', 'vrsta', 'type')
  const idIndex = findColumn(headers, 'interna šifra', 'interna sifra', 'šifra', 'sifra', 'id')
  const priceIndex = findColumn(headers, 'cijena*', 'cijena', 'cena', 'price')
  const saleIndex = findColumn(headers, 'akcijska cijena', 'akcijska cijena*', 'akcija', 'sale price')
  const anchorIndex = findColumn(headers, 'sidrena cijena', 'sidrena cijena*', 'dodatna cijena', 'anchor price', 'reference price')
  const specialSaleAppliedIndex = findColumn(headers, 'poseban oblik prodaje', 'posebni oblik prodaje', 'special sale applied')
  const specialSaleNameIndex = findColumn(headers, 'naziv posebnog oblika prodaje', 'poseban oblik prodaje naziv', 'special sale name')
  if (nameIndex < 0 || priceIndex < 0) throw new Error('Nisu pronađeni obavezni stupci “Naziv*” i “Cijena*”. Provjerite da je ovo Marketino CSV export.')
  const warnings: ParseResult['warnings'] = []
  const items = rows.slice(1).flatMap((row, index) => {
    const name = row[nameIndex]?.trim() ?? ''; const price = normalizeNumber(row[priceIndex]);
    if (!name && !row.some(Boolean)) return []
    if (!name || price == null) { warnings.push({ row: index + 2, message: !name ? 'Nedostaje naziv.' : 'Cijena nije broj — redak je preskočen.' }); return [] }
    const salePrice = saleIndex >= 0 ? normalizeNumber(row[saleIndex]) : null
    const rawType = row[typeIndex]?.trim() || ''
    const type = rawType === '2' ? 'Usluga' : rawType || undefined
    return [{ externalId: row[idIndex]?.trim() || undefined, category: row[groupIndex]?.trim() || undefined, name, type, price, salePrice, anchorPrice: anchorIndex >= 0 ? normalizeNumber(row[anchorIndex]) : null, specialSaleApplied: specialSaleAppliedIndex >= 0 ? booleanValue(row[specialSaleAppliedIndex]) : salePrice == null ? false : null, specialSaleName: specialSaleNameIndex >= 0 ? row[specialSaleNameIndex]?.trim() || null : null }]
  })
  const validItems = validateItems(items)
  if (!validItems.length) throw new Error('CSV nema nijedan valjan artikl s nazivom i cijenom.')
  const priceList: NormalizedPriceList = { tenant, source: 'marketino-csv', currency: 'EUR', updatedAt: new Date().toISOString(), items: validItems }
  return { priceList, warnings }
}

export class MarketinoCsvAdapter implements PriceSourceAdapter {
  id = 'marketino-csv' as const
  name = 'Marketino CSV'
  constructor(private readonly fixture: string) {}
  async load(input?: unknown) { return parseMarketinoCsv(typeof input === 'string' ? input : this.fixture).priceList }
}
