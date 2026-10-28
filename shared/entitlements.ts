import type { Entitlement } from '../src/price-engine/types'

/** Single source of truth for "is this tenant's public output live". Used by Pages Functions and the monitor Worker. */
export function entitlementIsLive(entitlement: Entitlement | null, now = Date.now()) {
  if (!entitlement) return false
  if (entitlement.status !== 'trial' && entitlement.status !== 'active') return false
  if (entitlement.plan === 'validator') return false
  if (!entitlement.periodEnd) return false
  return new Date(entitlement.periodEnd).getTime() >= now
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
}

const NONE: PlanFeatures = { publish: false, upload: false, archive: false, qr: false, pdf: false, embed: false, editItems: false, monitoring: false, alerts: false }
const PUBLICATION: PlanFeatures = { ...NONE, publish: true, upload: true, archive: true, qr: true, pdf: true, embed: true }
const MANAGEMENT: PlanFeatures = { ...PUBLICATION, editItems: true, monitoring: true, alerts: true }

/**
 * The single permission map. Callers ask for a feature (`featuresForPlan(plan).monitoring`), never for a plan name.
 * Web Link = publication (link, CSV/XML, archive, QR/PDF/embed, replacing the whole file).
 * Publisher = Web Link + editing single items, daily monitoring and alerts.
 */
export function featuresForPlan(plan: Entitlement['plan'] | null | undefined): PlanFeatures {
  if (plan === 'web_link') return PUBLICATION
  if (plan === 'publisher_self_service' || plan === 'managed') return MANAGEMENT
  return NONE
}

/** Plans whose tenants may publish; mirrored by the SQL guard in publishDraft(). */
export const PUBLISHING_PLANS = (['web_link', 'publisher_self_service', 'managed'] as const).filter((plan) => featuresForPlan(plan).publish)
