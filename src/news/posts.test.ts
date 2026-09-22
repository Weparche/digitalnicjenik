import { describe, expect, it } from 'vitest'
import {
  getAllNewsPaths,
  getLatestPost,
  getPostBySlug,
  NEWS_POSTS,
  newsArticleUrl,
} from './posts'

describe('news posts', () => {
  it('has unique slugs and valid dates', () => {
    const slugs = NEWS_POSTS.map((p) => p.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const post of NEWS_POSTS) {
      expect(post.title.length).toBeGreaterThan(10)
      expect(post.seoTitle.length).toBeGreaterThan(10)
      expect(post.description.length).toBeGreaterThan(40)
      expect(Date.parse(post.updatedAt)).toBeGreaterThanOrEqual(Date.parse(post.publishedAt))
    }
  })

  it('resolves latest and paths', () => {
    expect(getLatestPost().slug).toBe('digitalni-cjenik-bez-web-stranice-drustvene-mreze')
    expect(getPostBySlug('digitalni-cjenik-bez-web-stranice-drustvene-mreze')?.seoTitle).toContain('bez web stranice')
    expect(getPostBySlug('hok-excel-predlosci-digitalni-cjenik-2026')?.seoTitle).toContain('HOK')
    expect(getPostBySlug('primjer-csv-digitalnog-cjenika-usluge-2026')?.seoTitle).toContain('2026')
    expect(getPostBySlug('digitalni-cjenik-sidrena-cijena-2026')?.seoTitle).toContain('1.10.2026')
    expect(getAllNewsPaths().length).toBe(NEWS_POSTS.length)
    expect(newsArticleUrl('primjer-csv-digitalnog-cjenika-usluge-2026')).toContain('/vijesti/')
  })
})
