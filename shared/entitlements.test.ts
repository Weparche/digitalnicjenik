import { describe, expect, it } from 'vitest'
import { featuresForPlan, PUBLISHING_PLANS } from './entitlements'

describe('featuresForPlan', () => {
  it('gives Web Link a complete publication without management features', () => {
    expect(featuresForPlan('web_link')).toEqual({ publish: true, upload: true, archive: true, qr: true, pdf: true, embed: true, editItems: false, monitoring: false, alerts: false })
  })

  it('gives Publisher and managed tenants everything', () => {
    for (const plan of ['publisher_self_service', 'managed'] as const) {
      expect(Object.values(featuresForPlan(plan)).every(Boolean)).toBe(true)
    }
  })

  it('gives the validator and unknown plans nothing', () => {
    expect(Object.values(featuresForPlan('validator')).some(Boolean)).toBe(false)
    expect(Object.values(featuresForPlan(null)).some(Boolean)).toBe(false)
  })

  it('lists exactly the plans that may publish', () => {
    expect(PUBLISHING_PLANS).toEqual(['web_link', 'publisher_self_service', 'managed'])
  })
})
