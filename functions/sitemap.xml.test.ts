import { describe, expect, it } from 'vitest'
import { NEWS_POSTS } from '../src/news/posts'
import { onRequestGet } from './sitemap.xml'

describe('sitemap.xml', () => {
  it('returns every static subpage when the database is unavailable', async () => {
    const response = await onRequestGet({ env: {} })
    expect(response.headers.get('content-type')).toContain('application/xml')
    const xml = await response.text()
    expect(xml.startsWith('<?xml')).toBe(true)
    expect(xml).toContain('<loc>https://digitalnicjenik.nepar.hr/</loc>')
    expect(xml).toContain('<loc>https://digitalnicjenik.nepar.hr/vijesti/</loc>')
    for (const post of NEWS_POSTS) {
      expect(xml).toContain(`<loc>https://digitalnicjenik.nepar.hr/vijesti/${post.slug}/</loc>`)
    }
    expect(xml).toContain('<loc>https://digitalnicjenik.nepar.hr/c/nepar</loc>')
    expect(xml).toContain('<loc>https://digitalnicjenik.nepar.hr/examples/primjer-digitalni-cjenik-usluge-2026.csv</loc>')
    expect(xml).toContain('<loc>https://digitalnicjenik.nepar.hr/examples/primjer-digitalni-cjenik-usluge-2026.xml</loc>')
  })

  it('adds an active customer cjenik and skips a trial', async () => {
    const rows = [
      {
        slug: 'aktivni-salon',
        name: 'Aktivni salon',
        published_at: '2026-09-20T10:00:00.000Z',
        plan: 'publisher_self_service',
        status: 'active',
        period_end: '2099-01-01T00:00:00.000Z',
      },
      {
        slug: 'probni-salon',
        name: 'Probni salon',
        published_at: '2026-09-20T10:00:00.000Z',
        plan: 'publisher_self_service',
        status: 'trial',
        period_end: '2099-01-01T00:00:00.000Z',
      },
    ]
    const response = await onRequestGet({
      env: {
        DB: {
          prepare: () => ({
            bind: () => { throw new Error('bind not used') },
            all: async () => ({ results: rows }),
            first: async () => null,
            run: async () => ({}),
          }),
          batch: async () => [],
        },
      },
    })
    const xml = await response.text()
    expect(xml).toContain('<loc>https://digitalnicjenik.nepar.hr/c/aktivni-salon</loc>')
    expect(xml).toContain('<loc>https://digitalnicjenik.nepar.hr/c/aktivni-salon/cjenik.csv</loc>')
    expect(xml).toContain('<loc>https://digitalnicjenik.nepar.hr/c/aktivni-salon/cjenik.xml</loc>')
    expect(xml).toContain('<loc>https://digitalnicjenik.nepar.hr/c/aktivni-salon/arhiva</loc>')
    expect(xml).not.toContain('probni-salon')
  })
})
