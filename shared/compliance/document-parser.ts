import { parseXmlItemRecords } from '../../src/price-engine/xml'

/** Canonical field → value, as found in a published feed row. Empty string means "present but empty". */
export type FeedRecord = Partial<Record<'category' | 'name' | 'type' | 'externalId' | 'price' | 'salePrice' | 'specialSaleApplied' | 'specialSaleName' | 'anchorPrice' | 'unit', string>>

export type ParsedFeed = { records: FeedRecord[] }

/** Fields each renderer actually carries (see src/price-engine/csv.ts and xml.ts). */
export const FEED_FIELDS = {
  csv: ['category', 'name', 'type', 'externalId', 'price', 'salePrice', 'specialSaleApplied', 'specialSaleName', 'anchorPrice', 'unit'],
  xml: ['category', 'name', 'type', 'price', 'salePrice', 'specialSaleApplied', 'specialSaleName', 'anchorPrice'],
} as const

const CSV_HEADERS: Record<string, keyof FeedRecord> = {
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
  return { records }
}

export function parseXmlFeed(text: string): ParsedFeed {
  const records = parseXmlItemRecords(text).map((raw) => {
    const record: FeedRecord = {}
    for (const key of FEED_FIELDS.xml) record[key] = raw[key.toLowerCase()] ?? raw[key] ?? ''
    return record
  })
  return { records }
}

export type FeedFidelity = { missing: number; unexpected: number }

// csv.ts prefixes cells starting with = + - @ with an apostrophe against spreadsheet formula injection.
const unprotectFormula = (value: string) => (/^'[=+\-@]/.test(value) ? value.slice(1) : value)
const toKey = (name: string, price: string) => `${name.trim()}\u0000${Number.parseFloat(price.replace(',', '.')).toFixed(2)}`

/** Compares (name, price) multisets between the published payload and a rendered feed. */
export function compareFeedToPayload(
  expected: Array<{ name: string; price: number }>,
  feed: ParsedFeed,
): FeedFidelity {
  const counts = new Map<string, number>()
  for (const item of expected) {
    const key = toKey(item.name, String(item.price))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let unexpected = 0
  for (const record of feed.records) {
    const key = toKey(unprotectFormula(record.name ?? ''), record.price ?? '')
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
