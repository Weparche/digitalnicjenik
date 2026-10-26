import type { D1DatabaseLike } from './_repository'
import { PLANS } from '../shared/pricing'
import { sanitizeAttribution } from '../shared/acquisition'

export type AttributionKind = 'lead' | 'signup' | 'trial' | 'upgrade'

export type FunnelRow = {
  source: string
  leads: number
  signups: number
  trials: number
  upgrades: number
  active: number
  activated_plan_value: number
}

const PLAN_VALUE: Record<string, number> = {
  link: PLANS.find((plan) => plan.id === 'link')!.price,
  publisher: PLANS.find((plan) => plan.id === 'publisher')!.price,
  publisher_self_service: PLANS.find((plan) => plan.id === 'publisher')!.price,
  web: PLANS.find((plan) => plan.id === 'web')!.price,
  managed: PLANS.find((plan) => plan.id === 'web')!.price,
}

function subjectId(value: string) {
  return /^[A-Za-z0-9_-]{1,80}$/.test(value) ? value : ''
}

/** Insert one funnel step. A repeated attribution_id + kind + subject_id is a no-op. Never throws. */
export async function recordAttribution(db: D1DatabaseLike | undefined, kind: AttributionKind, subject: string, raw: unknown) {
  const touch = sanitizeAttribution(raw)
  const id = subjectId(subject)
  if (!db || !touch || !id) return
  try {
    await db.prepare(
      `INSERT OR IGNORE INTO acquisition_attributions
        (id, attribution_id, kind, subject_id, utm_source, utm_medium, utm_campaign, utm_content, referrer_host, landing_path, first_seen, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      crypto.randomUUID(),
      touch.attribution_id,
      kind,
      id,
      touch.utm_source,
      touch.utm_medium,
      touch.utm_campaign,
      touch.utm_content,
      touch.referrer_host,
      touch.landing_path,
      touch.first_seen,
      new Date().toISOString(),
    ).run()
  } catch {
    // Attribution is auxiliary. Lead, signup, trial and upgrade must continue.
  }
}

type CountRow = { source: string; leads: number; signups: number; trials: number; upgrades: number }
type ActiveRow = { source: string; tenant_id: string; plan: string }

/** Read-only source funnel. activated_plan_value is the catalogue price of an active entitlement, not collected revenue. */
export async function acquisitionFunnel(db: D1DatabaseLike): Promise<FunnelRow[]> {
  const counts = await db.prepare(
    `SELECT utm_source AS source,
        SUM(CASE WHEN kind = 'lead' THEN 1 ELSE 0 END) AS leads,
        SUM(CASE WHEN kind = 'signup' THEN 1 ELSE 0 END) AS signups,
        SUM(CASE WHEN kind = 'trial' THEN 1 ELSE 0 END) AS trials,
        SUM(CASE WHEN kind = 'upgrade' THEN 1 ELSE 0 END) AS upgrades
     FROM acquisition_attributions
     GROUP BY utm_source
     ORDER BY utm_source`,
  ).all<CountRow>()
  const active = await db.prepare(
    `SELECT a.utm_source AS source, e.tenant_id AS tenant_id, e.plan AS plan
     FROM acquisition_attributions a
     INNER JOIN entitlements e ON e.tenant_id = a.subject_id AND e.status = 'active'
     WHERE a.kind = 'trial'`,
  ).all<ActiveRow>()

  const activeBySource = new Map<string, Map<string, number>>()
  for (const row of active.results || []) {
    const tenants = activeBySource.get(row.source) || new Map<string, number>()
    if (!tenants.has(row.tenant_id)) tenants.set(row.tenant_id, PLAN_VALUE[row.plan] || 0)
    activeBySource.set(row.source, tenants)
  }

  return (counts.results || []).map((row) => {
    const tenants = activeBySource.get(row.source)
    const activated = tenants ? [...tenants.values()].reduce((sum, value) => sum + value, 0) : 0
    return {
      source: row.source,
      leads: Number(row.leads) || 0,
      signups: Number(row.signups) || 0,
      trials: Number(row.trials) || 0,
      upgrades: Number(row.upgrades) || 0,
      active: tenants?.size || 0,
      activated_plan_value: activated,
    }
  })
}
