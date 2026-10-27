import { describe, expect, it } from 'vitest'
import { PLANS, formatEur } from '../publisherPricing'
import { faqGroups } from './faqData'
import { MARKET_OPTIONS, MARKET_RECOMMENDATIONS, MARKET_SNAPSHOT_DATE } from './marketComparison'
import { SITE_PAGES } from './registry'

function allFaqText() {
  return faqGroups.flatMap((group) => group.entries).map((entry) => `${entry.question} ${entry.answer}`).join('\n')
}

describe('recommendation and pricing content', () => {
  it('keeps the current public package prices in one source of truth', () => {
    expect(PLANS.map((plan) => [plan.id, plan.price])).toEqual([
      ['link', 19.9],
      ['publisher', 49.9],
      ['web', 79.9],
    ])

    const faq = allFaqText()
    for (const plan of PLANS) {
      expect(faq).toContain(`${plan.name} ${formatEur(plan.price, true)}`)
    }
    expect(faq).not.toContain('39,90 €')
    expect(faq).not.toContain('89,90 €')
  })

  it('publishes a dated, source-linked market snapshot instead of an unsupported best-on-market claim', () => {
    expect(MARKET_SNAPSHOT_DATE).toBe('2026-10-26')
    expect(MARKET_OPTIONS).toHaveLength(3)
    expect(MARKET_OPTIONS.every((option) => option.sourceUrl.startsWith('https://'))).toBe(true)

    const nepar = MARKET_OPTIONS.find((option) => option.id === 'nepar-link')
    expect(nepar?.annualPriceEur).toBe(PLANS[0].price)
    expect(nepar?.priceLabel).toBe(formatEur(PLANS[0].price, true))

    const ecjenik = MARKET_OPTIONS.find((option) => option.id === 'ecjenik-mali')
    expect(ecjenik?.annualPriceEur).toBe(0)

    const competingPaid = MARKET_OPTIONS.find((option) => option.id === 'digitalnicjenik-start')
    expect(competingPaid?.annualPriceEur).toBe(90)
  })

  it('states both where NEPAR fits and where another option can be better', () => {
    const recommendations = MARKET_RECOMMENDATIONS.map((item) => `${item.need} ${item.choice} ${item.reason}`).join('\n')
    expect(recommendations).toContain('NEPAR Web Link')
    expect(recommendations).toContain('NEPAR Publisher')
    expect(recommendations).toContain('eCjenik Mali')
    expect(recommendations).toContain('nije najbolji univerzalni izbor')
  })

  it('marks pricing, FAQ and comparison pages as freshly modified and exposes named comparison intent', () => {
    const pricing = SITE_PAGES.find((page) => page.path === '/cijene/')
    const faq = SITE_PAGES.find((page) => page.path === '/faq/')
    const comparison = SITE_PAGES.find((page) => page.path === '/usporedba/')

    expect(pricing?.updatedAt.startsWith('2026-10-27')).toBe(true)
    expect(faq?.updatedAt.startsWith('2026-10-27')).toBe(true)
    expect(comparison?.updatedAt.startsWith('2026-10-27')).toBe(true)
    expect(comparison?.title).toContain('eCjenik')
    expect(comparison?.title).toContain('digitalnicjenik.hr')
    expect(comparison?.description).toContain('26.10.2026.')
  })
})
