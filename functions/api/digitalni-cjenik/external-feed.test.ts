import { afterEach, expect, it, vi } from 'vitest'
import { runDigitalPriceListCheck } from './check'

afterEach(() => vi.unstubAllGlobals())

it('verifies a directly linked external publisher feed with the safe fetcher', async () => {
  const requested: string[] = []
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input); requested.push(url)
    if (url === 'https://salon.example/') return new Response('<html><body><a href="https://publisher.example/cjenik.csv">CSV cjenik</a></body></html>', { headers: { 'content-type': 'text/html' } })
    if (url === 'https://publisher.example/cjenik.csv') return new Response('Naziv,Vrsta,Cijena,Sidrena cijena,Poseban oblik prodaje\nŠišanje,Usluga,15,14,NE\n')
    return new Response('missing', { status: 404 })
  })
  const checked = await runDigitalPriceListCheck('https://salon.example/', { DIGITAL_PRICE_LIST_DNS_RESOLVER: { resolve4: async () => ['93.184.216.34'], resolve6: async () => [] } })
  expect(checked.details.csvUrl).toBe('https://publisher.example/cjenik.csv')
  expect(requested).toContain('https://publisher.example/cjenik.csv')
  expect(checked.details.contentStatus).toBe('pass')
})
