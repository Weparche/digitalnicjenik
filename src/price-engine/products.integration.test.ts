import { beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { onRequestPost as importTenant } from '../../functions/api/tenants/[slug]/import'
import { onRequestPost as publishTenant } from '../../functions/api/tenants/[slug]/publish'
import { onRequestGet as getRootCsv } from '../../functions/cjenik.csv'
import { onRequestGet as getRootXml } from '../../functions/cjenik.xml'
import { parseCsvFeed, parseXmlFeed } from '../../shared/compliance/document-parser'
import type { NormalizedPriceList, PricePublication } from './types'

const PRODUCT_CSV = [
  'Grupa,Naziv,Vrsta,Interna šifra,Cijena,Akcijska cijena,Poseban oblik prodaje,Naziv posebnog oblika prodaje,Sidrena cijena,Jedinica,Marka,Barkod,Cijena za jedinicu mjere,Dostupnost',
  'Mliječni,Mlijeko 1 l,Proizvod,M-001,1.20,,NE,,1.10,l,Dukat,4006381333931,1.20,dostupno',
  'Pekarski,Kruh 500 g,Proizvod,M-002,0.99,,NE,,0.95,kg,bez marke,96385074,1.98,nedostupno',
].join('\r\n')

describe('product price list through the Publisher API', () => {
  const runtime = () => ({
    ...env,
    DEMO_WRITE_RATE_LIMIT_SECRET: 'demo-rate-secret',
    LEAD_RATE_LIMIT_SECRET: 'demo-rate-secret',
    DEMO_WRITE_TENANT: 'nepar',
    DEMO_PUBLIC_HOSTNAME: 'digitalnicjenik.nepar.hr',
  })

  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM sync_logs'),
      env.DB.prepare('DELETE FROM price_publications'),
      env.DB.prepare('DELETE FROM price_list_versions'),
      env.DB.prepare('DELETE FROM price_uploads'),
      env.DB.prepare('DELETE FROM publication_targets'),
      env.DB.prepare('DELETE FROM publication_metadata'),
      env.DB.prepare('DELETE FROM entitlements'),
      env.DB.prepare('DELETE FROM integrations'),
      env.DB.prepare('DELETE FROM price_lists'),
      env.DB.prepare('DELETE FROM tenants'),
      env.DB.prepare('DELETE FROM demo_write_rate_buckets'),
      env.DB.prepare('DELETE FROM checker_rate_buckets'),
    ])
  })

  it('keeps brand, barcode, unit price and availability from import to the published CSV and XML', async () => {
    const context = { params: { slug: 'nepar' }, env: runtime() }
    const imported = await importTenant({ request: new Request('https://demo.test/api/tenants/nepar/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ csv: PRODUCT_CSV, name: 'Trgovina' }) }), ...context })
    expect(imported.status).toBe(200)
    const body = await imported.json() as { draft: { id: string; status: string; normalizedPayload: NormalizedPriceList } }
    expect(body.draft.status).toBe('ready_to_publish')
    expect(body.draft.normalizedPayload.items[0]).toMatchObject({ brand: 'Dukat', barcode: '4006381333931', unit: 'l', unitPrice: 1.2, availability: 'dostupno' })
    expect(body.draft.normalizedPayload.items[1]).toMatchObject({ brand: 'bez marke', barcode: '96385074', unitPrice: 1.98, availability: 'nedostupno' })

    const published = await publishTenant({ request: new Request('https://demo.test/api/tenants/nepar/publish', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ draftId: body.draft.id }) }), ...context })
    const result = await published.json() as { changed: boolean; publication: PricePublication }
    expect(result.changed).toBe(true)

    const publicEnv = runtime()
    const csv = await (await getRootCsv({ request: new Request('https://digitalnicjenik.nepar.hr/cjenik.csv'), params: {}, env: publicEnv })).text()
    expect(csv.split('\r\n')[0]).toMatch(/,Jedinica,Marka,Barkod,Cijena za jedinicu mjere,Dostupnost$/)
    const csvFeed = parseCsvFeed(csv)
    expect(csvFeed.records[0]).toMatchObject({ brand: 'Dukat', barcode: '4006381333931', unitPrice: '1.20', availability: 'dostupno' })
    expect(csvFeed.records[1]).toMatchObject({ barcode: '96385074', availability: 'nedostupno' })

    const xml = await (await getRootXml({ request: new Request('https://digitalnicjenik.nepar.hr/cjenik.xml'), params: {}, env: publicEnv })).text()
    expect(xml).toContain('<brand>Dukat</brand>')
    expect(parseXmlFeed(xml).records[1]).toMatchObject({ brand: 'bez marke', barcode: '96385074', availability: 'nedostupno', unit: 'kg' })
  })

  it('does not publish while required product fields are missing', async () => {
    const context = { params: { slug: 'nepar' }, env: runtime() }
    const incomplete = PRODUCT_CSV.replace('Dukat', '').replace(',dostupno', ',')
    const imported = await importTenant({ request: new Request('https://demo.test/api/tenants/nepar/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ csv: incomplete, name: 'Trgovina' }) }), ...context })
    const body = await imported.json() as { draft: { id: string; status: string }; validation: { issues: Array<{ field: string; severity: string }> } }
    expect(body.draft.status).toBe('manual_review')
    expect(body.validation.issues.map((issue) => issue.field).sort()).toEqual(['availability', 'brand'])
    const published = await publishTenant({ request: new Request('https://demo.test/api/tenants/nepar/publish', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ draftId: body.draft.id }) }), ...context })
    expect(published.status).toBe(422)
  })
})
