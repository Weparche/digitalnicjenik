import { enqueueMonitorCheck, type MonitorQueue } from '../../../shared/compliance/jobs'
import { failMonitorJob, MonitorLeaseBusy, processMonitorJob, type QueueBatchLike } from './queue'
import { runTenantCheck, type MonitorEnv } from '../../../shared/compliance/run-check'
import { listMonitorTargets, selectRetryTargets, type MonitorTarget } from '../../../shared/compliance/store'
import type { MonitorTrigger } from '../../../shared/compliance/types'
import { sendAlert, type AlertEnv } from './alert'
import { cleanupExpiredDrafts, type DraftCleanupEnv } from '../../../shared/draft-cleanup'
import { dailyPublication } from '../../../shared/daily-publication'
import { scheduleLifecycle, dispatchLifecycle } from '../../../shared/lifecycle'
import { recordMonitorNotifications } from '../../../shared/monitor-notifications'

export type Env = MonitorEnv & AlertEnv & DraftCleanupEnv & { MONITOR_SECRET?: string; MONITOR_QUEUE?: MonitorQueue }

/** Must match `triggers.crons` in wrangler.jsonc: the second pass retries warn/fail/unchecked tenants only. */
export const RETRY_CRON = '30 5 * * *'
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
  if (result.status === 'checked') {
    await recordMonitorNotifications(env,result.run,result.tenant)
    await dispatchLifecycle(env)
  }
  return result
}

/** Dispatch ten tenants at a time so the scheduler itself has a bounded I/O budget. */
export async function runScheduled(env: Env, cron: string, now = new Date(), afterSlug = '') {
  if (!env.MONITOR_QUEUE) throw new Error('monitor_queue_unavailable')
  const retry = cron === RETRY_CRON
  const all = await listMonitorTargets(env.DB, afterSlug, 10)
  const targets: MonitorTarget[] = retry ? await selectRetryTargets(env.DB, all, new Date(now.getTime() - RETRY_LOOKBACK_MS).toISOString()) : all
  const trigger: MonitorTrigger = retry ? 'retry' : 'cron'
  const watchdog = cron === '15 5 * * *' || cron === '15 6 * * *'
  if (env.DAILY_PUBLICATION_ENABLED === 'true') {
    for (const target of all) await env.MONITOR_QUEUE.send({ dailySlug: target.slug, watchdog, now: now.toISOString(), trigger })
  } else if (!watchdog) {
    for (const target of targets) await enqueueMonitorCheck(env.DB, env.MONITOR_QUEUE, target.slug, trigger, now)
  }
  if (all.length === 10) await env.MONITOR_QUEUE.send({ cron, now: now.toISOString(), afterSlug: all[all.length - 1].slug })
  return { trigger, tenants: targets.length, queued: targets.length }
}

export default {
  async scheduled(event: ScheduledEventLike, env: Env, ctx: ExecutionContextLike) {
    if (!env.MONITOR_QUEUE) throw new Error('monitor_queue_unavailable')
    const stamp = new Date(event.scheduledTime ?? Date.now())
    if (event.cron === '0 * * * *') {
      ctx.waitUntil((async () => { await scheduleLifecycle(env,stamp); await dispatchLifecycle(env,stamp) })())
    } else ctx.waitUntil(env.MONITOR_QUEUE.send({ cron: event.cron, now: stamp.toISOString(), afterSlug: '' }))
    ctx.waitUntil(cleanupExpiredDrafts(env))
  },

  async queue(batch: QueueBatchLike, env: Env) {
    // Configuration uses max_batch_size=1; also enforce it if a binding drifts.
    const [message, ...extra] = batch.messages
    for (const deferred of extra) deferred.retry({ delaySeconds: 1 })
    if (!message) return
    try {
      if ('dailySlug' in message.body) {
        if (batch.queue === 'digitalnicjenik-monitor-dlq') {
          await dailyPublication(env,message.body.dailySlug,new Date(),'force')
        } else {
          await dailyPublication(env,message.body.dailySlug,new Date(),message.body.watchdog)
          if (!message.body.watchdog) await enqueueMonitorCheck(env.DB,env.MONITOR_QUEUE!,message.body.dailySlug,message.body.trigger)
        }
        await dispatchLifecycle(env)
      } else if ('jobId' in message.body && typeof message.body.jobId === 'string') {
        if (batch.queue === 'digitalnicjenik-monitor-dlq') await failMonitorJob(env, message.body.jobId)
        else await processMonitorJob(env, message.body.jobId)
      } else if ('cron' in message.body && batch.queue !== 'digitalnicjenik-monitor-dlq') {
        await runScheduled(env, message.body.cron, new Date(message.body.now), message.body.afterSlug)
      } else throw new Error('monitor_invalid_message')
      message.ack()
    } catch (error) {
      console.error('monitor_queue_failed', JSON.stringify({ reason: error instanceof Error ? error.message : 'unknown' }))
      message.retry({ delaySeconds: error instanceof MonitorLeaseBusy ? 60 : 30 })
    }
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
      if (!env.MONITOR_QUEUE) return Response.json({ error: 'monitor_queue_unavailable' }, { status: 503 })
      const job = await enqueueMonitorCheck(env.DB, env.MONITOR_QUEUE, body.slug, 'manual')
      if (!job) return Response.json({ status: 'skipped', reason: 'unknown_tenant' })
      return Response.json({ status: 'queued', jobId: job.id }, { status: 202 })
    } catch (error) {
      console.error('monitor_manual_failed', JSON.stringify({ slug: body.slug, reason: error instanceof Error ? error.message : 'unknown' }))
      return Response.json({ error: 'check_failed' }, { status: 500 })
    }
  },
}
