/**
 * Anonymous pageviews for the nepar.hr/admin dashboard. Paths are sent with a /digitalnicjenik
 * prefix so the admin shows this site as its own property, next to nepar.hr and NEPAR Kids.
 * No visitor id, no owner flag, nothing about the publisher or their price list.
 */

const ENDPOINT = 'https://nepar.hr/analytics/pageview'
const PATH_PREFIX = '/digitalnicjenik'
const TRACKED_HOST = 'digitalnicjenik.nepar.hr'
const PRIVATE_PREFIXES = ['/admin', '/app']
const ATTRIBUTION_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const

let lastTrackedPath = ''
let scheduled: number | undefined
// Read before captureFirstTouch() strips utm_* from the address bar.
let firstAttribution: Record<string, string> | null = null

function clean(value: string | null | undefined, maxLength = 160) {
  // eslint-disable-next-line no-control-regex
  return (value ?? '').trim().replace(/[\u0000-\u001f\u007f-\u009f]/g, '').slice(0, maxLength)
}

function publicPath(pathname: string) {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`
  if (PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return ''
  return path.slice(0, 480) || '/'
}

function deviceType(): 'desktop' | 'mobile' | 'tablet' {
  const ua = navigator.userAgent || ''
  const width = window.innerWidth || window.screen?.width || 0
  if (/ipad|tablet|kindle|playbook/i.test(ua) || (width >= 768 && width <= 1024 && /mobile/i.test(ua))) return 'tablet'
  if (/mobi|android|iphone|ipod|blackberry|iemobile/i.test(ua) || width < 768) return 'mobile'
  return 'desktop'
}

function attributionFor(search: string, landingPath: string) {
  const params = new URLSearchParams(search)
  const attribution: Record<string, string> = { landing_path: landingPath }
  for (const key of ATTRIBUTION_KEYS) {
    const value = clean(params.get(key))
    if (value) attribution[key] = value
  }
  return attribution
}

function sendPageView() {
  const path = publicPath(window.location.pathname)
  if (!path || path === lastTrackedPath) return
  lastTrackedPath = path

  const attribution = firstAttribution ?? attributionFor(window.location.search, path)
  firstAttribution = null
  const payload = JSON.stringify({
    path: `${PATH_PREFIX}${path}`,
    title: clean(document.title),
    referrer: clean(document.referrer, 240),
    language: clean(navigator.language, 40),
    screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
    ownerDevice: false,
    visitorId: '',
    device: deviceType(),
    attribution,
  })

  try {
    // text/plain keeps this a simple cross-origin request: no preflight, no CORS dependency.
    const body = new Blob([payload], { type: 'text/plain;charset=UTF-8' })
    if (navigator.sendBeacon?.(ENDPOINT, body)) return
    void fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', body, keepalive: true }).catch(() => undefined)
  } catch {
    // Analytics must never break the page.
  }
}

function schedulePageView() {
  if (scheduled !== undefined) window.clearTimeout(scheduled)
  // Give the page a moment to set its document.title.
  scheduled = window.setTimeout(() => {
    scheduled = undefined
    sendPageView()
  }, 100)
}

/** Call before captureFirstTouch() so the first pageview still sees the utm_* parameters. */
export function startPageAnalytics(target: Window = window) {
  if (target.location.hostname !== TRACKED_HOST) return
  firstAttribution = attributionFor(target.location.search, publicPath(target.location.pathname) || '/')
  target.addEventListener('popstate', schedulePageView)
  schedulePageView()
}
