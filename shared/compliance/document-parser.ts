import { retailPrice } from '../../src/price-engine/nn132'
import { parseXmlItemRecords } from '../../src/price-engine/xml'
import type { NormalizedPriceItem } from '../../src/price-engine/types'
import { usesProductStructure } from '../../src/price-engine/profile'
import { normalizeHeader } from '../../src/price-engine/normalize'

/** Canonical field → value, as found in a published feed row. Empty string means "present but empty". */
export type FeedRecord = Partial<Record<'category' | 'name' | 'type' | 'externalId' | 'price' | 'salePrice' | 'specialSaleApplied' | 'specialSaleName' | 'anchorPrice' | 'unit' | 'brand' | 'barcode' | 'unitPrice' | 'availability' | 'anchorReferenceDate' | 'lowest30DayPrice' | 'isNewSinceReferenceDate' | 'unitPricingExemption' | 'netQuantity' | 'eanBarcode', string>>

export type ParsedFeed = { records: FeedRecord[]; format?: 'csv' | 'xml'; nn132?: boolean }

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
  'naziv usluge': 'name',
  'naziv proizvoda': 'name',
  'naziv robe':'name', 'šifra robe':'externalId','marka robe':'brand','neto količina':'netQuantity','jedinica mjere':'unit','barkod robe':'barcode','ean barkod robe':'eanBarcode',
  vrsta: 'type',
  'interna šifra': 'externalId',
  cijena: 'price',
  'maloprodajna cijena': 'price',
  'akcijska cijena': 'salePrice',
  'poseban oblik prodaje': 'specialSaleApplied',
  'posebni oblik prodaje': 'specialSaleApplied',
  'naziv posebnog oblika prodaje': 'specialSaleName',
  'sidrena cijena': 'anchorPrice',
  'bazna cijena': 'anchorPrice',
  'dodatna cijena': 'anchorPrice',
  'base price': 'anchorPrice',
  jedinica: 'unit',
  marka: 'brand',
  barkod: 'barcode',
  'cijena za jedinicu mjere': 'unitPrice',
  dostupnost: 'availability',
}

/** RFC 4180 style parser (quoted fields, escaped quotes, CRLF/LF, BOM). Throws on an unterminated quote. */
export function parseCsvRows(text: string): string[][] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const delimiter=(source.split(/\r?\n/,1)[0].match(/;/g)?.length??0)>(source.split(/\r?\n/,1)[0].match(/,/g)?.length??0)?';':','
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
    else if (char === delimiter) {
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
  const columns = header.map((name) => CSV_HEADERS[normalizeHeader(name)])
  if (!columns.includes('name') || !columns.includes('price')) throw new Error('CSV nema stupce Naziv i Cijena.')
  const records = rows.slice(1).map((cells) => {
    const record: FeedRecord = {}
    columns.forEach((key, position) => {
      if (key) record[key] = (cells[position] ?? '').trim()
    })
    if (!record.type && header.some(name => normalizeHeader(name) === 'naziv usluge')) record.type = 'Usluga'
    return record
  })
  return { records, format: 'csv', nn132:header.some(name=>normalizeHeader(name)==='bazna cijena')&&header.some(name=>['naziv robe','naziv usluge'].includes(normalizeHeader(name))) }
}

export function parseXmlFeed(text: string): ParsedFeed {
  const records = parseXmlItemRecords(text).map((raw) => {
    const record: FeedRecord = {}
    for (const key of [...FEED_FIELDS.products.xml, 'anchorReferenceDate', 'lowest30DayPrice', 'isNewSinceReferenceDate', 'unitPricingExemption'] as const) record[key] = raw[key.toLowerCase()] ?? raw[key] ?? ''
    if(raw.naziv_robe!==undefined){record.name=raw.naziv_robe;record.type='Proizvod';record.externalId=raw.sifra_robe??'';record.brand=raw.marka_robe??'';record.netQuantity=raw.neto_kolicina??'';record.unit=raw.jedinica_mjere??'';record.price=raw.maloprodajna_cijena??'';record.specialSaleApplied=raw.poseban_oblik_prodaje??raw.posebni_oblik_prodaje??'';record.unitPrice=raw.cijena_za_jedinicu_mjere??'';record.barcode=raw.barkod_robe??'';record.eanBarcode=raw.ean_barkod_robe??'';record.anchorPrice=raw.bazna_cijena??''}
    if (raw.naziv_usluge !== undefined) {
      record.name = raw.naziv_usluge
      record.type ||= 'Usluga'
      record.price = raw.maloprodajna_cijena ?? ''
      record.anchorPrice = raw.bazna_cijena ?? raw.sidrena_cijena ?? raw.dodatna_cijena ?? ''
      record.specialSaleApplied = raw.poseban_oblik_prodaje ?? raw.posebni_oblik_prodaje ?? ''
      record.specialSaleName = raw.naziv_posebnog_oblika_prodaje ?? raw.naziv_posebnog_oblika ?? ''
    }
    return record
  })
  return { records, format: 'xml',nn132:/<cjenik\s+format=["']nn-132-2026["']/.test(text) }
}

export type FeedFidelity = { missing: number; unexpected: number }

// csv.ts prefixes cells starting with = + - @ with an apostrophe against spreadsheet formula injection.
const unprotectFormula = (value: string) => (/^'[=+\-@]/.test(value) ? value.slice(1) : value)
const numericFields = new Set(['price', 'salePrice', 'anchorPrice', 'unitPrice', 'lowest30DayPrice', 'netQuantity'])
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
  const fields = feed.nn132 ? (structure==='services'?['name','price','specialSaleApplied','anchorPrice']:['name','externalId','brand','netQuantity','unit','price','specialSaleApplied','unitPrice','barcode','eanBarcode','anchorPrice']) : [...FEED_FIELDS[structure][feed.format ?? 'csv'], 'anchorReferenceDate', 'lowest30DayPrice', 'isNewSinceReferenceDate', 'unitPricingExemption']
  const keyFor = (item: Record<string, unknown>, fromFeed: boolean) => JSON.stringify(fields.map(field => normalizeField(field, item[field], fromFeed)))
  const counts = new Map<string, number>()
  for (const item of expected) {
    const key = keyFor(feed.nn132?{...item,price:retailPrice(item)}:item, false)
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
