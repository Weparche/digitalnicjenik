import { describe, expect, it } from 'vitest'
import { adminState, daysLeft, projectedPeriodEnd } from './adminView'

const NOW = Date.parse('2026-11-17T10:00:00Z')

describe('adminState', () => {
  it('treats a lapsed period as expired even if status is still active/trial', () => {
    expect(adminState({ status: 'active', periodEnd: '2026-11-01T00:00:00Z' }, NOW)).toBe('expired')
    expect(adminState({ status: 'trial', periodEnd: '2026-11-10T00:00:00Z' }, NOW)).toBe('expired')
  })
  it('keeps live states and handles missing data', () => {
    expect(adminState({ status: 'active', periodEnd: '2027-01-01T00:00:00Z' }, NOW)).toBe('active')
    expect(adminState({ status: 'trial', periodEnd: '2026-11-20T00:00:00Z' }, NOW)).toBe('trial')
    expect(adminState({ status: 'suspended', periodEnd: '2027-01-01T00:00:00Z' }, NOW)).toBe('expired')
    expect(adminState({ status: null, periodEnd: null }, NOW)).toBe('none')
  })
})

describe('periods', () => {
  it('counts days left and projects +365 days from the later of now and period end', () => {
    expect(daysLeft('2026-11-20T10:00:00Z', NOW)).toBe(3)
    expect(daysLeft(null, NOW)).toBeNull()
    expect(projectedPeriodEnd('2026-11-20T10:00:00Z', NOW)).toBe('2027-11-20T10:00:00.000Z')
    expect(projectedPeriodEnd('2026-01-01T00:00:00Z', NOW)).toBe('2027-11-17T10:00:00.000Z')
  })
})
