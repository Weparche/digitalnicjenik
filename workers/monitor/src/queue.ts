import { advanceMonitorState } from '../../../shared/compliance/alert-state'
import { checkArchiveRow, runTenantCheck, type PreparedCheck } from '../../../shared/compliance/run-check'
import { insertRunStatement, readState, writeStateStatement } from '../../../shared/compliance/store'
import type { MonitorJob, MonitorMessage, MonitorQueue } from '../../../shared/compliance/jobs'
import type { AlertKind, MonitorState } from '../../../shared/compliance/types'
import { budgetedFetch } from '../../../shared/compliance/transport'
import { recordMonitorNotifications } from '../../../shared/monitor-notifications'
import { dispatchLifecycle } from '../../../shared/lifecycle'
import type { Env } from './index'

type CheckPayload = PreparedCheck & { notification?: { kind: AlertKind; before: MonitorState; after: MonitorState } }
export const ARCHIVE_BATCH_SIZE = 10
export class MonitorLeaseBusy extends Error {}

async function saveProgress(env: Env, job: MonitorJob, token: string, prepared: CheckPayload, cursor: number) {
  const saved = await env.DB.prepare(`UPDATE monitor_jobs SET payload_json = ?, cursor = ?, total = ?, updated_at = ?, lease_token = NULL, lease_until = NULL WHERE id = ? AND lease_token = ?`)
    .bind(JSON.stringify(prepared), cursor, prepared.archive.rows.length, new Date().toISOString(), job.id, token).run()
  if (!saved.meta?.changes) throw new MonitorLeaseBusy('monitor_lease_lost')
  await env.MONITOR_QUEUE!.send({ jobId: job.id })
}

async function notify(env: Env, job: MonitorJob, prepared: CheckPayload) {
  await recordMonitorNotifications(env,prepared.run,prepared.tenant)
  await dispatchLifecycle(env)
  await env.DB.prepare("UPDATE monitor_jobs SET status = 'completed', updated_at = ?, lease_token = NULL, lease_until = NULL WHERE id = ? AND lease_token = ?")
    .bind(new Date().toISOString(), job.id, job.lease_token).run()
}

