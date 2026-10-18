import type { Availability, NormalizedPriceItem } from './types'

export function normalizeNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const raw = String(value ?? '').trim().replace(/[^0-9,.-]/g, '')
  if (!raw) return null
  const normalized = raw.includes(',') && raw.includes('.') ? raw.lastIndexOf(',') > raw.lastIndexOf('.') ? raw.replaceAll('.', '').replace(',', '.') : raw.replaceAll(',', '') : raw.replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function validateItems(items: NormalizedPriceItem[]) {
  return items.filter((item) => item.name.trim() && Number.isFinite(item.price))
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
