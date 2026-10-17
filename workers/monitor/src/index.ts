import { runTenantCheck, type MonitorEnv } from '../../../shared/compliance/run-check'
import { listMonitorTargets, selectRetryTargets, type MonitorTarget } from '../../../shared/compliance/store'
import type { MonitorTrigger } from '../../../shared/compliance/types'
import { sendAlert, type AlertEnv } from './alert'

export type Env = MonitorEnv & AlertEnv & { MONITOR_SECRET?: string }

/** Must match `triggers.crons` in wrangler.jsonc: the second pass retries warn/fail/unchecked tenants only. */
export const RETRY_CRON = '30 5 * * *'
const CONCURRENCY = 4
const RETRY_LOOKBACK_MS = 6 * 60 * 60 * 1000

type ScheduledEventLike = { cron: string; scheduledTime?: number }
type ExecutionContextLike = { waitUntil: (promise: Promise<unknown>) => void }

function timingSafeEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left)
  const b = new TextEncoder().encode(right)
  let diff = a.length ^ b.length
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return diff === 0
}

/** One check + alert delivery. The same function serves cron, retry and manual runs. */
export async function checkAndAlert(env: Env, slug: string, trigger: MonitorTrigger, now = new Date(), fetcher?: typeof fetch) {
  const result = await runTenantCheck(env, { slug, trigger, now, fetcher })
  if (result.status === 'checked' && result.alert) {
    await sendAlert(env, result.alert, result.run, result.tenant)
  }
  return result
}

async function mapWithConcurrency<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  const queue = [...items]
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let next = queue.shift(); next; next = queue.shift()) await task(next)
  }))
}

export async function runScheduled(env: Env, cron: string, now = new Date(), fetcher?: typeof fetch) {
  const retry = cron === RETRY_CRON
  const all = await listMonitorTargets(env.DB)
  const targets: MonitorTarget[] = retry ? await selectRetryTargets(env.DB, all, new Date(now.getTime() - RETRY_LOOKBACK_MS).toISOString()) : all
  const trigger: MonitorTrigger = retry ? 'retry' : 'cron'
  const summary = { trigger, tenants: targets.length, ok: 0, warn: 0, fail: 0, skipped: 0, errors: 0 }
  await mapWithConcurrency(targets, CONCURRENCY, async (target) => {
    try {
      const result = await checkAndAlert(env, target.slug, trigger, now, fetcher)
      if (result.status === 'skipped') summary.skipped += 1
      else summary[result.run.overall === 'skipped' ? 'skipped' : result.run.overall] += 1
    } catch (error) {
      summary.errors += 1
      console.error('monitor_check_failed', JSON.stringify({ slug: target.slug, reason: error instanceof Error ? error.message : 'unknown' }))
    }
  })
  console.log('monitor_summary', JSON.stringify(summary))
  return summary
}

export default {
  async scheduled(event: ScheduledEventLike, env: Env, ctx: ExecutionContextLike) {
    ctx.waitUntil(runScheduled(env, event.cron))
  },

  /** `POST /run {"slug": "..."}` with `Authorization: Bearer MONITOR_SECRET` — called by the Pages API for "Provjeri sada". */
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname !== '/run') return new Response('Not Found', { status: 404 })
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
    const auth = request.headers.get('authorization') ?? ''
    if (!env.MONITOR_SECRET || !timingSafeEqual(auth, `Bearer ${env.MONITOR_SECRET}`)) return new Response('Unauthorized', { status: 401 })
    const body = await request.json().catch(() => null) as { slug?: unknown } | null
    if (!body || typeof body.slug !== 'string' || !body.slug) return Response.json({ error: 'invalid_input' }, { status: 400 })
    try {
      const result = await checkAndAlert(env, body.slug, 'manual')
      if (result.status === 'skipped') return Response.json({ status: 'skipped', reason: result.reason })
      return Response.json({ status: 'checked', run: result.run })
    } catch (error) {
      console.error('monitor_manual_failed', JSON.stringify({ slug: body.slug, reason: error instanceof Error ? error.message : 'unknown' }))
      return Response.json({ error: 'check_failed' }, { status: 500 })
    }
  },
}
