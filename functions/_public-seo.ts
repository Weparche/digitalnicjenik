import {
  DEMO_PUBLIC_SLUG,
  INDEXABLE_ROBOTS,
  isIndexablePublication,
  publicationSitemapUrls,
  type SitemapUrl,
} from '../src/seo/catalog'
import { SITE_URL } from '../src/news/site'
import { getPublicTenantAccess } from './_public-access'
import type { RuntimeEnv } from './_repository'

type PublicationRow = {
  slug: string
  name: string
  published_at: string
  plan: string | null
  status: string | null
  period_end: string | null
}

export type PublicationSeo = {
  index: boolean
  title: string
  description: string
  canonical: string
  slug: string
  name: string
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export async function listIndexablePublicationUrls(env: RuntimeEnv): Promise<SitemapUrl[]> {
  if (!env.DB) return []
  const demoSlug = env.DEMO_WRITE_TENANT || DEMO_PUBLIC_SLUG
  const rows = await env.DB.prepare(
    `SELECT t.slug, t.name, p.published_at, e.plan, e.status, e.period_end
     FROM price_publications p
     JOIN tenants t ON t.id = p.tenant_id
     LEFT JOIN entitlements e ON e.tenant_id = t.id
       AND e.id = (
         SELECT e2.id FROM entitlements e2
         WHERE e2.tenant_id = t.id
         ORDER BY e2.created_at DESC
         LIMIT 1
       )
     WHERE p.is_current = 1`,
  ).all<PublicationRow>()
  const urls: SitemapUrl[] = []
  for (const row of rows.results) {
    if (!isIndexablePublication({
      slug: row.slug,
      status: row.status,
      plan: row.plan,
      periodEnd: row.period_end,
      demoSlug,
    })) continue
    urls.push(...publicationSitemapUrls(row.slug, row.published_at.slice(0, 10)))
  }
  return urls
}

export async function resolvePublicationSeo(env: RuntimeEnv, slug: string, kind: 'current' | 'archive'): Promise<PublicationSeo> {
  const demoSlug = env.DEMO_WRITE_TENANT || DEMO_PUBLIC_SLUG
  let name = slug === demoSlug ? 'NEPAR demo' : slug
  let index = slug === demoSlug
  if (env.DB) {
    const access = await getPublicTenantAccess(env, slug)
    if (access.tenant?.name) name = access.tenant.name
    index = Boolean(access.accessible) && isIndexablePublication({
      slug,
      status: access.entitlement?.status ?? null,
      plan: access.entitlement?.plan ?? null,
      periodEnd: access.entitlement?.periodEnd ?? null,
      demoSlug,
    })
  }
  const canonical = kind === 'archive' ? `${SITE_URL}/c/${slug}/arhiva` : `${SITE_URL}/c/${slug}`
  const title = kind === 'archive'
    ? `Arhiva cjenika — ${name} | NEPAR Publisher`
    : `${name} — digitalni cjenik | NEPAR Publisher`
  const description = kind === 'archive'
    ? `Javna arhiva digitalnog cjenika za ${name}. Prethodne CSV i XML verzije ostaju dostupne.`
    : `Javni digitalni cjenik za ${name}: aktualne cijene te CSV i XML za automatizirani dohvat.`
  return { index, title, description, canonical, slug, name }
}

export function decoratePublicationShell(html: string, page: PublicationSeo) {
  if (!html.includes('<head>')) return html
  const robots = page.index ? INDEXABLE_ROBOTS : 'noindex,nofollow'
  let out = html
  if (/name="robots"/i.test(out)) {
    out = out.replace(/<meta\s+name="robots"\s+content="[^"]*"\s*\/>/i, `<meta name="robots" content="${robots}" />`)
  } else {
    out = out.replace('<head>', `<head>\n    <meta name="robots" content="${robots}" />`)
  }
  if (!page.index) return out

  const title = escapeHtml(page.title)
  const description = escapeHtml(page.description)
  const canonical = escapeHtml(page.canonical)
  const name = escapeHtml(page.name)
  const slug = escapeHtml(page.slug)
  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
  if (/name="description"/i.test(out)) {
    out = out.replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${description}" />`)
  } else {
    out = out.replace('<head>', `<head>\n    <meta name="description" content="${description}" />`)
  }
  const headExtras = [
    `    <link rel="canonical" href="${canonical}" />`,
    `    <link rel="alternate" hreflang="hr" href="${canonical}" />`,
    `    <link rel="alternate" hreflang="x-default" href="${canonical}" />`,
    `    <meta property="og:type" content="website" />`,
    `    <meta property="og:locale" content="hr_HR" />`,
    `    <meta property="og:url" content="${canonical}" />`,
    `    <meta property="og:title" content="${title}" />`,
    `    <meta property="og:description" content="${description}" />`,
    `    <script type="application/ld+json" data-nepar-schema>${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: page.title,
      description: page.description,
      url: page.canonical,
      inLanguage: 'hr-HR',
      isPartOf: 'https://digitalnicjenik.nepar.hr/#website',
    }).replaceAll('<', '\\u003c')}</script>`,
  ].join('\n')
  out = out.replace('</head>', `${headExtras}\n  </head>`)
  const summary = `<main class="public-shell"><h1>${name}</h1><p>${description}</p><p><a href="/c/${slug}/cjenik.csv">CSV</a> · <a href="/c/${slug}/cjenik.xml">XML</a> · <a href="/c/${slug}/arhiva">Arhiva</a></p></main>`
  out = out.replace('<div id="root"></div>', `<div id="root">${summary}</div>`)
  return out
}

export function publicationHtmlResponse(html: string, page: PublicationSeo) {
  const headers = new Headers({
    'content-type': 'text/html; charset=utf-8',
    'cache-control': page.index ? 'public, max-age=60' : 'no-store',
  })
  if (!page.index) headers.set('x-robots-tag', 'noindex, nofollow')
  return new Response(decoratePublicationShell(html, page), { headers })
}
