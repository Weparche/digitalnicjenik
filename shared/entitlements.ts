import type { Entitlement } from '../src/price-engine/types'

/** Single source of truth for "is this tenant's public output live". Used by Pages Functions and the monitor Worker. */
export function entitlementIsLive(entitlement: Entitlement | null, now = Date.now()) {
  if (!entitlement) return false
  if (entitlement.status !== 'trial' && entitlement.status !== 'active') return false
  if (entitlement.plan === 'validator') return false
  if (!entitlement.periodEnd) return false
  return new Date(entitlement.periodEnd).getTime() >= now
}
