/** First-touch campaign data. Invalid fields are dropped; a bad touch never blocks the product flow. */

export const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const
export const FIRST_TOUCH_MS = 90 * 24 * 60 * 60 * 1000
export const ACQUISITION_STORAGE_KEY = 'nepar-acquisition-v1'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type AcquisitionTouch = {
  attribution_id: string
  utm_source: string
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  referrer_host: string | null
  landing_path: string | null
  first_seen: string
}

function utmField(value: unknown, max: number) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!new RegExp(`^[a-z0-9._-]{1,${max}}$`).test(normalized)) return null
  return normalized
}

export function referrerHost(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 300) return null
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
  if (!hasScheme && /[/?#\s]/.test(trimmed)) return null
  try {
    const host = new URL(hasScheme ? trimmed : `https://${trimmed}`).hostname.toLowerCase()
    if (!host || host.length > 253 || !/^[a-z0-9.-]+$/.test(host) || host.includes('..') || host.startsWith('.') || host.endsWith('.')) return null
    return host
  } catch {
    return null
  }
}

export function landingPath(value: unknown) {
  if (typeof value !== 'string') return null
  const path = value.trim()
  if (!path.startsWith('/') || path.includes('?') || path.includes('#') || path.includes('\\') || path.length > 240) return null
  return path
}

function isoTimestamp(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return null
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return null
  return new Date(parsed).toISOString()
}

export function sanitizeAttribution(input: unknown): AcquisitionTouch | null {
  if (!input || typeof input !== 'object') return null
  const record = input as Record<string, unknown>
  const attributionId = typeof record.attribution_id === 'string' ? record.attribution_id.trim().toLowerCase() : ''
  const source = utmField(record.utm_source, 80)
  const firstSeen = isoTimestamp(record.first_seen)
  if (!UUID.test(attributionId) || !source || !firstSeen) return null
  return {
    attribution_id: attributionId,
    utm_source: source,
    utm_medium: utmField(record.utm_medium, 40),
    utm_campaign: utmField(record.utm_campaign, 80),
    utm_content: utmField(record.utm_content, 80),
    referrer_host: referrerHost(record.referrer_host),
    landing_path: landingPath(record.landing_path),
    first_seen: firstSeen,
  }
}

export function isFreshTouch(touch: AcquisitionTouch, nowMs: number) {
  const seen = Date.parse(touch.first_seen)
  return Number.isFinite(seen) && nowMs >= seen && nowMs - seen < FIRST_TOUCH_MS
}

/** Keep the first saved touch for 90 days. A later campaign does not replace it. */
export function resolveFirstTouch(existingRaw: unknown, incomingRaw: unknown, nowMs: number) {
  const existing = sanitizeAttribution(existingRaw)
  const incoming = sanitizeAttribution(incomingRaw)
  if (existing && isFreshTouch(existing, nowMs)) {
    return { touch: existing, strip: Boolean(incoming) }
  }
  if (incoming && isFreshTouch(incoming, nowMs)) {
    return { touch: incoming, strip: true }
  }
  return { touch: null as AcquisitionTouch | null, strip: false }
}

export function urlWithoutCampaignParams(href: string) {
  const url = new URL(href, 'https://digitalnicjenik.nepar.hr')
  for (const key of UTM_PARAMS) url.searchParams.delete(key)
  const query = url.searchParams.toString()
  return `${url.pathname}${query ? `?${query}` : ''}${url.hash}`
}

export function touchFromSearch(input: {
  search: string
  referrer: string
  pathname: string
  nowIso: string
  attributionId: string
}): AcquisitionTouch | null {
  const params = new URLSearchParams(input.search)
  if (!UTM_PARAMS.some((key) => params.has(key))) return null
  return sanitizeAttribution({
    attribution_id: input.attributionId,
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    utm_content: params.get('utm_content'),
    referrer_host: input.referrer,
    landing_path: input.pathname,
    first_seen: input.nowIso,
  })
}
