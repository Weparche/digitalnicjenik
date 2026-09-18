import { describe, expect, it, vi } from 'vitest'
import { onRequestGet } from './arhiva'

describe('/arhiva', () => {
  it('serves the pristine app-shell, not the prerendered Landing markup', async () => {
    const fetchAsset = vi.fn(async () => new Response('shell'))
    await onRequestGet({
      request: new Request('https://digitalnicjenik.nepar.hr/arhiva'),
      env: { ASSETS: { fetch: fetchAsset } },
    })

    expect(fetchAsset).toHaveBeenCalledTimes(1)
    const requestedUrl = fetchAsset.mock.calls[0][0] as URL
    expect(requestedUrl.pathname).toBe('/app-shell.html')
  })

  it('404s when the ASSETS binding is unavailable', async () => {
    const response = await onRequestGet({
      request: new Request('https://digitalnicjenik.nepar.hr/arhiva'),
      env: {},
    })
    expect(response.status).toBe(404)
  })
})
