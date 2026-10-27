import { beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { createDraft, publishDraft } from '../../../functions/_repository'
import { renderCsv } from '../../../src/price-engine/csv'
import { renderXml } from '../../../src/price-engine/xml'
import type { NormalizedPriceList } from '../../../src/price-engine/types'
import { enqueueMonitorCheck, latestMonitorJob, type MonitorMessage } from '../../../shared/compliance/jobs'
import { readLimitedBytes, MAX_FEED_BYTES } from '../../../shared/compliance/transport'
import { readLatestRun } from '../../../shared/compliance/store'
import { failMonitorJob, processMonitorJob } from './queue'
import worker, { type Env } from './index'

const NOW = new Date('2026-10-27T07:00:00Z')
const list: NormalizedPriceList = { tenant: { id: 'nepar', slug: 'nepar', name: 'NEPAR' }, source: 'nepar', currency: 'EUR', updatedAt: NOW.toISOString(), items: [{ name: 'Test', type: 'Usluga', price: 10, anchorPrice: 10, specialSaleApplied: false }] }
const messages: MonitorMessage[] = []
const sent: string[] = []
const runtime = (): Env => ({ DB: env.DB, MONITOR_QUEUE: { send: async body => { messages.push(body) } }, EMAIL_FROM: 'publisher@nepar.hr', EMAIL_TO: 'ops@nepar.hr', EMAIL: { send: async message => { sent.push(String(message.to)); return {} } } })

async function seed(archives = 0) {
  const draft = await createDraft(env, 'nepar', list, 'list.csv', 'test')
  const result = await publishDraft(env, 'nepar', draft.draft!.id)
  const publication = result.publication!
  for (let i = 0; i < archives; i++) await env.DB.prepare("INSERT INTO price_publications (id, tenant_id, price_list_id, sequence, filename_stem, published_at, superseded_at, public_until, hash, payload_json, is_current) VALUES (?, 'nepar', ?, ?, ?, ?, ?, ?, 'h', ?, 0)")
    .bind(`archive-${i}`, publication.priceListId, i + 2, `old-${i}`, NOW.toISOString(), NOW.toISOString(), '2026-11-26T07:00:00Z', JSON.stringify(list)).run()
  return publication
}

describe('queued monitor', () => {
  beforeEach(async () => {
    messages.length = 0; sent.length = 0
    await env.DB.batch(['monitor_deliveries', 'monitor_jobs', 'monitor_runs', 'monitor_state', 'sync_logs', 'price_publications', 'price_list_versions', 'price_uploads', 'publication_targets', 'publication_metadata', 'entitlements', 'tenants'].map(table => env.DB.prepare(`DELETE FROM ${table}`)))
  })
  it('checkpoints a large archive, never reports partial success, and ignores duplicate deliveries', async () => {
    const publication = await seed(35)
    const runtimeEnv = runtime()
    const job = await enqueueMonitorCheck(env.DB, runtimeEnv.MONITOR_QUEUE!, 'nepar', 'manual', NOW)
    expect((await enqueueMonitorCheck(env.DB, runtimeEnv.MONITOR_QUEUE!, 'nepar', 'manual', NOW))?.id).toBe(job?.id)
    let requests = 0
    const fetcher: typeof fetch = async input => {
      requests++
      const url = String(input)
      if (url.endsWith('/cjenik.csv')) return new Response(renderCsv(list), { headers: { 'content-disposition': `inline; filename="${publication.filenameStem}.csv"` } })
      if (url.endsWith('/cjenik.xml')) return new Response('down', { status: 500 })
      return new Response('ok')
    }
    await processMonitorJob(runtimeEnv, job!.id, fetcher)
    expect(await readLatestRun(env.DB, 'nepar')).toBeNull()
    expect(sent).toEqual([])
    for (let pass = 0; pass < 4; pass++) {
      const before = requests
      await processMonitorJob(runtimeEnv, job!.id, fetcher)
      expect(requests - before).toBeLessThanOrEqual(20)
      if (pass < 3) expect(await readLatestRun(env.DB, 'nepar')).toBeNull()
    }
    expect(await latestMonitorJob(env.DB, 'nepar')).toMatchObject({ status: 'completed', checked: 35, total: 35 })
    expect((await readLatestRun(env.DB, 'nepar'))?.overall).toBe('fail')
    expect(sent).toEqual(['ops@nepar.hr'])
    await processMonitorJob(runtimeEnv, job!.id, fetcher)
    expect(sent).toEqual(['ops@nepar.hr'])
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM monitor_runs').first<{ n: number }>())?.n).toBe(1)
  })
  it('recovers after an owner delivery failure without repeating a successful recipient', async () => {
    const publication = await seed()
    await env.DB.prepare("INSERT INTO auth_users (id, email, created_at, updated_at) VALUES ('owner', 'owner@example.hr', ?, ?)").bind(NOW.toISOString(), NOW.toISOString()).run()
    await env.DB.prepare("INSERT INTO tenant_members (id, tenant_id, user_id, role, created_at) VALUES ('member-owner', 'nepar', 'owner', 'owner', ?)").bind(NOW.toISOString()).run()
    const runtimeEnv = runtime()
    let unavailable = true
    runtimeEnv.EMAIL = { send: async message => { if (unavailable && message.to === 'owner@example.hr') throw new Error('temporary'); sent.push(String(message.to)); return {} } }
    const job = await enqueueMonitorCheck(env.DB, runtimeEnv.MONITOR_QUEUE!, 'nepar', 'manual', NOW)
    const fetcher: typeof fetch = async input => String(input).endsWith('/cjenik.csv') ? new Response(renderCsv(list), { headers: { 'content-disposition': `inline; filename="${publication.filenameStem}.csv"` } }) : new Response('down', { status: 500 })
    await expect(processMonitorJob(runtimeEnv, job!.id, fetcher)).rejects.toThrow('delivery_incomplete')
    unavailable = false
    await processMonitorJob(runtimeEnv, job!.id, fetcher)
    expect(sent.filter(to => to === 'ops@nepar.hr')).toHaveLength(1)
    expect(sent.filter(to => to === 'owner@example.hr')).toHaveLength(1)
  })
  it('marks exhausted jobs failed, rather than successful', async () => {
    await seed()
    const job = await enqueueMonitorCheck(env.DB, runtime().MONITOR_QUEUE!, 'nepar', 'manual', NOW)
    await failMonitorJob(runtime(), job!.id)
    expect(await latestMonitorJob(env.DB, 'nepar')).toMatchObject({ status: 'failed' })
    expect(await readLatestRun(env.DB, 'nepar')).toBeNull()
  })
  it('enforces the byte limit even when Content-Length is absent', async () => {
    await expect(readLimitedBytes(new Response(new Uint8Array(MAX_FEED_BYTES + 1)))).rejects.toThrow('5 MB')
  })
  it('dispatches ten tenants per scheduler message and no feeds inside cron', async () => {
    await seed()
    let acked = false
    await worker.queue({ queue: 'digitalnicjenik-monitor', messages: [{ body: { cron: '30 4 * * *', now: NOW.toISOString(), afterSlug: '' }, ack: () => { acked = true }, retry: () => { throw new Error('unexpected retry') } }] }, runtime())
    expect(acked).toBe(true)
    expect(messages.some(message => 'jobId' in message)).toBe(true)
    expect(await readLatestRun(env.DB, 'nepar')).toBeNull()
  })
})
