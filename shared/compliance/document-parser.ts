import { parseXmlItemRecords } from '../../src/price-engine/xml'
import type { NormalizedPriceItem } from '../../src/price-engine/types'
import { usesProductStructure } from '../../src/price-engine/profile'

/** Canonical field → value, as found in a published feed row. Empty string means "present but empty". */
export type FeedRecord = Partial<Record<'category' | 'name' | 'type' | 'externalId' | 'price' | 'salePrice' | 'specialSaleApplied' | 'specialSaleName' | 'anchorPrice' | 'unit' | 'brand' | 'barcode' | 'unitPrice' | 'availability' | 'anchorReferenceDate' | 'lowest30DayPrice' | 'isNewSinceReferenceDate' | 'unitPricingExemption', string>>

export type ParsedFeed = { records: FeedRecord[]; format?: 'csv' | 'xml' }

/** Fields each renderer actually carries (see src/price-engine/csv.ts and xml.ts). */
export type FeedStructure = 'services' | 'products'

/** Fields each renderer carries, per list structure (see src/price-engine/csv.ts, xml.ts and profile.ts). */
export const FEED_FIELDS = {
  services: {
    csv: ['category', 'name', 'type', 'externalId', 'price', 'salePrice', 'specialSaleApplied', 'specialSaleName', 'anchorPrice', 'unit'],
    xml: ['category', 'name', 'type', 'price', 'salePrice', 'specialSaleApplied', 'specialSaleName', 'anchorPrice'],
  },
  products: {
    csv: ['category', 'name', 'type', 'externalId', 'price', 'salePrice', 'specialSaleApplied', 'specialSaleName', 'anchorPrice', 'unit', 'brand', 'barcode', 'unitPrice', 'availability'],
    xml: ['category', 'name', 'type', 'externalId', 'brand', 'barcode', 'unit', 'unitPrice', 'availability', 'price', 'salePrice', 'specialSaleApplied', 'specialSaleName', 'anchorPrice'],
  },
} as const

const CSV_HEADERS: Record<string, keyof FeedRecord> = {
  'datum referentne cijene': 'anchorReferenceDate',
  'najniža cijena u 30 dana': 'lowest30DayPrice',
  'nova stavka': 'isNewSinceReferenceDate',
  'razlog izuzeća cijene po jedinici': 'unitPricingExemption',
  grupa: 'category',
  naziv: 'name',
  vrsta: 'type',
  'interna šifra': 'externalId',
  cijena: 'price',
  'akcijska cijena': 'salePrice',
  'poseban oblik prodaje': 'specialSaleApplied',
  'naziv posebnog oblika prodaje': 'specialSaleName',
  'sidrena cijena': 'anchorPrice',
  jedinica: 'unit',
  marka: 'brand',
  barkod: 'barcode',
  'cijena za jedinicu mjere': 'unitPrice',
  dostupnost: 'availability',
}

/** RFC 4180 style parser (quoted fields, escaped quotes, CRLF/LF, BOM). Throws on an unterminated quote. */
export function parseCsvRows(text: string): string[][] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let index = 0
  while (index < source.length) {
    const char = source[index]!
    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"'
          index += 1
        } else inQuotes = false
      } else field += char
    } else if (char === '"' && field === '') inQuotes = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && source[index + 1] === '\n') index += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += char
    index += 1
  }
  if (inQuotes) throw new Error('CSV nije ispravan: nezatvoreni navodnik.')
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((candidate) => candidate.some((value) => value !== ''))
}

export function parseCsvFeed(text: string): ParsedFeed {
  const rows = parseCsvRows(text)
  const header = rows[0]
  if (!header) throw new Error('CSV je prazan.')
  const columns = header.map((name) => CSV_HEADERS[name.trim().toLocaleLowerCase('hr-HR')])
  if (!columns.includes('name') || !columns.includes('price')) throw new Error('CSV nema stupce Naziv i Cijena.')
  const records = rows.slice(1).map((cells) => {
    const record: FeedRecord = {}
    columns.forEach((key, position) => {
      if (key) record[key] = (cells[position] ?? '').trim()
    })
    return record
  })
  return { records, format: 'csv' }
}

export function parseXmlFeed(text: string): ParsedFeed {
  const records = parseXmlItemRecords(text).map((raw) => {
    const record: FeedRecord = {}
    for (const key of [...FEED_FIELDS.products.xml, 'anchorReferenceDate', 'lowest30DayPrice', 'isNewSinceReferenceDate', 'unitPricingExemption'] as const) record[key] = raw[key.toLowerCase()] ?? raw[key] ?? ''
    return record
  })
  return { records, format: 'xml' }
}

export type FeedFidelity = { missing: number; unexpected: number }

// csv.ts prefixes cells starting with = + - @ with an apostrophe against spreadsheet formula injection.
const unprotectFormula = (value: string) => (/^'[=+\-@]/.test(value) ? value.slice(1) : value)
const numericFields = new Set(['price', 'salePrice', 'anchorPrice', 'unitPrice', 'lowest30DayPrice'])
function normalizeField(field: string, value: unknown, fromFeed: boolean): string {
  if (field === 'isNewSinceReferenceDate') return /^(true|da|1)$/i.test(String(value)) ? 'true' : 'false'
  if (value == null || value === '') return ''
  if (numericFields.has(field)) {
    const number = Number(String(value).replace(',', '.'))
    return Number.isFinite(number) ? number.toFixed(2) : 'INVALID_NUMBER'
  }
  if (field === 'specialSaleApplied') return /^(true|da|1)$/i.test(String(value)) ? 'true' : /^(false|ne|0)$/i.test(String(value)) ? 'false' : 'INVALID_FLAG'
  const text = String(value).trim()
  return fromFeed ? unprotectFormula(text) : text
}

/** Compare every field carried by the renderer, preserving duplicate rows. */
export function compareFeedToPayload(
  expected: NormalizedPriceItem[],
  feed: ParsedFeed,
): FeedFidelity {
  const structure = usesProductStructure({ items: expected }) ? 'products' : 'services'
  const fields = [...FEED_FIELDS[structure][feed.format ?? 'csv'], 'anchorReferenceDate', 'lowest30DayPrice', 'isNewSinceReferenceDate', 'unitPricingExemption'] as const
  const keyFor = (item: Record<string, unknown>, fromFeed: boolean) => JSON.stringify(fields.map(field => normalizeField(field, item[field], fromFeed)))
  const counts = new Map<string, number>()
  for (const item of expected) {
    const key = keyFor(item, false)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let unexpected = 0
  for (const record of feed.records) {
    const key = keyFor(record, true)
    const left = counts.get(key) ?? 0
    if (left > 0) counts.set(key, left - 1)
    else unexpected += 1
  }
  let missing = 0
  for (const left of counts.values()) missing += left
  return { missing, unexpected }
}

export async function sha256Hex(value: string | Uint8Array) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource)
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, '0')).join('')
}
