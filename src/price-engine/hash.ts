import type { NormalizedPriceItem, NormalizedPriceList, PriceChange, PriceSnapshot, PublicationMetadata } from './types'

// Optional product fields are only part of the canonical form when present, so hashes of existing publications stay stable.
function productFields(item: NormalizedPriceItem) {
  return {
    ...(item.unitPricingExemption ? { unitPricingExemption: item.unitPricingExemption } : {}),
    ...(item.anchorReferenceDate ? { anchorReferenceDate: item.anchorReferenceDate } : {}),
    ...(item.lowest30DayPrice != null ? { lowest30DayPrice: item.lowest30DayPrice } : {}),
    ...(item.brand ? { brand: item.brand } : {}),
    ...(item.barcode ? { barcode: item.barcode } : {}),
    ...(item.unitPrice != null ? { unitPrice: item.unitPrice } : {}),
    ...(item.availability ? { availability: item.availability } : {}),
  }
}

function canonicalItem(item: NormalizedPriceItem) {
  return { externalId: item.externalId ?? null, category: item.category ?? null, name: item.name, type: item.type ?? null, description: item.description ?? null, price: item.price, anchorPrice: item.anchorPrice ?? null, salePrice: item.salePrice ?? null, unit: item.unit ?? null, ...productFields(item), specialSaleApplied: item.specialSaleApplied ?? null, specialSaleName: item.specialSaleName ?? null, isNewSinceReferenceDate: item.isNewSinceReferenceDate ?? false }
}

export function canonicalize(priceList: NormalizedPriceList): string {
  const items = priceList.items.map(canonicalItem).sort((a, b) => `${a.externalId ?? ''}:${a.category ?? ''}:${a.name}`.localeCompare(`${b.externalId ?? ''}:${b.category ?? ''}:${b.name}`, 'hr-HR'))
  return JSON.stringify({ tenant: priceList.tenant, currency: priceList.currency, items })
}

export async function deterministicHash(priceList: NormalizedPriceList): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalize(priceList))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, '0')).join('')
}

/** Metadata changes also need a new immutable publication, even when prices are unchanged. */
export async function deterministicPublicationHash(priceList: NormalizedPriceList, metadata: PublicationMetadata, publicationDay?: string): Promise<string> {
  const text = JSON.stringify({ content: canonicalize(priceList), objectType: metadata.objectType, objectAddress: metadata.objectAddress, objectCode: metadata.objectCode, timezone: metadata.timezone, ...(publicationDay ? { publicationDay } : {}) })
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map(part => part.toString(16).padStart(2, '0')).join('')
}

export function diffPriceLists(previous: NormalizedPriceList | undefined, current: NormalizedPriceList): PriceChange[] {
  const before = new Map((previous?.items ?? []).map((item) => [item.externalId || `${item.category}:${item.name}`, item]))
  return current.items.flatMap((item) => {
    const old = before.get(item.externalId || `${item.category}:${item.name}`)
    return !old || old.price !== item.price || old.salePrice !== item.salePrice ? [{ name: item.name, category: item.category, before: old?.price, after: item.price }] : []
  })
}

export class SnapshotEngine {
  private snapshots: PriceSnapshot[] = []
  async save(priceList: NormalizedPriceList): Promise<{ snapshot?: PriceSnapshot; changed: boolean }> {
    const hash = await deterministicHash(priceList)
    const latest = this.snapshots.at(-1)
    if (latest?.hash === hash) return { changed: false }
    const snapshot: PriceSnapshot = { id: `${priceList.tenant.id}-${Date.now()}`, tenantId: priceList.tenant.id, source: priceList.source, hash, data: structuredClone(priceList), createdAt: new Date().toISOString(), changedItems: diffPriceLists(latest?.data, priceList) }
    this.snapshots.push(snapshot)
    return { snapshot, changed: true }
  }
  all() { return [...this.snapshots].reverse() }
}
