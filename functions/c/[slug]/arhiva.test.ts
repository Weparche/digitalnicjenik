import { describe, expect, it, vi } from 'vitest'
import { onRequestGet } from './arhiva'

describe('/c/:slug/arhiva', () => {
  it('serves the pristine app-shell for browser navigation, not the prerendered Landing markup', async () => {
    const fetchAsset = vi.fn(async () => new Response('shell'))
    await onRequestGet({
      request: new Request('https://digitalnicjenik.nepar.hr/c/demo/arhiva'),
      params: { slug: 'demo' },
      env: { ASSETS: { fetch: fetchAsset } },
    })

    expect(fetchAsset).toHaveBeenCalledTimes(1)
    const requestedUrl = fetchAsset.mock.calls[0][0] as URL
    expect(requestedUrl.pathname).toBe('/app-shell.html')
  })
})
