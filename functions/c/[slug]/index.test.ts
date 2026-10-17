import { describe, expect, it } from 'vitest'
import { onRequestGet } from './index'

const shell = '<!doctype html><html><head><title>x</title></head><body><div id="root"></div></body></html>'
const call = (query = '') => onRequestGet({
  request: new Request(`https://digitalnicjenik.nepar.hr/c/nepar${query}`),
  params: { slug: 'nepar' },
  env: { ASSETS: { fetch: async () => new Response(shell, { headers: { 'x-frame-options': 'DENY' } }) } },
})

describe('/c/:slug HTML', () => {
  it('is embeddable: frame-ancestors * and no X-Frame-Options', async () => {
    const response = await call()
    expect(response.headers.get('content-security-policy')).toBe('frame-ancestors *')
    expect(response.headers.get('x-frame-options')).toBeNull()
  })

  it('keeps the canonical page indexable', async () => {
    const response = await call()
    expect(response.headers.get('x-robots-tag')).toBeNull()
    expect(await response.text()).not.toContain('content="noindex,nofollow"')
  })

  it('serves embed and print variants as noindex and still framable', async () => {
    for (const query of ['?embed=1', '?print=1']) {
      const response = await call(query)
      expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
      expect(response.headers.get('content-security-policy')).toBe('frame-ancestors *')
      expect(await response.text()).toContain('content="noindex,nofollow"')
    }
    expect((await call('?embed=1')).headers.get('cache-control')).toBe('public, max-age=60')
    expect((await call('?print=1')).headers.get('cache-control')).toBe('no-store')
  })
})
