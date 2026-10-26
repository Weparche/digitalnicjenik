import { beforeEach, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { onRequestGet as getArchivedCsv } from './c/[slug]/[filename].csv'
import { onRequestGet as getCurrentCsv } from './c/[slug]/cjenik.csv'
import { onRequestGet as getRetained } from './api/publication/retained'
import { onRequestPatch as saveMetadata } from './api/tenants/[slug]/metadata'
import { createDraft, publishDraft, readMetadataForSlug, type RuntimeEnv } from './_repository'
import type { NormalizedPriceList } from '../src/price-engine/types'

const stem = 'usluzni-objekt_ilica-10_p1_1_20261026-060000'
const list: NormalizedPriceList = { tenant: { id: 't-retained', slug: 'retained', name: 'Salon' }, source: 'nepar', currency: 'EUR', updatedAt: '2026-10-26T00:00:00Z', items: [{ name: 'Šišanje', type: 'Usluga', price: 15, anchorPrice: 14, specialSaleApplied: false }] }
const runtime = (): RuntimeEnv => ({ DB: env.DB as unknown as RuntimeEnv['DB'], OPERATOR_WRITE_KEY: 'operator-test', DEMO_PUBLIC_HOSTNAME: 'digitalnicjenik.nepar.hr' })

beforeEach(async () => {
  await env.DB.batch(['sync_logs', 'price_publications', 'price_list_versions', 'price_uploads', 'publication_targets', 'publication_metadata', 'entitlements', 'tenants'].map(table => env.DB.prepare(`DELETE FROM ${table}`)))
  const stamp = new Date().toISOString()
  const until = new Date(Date.now() + 10 * 86400000).toISOString()
  await env.DB.batch([
    env.DB.prepare("INSERT INTO tenants (id,slug,name,currency,created_at,updated_at) VALUES ('t-retained','retained','Salon','EUR',?,?)").bind(stamp, stamp),
    env.DB.prepare("INSERT INTO publication_metadata (tenant_id,object_type,object_address,object_code,next_publication_sequence,timezone,created_at,updated_at,compliance_profile) VALUES ('t-retained','usluzni-objekt','Ilica 10','p1',3,'Europe/Zagreb',?,?,'services')").bind(stamp, stamp),
    env.DB.prepare("INSERT INTO publication_targets (id,tenant_id,hostname,status,current_publication_id,created_at,updated_at) VALUES ('target-retained','t-retained','retained.digitalnicjenik.nepar.hr','active',NULL,?,?)").bind(stamp, stamp),
    env.DB.prepare("INSERT INTO price_list_versions (id,tenant_id,hash,payload_json,created_at) VALUES ('v-retained','t-retained','seed',?,?)").bind(JSON.stringify(list), stamp),
    env.DB.prepare("INSERT INTO price_publications (id,tenant_id,price_list_id,sequence,filename_stem,published_at,superseded_at,public_until,hash,payload_json,is_current) VALUES ('old','t-retained','v-retained',1,?,?,?,?,'seed',?,0)").bind(stem, stamp, stamp, until, JSON.stringify(list)),
    env.DB.prepare("INSERT INTO price_publications (id,tenant_id,price_list_id,sequence,filename_stem,published_at,hash,payload_json,is_current) VALUES ('current','t-retained','v-retained',2,'current-stem',?,'seed',?,1)").bind(stamp, JSON.stringify(list)),
    env.DB.prepare("INSERT INTO entitlements (id,tenant_id,plan,status,period_start,period_end,created_at,updated_at) VALUES ('e-retained','t-retained','publisher_self_service','expired',?,'2020-01-01T00:00:00Z',?,?)").bind(stamp, stamp, stamp),
  ])
  await env.DB.prepare("UPDATE publication_targets SET current_publication_id = 'current' WHERE id = 'target-retained'").run()
})

it('serves a retained immutable archive on the platform after expiry, while current feeds stay closed', async () => {
  const archived = await getArchivedCsv({ request: new Request(`https://digitalnicjenik.nepar.hr/c/retained/${stem}.csv`), params: { slug: 'retained', filename: stem }, env: runtime() })
  expect(archived.status).toBe(200)
  expect(await archived.text()).toContain('Šišanje')
  expect((await getCurrentCsv({ request: new Request('https://digitalnicjenik.nepar.hr/c/retained/cjenik.csv'), params: { slug: 'retained' }, env: runtime() })).status).toBe(410)
  const archive = await getRetained({ request: new Request('https://digitalnicjenik.nepar.hr/api/publication/retained?slug=retained'), env: runtime() })
  expect((await archive.json() as { publications: Array<{ id: string }> }).publications.map(item => item.id).sort()).toEqual(['current', 'old'])
  expect((await getArchivedCsv({ request: new Request('https://digitalnicjenik.nepar.hr/c/retained/current-stem.csv'), params: { slug: 'retained', filename: 'current-stem' }, env: runtime() })).status).toBe(200)
  await env.DB.prepare("UPDATE price_publications SET published_at = '2020-01-01T00:00:00Z' WHERE id = 'current'").run()
  expect((await getArchivedCsv({ request: new Request('https://digitalnicjenik.nepar.hr/c/retained/current-stem.csv'), params: { slug: 'retained', filename: 'current-stem' }, env: runtime() })).status).toBe(404)
})

it('does not bypass suspension or tenant scoping', async () => {
  const request = new Request(`https://digitalnicjenik.nepar.hr/c/retained/${stem}.csv`)
  expect((await getArchivedCsv({ request, params: { slug: 'another', filename: stem }, env: runtime() })).status).toBe(404)
  await env.DB.prepare("UPDATE entitlements SET status = 'suspended' WHERE tenant_id = 't-retained'").run()
  expect((await getArchivedCsv({ request, params: { slug: 'retained', filename: stem }, env: runtime() })).status).toBe(404)
})

it('does not permit an internal demo flag to force-publish an incomplete customer draft', async () => {
  const invalid = { ...list, items: [{ ...list.items[0], anchorPrice: null }] }
  const draft = await createDraft(runtime(), 'retained', invalid, 'invalid.csv', 'nepar')
  await expect(publishDraft(runtime(), 'retained', draft.draft!.id, true)).rejects.toThrow('Cjenik još nije spreman')
})

it('requires write access to metadata and creates a new filename when only the address changes', async () => {
  const request = (authorized: boolean) => new Request('https://digitalnicjenik.nepar.hr/api/tenants/retained/metadata', { method: 'PATCH', headers: { 'content-type': 'application/json', ...(authorized ? { authorization: 'Bearer operator-test' } : {}) }, body: JSON.stringify({ objectType: 'usluzni-objekt', objectAddress: 'Nova ulica 20, Zagreb', objectCode: 'p1' }) })
  expect((await saveMetadata({ request: request(false), params: { slug: 'retained' }, env: runtime() })).status).toBe(401)
  await env.DB.prepare("UPDATE entitlements SET status = 'active', period_end = '2099-01-01T00:00:00Z' WHERE tenant_id = 't-retained'").run()
  const first = await createDraft(runtime(), 'retained', list, 'cjenik.csv', 'nepar')
  const before = await publishDraft(runtime(), 'retained', first.draft!.id)
  expect((await saveMetadata({ request: request(true), params: { slug: 'retained' }, env: runtime() })).status).toBe(200)
  expect((await readMetadataForSlug(runtime(), 'retained'))?.objectAddress).toBe('Nova ulica 20, Zagreb')
  const draft = await createDraft(runtime(), 'retained', list, 'cjenik.csv', 'nepar')
  const after = await publishDraft(runtime(), 'retained', draft.draft!.id)
  expect(after.changed).toBe(true)
  expect(after.publication!.filenameStem).toContain('nova-ulica-20-zagreb')
  expect(after.publication!.filenameStem).not.toBe(before.publication!.filenameStem)
})
