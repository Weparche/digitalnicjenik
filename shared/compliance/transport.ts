export const MAX_FEED_BYTES = 5_000_000

export async function readLimitedBytes(response: Response): Promise<Uint8Array> {
  const oversized = () => new Error('Datoteka prelazi ograničenje od 5 MB.')
  if (Number(response.headers.get('content-length')) > MAX_FEED_BYTES) {
    await response.body?.cancel()
    throw oversized()
  }
  const reader = response.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > MAX_FEED_BYTES) { await reader.cancel(); throw oversized() }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const result = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength }
  return result
}

/** Count every redirect, not only top-level fetch calls. Leave room for platform I/O. */
export function budgetedFetch(fetcher: typeof fetch = fetch) {
  const budget = { remaining: 40 }
  const bounded: typeof fetch = async (input, init) => {
    let url = String(input)
    for (let redirect = 0; redirect <= 5; redirect++) {
      if (--budget.remaining < 0) throw new Error('monitor_fetch_budget_exhausted')
      const response = await fetcher(url, { ...init, redirect: 'manual' })
      if (![301, 302, 303, 307, 308].includes(response.status)) return response
      const location = response.headers.get('location')
      await response.body?.cancel()
      if (!location || redirect === 5) throw new Error('monitor_invalid_redirect')
      const next = new URL(location, url)
      if (next.protocol !== 'https:' || next.username || next.password) throw new Error('monitor_invalid_redirect')
      url = next.href
    }
    throw new Error('monitor_invalid_redirect')
  }
  return { fetcher: bounded, budget }
}
