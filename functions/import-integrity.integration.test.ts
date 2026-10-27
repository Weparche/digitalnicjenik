import { beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { createDraft, publishDraft, readDraft, updateDraft } from './_repository'
import { parseMarketinoCsv } from '../src/price-engine/adapters/marketinoCsv'
import { importIssuesFromParseWarnings } from '../src/price-engine/validate'

describe('persistent import findings', () => {
  beforeEach(async () => {
    await env.DB.batch(['sync_logs', 'price_publications', 'price_list_versions', 'price_uploads', 'publication_targets', 'publication_metadata', 'entitlements', 'tenants'].map(table => env.DB.prepare(`DELETE FROM ${table}`)))
  })
  it('save, reopen and even a stale ready status cannot publish skipped source rows', async () => {
    const input = 'Naziv,Vrsta,Cijena,Sidrena cijena,Poseban oblik prodaje\nValid,Usluga,10,10,NE\nInvalid,Usluga,abc,10,NE'
    const parsed = parseMarketinoCsv(input, { id: 'nepar', slug: 'nepar', name: 'NEPAR' })
    const created = await createDraft(env, 'nepar', parsed.priceList, 'input.csv', 'csv', input, importIssuesFromParseWarnings(parsed.warnings, 'csv'))
    const id = created.draft!.id
    expect(created.validation.status).toBe('invalid')
    const saved = await updateDraft(env, 'nepar', id, { ...parsed.priceList, items: parsed.priceList.items.map(item => ({ ...item, price: 11 })) })
    expect(saved.validation.status).toBe('invalid')
    expect((await readDraft(env, 'nepar', id))?.validationIssues).toContainEqual(expect.objectContaining({ code: 'IMPORT_ROW_SKIPPED', row: 3 }))
    await env.DB.prepare("UPDATE price_uploads SET status = 'ready_to_publish' WHERE id = ?").bind(id).run()
    await expect(publishDraft(env, 'nepar', id)).rejects.toThrow('nije spreman')
    const corrected = parseMarketinoCsv(input.replace('abc', '12'), parsed.priceList.tenant)
    const replacement = await createDraft(env, 'nepar', corrected.priceList, 'corrected.csv', 'csv')
    expect(replacement.validation.status).toBe('ready_to_publish')
    await expect(publishDraft(env, 'nepar', replacement.draft!.id)).resolves.toMatchObject({ changed: true })
  })
})
