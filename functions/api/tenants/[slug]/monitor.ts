import { latestMonitorJob } from '../../../../shared/compliance/jobs'
import { complianceRules, getRuleset, isComplianceProfile } from '../../../../shared/compliance/rulesets'
import { claimManualRun, readLatestRun, readRunHistory, readState } from '../../../../shared/compliance/store'
import type { MonitorRunRecord } from '../../../../shared/compliance/types'
import type { AuthEnv } from '../../../_auth'
import type { RuntimeEnv } from '../../../_repository'
import { accessErrorResponse, requireOwnerOrOperator, requirePlanFeature } from '../../../_write-auth'

type MonitorBinding = { fetch: (input: Request | string, init?: RequestInit) => Promise<Response> }
type MonitorApiEnv = RuntimeEnv & AuthEnv & { MONITOR?: MonitorBinding; MONITOR_SECRET?: string }

const HISTORY_DAYS = 14
const noStore = { 'cache-control': 'no-store' }

const compact = (run: MonitorRunRecord) => ({ id: run.id, checkedAt: run.checkedAt, overall: run.overall, trigger: run.trigger, expectedRows: run.expectedRows })

/** Read-only: latest run, 14-day history and the ruleset that applies. Never runs any check. */
export const onRequestGet = async ({ request, params, env }: { request: Request; params: Record<string, string>; env: MonitorApiEnv }) => {
  try {
    const tenant = await requireOwnerOrOperator({ request, env, slug: params.slug })
    await requirePlanFeature(env, tenant.id, 'monitoring')
    const db = env.DB!
    const [latest, history, state, metadata, job] = await Promise.all([
      readLatestRun(db, tenant.id),
      readRunHistory(db, tenant.id, new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString()),
      readState(db, tenant.id),
      db.prepare('SELECT compliance_profile FROM publication_metadata WHERE tenant_id = ?').bind(tenant.id).first<{ compliance_profile: string }>(),
      latestMonitorJob(db, tenant.id),
    ])
    const ruleset = complianceRules[latest?.ruleset ?? ''] ?? getRuleset()
    const profile = isComplianceProfile(metadata?.compliance_profile) ? metadata.compliance_profile : 'products'
    return Response.json({
      latest,
      job,
      history: history.map(compact),
      alertOpen: state.alertOpen,
      lastOkAt: state.lastOkAt,
      ruleset: { id: ruleset.id, label: ruleset.label },
      profile: { id: profile, label: ruleset.profiles[profile].label },
      schedule: { description: 'svaki dan prije 08:00 (Europe/Zagreb)' },
    }, { headers: noStore })
  } catch (error) {
    return accessErrorResponse(error) ?? Response.json({ error: 'Nadzor trenutno nije dostupan.' }, { status: 500, headers: noStore })
  }
}

/**
 * "Provjeri sada": authorises, rate-limits atomically, then delegates to the monitor Worker via service binding.
 * No check logic runs here, so cron, retry and manual runs share one implementation.
 */
export const onRequestPost = async ({ request, params, env }: { request: Request; params: Record<string, string>; env: MonitorApiEnv }) => {
  try {
    const tenant = await requireOwnerOrOperator({ request, env, slug: params.slug })
    await requirePlanFeature(env, tenant.id, 'monitoring')
    if (!env.MONITOR || !env.MONITOR_SECRET) {
      return Response.json({ error: 'Nadzor nije konfiguriran.', code: 'monitor_unavailable' }, { status: 503, headers: noStore })
    }
    if (!await claimManualRun(env.DB!, tenant.id, new Date())) {
      return Response.json({ error: 'Provjera je nedavno pokrenuta. Pokušajte ponovno za nekoliko minuta.', code: 'rate_limited' }, { status: 429, headers: { ...noStore, 'retry-after': '300' } })
    }
    const response = await env.MONITOR.fetch('https://digitalnicjenik-monitor/run', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.MONITOR_SECRET}`, 'content-type': 'application/json' },
      body: JSON.stringify({ slug: tenant.slug }),
    })
    if (!response.ok) return Response.json({ error: 'Provjera nije uspjela.', code: 'monitor_failed' }, { status: 502, headers: noStore })
    const body = await response.json() as { status: 'checked' | 'skipped' | 'queued'; run?: MonitorRunRecord; reason?: string; jobId?: string }
    if (body.status === 'queued') return Response.json({ status: 'queued', jobId: body.jobId }, { status: 202, headers: noStore })
    if (body.status === 'skipped') return Response.json({ status: 'skipped', reason: body.reason }, { headers: noStore })
    return Response.json({ status: 'checked', run: body.run }, { headers: noStore })
  } catch (error) {
    return accessErrorResponse(error) ?? Response.json({ error: 'Provjera nije uspjela.', code: 'monitor_failed' }, { status: 500, headers: noStore })
  }
}
