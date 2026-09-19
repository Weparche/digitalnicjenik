import { describe, expect, it } from 'vitest'
import { nextPeriodEnd } from './_trial'
import { slugifyBusinessName, validSlug } from './_slug'
import { entitlementIsLive } from './_public-access'

describe('trial helpers', () => {
  it('slugifies business names', () => {
    expect(slugifyBusinessName('Auto Gubić')).toBe('auto-gubic')
    expect(validSlug('auto-gubic')).toBe(true)
    expect(validSlug('nepar')).toBe(false)
  })

  it('renews from max(now, period_end)', () => {
    const now = new Date('2026-10-19T12:00:00.000Z')
    const fromPast = nextPeriodEnd('2026-09-01T00:00:00.000Z', now)
    expect(fromPast).toBe('2027-10-19T12:00:00.000Z')
    const fromFuture = nextPeriodEnd('2026-11-01T00:00:00.000Z', now)
    expect(fromFuture).toBe('2027-11-01T00:00:00.000Z')
  })

  it('treats trial as live when period_end is ahead', () => {
    expect(entitlementIsLive({
      id: 'e1',
      tenantId: 't1',
      plan: 'publisher_self_service',
      status: 'trial',
      periodStart: '2026-09-19T00:00:00.000Z',
      periodEnd: '2026-09-26T00:00:00.000Z',
    }, new Date('2026-09-20T00:00:00.000Z').getTime())).toBe(true)
    expect(entitlementIsLive({
      id: 'e1',
      tenantId: 't1',
      plan: 'publisher_self_service',
      status: 'trial',
      periodStart: '2026-09-19T00:00:00.000Z',
      periodEnd: '2026-09-19T00:00:00.000Z',
    }, new Date('2026-09-20T00:00:00.000Z').getTime())).toBe(false)
  })
})
