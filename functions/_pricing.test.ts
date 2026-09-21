import { describe, expect, it } from 'vitest'
import { implementationIntentLabel, selfServiceIntentLabel } from './_pricing'

describe('publisher pricing labels', () => {
  it('formats self-service intent with launch copy', () => {
    expect(selfServiceIntentLabel()).toContain('39,90')
    expect(selfServiceIntentLabel()).toContain('100 aktiviranih pretplata')
  })

  it('formats implementation intent', () => {
    expect(implementationIntentLabel()).toBe('Postavljanje — 89,90 € prva godina')
  })
})
