import type { TrialEnv } from '../../_trial'
import { AccessDeniedError, accessErrorResponse, operatorAuthorized } from '../../_write-auth'

type Row = {
  slug: string
  name: string
  plan: string | null
  status: string | null
  period_end: string | null
  owner_email: string | null
  monitor_overall: string | null
  monitor_checked_at: string | null
}

/** Ops-only overview for /admin: every tenant with entitlement, owner e-mail and latest monitor result. */
export const onRequestGet = async ({ request, env }: { request: Request; env: TrialEnv }) => {
  try {
    if (!operatorAuthorized(env, request)) throw new AccessDeniedError(401, 'unauthorized', 'Operator key required.')
    if (!env.DB) throw new AccessDeniedError(503, 'db_unavailable', 'D1 binding DB nije konfiguriran.')
    const rows = await env.DB.prepare(
      `SELECT t.slug, t.name, e.plan, e.status, e.period_end,
         (SELECT u.email FROM tenant_members m JOIN auth_users u ON u.id = m.user_id WHERE m.tenant_id = t.id ORDER BY m.created_at LIMIT 1) AS owner_email,
         (SELECT r.overall FROM monitor_runs r WHERE r.tenant_id = t.id ORDER BY r.checked_at DESC LIMIT 1) AS monitor_overall,
         (SELECT r.checked_at FROM monitor_runs r WHERE r.tenant_id = t.id ORDER BY r.checked_at DESC LIMIT 1) AS monitor_checked_at
       FROM tenants t
       LEFT JOIN entitlements e ON e.id = (SELECT id FROM entitlements WHERE tenant_id = t.id ORDER BY created_at DESC LIMIT 1)
       ORDER BY (e.period_end IS NULL), e.period_end ASC, t.slug`,
    ).all<Row>()
    return Response.json({
      tenants: rows.results.map((row) => ({
        slug: row.slug,
        name: row.name,
        plan: row.plan,
        status: row.status,
        periodEnd: row.period_end,
        ownerEmail: row.owner_email,
        monitorOverall: row.monitor_overall,
        monitorCheckedAt: row.monitor_checked_at,
      })),
    }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    return accessErrorResponse(error) ?? Response.json({ error: 'Pregled trenutačno nije dostupan.' }, { status: 500, headers: { 'cache-control': 'no-store' } })
  }
}
