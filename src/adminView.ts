export type AdminTenant = {
  slug: string
  name: string
  plan: string | null
  status: string | null
  periodEnd: string | null
  ownerEmail: string | null
  monitorOverall: string | null
  monitorCheckedAt: string | null
  request: { intent: string; createdAt: string | null; email: string | null } | null
}

export type AdminState = 'active' | 'trial' | 'expired' | 'none'

const DAY_MS = 86_400_000

/** Effective state: a stored `active`/`trial` whose period_end has passed is expired (public output returns 410). */
export function adminState(tenant: Pick<AdminTenant, 'status' | 'periodEnd'>, now = Date.now()): AdminState {
  if (!tenant.status) return 'none'
  const ended = tenant.periodEnd !== null && new Date(tenant.periodEnd).getTime() < now
  if (tenant.status === 'expired' || tenant.status === 'suspended' || ended) return 'expired'
  return tenant.status === 'trial' ? 'trial' : 'active'
}

export function daysLeft(periodEnd: string | null, now = Date.now()) {
  if (!periodEnd) return null
  return Math.ceil((new Date(periodEnd).getTime() - now) / DAY_MS)
}

/** Mirrors nextPeriodEnd() on the server: MAX(now, period_end) + 365 days. */
export function projectedPeriodEnd(periodEnd: string | null, now = Date.now()) {
  const base = Math.max(now, periodEnd ? new Date(periodEnd).getTime() : 0)
  return new Date(base + 365 * DAY_MS).toISOString()
}

export const STATE_LABEL: Record<AdminState, string> = {
  active: 'Aktivan',
  trial: 'Probno',
  expired: 'Istekao — javni cjenik je ugašen',
  none: 'Bez licence',
}

export const REQUEST_LABEL: Record<string, string> = {
  self_service: 'Čeka uplatu — Publisher',
  implementation: 'Čeka uplatu — s postavljanjem',
  consultation: 'Traži pomoć',
}

/** Requests that mean "I will pay" — only these are treated as awaiting payment. */
export const isPaymentRequest = (request: AdminTenant['request']) => request !== null && request.intent !== 'consultation'
