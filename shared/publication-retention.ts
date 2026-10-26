import type { PricePublication } from '../src/price-engine/types'

/** Expiry cannot cut short the retention of a recently published immutable file. */
export function retentionIsLive(publication: Pick<PricePublication, 'isCurrent' | 'publishedAt' | 'publicUntil'>, now = Date.now()) {
  const until = publication.isCurrent ? new Date(publication.publishedAt).getTime() + 30 * 86_400_000 : Date.parse(publication.publicUntil || '')
  return Number.isFinite(until) && until >= now
}
