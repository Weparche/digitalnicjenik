export function adminEmailAllowed(env: { ADMIN_EMAILS?: string }, email: string) {
  return (env.ADMIN_EMAILS ?? '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean).includes(email.trim().toLowerCase())
}

/** Only our two authenticated surfaces and known selectors may survive login. */
export function safeReturnPath(input: unknown) {
  if (typeof input !== 'string' || input.length > 512 || !input.startsWith('/') || input.startsWith('//')) return '/app'
  try {
    const url = new URL(input, 'https://nepar.invalid')
    if (url.origin !== 'https://nepar.invalid' || !['/app', '/admin'].includes(url.pathname)) return '/app'
    const safe = new URLSearchParams()
    for (const key of ['tab', 'order', 'tenant', 'renew']) {
      const value = url.searchParams.get(key)
      if (value && /^[a-zA-Z0-9_-]{1,80}$/.test(value)) safe.set(key, value)
    }
    return url.pathname + (safe.size ? '?' + safe.toString() : '')
  } catch { return '/app' }
}