/** A delivery handles at most ten versions; every redirect is included in the HTTP budget. */
export async function processMonitorJob(env: Env, jobId: string, fetcher: typeof fetch = fetch) {
  const stamp = new Date().toISOString()
  const token = crypto.randomUUID()
  const claim = await env.DB.prepare(`UPDATE monitor_jobs SET lease_token = ?, lease_until = ?, updated_at = ?, status = CASE WHEN status = 'queued' THEN 'running' ELSE status END
    WHERE id = ? AND status IN ('queued', 'running', 'notifying') AND (lease_until IS NULL OR lease_until < ?)`)
    .bind(token, new Date(Date.now() + 300_000).toISOString(), stamp, jobId, stamp).run()
  if (!claim.meta?.changes) {
    const row = await env.DB.prepare('SELECT status FROM monitor_jobs WHERE id = ?').bind(jobId).first<{ status: string }>()
    if (row && ['queued', 'running', 'notifying'].includes(row.status)) throw new MonitorLeaseBusy('monitor_job_busy')
    return
  }
  const job = await env.DB.prepare('SELECT * FROM monitor_jobs WHERE id = ?').bind(jobId).first<MonitorJob>()
  if (!job) throw new Error('monitor_job_missing')
  const started = Date.now()
  try {
    if (job.status === 'notifying') { await notify(env, job, JSON.parse(job.payload_json!) as CheckPayload); return }
    const bounded = budgetedFetch(fetcher)
    let prepared: CheckPayload
    if (!job.payload_json) {
      const result = await runTenantCheck(env, { slug: job.slug, trigger: job.run_trigger, now: new Date(job.requested_at), deferArchive: true, runId: job.id, fetcher: bounded.fetcher })
      if (result.status === 'skipped') {
        await env.DB.prepare("UPDATE monitor_jobs SET status = 'skipped', error = ?, updated_at = ?, lease_token = NULL, lease_until = NULL WHERE id = ? AND lease_token = ?").bind(result.reason, stamp, job.id, token).run()
        return
      }
      if (result.status !== 'prepared') throw new Error('monitor_preparation_failed')
      prepared = result
      if (prepared.archive.rows.length) { await saveProgress(env, job, token, prepared, 0); return }
    } else prepared = JSON.parse(job.payload_json) as CheckPayload

    let cursor = job.cursor
    const end = Math.min(cursor + ARCHIVE_BATCH_SIZE, prepared.archive.rows.length)
    while (cursor < end && bounded.budget.remaining >= 12) {
      await checkArchiveRow(bounded.fetcher, prepared, cursor)
      cursor++
    }
    if (job.payload_json) prepared.run.durationMs += Date.now() - started
    if (cursor < prepared.archive.rows.length) { await saveProgress(env, job, token, prepared, cursor); return }

    // A newer publication invalidates this snapshot. Never apply stale health or alerts.
    const current = await env.DB.prepare('SELECT id FROM price_publications WHERE tenant_id = ? AND is_current = 1').bind(job.tenant_id).first<{ id: string }>()
    if (current?.id !== prepared.run.publicationId) {
      await env.DB.prepare("UPDATE monitor_jobs SET status = 'skipped', error = 'publication_changed', lease_token = NULL, lease_until = NULL, updated_at = ? WHERE id = ? AND lease_token = ?").bind(stamp, job.id, token).run()
      return
    }
    const previous = await readState(env.DB, job.tenant_id)
    const { state, alert } = advanceMonitorState(previous, prepared.run.overall, new Date(job.requested_at))
    if (alert) prepared.notification = { kind: alert, before: previous, after: state }
    // Run, health state and phase transition are one D1 transaction.
    await env.DB.batch([
      insertRunStatement(env.DB, prepared.run),
      writeStateStatement(env.DB, state),
      env.DB.prepare("UPDATE monitor_jobs SET status = 'notifying', cursor = ?, total = ?, payload_json = ?, result_run_id = ?, updated_at = ? WHERE id = ? AND lease_token = ?")
        .bind(cursor, prepared.archive.rows.length, JSON.stringify(prepared), prepared.run.id, stamp, job.id, token),
    ])
    await notify(env, job, prepared)
  } catch (error) {
    await env.DB.prepare('UPDATE monitor_jobs SET lease_token = NULL, lease_until = NULL, error = ?, updated_at = ? WHERE id = ? AND lease_token = ?')
      .bind(error instanceof Error ? error.message.slice(0, 200) : 'monitor_error', new Date().toISOString(), jobId, token).run()
    throw error
  }
}

export async function failMonitorJob(env: Env, jobId: string) {
  const job = await env.DB.prepare('SELECT * FROM monitor_jobs WHERE id = ?').bind(jobId).first<MonitorJob>()
  if (!job || !['queued', 'running', 'notifying'].includes(job.status)) return
  const prepared = job.payload_json ? JSON.parse(job.payload_json) as CheckPayload : null
  if (prepared?.notification) {
    const { before, after } = prepared.notification
    await writeStateStatement(env.DB, { ...after, lastAlertAt: before.lastAlertAt, lastAlertKind: before.lastAlertKind, alertOpen: before.alertOpen }).run()
  }
  await env.DB.prepare("UPDATE monitor_jobs SET status = 'failed', lease_token = NULL, lease_until = NULL, error = 'retries_exhausted', updated_at = ? WHERE id = ? AND status IN ('queued', 'running', 'notifying')").bind(new Date().toISOString(), job.id).run()
}

export type QueueMessageLike = { body: MonitorMessage; ack(): void; retry(options?: { delaySeconds: number }): void }
export type QueueBatchLike = { queue: string; messages: QueueMessageLike[] }
export type QueueEnv = { MONITOR_QUEUE?: MonitorQueue }
