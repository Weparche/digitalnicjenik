import { describe, expect, it } from 'vitest'
import { NEWS_POSTS } from '../news/posts'
import { newsArticleUrl, newsIndexUrl } from '../news/site'
import {
  DEMO_PUBLIC_SLUG,
  EXAMPLE_CSV_PATH,
  EXAMPLE_XML_PATH,
  isIndexablePublication,
  mergeSitemapUrls,
  publicationSitemapUrls,
  renderFeed,
  renderLlms,
  renderRobots,
  renderSitemap,
  staticSitemapUrls,
} from './catalog'

describe('public SEO catalog', () => {
  const urls = staticSitemapUrls()
  const sitemap = renderSitemap(urls)
  const llms = renderLlms()
  const feed = renderFeed()
  const robots = renderRobots()

  it('lists every news subpage, the demo cjenik, and the downloadable examples', () => {
    expect(sitemap).toContain('<loc>https://digitalnicjenik.nepar.hr/</loc>')
    expect(sitemap).toContain(`<loc>${newsIndexUrl()}</loc>`)
    expect(newsIndexUrl().endsWith('/')).toBe(true)
    for (const post of NEWS_POSTS) {
      const canonical = newsArticleUrl(post.slug)
      expect(canonical.endsWith('/')).toBe(true)
      expect(sitemap).toContain(`<loc>${canonical}</loc>`)
      expect(sitemap).toContain(`<lastmod>${post.updatedAt.slice(0, 10)}</lastmod>`)
      expect(llms).toContain(canonical)
      expect(feed).toContain(`<link>${canonical}</link>`)
    }
    expect(sitemap).toContain(`<loc>https://digitalnicjenik.nepar.hr/c/${DEMO_PUBLIC_SLUG}</loc>`)
    expect(sitemap).toContain(`<loc>https://digitalnicjenik.nepar.hr/c/${DEMO_PUBLIC_SLUG}/arhiva</loc>`)
    expect(sitemap).toContain(`<loc>https://digitalnicjenik.nepar.hr/c/${DEMO_PUBLIC_SLUG}/cjenik.csv</loc>`)
    expect(sitemap).toContain(`<loc>https://digitalnicjenik.nepar.hr/c/${DEMO_PUBLIC_SLUG}/cjenik.xml</loc>`)
    expect(sitemap).toContain(`<loc>https://digitalnicjenik.nepar.hr${EXAMPLE_CSV_PATH}</loc>`)
    expect(sitemap).toContain(`<loc>https://digitalnicjenik.nepar.hr${EXAMPLE_XML_PATH}</loc>`)
    expect(llms).toContain('https://nepar.hr/digitalni-cjenik')
    expect(llms).toContain(`https://digitalnicjenik.nepar.hr/c/${DEMO_PUBLIC_SLUG}`)
  })

  it('keeps private app and API routes out of the crawl while leaving public cjeniks allowed', () => {
    expect(robots.startsWith('User-agent:')).toBe(true)
    expect(robots).toContain('Allow: /')
    expect(robots).toContain('Disallow: /api/')
    expect(robots).toContain('Disallow: /app$')
    expect(robots).toContain('Disallow: /app/')
    expect(robots).not.toMatch(/Disallow: \/app\n/)
    expect(robots).not.toContain('Disallow: /c')
    expect(robots).not.toContain('Disallow: /vijesti')
    expect(robots).toContain('Sitemap: https://digitalnicjenik.nepar.hr/sitemap.xml')
  })

  it('indexes active publications and the demo, and skips trials', () => {
    expect(isIndexablePublication({
      slug: 'salon',
      status: 'active',
      plan: 'publisher_self_service',
      periodEnd: '2099-01-01T00:00:00.000Z',
    })).toBe(true)
    expect(isIndexablePublication({
      slug: 'salon',
      status: 'trial',
      plan: 'publisher_self_service',
      periodEnd: '2099-01-01T00:00:00.000Z',
    })).toBe(false)
    expect(isIndexablePublication({
      slug: 'salon',
      status: 'active',
      plan: 'validator',
      periodEnd: '2099-01-01T00:00:00.000Z',
    })).toBe(false)
    expect(isIndexablePublication({
      slug: DEMO_PUBLIC_SLUG,
      status: null,
      plan: null,
      periodEnd: null,
    })).toBe(true)
  })

  it('does not duplicate a publication already present in the static sitemap', () => {
    const merged = mergeSitemapUrls(urls, publicationSitemapUrls(DEMO_PUBLIC_SLUG, '2026-09-23'))
    const locs = merged.map((entry) => entry.loc)
    expect(locs.filter((loc) => loc === `https://digitalnicjenik.nepar.hr/c/${DEMO_PUBLIC_SLUG}`)).toHaveLength(1)
  })
})
