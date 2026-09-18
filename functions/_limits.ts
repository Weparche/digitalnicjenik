import type { NormalizedPriceItem, NormalizedPriceList } from '../src/price-engine/types'

export const MAX_WRITE_REQUEST_BYTES = 2_200_000
export const MAX_PRICE_LIST_ITEMS = 5_000
export const MAX_ITEM_STRING_LENGTH = 500
export const MAX_SOURCE_FILENAME_LENGTH = 240
export const MAX_SOURCE_ARTIFACT_BYTES = 1_000_000

export class PayloadTooLargeError extends Error {
  readonly status = 413
  constructor(message: string) {
    super(message)
    this.name = 'PayloadTooLargeError'
  }
}

export class ValidationInputError extends Error {
  readonly status = 400
  constructor(message: string) {
    super(message)
    this.name = 'ValidationInputError'
  }
}

export async function readJsonBody(request: Request, maxBytes = MAX_WRITE_REQUEST_BYTES): Promise<unknown> {
  const contentLength = Number(request.headers.get('content-length') || 0)
  if (Number.isFinite(contentLength) && contentLength > maxBytes) throw new PayloadTooLargeError('Zahtjev je prevelik.')
  const raw = await request.text()
  if (new TextEncoder().encode(raw).byteLength > maxBytes) throw new PayloadTooLargeError('Zahtjev je prevelik.')
  try {
    return JSON.parse(raw) as unknown
  } catch {
    throw new ValidationInputError('JSON tijelo zahtjeva nije valjano.')
  }
}

function clipString(value: unknown, field: string, max = MAX_ITEM_STRING_LENGTH): string | undefined {
  if (value == null) return undefined
  if (typeof value !== 'string') throw new ValidationInputError(`Polje ${field} mora biti tekst.`)
  if (value.length > max) throw new PayloadTooLargeError(`Polje ${field} je predugačko.`)
  return value
}

function normalizeItem(raw: unknown, index: number): NormalizedPriceItem {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ValidationInputError(`Stavka ${index + 1} nije valjan objekt.`)
  const item = raw as Record<string, unknown>
  const name = clipString(item.name, `items[${index}].name`)
  if (!name?.trim()) throw new ValidationInputError(`Stavka ${index + 1} nema naziv.`)
  if (typeof item.price !== 'number' || !Number.isFinite(item.price)) throw new ValidationInputError(`Stavka ${index + 1} nema valjanu cijenu.`)
  return {
    name: name.trim(),
    price: item.price,
    externalId: clipString(item.externalId, `items[${index}].externalId`) || undefined,
    category: clipString(item.category, `items[${index}].category`) || undefined,
    type: clipString(item.type, `items[${index}].type`) || undefined,
    description: clipString(item.description, `items[${index}].description`, 2_000) || undefined,
    unit: clipString(item.unit, `items[${index}].unit`) ?? null,
    specialSaleName: clipString(item.specialSaleName, `items[${index}].specialSaleName`) ?? null,
    anchorPrice: typeof item.anchorPrice === 'number' && Number.isFinite(item.anchorPrice) ? item.anchorPrice : item.anchorPrice === null ? null : undefined,
    salePrice: typeof item.salePrice === 'number' && Number.isFinite(item.salePrice) ? item.salePrice : item.salePrice === null ? null : undefined,
    specialSaleApplied: typeof item.specialSaleApplied === 'boolean' ? item.specialSaleApplied : item.specialSaleApplied === null ? null : undefined,
    isNewSinceReferenceDate: item.isNewSinceReferenceDate === true,
  }
}

export type PriceListInput = {
  items: NormalizedPriceItem[]
  currency?: string
  updatedAt?: string
  source?: string
}

export function parsePriceListInput(value: unknown): PriceListInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationInputError('priceList mora biti objekt.')
  const body = value as Record<string, unknown>
  if (!Array.isArray(body.items)) throw new ValidationInputError('priceList.items mora biti polje.')
  if (body.items.length > MAX_PRICE_LIST_ITEMS) throw new PayloadTooLargeError(`Cjenik smije imati najviše ${MAX_PRICE_LIST_ITEMS} stavki.`)
  if (!body.items.length) throw new ValidationInputError('Cjenik mora sadržavati barem jednu stavku.')
  return {
    items: body.items.map((item, index) => normalizeItem(item, index)),
    currency: typeof body.currency === 'string' ? body.currency : undefined,
    updatedAt: typeof body.updatedAt === 'string' ? body.updatedAt : undefined,
    source: typeof body.source === 'string' ? body.source : undefined,
  }
}

export function attachCanonicalTenant(input: PriceListInput, tenant: { id: string; slug: string; name: string }): NormalizedPriceList {
  return {
    tenant,
    source: input.source === 'marketino-api' || input.source === 'nepar' || input.source === 'marketino-csv' ? input.source : 'marketino-csv',
    currency: 'EUR',
    updatedAt: input.updatedAt && !Number.isNaN(Date.parse(input.updatedAt)) ? input.updatedAt : new Date().toISOString(),
    items: input.items,
  }
}

export function assertSourceArtifactSize(value: string | undefined) {
  if (value == null) return
  if (new TextEncoder().encode(value).byteLength > MAX_SOURCE_ARTIFACT_BYTES) {
    throw new PayloadTooLargeError(`sourceArtifact smije imati najviše ${MAX_SOURCE_ARTIFACT_BYTES} bajtova.`)
  }
}

export function sanitizeSourceFilename(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return 'upload'
  return value.replace(/[\u0000-\u001f\u007f]/g, '').split(/[\\/]/).pop()!.slice(0, MAX_SOURCE_FILENAME_LENGTH) || 'upload'
}

export function errorStatus(error: unknown, fallback = 422) {
  if (error instanceof PayloadTooLargeError || error instanceof ValidationInputError) return error.status
  return fallback
}
