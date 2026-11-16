import { afterEach, expect, it, vi, beforeEach } from 'vitest'
// Historical checker fixtures use the pre-NN132 schema; current-rule coverage is separate.
beforeEach(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-11-16T22:00:00Z'))})
afterEach(()=>vi.useRealTimers())
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


it('follows a public external HTML publisher and recognizes a Bazna cijena feed', async () => {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url=String(input)
    if(url==='https://salon.example/')return new Response('<a href="https://publisher.example/c/salon">Digitalni cjenik</a>',{headers:{'content-type':'text/html'}})
    if(url==='https://publisher.example/c/salon')return new Response('<h1>Cjenik</h1><a href="https://publisher.example/c/salon/cjenik.csv">CSV cjenik</a>',{headers:{'content-type':'text/html'}})
    if(url==='https://publisher.example/c/salon/cjenik.csv')return new Response('Naziv,Vrsta,Cijena,Bazna cijena,Poseban oblik prodaje\nŠišanje,Usluga,15,14,NE\n')
    return new Response('missing',{status:404})
  })
  const checked=await runDigitalPriceListCheck('https://salon.example/',{DIGITAL_PRICE_LIST_DNS_RESOLVER:{resolve4:async()=>['93.184.216.34'],resolve6:async()=>[]}})
  expect(checked.details.externalFeedLinked).toBe(true)
  expect(checked.details.publicLinkUrl).toBe('https://publisher.example/c/salon')
  expect(checked.details.csvAnalysis?.findings.some(f=>f.rule==='service.anchor.missing')).toBe(false)
})
