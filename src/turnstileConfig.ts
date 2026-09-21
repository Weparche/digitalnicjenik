import { useEffect, useState } from 'react'

const BUILD_TIME_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() || ''

export function useTurnstileSiteKey(): { siteKey: string; loading: boolean } {
  const [siteKey, setSiteKey] = useState(BUILD_TIME_SITE_KEY)
  const [loading, setLoading] = useState(!BUILD_TIME_SITE_KEY)

  useEffect(() => {
    if (BUILD_TIME_SITE_KEY) return
    let cancelled = false
    void fetch('/api/public-config')
      .then(async (response) => (response.ok ? (await response.json()) as { turnstileSiteKey?: string } : null))
      .then((payload) => {
        if (cancelled) return
        setSiteKey(payload?.turnstileSiteKey?.trim() || '')
      })
      .catch(() => {
        if (!cancelled) setSiteKey('')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { siteKey, loading }
}
