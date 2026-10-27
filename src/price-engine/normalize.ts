import type { Availability, NormalizedPriceItem } from './types'

/** Shared CSV/Excel header matching; aliases retain their Croatian spelling. */
export const normalizeHeader = (value: string) => value.replace(/^\uFEFF/, '').trim().toLocaleLowerCase('hr-HR').replace(/[_\s]+/g, ' ')

export function validRequiredPrice(value: number | null | undefined, service: boolean): boolean {
  return value != null && Number.isFinite(value) && (service ? value >= 0 : value > 0)
}

export function normalizeNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  // Accept a currency suffix and locale grouping, never discard arbitrary text.
  const raw = String(value ?? '').trim().replace(/\s*(?:EUR|€)\s*$/i, '').trim().replace(/[\u00a0\u202f]/g, ' ')
  if (!raw) return null
  if (!/^[+-]?(?:\d+(?:[.,]\d+)?|\d{1,3}(?:[., ]\d{3})+(?:[.,]\d{1,2})?)$/.test(raw)) return null
  const compact = raw.replaceAll(' ', '')
  const normalized = compact.includes(',') && compact.includes('.') ? compact.lastIndexOf(',') > compact.lastIndexOf('.') ? compact.replaceAll('.', '').replace(',', '.') : compact.replaceAll(',', '') : compact.replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function validateItems(items: NormalizedPriceItem[]) {
  return items.filter((item) => item.name.trim() && Number.isFinite(item.price))
}

export function normalizeReferenceDate(value: unknown): string | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const localized = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\.?$/.exec(raw)
  const iso = localized ? `${localized[3]}-${localized[2].padStart(2, '0')}-${localized[1].padStart(2, '0')}` : raw
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !Number.isFinite(Date.parse(iso))) return null
  return new Date(iso).toISOString().slice(0, 10) === iso ? iso : null
}

const AVAILABLE = new Set(['dostupno', 'dostupan', 'dostupna', 'da', 'yes', 'true', '1', 'na zalihi', 'available', 'in stock'])
const UNAVAILABLE = new Set(['nedostupno', 'nedostupan', 'nedostupna', 'ne', 'no', 'false', '0', 'nema na zalihi', 'nije dostupno', 'unavailable', 'out of stock'])

/** "dostupno" / "nedostupno" iz uobičajenih oznaka (Excel, ERP izvozi); nepoznato → null. */
export function parseAvailability(value: unknown): Availability | null {
  const normalized = String(value ?? '').trim().toLocaleLowerCase('hr-HR')
  if (!normalized) return null
  if (AVAILABLE.has(normalized)) return 'dostupno'
  if (UNAVAILABLE.has(normalized)) return 'nedostupno'
  return null
}

/** Barkod kao tekst bez razmaka; vraća prazan string ako nema vrijednosti. Ne mijenja znamenke. */
export function normalizeBarcode(value: unknown): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(Math.trunc(value)) : ''
  return String(value ?? '').replace(/^\uFEFF/, '').replace(/\s+/g, '').trim()
}

/** GS1 kontrolna znamenka za EAN-8, UPC-A (12), EAN-13 i GTIN-14. */
export function isValidGtin(barcode: string): boolean {
  if (!/^\d+$/.test(barcode) || ![8, 12, 13, 14].includes(barcode.length)) return false
  const digits = barcode.split('').map(Number)
  const check = digits.pop() as number
  const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}
