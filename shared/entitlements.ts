import type { Entitlement } from '../src/price-engine/types'

/** Single source of truth for "is this tenant's public output live". Used by Pages Functions and the monitor Worker. */
export const PAID_GRACE_MS = 7 * 24 * 60 * 60 * 1000
export type AccessState = 'none' | 'trial' | 'active' | 'grace' | 'expired' | 'suspended'
export function entitlementAccess(entitlement: Entitlement | null, now = Date.now()) {
  let state: AccessState = 'none'
  let accessUntil = entitlement?.periodEnd ?? null
  if (entitlement?.status === 'suspended') state = 'suspended'
  else if (entitlement && entitlement.plan !== 'validator' && entitlement.periodEnd) {
    const paidEnd = Date.parse(entitlement.periodEnd)
    const eligible = entitlement.status !== 'trial' && Boolean(entitlement.paidConfirmedAt && entitlement.graceUntil)
    // Never let a corrupt/old grace timestamp extend the configured seven days.
    const graceEnd = eligible ? Math.min(Date.parse(entitlement.graceUntil!), paidEnd + PAID_GRACE_MS) : NaN
    if (eligible && Number.isFinite(graceEnd)) accessUntil = new Date(graceEnd).toISOString()
    if (now < paidEnd && (entitlement.status === 'active' || entitlement.status === 'trial')) state = entitlement.status
    else if (eligible && now >= paidEnd && now < graceEnd) state = 'grace'
    else state = 'expired'
  }
  return { state, live: state === 'trial' || state === 'active' || state === 'grace', periodEnd: entitlement?.periodEnd ?? null, graceUntil: entitlement?.paidConfirmedAt ? entitlement.graceUntil ?? null : null, accessUntil }
}
export function entitlementIsLive(entitlement: Entitlement | null, now = Date.now()) {
  return entitlementAccess(entitlement, now).live
}

export type PlanFeatures = {
  publish: boolean
  upload: boolean
  archive: boolean
  qr: boolean
  pdf: boolean
  embed: boolean
  editItems: boolean
  monitoring: boolean
  alerts: boolean
  staticWebsite: boolean
}

const NONE: PlanFeatures = { publish: false, upload: false, archive: false, qr: false, pdf: false, embed: false, editItems: false, monitoring: false, alerts: false, staticWebsite: false }
const PUBLICATION: PlanFeatures = { ...NONE, publish: true, upload: true, archive: true, qr: true, pdf: true, embed: true }
const MANAGEMENT: PlanFeatures = { ...PUBLICATION, editItems: true, monitoring: true, alerts: true }

/**
 * The single permission map. Callers ask for a feature (`featuresForPlan(plan).monitoring`), never for a plan name.
 * Web Link = publication (link, CSV/XML, archive, QR/PDF/embed, replacing the whole file).
 * Publisher = Web Link + editing single items, daily monitoring and alerts.
 */
export function featuresForPlan(plan: Entitlement['plan'] | null | undefined): PlanFeatures {
  if (plan === 'web_link') return PUBLICATION
  if (plan === 'managed') return { ...MANAGEMENT, staticWebsite: true }
  if (plan === 'publisher_self_service') return MANAGEMENT
  return NONE
}

/** Plans whose tenants may publish; mirrored by the SQL guard in publishDraft(). */
export const PUBLISHING_PLANS = (['web_link', 'publisher_self_service', 'managed'] as const).filter((plan) => featuresForPlan(plan).publish)

/** SQL counterpart of entitlementIsLive for atomic writes and database filtering.
 * Arguments are internal SQL identifiers/parameters, never request input. */
export function liveEntitlementSql(alias:string, clock='?') {
  return `${alias}.plan IN (${PUBLISHING_PLANS.map(plan=>`'${plan}'`).join(',')}) AND ${alias}.status IN ('active','trial','expired') AND (
    (${alias}.status IN ('active','trial') AND julianday(${alias}.period_end)>julianday(${clock})) OR
    (${alias}.status!='trial' AND ${alias}.paid_confirmed_at IS NOT NULL AND ${alias}.paid_confirmed_at!='' AND
      julianday(${alias}.period_end)<=julianday(${clock}) AND julianday(${alias}.grace_until)>julianday(${clock}) AND julianday(${alias}.period_end,'+7 days')>julianday(${clock})))`
}
