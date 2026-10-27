import type { D1DatabaseLike } from '../db'
import type { MonitorTrigger } from './types'

export type MonitorMessage = { jobId: string } | { cron: string; now: string; afterSlug: string }
export type MonitorQueue = { send(body: MonitorMessage): Promise<void> }
export type MonitorJob = {
  id: string; tenant_id: string; slug: string; run_trigger: MonitorTrigger
  status: 'queued' | 'running' | 'notifying' | 'completed' | 'skipped' | 'failed'
  requested_at: string; updated_at: string; lease_token: string | null; lease_until: string | null
  cursor: number; total: number; payload_json: string | null; result_run_id: string | null; error: string | null
}

export async function enqueueMonitorCheck(db: D1DatabaseLike, queue: MonitorQueue, slug: string, trigger: MonitorTrigger, now = new Date()) {
  const tenant = await db.prepare('SELECT id FROM tenants WHERE slug = ?').bind(slug).first<{ id: string }>()
  if (!tenant) return null
  const stamp = now.toISOString()
  await db.prepare(`INSERT OR IGNORE INTO monitor_jobs (id, tenant_id, slug, run_trigger, requested_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), tenant.id, slug, trigger, stamp, stamp).run()
  const job = await db.prepare("SELECT * FROM monitor_jobs WHERE tenant_id = ? AND status IN ('queued', 'running', 'notifying') LIMIT 1").bind(tenant.id).first<MonitorJob>()
  if (!job) throw new Error('monitor_job_missing')
  // Re-sending an existing active job also repairs a failed producer attempt.
  await queue.send({ jobId: job.id })
  return job
}

export async function latestMonitorJob(db: D1DatabaseLike, tenantId: string) {
  const job = await db.prepare('SELECT id, status, cursor, total, requested_at, updated_at, result_run_id FROM monitor_jobs WHERE tenant_id = ? ORDER BY requested_at DESC, rowid DESC LIMIT 1')
    .bind(tenantId).first<Pick<MonitorJob, 'id' | 'status' | 'cursor' | 'total' | 'requested_at' | 'updated_at' | 'result_run_id'>>()
  return job ? { id: job.id, status: job.status, checked: job.cursor, total: job.total, requestedAt: job.requested_at, updatedAt: job.updated_at, runId: job.result_run_id } : null
}
