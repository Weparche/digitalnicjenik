import type { NormalizedPriceItem } from './types'

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
