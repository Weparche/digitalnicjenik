import { beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import fixture from '../../marketino-artikli?raw'
import { createDraft, publishDraft, readCurrentPublication, readPublicationForHost, readPublications } from '../../functions/_repository'
import { parseMarketinoCsv } from './adapters/marketinoCsv'
import type { NormalizedPriceList } from './types'

const clear = async () => env.DB.batch([
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

const validList = (): NormalizedPriceList => {
  const parsed = parseMarketinoCsv(fixture, { id: 'nepar', slug: 'nepar', name: 'NEPAR' }).priceList
  return { ...parsed, items: parsed.items.map((item) => ({ ...item, anchorPrice: item.price, specialSaleApplied: false, isNewSinceReferenceDate: false })) }
}

describe('D1 publication atomicity', () => {
  beforeEach(clear)

  it('serializes concurrent publishes into unique sequences and one current publication', async () => {
    const base = validList()
    const a = { ...base, items: base.items.map((item) => item.name === 'Web Business – izrada web-stranice' ? { ...item, price: 601 } : item) }
    const b = { ...base, items: base.items.map((item) => item.name === 'Web Business – izrada web-stranice' ? { ...item, price: 602 } : item) }
    const draftA = await createDraft(env, 'nepar', a, 'a.csv', 'test')
    const draftB = await createDraft(env, 'nepar', b, 'b.csv', 'test')
    if (!draftA.draft || !draftB.draft) throw new Error('Test draft nije kreiran.')

    const results = await Promise.all([
      publishDraft(env, 'nepar', draftA.draft.id),
      publishDraft(env, 'nepar', draftB.draft.id),
    ])
    const publications = await readPublications(env, 'nepar', false)
    const current = await readCurrentPublication(env, 'nepar')
    const currentCount = await env.DB.prepare('SELECT COUNT(*) AS count FROM price_publications WHERE tenant_id = ? AND is_current = 1').bind('nepar').first<{ count: number }>()
    const target = await env.DB.prepare('SELECT current_publication_id FROM publication_targets WHERE tenant_id = ?').bind('nepar').first<{ current_publication_id: string }>()

    expect(results.every((result) => result.changed)).toBe(true)
    expect(publications.map((publication) => publication.sequence).sort()).toEqual([1, 2])
    expect(currentCount?.count).toBe(1)
    expect(target?.current_publication_id).toBe(current?.id)
  })

  it('rolls back the whole batch when the final audit write fails', async () => {
    const draft = await createDraft(env, 'nepar', validList(), 'rollback.csv', 'test')
    if (!draft.draft) throw new Error('Test draft nije kreiran.')
    await env.DB.prepare("CREATE TRIGGER fail_publication_audit BEFORE INSERT ON sync_logs WHEN NEW.event_type = 'publication_published' BEGIN SELECT RAISE(ABORT, 'audit failure'); END").run()
    await expect(publishDraft(env, 'nepar', draft.draft.id)).rejects.toThrow('audit failure')
    await env.DB.prepare('DROP TRIGGER fail_publication_audit').run()

    const publicationCount = await env.DB.prepare('SELECT COUNT(*) AS count FROM price_publications').first<{ count: number }>()
    const metadata = await env.DB.prepare('SELECT next_publication_sequence FROM publication_metadata WHERE tenant_id = ?').bind('nepar').first<{ next_publication_sequence: number }>()
    const persistedDraft = await env.DB.prepare('SELECT status FROM price_uploads WHERE id = ?').bind(draft.draft.id).first<{ status: string }>()
    expect(publicationCount?.count).toBe(0)
    expect(metadata?.next_publication_sequence).toBe(1)
    expect(persistedDraft?.status).toBe('ready_to_publish')
  })

  it('does not publish or supersede anything when the target is missing', async () => {
    const draft = await createDraft(env, 'nepar', validList(), 'missing-target.csv', 'test')
    if (!draft.draft) throw new Error('Test draft nije kreiran.')
    await env.DB.prepare('DELETE FROM publication_targets WHERE tenant_id = ?').bind('nepar').run()

    await expect(publishDraft(env, 'nepar', draft.draft.id)).rejects.toThrow('Nedostaje aktivni public target')
    expect((await env.DB.prepare('SELECT COUNT(*) AS count FROM price_publications').first<{ count: number }>())?.count).toBe(0)
    expect((await env.DB.prepare('SELECT status FROM price_uploads WHERE id = ?').bind(draft.draft.id).first<{ status: string }>())?.status).toBe('ready_to_publish')
  })

  it('rejects a cross-tenant current pointer', async () => {
    const first = await createDraft(env, 'nepar', validList(), 'first.csv', 'test')
    if (!first.draft) throw new Error('Prvi testni draft nije kreiran.')
    const firstPublication = await publishDraft(env, 'nepar', first.draft.id)

    const otherList = { ...validList(), tenant: { id: 'other-tenant', slug: 'other-tenant', name: 'Other tenant' } }
    const other = await createDraft(env, 'other-tenant', otherList, 'other.csv', 'test')
    if (!other.draft) throw new Error('Drugi testni draft nije kreiran.')
    const otherPublication = await publishDraft(env, 'other-tenant', other.draft.id, true)

    await expect(env.DB.prepare('UPDATE publication_targets SET current_publication_id = ? WHERE tenant_id = ?').bind(otherPublication.publication.id, 'nepar').run()).rejects.toThrow('publication target tenant mismatch')
    expect((await readPublicationForHost(env, 'digitalnicjenik.nepar.hr'))?.id).toBe(firstPublication.publication.id)
  })
})
