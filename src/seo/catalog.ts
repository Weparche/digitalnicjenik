import { NEWS_POSTS, type NewsPost } from '../news/posts'
import { NEPAR_URL, SITE_URL, newsArticleUrl, newsIndexUrl } from '../news/site'

export const DEMO_PUBLIC_SLUG = 'nepar'
export const INDEXABLE_ROBOTS =
  'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'
export const EXAMPLE_CSV_PATH = '/examples/primjer-digitalni-cjenik-usluge-2026.csv'
export const EXAMPLE_XML_PATH = '/examples/primjer-digitalni-cjenik-usluge-2026.xml'
export const FEED_PATH = '/feed.xml'

export type SitemapImage = { loc: string; title: string }

export type SitemapUrl = {
  loc: string
  lastmod?: string
  priority?: string
  image?: SitemapImage
}

export type IndexablePublication = {
  slug: string
  status: string | null
  plan: string | null
  periodEnd: string | null
  now?: number
  demoSlug?: string
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function isoDate(iso: string) {
  return iso.slice(0, 10)
}

export function isIndexablePublication(input: IndexablePublication) {
  if (input.slug === (input.demoSlug || DEMO_PUBLIC_SLUG)) return true
  if (input.status !== 'active') return false
  if (!input.plan || input.plan === 'validator') return false
  if (!input.periodEnd) return false
  return new Date(input.periodEnd).getTime() >= (input.now ?? Date.now())
}

export function publicationSitemapUrls(slug: string, lastmod?: string): SitemapUrl[] {
  const base = `${SITE_URL}/c/${encodeURIComponent(slug)}`
  const priority = slug === DEMO_PUBLIC_SLUG ? '0.6' : '0.5'
  return [
    { loc: base, lastmod, priority },
    { loc: `${base}/arhiva`, lastmod, priority: '0.3' },
    { loc: `${base}/cjenik.csv`, lastmod, priority: '0.4' },
    { loc: `${base}/cjenik.xml`, lastmod, priority: '0.4' },
  ]
}

export function staticSitemapUrls(posts: NewsPost[] = NEWS_POSTS): SitemapUrl[] {
  const newest = posts.reduce((max, post) => (post.updatedAt > max ? post.updatedAt : max), '')
  const newestDate = newest ? isoDate(newest) : undefined
  const articles = [...posts].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
  return [
    { loc: `${SITE_URL}/`, lastmod: newestDate, priority: '1.0' },
    { loc: newsIndexUrl(), lastmod: newestDate, priority: '0.9' },
    ...articles.map((post) => ({
      loc: newsArticleUrl(post.slug),
      lastmod: isoDate(post.updatedAt),
      priority: '0.8',
      image: {
        loc: post.image.src.startsWith('http') ? post.image.src : `${SITE_URL}${post.image.src}`,
        title: post.image.alt,
      },
    })),
    ...publicationSitemapUrls(DEMO_PUBLIC_SLUG, newestDate),
    { loc: `${SITE_URL}${EXAMPLE_CSV_PATH}`, priority: '0.4' },
    { loc: `${SITE_URL}${EXAMPLE_XML_PATH}`, priority: '0.4' },
  ]
}

export function mergeSitemapUrls(primary: SitemapUrl[], extra: SitemapUrl[]) {
  const seen = new Set<string>()
  const merged: SitemapUrl[] = []
  for (const entry of [...primary, ...extra]) {
    if (seen.has(entry.loc)) continue
    seen.add(entry.loc)
    merged.push(entry)
  }
  return merged
}

export function renderSitemap(urls: SitemapUrl[]) {
  const body = urls
    .map((entry) => {
      const lastmod = entry.lastmod ? `\n    <lastmod>${escapeXml(entry.lastmod)}</lastmod>` : ''
      const priority = entry.priority ? `\n    <priority>${escapeXml(entry.priority)}</priority>` : ''
      const image = entry.image
        ? `\n    <image:image>\n      <image:loc>${escapeXml(entry.image.loc)}</image:loc>\n      <image:title>${escapeXml(entry.image.title)}</image:title>\n    </image:image>`
        : ''
      return `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>${lastmod}${priority}${image}\n  </url>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${body}\n</urlset>\n`
}

export function renderRobots() {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /app$',
    'Disallow: /app/',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ].join('\n')
}

export function renderLlms(posts: NewsPost[] = NEWS_POSTS) {
  const articles = [...posts].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
  const lines = [
    '# NEPAR Publisher — Digitalni cjenik',
    '',
    '> Publishing sloj za javni CSV/XML cjenik na webu: provjera stranice, validacija Excela/CSV-a i objava aktualnog cjenika s arhivom.',
    '',
    'NEPAR Publisher je alat kojim vlasnik web stranice provjerava ima li javno dostupan',
    'strojno čitljiv (CSV ili XML) digitalni cjenik, validira postojeću datoteku, pretvara',
    'Excel cjenik u CSV/XML i po potrebi naruči potpunu tehničku implementaciju.',
    '',
    `Proizvod pruža: NEPAR (Nepar, obrt za digitalna rješenja i usluge) — ${NEPAR_URL}`,
    '',
    '## Stranice',
    '',
    `- [Početna](${SITE_URL}/): provjera weba, validator Excel/CSV cjenika i ponuda Publishera.`,
    `- [Vijesti](${newsIndexUrl()}): vodiči o digitalnom cjeniku, sidrenoj cijeni i CSV/XML objavi.`,
    `- [RSS](${SITE_URL}${FEED_PATH}): feed svih vijesti.`,
    `- [Sitemap](${SITE_URL}/sitemap.xml): sve indeksabilne podstranice, uključujući javne cjenike.`,
    '',
    '## Vijesti',
    '',
  ]
  for (const post of articles) {
    lines.push(`- [${post.title}](${newsArticleUrl(post.slug)}): ${post.excerpt}`)
  }
  lines.push(
    '',
    '## Javni primjeri i datoteke',
    '',
    `- [Demo cjenik](${SITE_URL}/c/${DEMO_PUBLIC_SLUG}): javni primjer aktualnog digitalnog cjenika.`,
    `- [Demo arhiva](${SITE_URL}/c/${DEMO_PUBLIC_SLUG}/arhiva): prethodne objave demo cjenika.`,
    `- [Demo CSV](${SITE_URL}/c/${DEMO_PUBLIC_SLUG}/cjenik.csv): stabilni CSV za automatizirani dohvat.`,
    `- [Demo XML](${SITE_URL}/c/${DEMO_PUBLIC_SLUG}/cjenik.xml): stabilni XML za automatizirani dohvat.`,
    `- [Primjer CSV za usluge](${SITE_URL}${EXAMPLE_CSV_PATH}): preuzimanje primjera iz vodiča.`,
    `- [Primjer XML za usluge](${SITE_URL}${EXAMPLE_XML_PATH}): XML varijanta istog primjera.`,
    '',
    'Aktivni javni cjenici kupaca na /c/slug, njihova arhiva i CSV/XML feedovi dodaju se u',
    'sitemap.xml. Probni cjenici nose noindex i nisu u sitemapu.',
    '',
    '## Dokumentacija na nepar.hr',
    '',
    `- [${NEPAR_URL}/digitalni-cjenik](${NEPAR_URL}/digitalni-cjenik): pregled obveze i NEPAR Digital Price Engine`,
    `- [${NEPAR_URL}/digitalni-cjenik/sidrena-cijena](${NEPAR_URL}/digitalni-cjenik/sidrena-cijena): sidrena/dodatna cijena`,
    `- [${NEPAR_URL}/digitalni-cjenik/xml-csv](${NEPAR_URL}/digitalni-cjenik/xml-csv): XML/CSV format i zahtjevi`,
    `- [${NEPAR_URL}/digitalni-cjenik/automatizacija](${NEPAR_URL}/digitalni-cjenik/automatizacija): automatizacija objave cjenika`,
    '',
    'Napomena: ovaj llms.txt je informativni artefakt za strojno čitanje i ne utječe na',
    'Google rangiranje.',
    '',
  )
  return lines.join('\n')
}

export function renderFeed(posts: NewsPost[] = NEWS_POSTS) {
  const articles = [...posts].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
  const items = articles
    .map((post) => {
      const link = newsArticleUrl(post.slug)
      return [
        '    <item>',
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `      <pubDate>${escapeXml(new Date(post.publishedAt).toUTCString())}</pubDate>`,
        `      <description>${escapeXml(post.description)}</description>`,
        '    </item>',
      ].join('\n')
    })
    .join('\n')
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>NEPAR Publisher — vijesti o digitalnom cjeniku</title>',
    `    <link>${escapeXml(newsIndexUrl())}</link>`,
    '    <description>Vodiči o digitalnom cjeniku, sidrenoj cijeni i CSV/XML objavi.</description>',
    '    <language>hr</language>',
    `    <atom:link href="${SITE_URL}${FEED_PATH}" rel="self" type="application/rss+xml" />`,
    items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n')
}
