import { describe, expect, it } from 'vitest'
import { INSTALLATION, MAX_ITEMS_LABEL, MAX_PRICE_LIST_ITEMS, PLANS, installationPriceLabel } from '../../shared/pricing'
import { MAX_PRICE_LIST_ITEMS as ENFORCED_LIMIT } from '../../functions/_limits'
import { EXISTING_WEB_STEPS, LARGE_LIST_LIMIT, NO_PLUGIN_REASONS } from '../ExistingWebSections'
import { EXTRA_SERVICES } from '../PlanCards'
import { productFaq } from '../productFaq'
import { renderLlms, staticSitemapUrls } from '../seo/catalog'
import { PLATFORM_GUIDES } from './ExistingWebPage'
import { EXISTING_WEB_FAQ_ID, faqGroups } from './faqData'
import { EXISTING_WEB_PATH, NAV_LINKS, SITE_PAGES, pageUrl } from './registry'

const FORBIDDEN = [/najjeftinij/i, /najbolji digitalni cjenik/i, /svakim webshopom automatski/i, /zakonski certificiran/i, /100\s*% uskla/i, /zakonski digitalni cjenik/i, /automatsk\w* sinkronizacij/i, /eCjenik/i, /digitalnicjenik\.hr/i]

describe('existing-web positioning', () => {
  const page = SITE_PAGES.find((candidate) => candidate.path === EXISTING_WEB_PATH)!
  const faq = faqGroups.find((group) => group.id === EXISTING_WEB_FAQ_ID)!

  it('renames Link to Web Link without changing the plan id or price', () => {
    expect(PLANS[0]).toMatchObject({ id: 'link', name: 'Web Link', price: 19.9 })
    expect(PLANS[0].highlight).toBe(`Do ${MAX_ITEMS_LABEL} stavki`)
    expect(PLANS[1]).toMatchObject({ id: 'publisher', price: 49.9, summary: 'Objava, validacija i svakodnevni nadzor digitalnog cjenika.' })
  })

  it('prices installation help once and shows it on the extra-service tile', () => {
    expect(INSTALLATION.price).toBe(29.9)
    expect(installationPriceLabel()).toBe('29,90 € jednokratno')
    expect(EXTRA_SERVICES.find((service) => service.id === 'installation')?.price).toBe('29,90 € jednokratno')
    expect(EXTRA_SERVICES.find((service) => service.id === 'integration')?.price).toBe('Individualna ponuda')
  })

  it('quotes the item limit that import and publish actually enforce', () => {
    expect(ENFORCED_LIMIT).toBe(MAX_PRICE_LIST_ITEMS)
    expect(MAX_ITEMS_LABEL).toBe('5.000')
    expect(LARGE_LIST_LIMIT).toContain('5.000 stavki')
  })

  it('registers the landing for navigation, sitemap and llms.txt with FAQ and Service data', () => {
    expect(page).toMatchObject({ kind: 'service', faqGroupId: EXISTING_WEB_FAQ_ID })
    expect(page.service?.planIds).toEqual(['link', 'publisher'])
    expect(page.description.length).toBeGreaterThanOrEqual(70)
    expect(page.description.length).toBeLessThanOrEqual(200)
    expect(NAV_LINKS.some((link) => link.href === EXISTING_WEB_PATH)).toBe(true)
    expect(staticSitemapUrls().some((entry) => entry.loc === pageUrl(page))).toBe(true)
    expect(renderLlms()).toContain(pageUrl(page))
  })

  it('answers every existing-web question from the brief', () => {
    expect(faq.entries.map((entry) => entry.question)).toEqual([
      'Radi li NEPAR s WordPressom?',
      'Radi li s WooCommerceom?',
      'Radi li sa Shopifyjem, Wixom ili vlastitim webom?',
      'Moram li mijenjati postojeći web?',
      'Trebam li instalirati plugin?',
      'Što ako već imam CSV/XML?',
      'Što ako imam puno proizvoda ili usluga?',
      'Hoće li NEPAR sam promijeniti cijene na mom webshopu?',
    ])
    expect(faq.entries[6].answer).toContain(`${MAX_ITEMS_LABEL} stavki`)
    expect(faq.entries[7].answer.startsWith('Ne.')).toBe(true)
  })

  it('keeps sales copy free of guarantees, overclaims and competitor names', () => {
    const copy = [
      ...PLANS.flatMap((plan) => [plan.name, plan.tagline, plan.summary, plan.highlight ?? '', ...plan.features]),
      ...EXTRA_SERVICES.flatMap((service) => [service.title, service.text, service.cta]),
      ...EXISTING_WEB_STEPS.flatMap((step) => [step.title, step.text]),
      ...NO_PLUGIN_REASONS,
      ...PLATFORM_GUIDES.map((guide) => guide.text),
      ...faq.entries.flatMap((entry) => [entry.question, entry.answer]),
      ...productFaq.flatMap((entry) => [entry.question, entry.answer]),
      page.title, page.description, page.seoTitle,
    ].join('\n')
    for (const pattern of FORBIDDEN) expect(copy).not.toMatch(pattern)
  })
})
