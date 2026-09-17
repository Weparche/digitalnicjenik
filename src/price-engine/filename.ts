import type { PublicationMetadata } from './types'

const transliteration: Record<string, string> = { č: 'c', ć: 'c', đ: 'd', š: 's', ž: 'z', Č: 'c', Ć: 'c', Đ: 'd', Š: 's', Ž: 'z' }

export function sanitizeFilenamePart(value: string, fallback = 'objekt') {
  const transliterated = Array.from(value.normalize('NFKD').replace(/\p{M}/gu, '')).map((character) => transliteration[character] ?? character).join('')
  const safe = transliterated.replace(/[\u0000-\u001F\u007F]/g, '').replace(/[\\/]+/g, '-').replace(/\.\.+/g, '-').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLocaleLowerCase('en-US')
  return safe || fallback
}

export function filenameTimestamp(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}${values.month}${values.day}-${values.hour}${values.minute}${values.second}`
}

export function createFilenameStem(metadata: Pick<PublicationMetadata, 'objectType' | 'objectAddress' | 'objectCode' | 'timezone'>, sequence: number, publishedAt: Date) {
  return `${createFilenameStemPrefix(metadata, publishedAt)}_${sequence}_${filenameTimestamp(publishedAt, metadata.timezone || 'Europe/Zagreb')}`
}

export function createFilenameStemPrefix(metadata: Pick<PublicationMetadata, 'objectType' | 'objectAddress' | 'objectCode'>, _publishedAt?: Date) {
  return [sanitizeFilenamePart(metadata.objectType, 'objekt'), sanitizeFilenamePart(metadata.objectAddress, 'adresa'), sanitizeFilenamePart(metadata.objectCode, 'oznaka')].join('_')
}

export const filenameFor = (stem: string, extension: 'csv' | 'xml') => `${stem}.${extension}`
