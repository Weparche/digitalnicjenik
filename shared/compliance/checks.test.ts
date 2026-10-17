import { describe, expect, it } from 'vitest'
import type { NormalizedPriceItem } from '../../src/price-engine/types'
import { evaluateArchiveIntegrity, evaluateFeedGaps, evaluateFilename, evaluateFreshness, evaluateRequiredFields, overallFromIssues, parseContentDispositionFilename } from './checks'
import { complianceRules, getRuleset } from './rulesets'

const ruleset = getRuleset('nn-101-2026')
const products = ruleset.profiles.products
const services = ruleset.profiles.services
const item = (overrides: Partial<NormalizedPriceItem> = {}): NormalizedPriceItem => ({ name: 'Mlijeko', price: 1.2, externalId: 'A1', unit: 'kom', anchorPrice: 1.1, ...overrides })

describe('required fields', () => {
  it('counts rows per missing field and reports fields outside the data model as info', () => {
    const issues = evaluateRequiredFields([item(), item({ anchorPrice: null }), item({ anchorPrice: null, externalId: '' })], products)
    expect(issues.find((i) => i.field === 'anchorPrice')).toMatchObject({ code: 'MISSING_REQUIRED_FIELD', severity: 'warn', rows: 2 })
    expect(issues.find((i) => i.field === 'externalId')).toMatchObject({ rows: 1 })
    expect(issues.find((i) => i.field === 'barcode')).toMatchObject({ code: 'FIELD_NOT_IN_DATA_MODEL', severity: 'info' })
  })

  it('treats a missing name or price as fail', () => {
    const issues = evaluateRequiredFields([item({ name: '' }), item({ price: 0 })], products)
    expect(issues.filter((i) => i.severity === 'fail').map((i) => i.field).sort()).toEqual(['name', 'price'])
  })

  it('uses a smaller field set for services', () => {
    const issues = evaluateRequiredFields([item({ externalId: undefined, unit: null })], services)
    expect(issues).toEqual([])
  })

  it('flags a sale price without special-sale flag', () => {
    expect(evaluateRequiredFields([item({ salePrice: 0.9, specialSaleApplied: null })], services).map((i) => i.code)).toContain('INVALID_SPECIAL_SALE')
  })
})

describe('feed gaps', () => {
  it('xml does not carry šifra or unit, csv does', () => {
    expect(evaluateFeedGaps('xml', products).map((i) => i.field)).toEqual(expect.arrayContaining(['externalId', 'unit']))
    expect(evaluateFeedGaps('csv', products)).toEqual([])
  })
})

describe('filename', () => {
  const stem = 'usluzni-objekt_vukovarska-123_p-01_15_20261117-064500'
  it('parses plain and RFC 5987 headers', () => {
    expect(parseContentDispositionFilename(`inline; filename="${stem}.csv"`)).toBe(`${stem}.csv`)
    expect(parseContentDispositionFilename("attachment; filename*=UTF-8''a%20b.csv")).toBe('a b.csv')
    expect(parseContentDispositionFilename(null)).toBeNull()
  })
  it('separates publication match from ruleset match', () => {
    expect(evaluateFilename(`inline; filename="${stem}.csv"`, stem, 'csv', ruleset)).toMatchObject({ publicationMatch: true, rulesetMatch: true })
    expect(evaluateFilename('inline; filename="cjenik.csv"', stem, 'csv', ruleset)).toMatchObject({ publicationMatch: false, rulesetMatch: false })
    // Ruleset-shaped but a different publication: internal bug, not a regulatory one.
    const other = 'usluzni-objekt_vukovarska-123_p-01_14_20261116-064500'
    expect(evaluateFilename(`inline; filename="${other}.csv"`, stem, 'csv', ruleset)).toMatchObject({ publicationMatch: false, rulesetMatch: true })
    expect(evaluateFilename(`inline; filename="${stem}.xml"`, stem, 'csv', ruleset)).toMatchObject({ publicationMatch: false, rulesetMatch: false })
  })
})

describe('freshness', () => {
  // 2026-11-18 is a Wednesday.
  it('products: before the 08:00 deadline the previous working day is enough', () => {
    const now = new Date('2026-11-18T05:30:00Z') // 06:30 Zagreb
    expect(evaluateFreshness(products, '2026-11-17T05:00:00Z', now, 'Europe/Zagreb')).toBe('ok')
    expect(evaluateFreshness(products, '2026-11-16T05:00:00Z', now, 'Europe/Zagreb')).toBe('warn')
  })
  it('products: after the deadline today is expected', () => {
    const now = new Date('2026-11-18T08:00:00Z') // 09:00 Zagreb
    expect(evaluateFreshness(products, '2026-11-17T05:00:00Z', now, 'Europe/Zagreb')).toBe('warn')
    expect(evaluateFreshness(products, '2026-11-18T04:00:00Z', now, 'Europe/Zagreb')).toBe('ok')
  })
  it('products: the weekend expects Friday', () => {
    const sunday = new Date('2026-11-22T09:00:00Z')
    expect(evaluateFreshness(products, '2026-11-20T10:00:00Z', sunday, 'Europe/Zagreb')).toBe('ok')
    expect(evaluateFreshness(products, '2026-11-19T10:00:00Z', sunday, 'Europe/Zagreb')).toBe('warn')
  })
  it('services never go stale', () => {
    expect(evaluateFreshness(services, '2025-01-01T00:00:00Z', new Date('2026-11-18T09:00:00Z'), 'Europe/Zagreb')).toBe('n/a')
  })
})

describe('archive integrity', () => {
  const now = new Date('2026-11-17T06:00:00Z')
  it('counts only publications inside the window that are still public', () => {
    const result = evaluateArchiveIntegrity([
      { publishedAt: '2026-11-16T06:00:00Z', publicUntil: '2026-12-16T06:00:00Z' },
      { publishedAt: '2026-11-02T06:00:00Z', publicUntil: '2026-11-04T06:00:00Z' }, // gap: public_until too early
      { publishedAt: '2026-10-01T06:00:00Z', publicUntil: '2026-10-03T06:00:00Z' }, // outside the 30-day window
      { publishedAt: '2026-11-03T06:00:00Z', publicUntil: null },
    ], now, 30)
    expect(result).toEqual({ expected: 3, available: 1 })
  })
})

describe('overall', () => {
  it('warn is not fail; info is ignored', () => {
    expect(overallFromIssues([{ code: 'x', severity: 'info', message: '' }], 'ok')).toBe('ok')
    expect(overallFromIssues([], 'warn')).toBe('warn')
    expect(overallFromIssues([{ code: 'x', severity: 'warn', message: '' }], 'ok')).toBe('warn')
    expect(overallFromIssues([{ code: 'x', severity: 'fail', message: '' }], 'warn')).toBe('fail')
  })
})

describe('rulesets', () => {
  it('are registered by id so a new Pravilnik is a config change', () => {
    expect(Object.keys(complianceRules)).toContain('nn-101-2026')
    expect(() => getRuleset('missing')).toThrow('unknown_ruleset')
  })
})
