import type { NormalizedPriceItem, NormalizedPriceList, PriceChange, PriceSnapshot } from './types'

function canonicalItem(item: NormalizedPriceItem) {
  return { externalId: item.externalId ?? null, category: item.category ?? null, name: item.name, type: item.type ?? null, description: item.description ?? null, price: item.price, anchorPrice: item.anchorPrice ?? null, salePrice: item.salePrice ?? null, unit: item.unit ?? null, specialSaleApplied: item.specialSaleApplied ?? null, specialSaleName: item.specialSaleName ?? null, isNewSinceReferenceDate: item.isNewSinceReferenceDate ?? false }
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
