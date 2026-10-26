import {
  ACQUISITION_STORAGE_KEY,
  resolveFirstTouch,
  touchFromSearch,
  urlWithoutCampaignParams,
  type AcquisitionTouch,
} from '../shared/acquisition'

function readStored(storage: Storage | undefined) {
  if (!storage) return null
  try {
    const raw = storage.getItem(ACQUISITION_STORAGE_KEY)
    return raw ? JSON.parse(raw) as unknown : null
  } catch {
    return null
  }
}

function writeStored(storage: Storage | undefined, touch: AcquisitionTouch) {
  if (!storage) return false
  try {
    storage.setItem(ACQUISITION_STORAGE_KEY, JSON.stringify(touch))
    return true
  } catch {
    return false
  }
}

/** Read the saved first touch. Returns null when nothing valid is stored. */
export function readAcquisitionTouch(): AcquisitionTouch | null {
  if (typeof window === 'undefined') return null
  const decision = resolveFirstTouch(readStored(window.localStorage) || readStored(window.sessionStorage), null, Date.now())
  return decision.touch
}

/**
 * Save the first campaign touch, then drop only utm_* from the address bar.
 * A later campaign does not replace a touch younger than 90 days.
 * Other query parameters stay. The page is not reloaded.
 */
export function captureFirstTouch(target: Window = window) {
  const existing = readStored(target.localStorage) || readStored(target.sessionStorage)
  const now = new Date()
  const incoming = touchFromSearch({
    search: target.location.search,
    referrer: target.document.referrer,
    pathname: target.location.pathname,
    nowIso: now.toISOString(),
    attributionId: crypto.randomUUID(),
  })
  const decision = resolveFirstTouch(existing, incoming, now.getTime())
  if (!decision.touch) return null

  const alreadySaved = resolveFirstTouch(existing, null, now.getTime()).touch?.attribution_id === decision.touch.attribution_id
  const saved = alreadySaved || writeStored(target.localStorage, decision.touch) || writeStored(target.sessionStorage, decision.touch)
  if (!saved) return null
  writeStored(target.localStorage, decision.touch)
  writeStored(target.sessionStorage, decision.touch)

  if (decision.strip) {
    const next = urlWithoutCampaignParams(`${target.location.pathname}${target.location.search}${target.location.hash}`)
    const current = `${target.location.pathname}${target.location.search}${target.location.hash}`
    if (next !== current) target.history.replaceState(target.history.state, '', next)
  }
  return decision.touch
}
