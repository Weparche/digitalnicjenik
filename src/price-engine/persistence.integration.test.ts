import { beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import fixture from '../../marketino-artikli?raw'
import { onRequestGet as getTenant } from '../../functions/api/tenants/[slug]'
import { onRequestPost as importTenant } from '../../functions/api/tenants/[slug]/import'
import { onRequestPost as simulateTenant } from '../../functions/api/tenants/[slug]/simulate'
import { onRequestPatch as patchDraft } from '../../functions/api/tenants/[slug]/draft/[id]'
import { onRequestGet as getArchive } from '../../functions/c/[slug]/arhiva'
import { onRequestGet as getCsv } from '../../functions/c/[slug]/cjenik.csv'
import { onRequestGet as getXml } from '../../functions/c/[slug]/cjenik.xml'
import { onRequestGet as getRootCsv } from '../../functions/cjenik.csv'
import { onRequestGet as getRootXml } from '../../functions/cjenik.xml'
import { onRequestGet as getImmutableCsv } from '../../functions/[filename].csv'
import { onRequestGet as getImmutableXml } from '../../functions/[filename].xml'
import { validatePriceList } from './validate'
import type { NormalizedPriceList, PricePublication } from './types'
import { onRequestPost as validateAnonymous } from '../../functions/api/validator/validate'
import { renderXml } from './xml'
import { parseMarketinoCsv } from './adapters/marketinoCsv'

describe('D1 Publisher persistence', () => {
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
    ])
  })

  it('imports a draft, completes it, publishes immutable versions and serves one current payload', async () => {
    const context = { params: { slug: 'nepar' }, env }
    const anonymousValidation = await validateAnonymous({ request: new Request('https://validator.test/api/validator/validate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ csv: fixture }) }) })
    expect(anonymousValidation.status).toBe(200)
    expect((await anonymousValidation.json() as { validation: { status: string } }).validation.status).toBe('manual_review')
    const xmlValidation = await validateAnonymous({ request: new Request('https://validator.test/api/validator/validate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ xml: renderXml({ ...parseMarketinoCsv(fixture).priceList, items: [parseMarketinoCsv(fixture).priceList.items[0]] }) }) }) })
    expect(xmlValidation.status).toBe(200)
    expect((await xmlValidation.json() as { priceList: NormalizedPriceList }).priceList.items[0]).toMatchObject({ name: 'Administracija sadržaja', price: 40 })
    expect((await env.DB.prepare('SELECT COUNT(*) AS count FROM price_publications').first<{ count: number }>())?.count).toBe(0)
    const importedResponse = await importTenant({ request: new Request('https://demo.test/api/tenants/nepar/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ csv: fixture, name: 'NEPAR', sourceFilename: 'marketino-artikli.csv' }) }), ...context })
    const imported = await importedResponse.json() as { draft: { id: string; status: string; normalizedPayload: NormalizedPriceList }; validation: { status: string; issues: Array<{ field: string }> } }
    expect(importedResponse.status).toBe(200)
    expect(imported.draft.status).toBe('manual_review')
    expect(imported.validation.issues.some((issue) => issue.field === 'anchorPrice')).toBe(true)

    const completed = { ...imported.draft.normalizedPayload, items: imported.draft.normalizedPayload.items.map((item) => ({ ...item, anchorPrice: item.price, specialSaleApplied: false, isNewSinceReferenceDate: false })) }
    expect(validatePriceList(completed).status).toBe('ready_to_publish')
    const crossTenantPayload = { ...completed, tenant: { ...completed.tenant, id: 'other-tenant', slug: 'other-tenant' } }
    const crossTenantPatch = await patchDraft({ request: new Request('https://demo.test/draft', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ priceList: crossTenantPayload }) }), params: { slug: 'nepar', id: imported.draft.id }, env })
    expect(crossTenantPatch.status).toBe(422)
    const patchedResponse = await patchDraft({ request: new Request('https://demo.test/api/tenants/nepar/draft/' + imported.draft.id, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ priceList: completed }) }), params: { slug: 'nepar', id: imported.draft.id }, env })
    const patched = await patchedResponse.json() as { validation: { status: string }; draft: { status: string } }
    expect(patched.validation.status).toBe('ready_to_publish')
    expect(patched.draft.status).toBe('ready_to_publish')

    await env.DB.prepare("UPDATE entitlements SET plan = 'validator' WHERE tenant_id = 'nepar'").run()
    const blockedPublish = await (await import('../../functions/api/tenants/[slug]/publish')).onRequestPost({ request: new Request('https://demo.test/publish', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ draftId: imported.draft.id }) }), ...context })
    expect(blockedPublish.status).toBe(422)
    await env.DB.prepare("UPDATE entitlements SET plan = 'publisher_self_service' WHERE tenant_id = 'nepar'").run()

    const publishedResponse = await (await import('../../functions/api/tenants/[slug]/publish')).onRequestPost({ request: new Request('https://demo.test/api/tenants/nepar/publish', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ draftId: imported.draft.id }) }), ...context })
    const published = await publishedResponse.json() as { changed: boolean; publication: PricePublication }
    expect(published.changed).toBe(true)
    expect(published.publication.sequence).toBe(1)
    expect(published.publication.filenameStem).not.toContain('.csv')
    expect(published.publication.filenameStem).toMatch(/^usluzni-objekt_demo_nepar_1_\d{8}-\d{6}$/)

    const duplicateImport = await importTenant({ request: new Request('https://demo.test/api/tenants/nepar/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ csv: fixture, name: 'NEPAR' }) }), ...context })
    const duplicate = await duplicateImport.json() as { draft: { id: string; normalizedPayload: NormalizedPriceList } }
    const duplicateList = { ...duplicate.draft.normalizedPayload, items: duplicate.draft.normalizedPayload.items.map((item) => ({ ...item, anchorPrice: item.price, specialSaleApplied: false, isNewSinceReferenceDate: false })) }
    await patchDraft({ request: new Request('https://demo.test/draft', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ priceList: duplicateList }) }), params: { slug: 'nepar', id: duplicate.draft.id }, env })
    const unchangedResponse = await (await import('../../functions/api/tenants/[slug]/publish')).onRequestPost({ request: new Request('https://demo.test/publish', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ draftId: duplicate.draft.id }) }), ...context })
    const unchanged = await unchangedResponse.json() as { changed: boolean; message: string }
    expect(unchanged.changed).toBe(false)
    expect(unchanged.message).toBe('Nema promjena za objavu.')

    const simulationResponse = await simulateTenant({ request: new Request('https://demo.test/api/tenants/nepar/simulate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ itemName: 'Web Business – izrada web-stranice', price: 550 }) }), ...context })
    expect(simulationResponse.status, await simulationResponse.clone().text()).toBe(200)
    const simulated = await simulationResponse.json() as { changed: boolean; publication: PricePublication; publications: PricePublication[] }
    expect(simulated.changed).toBe(true)
    expect(simulated.publication.sequence).toBe(2)
    expect(simulated.publications).toHaveLength(2)
    expect(simulated.publications[0].payload.items.find((item) => item.name === 'Web Business – izrada web-stranice')?.price).toBe(550)
    expect(simulated.publications[1].payload.items.find((item) => item.name === 'Web Business – izrada web-stranice')?.price).toBe(500)
    expect(simulated.publication.filenameStem).not.toContain('.xml')

    const hostRequest = (path: string) => new Request('https://digitalnicjenik.nepar.hr' + path)
    expect(await env.DB.prepare('SELECT hostname, current_publication_id FROM publication_targets').all()).toMatchObject({ results: [{ hostname: 'digitalnicjenik.nepar.hr' }] })
    const rootCsvResponse = await getRootCsv({ request: hostRequest('/cjenik.csv'), env })
    const rootXmlResponse = await getRootXml({ request: hostRequest('/cjenik.xml'), env })
    expect(await rootCsvResponse.text()).toContain('550.00')
    expect(await rootXmlResponse.text()).toContain('550.00')
    expect(rootCsvResponse.headers.get('content-disposition')).toContain(simulated.publication.filenameStem + '.csv')
    expect(rootXmlResponse.headers.get('content-disposition')).toContain(simulated.publication.filenameStem + '.xml')

    const oldCsvResponse = await getImmutableCsv({ request: hostRequest('/' + simulated.publications[1].filenameStem + '.csv'), params: { filename: simulated.publications[1].filenameStem }, env })
    const oldXmlResponse = await getImmutableXml({ request: hostRequest('/' + simulated.publications[1].filenameStem + '.xml'), params: { filename: simulated.publications[1].filenameStem }, env })
    expect(await oldCsvResponse.text()).toContain('500.00')
    expect(await oldXmlResponse.text()).toContain('500.00')
    const previewOldCsvResponse = await getImmutableCsv({ request: new Request('https://preview.pages.dev/' + simulated.publications[1].filenameStem + '.csv'), params: { filename: simulated.publications[1].filenameStem }, env })
    expect(previewOldCsvResponse.status).toBe(404)

    const currentResponse = await getTenant({ request: new Request('https://demo.test/api/tenants/nepar'), ...context })
    const current = await currentResponse.json() as { priceList: NormalizedPriceList; publications: PricePublication[] }
    expect(current.priceList.items.find((item) => item.name === 'Web Business – izrada web-stranice')?.price).toBe(550)
    expect(current.publications).toHaveLength(2)

    const archive = await (await getArchive(context)).json() as { publications: PricePublication[] }
    expect(archive.publications).toHaveLength(2)
    expect(archive.publications[0].isCurrent).toBe(true)
    expect(archive.publications[1].publicUntil).not.toBeNull()

    // Controlled-time archive cases: current never expires, while a
    // superseded publication leaves the public index after its 30-day window.
    const now = Date.now()
    await env.DB.prepare('UPDATE price_publications SET published_at = ? WHERE sequence = 2').bind(new Date(now - 100 * 86400000).toISOString()).run()
    expect((await (await getArchive(context)).json() as { publications: PricePublication[] }).publications).toHaveLength(2)
    await env.DB.prepare('UPDATE price_publications SET public_until = ? WHERE sequence = 1').bind(new Date(now + 86400000).toISOString()).run()
    expect((await (await getArchive(context)).json() as { publications: PricePublication[] }).publications).toHaveLength(2)
    await env.DB.prepare('UPDATE price_publications SET public_until = ? WHERE sequence = 1').bind(new Date(now - 31 * 86400000).toISOString()).run()
    expect((await (await getArchive(context)).json() as { publications: PricePublication[] }).publications).toHaveLength(1)
    expect((await env.DB.prepare('SELECT COUNT(*) AS count FROM price_publications WHERE tenant_id = ?').bind('nepar').first<{ count: number }>())?.count).toBe(2)

    const csvResponse = await getCsv({ request: new Request('https://demo.test/c/nepar/cjenik.csv'), params: { slug: 'nepar' }, env })
    expect(await csvResponse.text()).toContain('550.00')
    expect(csvResponse.headers.get('content-type')).toContain('text/csv')
    expect(csvResponse.headers.get('content-disposition')).toContain('.csv')
    const xmlResponse = await getXml({ request: new Request('https://demo.test/c/nepar/cjenik.xml'), params: { slug: 'nepar' }, env })
    expect(await xmlResponse.text()).toContain('550.00')
    expect(xmlResponse.headers.get('content-type')).toContain('application/xml')
    expect(xmlResponse.headers.get('content-disposition')).toContain('.xml')
  })
})
