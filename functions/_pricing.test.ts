import { describe, expect, it } from 'vitest'
import { implementationIntentLabel, selfServiceIntentLabel } from './_pricing'

describe('publisher pricing labels', () => {
  it('formats the current annual Publisher offer', () => {
    expect(selfServiceIntentLabel()).toBe('Publisher — 49,90 €/god')
  })

  it('formats implementation intent', () => {
    expect(implementationIntentLabel()).toBe('Web + Publisher — 79,90 €/god')
  })
})
