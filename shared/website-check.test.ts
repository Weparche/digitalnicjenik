import { describe, expect, it } from 'vitest'
import { normalizeWebsiteInput, technicalReport, TECHNICAL_CHECKS, type WebsiteCheckDetails } from './website-check'
import { PLANS, formatEur } from './pricing'

const complete: WebsiteCheckDetails = { reachable: true, homepageReadable: true, https: true, csvFound: true, xmlFound: true, pricePageFound: true, csvUrl: 'https://example.hr/cjenik.csv', xmlUrl: 'https://example.hr/cjenik.xml', publicLinkUrl: 'https://example.hr/cjenik.csv', archiveFound: true, structureStatus: 'pass', contentStatus: 'pass' }
describe('technical evidence score', () => {
  it('has exactly nine unique checks and scores only confirmed passes', () => {
    const report = technicalReport({ status: 'green', message: '', details: complete })
    expect(new Set(TECHNICAL_CHECKS.map((c) => c.id)).size).toBe(9)
    expect(report).toMatchObject({ score: 9, tone: 'green', attention: 0, unknown: 0 })
  })
  it('does not inherit legacy green as a guarantee of nine passes', () => {
    const report = technicalReport({ status: 'green', message: '', details: { ...complete, xmlFound: false, archiveFound: false, contentStatus: 'unknown' } })
    expect(report).toMatchObject({ score: 7, attention: 1, unknown: 1, tone: 'yellow' })
    expect(report.checks.find((c) => c.id === 'archive')?.evidence).toContain('ne potvrđuje')
  })
  it('keeps blocked checks unknown instead of declaring missing files', () => {
    const report = technicalReport({ status: 'red', message: '', details: { reachable: true, homepageReadable: false, https: true, fetchBlocked: true } })
    expect(report).toMatchObject({ score: 1, attention: 0, unknown: 8, tone: 'yellow' })
    expect(report.checks.some((c) => c.status === 'missing')).toBe(false)
  })
  it('does not mistake a discovered but inaccessible CSV for a verified document', () => {
    const report = technicalReport({ status: 'yellow', message: '', details: { csvLinkDiscovered: true, publicLinkUrl: 'https://example.hr/cjenik.csv', fetchBlocked: true } })
    expect(report.checks.find((c) => c.id === 'csv')?.status).toBe('unknown')
    expect(report.checks.find((c) => c.id === 'link')?.status).toBe('pass')
  })
  it('keeps a guessed feed endpoint separate from a discovered public link', () => {
    const report = technicalReport({ status: 'green', message: '', details: { ...complete, publicLinkUrl: undefined } })
    expect(report.score).toBe(8)
    expect(report.checks.find((c) => c.id === 'link')?.status).toBe('missing')
  })
  it('preserves positive evidence on partial network failure', () => {
    const report = technicalReport({ status: 'green', message: '', details: { ...complete, xmlFound: false, networkIncomplete: true } })
    expect(report.checks.find((c) => c.id === 'xml')?.status).toBe('unknown')
    expect(report.checks.find((c) => c.id === 'csv')?.status).toBe('pass')
  })
  it('reports unavailable results without failures or invented evidence', () => {
    expect(technicalReport({ status: 'unavailable', message: '' })).toMatchObject({ score: 0, unknown: 9, attention: 0, tone: 'yellow' })
  })
  it('uses red for verified widespread missing signals and never negative scores', () => {
    const report = technicalReport({ status: 'red', message: '', details: { reachable: false, homepageReadable: false } })
    expect(report).toMatchObject({ score: 0, tone: 'red' })
    expect(report.checks.filter((c) => c.status === 'missing')).toHaveLength(1)
    expect(report.unknown).toBe(8)
  })
})
describe('website input', () => {
  it.each([['vasweb.hr', 'https://vasweb.hr/'], ['  https://VASWEB.hr/cjenik#vrh  ', 'https://vasweb.hr/cjenik'], ['http://vasweb.hr', 'http://vasweb.hr/']])('normalizes %s', (input, expected) => { expect(normalizeWebsiteInput(input)).toBe(expected) })
  it.each(['', 'nije adresa', 'javascript:alert(1)', 'ftp://example.hr', 'https://user:password@example.hr', 'localhost'])('rejects invalid input %s', (input) => { expect(() => normalizeWebsiteInput(input)).toThrow() })
})
it('shares the three annual commercial prices', () => {
  expect(PLANS.map((p) => [p.id, formatEur(p.price, true)])).toEqual([['link', '19,90 €/god'], ['publisher', '49,90 €/god'], ['web', '79,90 €/god']])
})
