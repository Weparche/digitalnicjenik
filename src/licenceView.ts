import type { PlanFeatures } from '../shared/entitlements'
import { entitlementAccess } from '../shared/entitlements'
import type { Entitlement } from './price-engine/types'
import type { OrderKind } from '../shared/payment'

export type OrderPayment = {
  reference: string
  kind: OrderKind
  status?: string
  paymentReportedAt?: string | null
  installation: boolean
  amountCents: number
  amountLabel: string
  customerType: 'company' | 'person'
  billingName: string
  oib: string | null
  address: string
  postalCity: string
  email: string
  createdAt: string
  description: string
  payee: { name: string; street: string; postalCity: string; iban: string; model: string }
  hub3: string
}

export type Licence = {
  tenant?:{id:string;slug:string;name:string}
  entitlement: (Pick<Entitlement,'plan'|'status'|'periodStart'|'periodEnd'|'paidConfirmedAt'|'graceUntil'>) | null
  features: PlanFeatures
  upgradeAvailable: boolean
  order: OrderPayment | null
  access?: ReturnType<typeof entitlementAccess>
}

/**
 * - free: the 24 h free publication, nothing ordered yet
 * - awaiting_payment: a Web Link order is waiting for the bank transfer (link still live)
 * - expired: the public link is switched off, data is kept
 * - web_link / publisher: paid and live
 */
export type LicenceState = 'none' | 'free' | 'awaiting_payment' | 'expired' | 'web_link' | 'publisher' | 'grace' | 'suspended'

export function licenceState(licence: Licence | null, now = Date.now()): LicenceState {
  const entitlement = licence?.entitlement
  if (!licence || !entitlement) return 'none'
  const effective = entitlementAccess({id:'view',tenantId:'view',...entitlement},now)
  if (effective.state === 'suspended') return 'suspended'
  if (effective.state === 'grace') return 'grace'
  if (!effective.live) return 'expired'
  if (entitlement.status === 'trial' && licence.order?.status !== 'paid' && licence.order) return 'awaiting_payment'
  if (entitlement.status === 'trial') return 'free'
  return licence.features.monitoring ? 'publisher' : 'web_link'
}

/** "30. 10. 2026. u 14:35" in Zagreb time, the way the customer reads a deadline. */
export function untilLabel(iso: string) {
  const date = new Date(iso)
  const day = new Intl.DateTimeFormat('hr-HR', { timeZone: 'Europe/Zagreb', day: 'numeric', month: 'numeric', year: 'numeric' }).format(date)
  const time = new Intl.DateTimeFormat('hr-HR', { timeZone: 'Europe/Zagreb', hour: '2-digit', minute: '2-digit' }).format(date)
  return `${day} u ${time}`
}

export function hoursLeft(iso: string | null, now = Date.now()) {
  if (!iso) return null
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 3_600_000))
}
