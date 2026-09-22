import { describe, expect, it, vi, afterEach } from 'vitest'
import { documentLooksValid, isForbiddenIp, normalizeDigitalPriceListUrl, runDigitalPriceListCheck } from './check'

const resolver = {
  resolve4: async () => ['93.184.216.34'],
  resolve6: async () => [],
}

function routeFetch(routes: Record<string, Response | (() => Response)>, fallback = new Response('Not found', { status: 404 })) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(input.toString())
    const route = routes[url.pathname]
    return typeof route === 'function' ? route() : route ?? fallback
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('digital price list checker hardening', () => {
  it('rejects non-http schemes, credentials and private IPs', () => {
    for (const value of ['file:///tmp/cjenik.csv', 'ftp://example.com/cjenik.csv', 'data:text/plain,cjenik', 'javascript:alert(1)', 'https://user:pass@example.com']) {
      expect(() => normalizeDigitalPriceListUrl(value)).toThrow('invalid_url')
    }
    expect(() => normalizeDigitalPriceListUrl('http://127.0.0.1')).toThrow('invalid_url')
    expect(isForbiddenIp('192.168.1.2')).toBe(true)
  })

  it('allows five redirects and rejects the sixth without following it', async () => {
    const fetch = routeFetch({
      '/': () => new Response(null, { status: 302, headers: { location: '/1' } }),
      '/1': () => new Response(null, { status: 302, headers: { location: '/2' } }),
      '/2': () => new Response(null, { status: 302, headers: { location: '/3' } }),
      '/3': () => new Response(null, { status: 302, headers: { location: '/4' } }),
      '/4': () => new Response(null, { status: 302, headers: { location: '/5' } }),
      '/5': () => new Response('<html><body>cjenik</body></html>', { status: 200 }),
    })
    vi.stubGlobal('fetch', fetch)
    const allowed = await runDigitalPriceListCheck('https://example.com', { DIGITAL_PRICE_LIST_DNS_RESOLVER: resolver })
    expect(['red', 'unavailable']).toContain(allowed.status)
    expect(fetch.mock.calls.filter(([input]) => String(input).includes('/5')).length).toBe(1)

    const tooMany = routeFetch({
      '/': () => new Response(null, { status: 302, headers: { location: '/1' } }),
      '/1': () => new Response(null, { status: 302, headers: { location: '/2' } }),
      '/2': () => new Response(null, { status: 302, headers: { location: '/3' } }),
      '/3': () => new Response(null, { status: 302, headers: { location: '/4' } }),
      '/4': () => new Response(null, { status: 302, headers: { location: '/5' } }),
      '/5': () => new Response(null, { status: 302, headers: { location: '/6' } }),
      '/6': () => new Response('<html />', { status: 200 }),
    })
    vi.stubGlobal('fetch', tooMany)
    const rejected = await runDigitalPriceListCheck('https://example.com', { DIGITAL_PRICE_LIST_DNS_RESOLVER: resolver })
    expect(rejected.status).toBe('unavailable')
    expect(tooMany.mock.calls.some(([input]) => String(input).includes('/6'))).toBe(false)
  })

  it('rejects a redirect to a private destination before fetching it', async () => {
    const fetch = routeFetch({ '/': () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/admin' } }) })
    vi.stubGlobal('fetch', fetch)
    const checked = await runDigitalPriceListCheck('https://example.com', { DIGITAL_PRICE_LIST_DNS_RESOLVER: resolver })
    expect(checked.status).toBe('unavailable')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('requires meaningful CSV content and rejects HTML served from a csv URL', async () => {
    const fetch = routeFetch({
      '/': () => new Response('<a href="/cjenik.csv">CSV</a>', { status: 200 }),
      '/cjenik.csv': () => new Response('<!doctype html><html><body>not csv</body></html>', { status: 200, headers: { 'content-type': 'text/csv' } }),
    })
    vi.stubGlobal('fetch', fetch)
    const checked = await runDigitalPriceListCheck('https://example.com', { DIGITAL_PRICE_LIST_DNS_RESOLVER: resolver })
    expect(checked.status).toBe('red')
    expect(documentLooksValid('csv', new Response('text/html', { headers: { 'content-type': 'text/csv' } }), 'just one line')).toBe(false)
  })

  it('returns green only for a valid tabular CSV', async () => {
    const fetch = routeFetch({
      '/': () => new Response('<a href="/exports/current.csv">CSV</a>', { status: 200 }),
      '/exports/current.csv': () => new Response('Naziv,Cijena\nŠišanje,15', { status: 200, headers: { 'content-type': 'text/plain' } }),
    })
    vi.stubGlobal('fetch', fetch)
    const checked = await runDigitalPriceListCheck('https://example.com', { DIGITAL_PRICE_LIST_DNS_RESOLVER: resolver })
    expect(checked.status).toBe('green')
    expect(checked.details.csvUrl).toBe('https://example.com/exports/current.csv')
  })

  it('requires parseable XML and rejects malformed XML', async () => {
    const malformedFetch = routeFetch({
      '/': () => new Response('<a href="/current.xml">XML</a>', { status: 200 }),
      '/current.xml': () => new Response('<?xml version="1.0"?><cjenik>', { status: 200, headers: { 'content-type': 'application/xml' } }),
    })
    vi.stubGlobal('fetch', malformedFetch)
    const malformed = await runDigitalPriceListCheck('https://example.com', { DIGITAL_PRICE_LIST_DNS_RESOLVER: resolver })
    expect(malformed.status).toBe('red')

    const validFetch = routeFetch({
      '/': () => new Response('<a href="/current.xml">XML</a>', { status: 200 }),
      '/current.xml': () => new Response('<?xml version="1.0"?><cjenik><stavka>Šišanje</stavka></cjenik>', { status: 200, headers: { 'content-type': 'text/plain' } }),
    })
    vi.stubGlobal('fetch', validFetch)
    const valid = await runDigitalPriceListCheck('https://example.com', { DIGITAL_PRICE_LIST_DNS_RESOLVER: resolver })
    expect(valid.status).toBe('green')
    expect(valid.details.xmlUrl).toBe('https://example.com/current.xml')
  })

  it('returns yellow only when the price page passes multi-signal content checks', async () => {
    const { pageLooksLikePriceList } = await import('./check')
    const richHtml = '<!doctype html><html><body><h1>Cjenik usluga</h1><table><tr><th>Naziv</th><th>Cijena</th></tr><tr><td>Šišanje</td><td>15,00 €</td></tr><tr><td>Bojanje</td><td>40,00 €</td></tr><tr><td>Pranje</td><td>8,00 €</td></tr></table><script type="application/ld+json">{"@type":"Product"}</script></body></html>'
    expect(pageLooksLikePriceList(new Response(richHtml, { status: 200, headers: { 'content-type': 'text/html' } }), richHtml)).toBe(true)

    const weak = routeFetch({
      '/': () => new Response('<a href="/cjenik/">Cjenik</a>', { status: 200 }),
      '/cjenik/': () => new Response('<!doctype html><html><body><h1>Cjenik</h1><p>Dobrodošli</p></body></html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    })
    vi.stubGlobal('fetch', weak)
    expect((await runDigitalPriceListCheck('https://example.com', { DIGITAL_PRICE_LIST_DNS_RESOLVER: resolver })).status).toBe('red')

    const soft404 = routeFetch({
      '/': () => new Response('<a href="/cjenik/">Cjenik</a>', { status: 200 }),
      '/cjenik/': () => new Response('<!doctype html><html><body><h1>404</h1><p>Stranica nije pronađena</p></body></html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    })
    vi.stubGlobal('fetch', soft404)
    expect((await runDigitalPriceListCheck('https://example.com', { DIGITAL_PRICE_LIST_DNS_RESOLVER: resolver })).details.pricePageFound).toBe(false)

    const fetch = routeFetch({
      '/': () => new Response('<a href="/cjenik/">Cjenik</a>', { status: 200, headers: { 'content-type': 'text/html' } }),
      '/cjenik/': () => new Response(richHtml, { status: 200, headers: { 'content-type': 'text/html' } }),
      '/cjenici/': () => new Response('missing', { status: 404 }),
    })
    vi.stubGlobal('fetch', fetch)
    const checked = await runDigitalPriceListCheck('https://example.com', { DIGITAL_PRICE_LIST_DNS_RESOLVER: resolver })
    expect(checked.details.pricePageFound).toBe(true)
    expect(checked.status).toBe('yellow')
  })

  it('reads a large homepage instead of aborting the check', async () => {
    const padding = ' '.repeat(600 * 1024)
    const fetch = routeFetch({
      '/': () => new Response(`<a href="/exports/current.csv">CSV</a>${padding}`, { status: 200, headers: { 'content-type': 'text/html' } }),
      '/exports/current.csv': () => new Response('Naziv,Cijena\nŠišanje,15', { status: 200, headers: { 'content-type': 'text/plain' } }),
    })
    vi.stubGlobal('fetch', fetch)
    const checked = await runDigitalPriceListCheck('https://example.com', { DIGITAL_PRICE_LIST_DNS_RESOLVER: resolver })
    expect(checked.status).toBe('green')
    expect(checked.details.csvUrl).toBe('https://example.com/exports/current.csv')
  })

  it('keeps a network failure separate from red', async () => {
    const fetch = vi.fn(async () => { throw new Error('timeout') })
    vi.stubGlobal('fetch', fetch)
    const checked = await runDigitalPriceListCheck('https://example.com', { DIGITAL_PRICE_LIST_DNS_RESOLVER: resolver })
    expect(checked.status).toBe('unavailable')
    expect(checked.message).toContain('Pokušajte ponovno')
  })

  it('returns red when the hostname does not exist', async () => {
    const missing = {
      resolve4: async () => [],
      resolve6: async () => [],
    }
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const checked = await runDigitalPriceListCheck('www.mile.hr', { DIGITAL_PRICE_LIST_DNS_RESOLVER: missing })
    expect(checked.status).toBe('red')
    expect(checked.message).toContain('nije pronađena')
    expect(checked.details.reachable).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('treats DoH NXDOMAIN as host not found without fetching the site', async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('cloudflare-dns.com')) return Response.json({ Status: 3, Answer: [] })
      throw new Error('should not fetch site')
    })
    vi.stubGlobal('fetch', fetch)
    const checked = await runDigitalPriceListCheck('www.mile.hr')
    expect(checked.status).toBe('red')
    expect(checked.message).toBe('Web stranica nije pronađena. Provjerite adresu.')
    expect(fetch.mock.calls.every(([input]) => String(input).includes('cloudflare-dns.com'))).toBe(true)
  })

  it('keeps a DNS resolver outage as unavailable', async () => {
    const failing = {
      resolve4: async () => { throw new Error('servfail') },
      resolve6: async () => { throw new Error('servfail') },
    }
    const checked = await runDigitalPriceListCheck('https://example.com', { DIGITAL_PRICE_LIST_DNS_RESOLVER: failing })
    expect(checked.status).toBe('unavailable')
    expect(checked.message).toContain('Pokušajte ponovno')
  })

  it('continues after a Cloudflare homepage challenge and reports missing CSV as red', async () => {
    const challenge = () => new Response('<!doctype html><title>Just a moment...</title>', {
      status: 403,
      headers: { 'cf-mitigated': 'challenge', 'content-type': 'text/html' },
    })
    const fetch = routeFetch({
      '/': challenge,
      '/cjenik/': challenge,
      '/cjenici/': challenge,
      '/cjenik.xml': challenge,
      '/cjenik/arhiva/': challenge,
      '/cjenik/arhiva': challenge,
      '/cjenik.csv': () => new Response('Not found', { status: 404 }),
    })
    vi.stubGlobal('fetch', fetch)
    const checked = await runDigitalPriceListCheck('https://www.mall.hr', { DIGITAL_PRICE_LIST_DNS_RESOLVER: resolver })
    expect(checked.status).toBe('red')
    expect(checked.message).toContain('zaštićena od automatskog dohvata')
    expect(checked.details.reachable).toBe(true)
    expect(checked.details.fetchBlocked).toBe(true)
    expect(checked.details.csvFound).toBe(false)
  })

  it('explains a full bot challenge instead of asking the user to retry', async () => {
    const challenge = () => new Response('<!doctype html><title>Just a moment...</title>', {
      status: 403,
      headers: { 'cf-mitigated': 'challenge', 'content-type': 'text/html' },
    })
    const fetch = routeFetch({
      '/': challenge,
      '/cjenik/': challenge,
      '/cjenici/': challenge,
      '/cjenik.csv': challenge,
      '/cjenik.xml': challenge,
      '/cjenik/arhiva/': challenge,
      '/cjenik/arhiva': challenge,
    }, challenge())
    vi.stubGlobal('fetch', fetch)
    const checked = await runDigitalPriceListCheck('https://www.mall.hr', { DIGITAL_PRICE_LIST_DNS_RESOLVER: resolver })
    expect(checked.status).toBe('yellow')
    expect(checked.message).toContain('zaštićen od automatskog dohvata')
    expect(checked.details.fetchBlocked).toBe(true)
    expect(checked.details.reachable).toBe(true)
  })
})
