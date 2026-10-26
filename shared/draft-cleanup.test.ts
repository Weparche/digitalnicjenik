import { beforeEach, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { cleanupExpiredDrafts } from './draft-cleanup'
import type { D1DatabaseLike } from './db'

beforeEach(async () => { await env.DB.prepare('DELETE FROM publisher_drafts').run() })

async function seed(id: string, expiresAt: string) {
  await env.DB.prepare("INSERT INTO publisher_drafts (id,payload_location,original_filename,content_type,created_at,expires_at,status) VALUES (?,?,'prices.csv','application/json','2020-01-01T00:00:00Z',?,'temporary')").bind(id, `drafts/${id}.json`, expiresAt).run()
}

it('removes expired private payloads while preserving live uploads', async () => {
  await seed('old', '2020-01-02T00:00:00Z'); await seed('live', '2099-01-01T00:00:00Z')
  const removed: string[] = []
  expect(await cleanupExpiredDrafts({ DB: env.DB as unknown as D1DatabaseLike, DRAFTS: { delete: async key => { removed.push(key) } } })).toBe(1)
  expect(removed).toEqual(['drafts/old.json'])
  expect((await env.DB.prepare('SELECT id FROM publisher_drafts').all<{ id: string }>()).results.map(row => row.id)).toEqual(['live'])
})

it('keeps the database row when object removal fails, so a later run can retry', async () => {
  await seed('old', '2020-01-02T00:00:00Z')
  await expect(cleanupExpiredDrafts({ DB: env.DB as unknown as D1DatabaseLike, DRAFTS: { delete: async () => { throw new Error('retry') } } })).rejects.toThrow('retry')
  expect(await env.DB.prepare("SELECT id FROM publisher_drafts WHERE id='old'").first()).not.toBeNull()
})
