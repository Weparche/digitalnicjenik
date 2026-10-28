import { describe, expect, it } from 'vitest'
import { featuresForPlan } from '../shared/entitlements'
import { hoursLeft, licenceState, untilLabel, type Licence } from './licenceView'

const NOW = Date.parse('2026-10-28T10:00:00Z')
const licence = (entitlement: Licence['entitlement'], order: Licence['order'] = null): Licence => ({
  entitlement,
  features: featuresForPlan(entitlement?.plan as never),
  upgradeAvailable: false,
  order,
})
const order = (kind: 'web_link' | 'publisher_upgrade') => ({ kind } as Licence['order'])

describe('licenceState', () => {
  it('follows the free publication → order → paid path', () => {
    const free = { plan: 'web_link', status: 'trial', periodStart: null, periodEnd: '2026-10-29T10:00:00Z' }
    expect(licenceState(licence(free), NOW)).toBe('free')
    expect(licenceState(licence(free, order('web_link')), NOW)).toBe('awaiting_payment')
    expect(licenceState(licence({ ...free, periodEnd: '2026-10-27T10:00:00Z' }, order('web_link')), NOW)).toBe('expired')
    expect(licenceState(licence({ ...free, status: 'active' }), NOW)).toBe('web_link')
    expect(licenceState(licence({ ...free, status: 'active' }, order('publisher_upgrade')), NOW)).toBe('web_link')
    expect(licenceState(licence({ ...free, plan: 'publisher_self_service', status: 'active' }), NOW)).toBe('publisher')
    expect(licenceState(null, NOW)).toBe('none')
  })
})

describe('labels', () => {
  it('shows the deadline in Zagreb time and whole hours left', () => {
    expect(untilLabel('2026-10-30T13:35:00Z')).toBe('30. 10. 2026. u 14:35')
    expect(hoursLeft('2026-10-29T09:30:00Z', NOW)).toBe(24)
    expect(hoursLeft('2026-10-27T09:30:00Z', NOW)).toBe(0)
  })
})
