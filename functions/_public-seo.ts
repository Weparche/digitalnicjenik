import {
  DEMO_PUBLIC_SLUG,
  INDEXABLE_ROBOTS,
  isIndexablePublication,
  publicationSitemapUrls,
  type SitemapUrl,
} from '../src/seo/catalog'
import { SITE_URL } from '../src/news/site'
import { getPublicTenantAccess } from './_public-access'
import { readCurrentPublication,readPublications,type RuntimeEnv } from './_repository'
import { retentionIsLive } from '../shared/publication-retention'

type PublicationRow = {
  slug: string
  name: string
  published_at: string
  plan: string | null
  status: string | null
  period_end: string | null
  paid_confirmed_at: string | null
  grace_until: string | null
}

export type PublicationSeo = {
  index: boolean
  title: string
  description: string
  canonical: string
  slug: string
  name: string
  accessible?: boolean
  accessUntil?: string|null
  exists?: boolean
  publishedAt?: string
  sequence?: number
  versionStem?: string
  retained?: Array<{filenameStem:string;sequence:number;publishedAt:string}>
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
    `SELECT t.slug, t.name, p.published_at, e.plan, e.status, e.period_end, e.paid_confirmed_at, e.grace_until
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
      paidConfirmedAt: row.paid_confirmed_at,
      graceUntil: row.grace_until,
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
  let accessible = slug === demoSlug
  let exists = slug === demoSlug
  let accessUntil:string|null=null
  const publication = await readCurrentPublication(env,slug)
  let retained: Array<{filenameStem:string;sequence:number;publishedAt:string}> | undefined
  if (env.DB) {
    const access = await getPublicTenantAccess(env, slug)
    exists=Boolean(access.tenant)
    accessible=access.accessible
    accessUntil=kind==='current'?access.accessUntil??null:null
    if(kind==='archive' && access.entitlement?.status!=='suspended') {
      retained=(await readPublications(env,slug)).filter(row=>access.accessible||retentionIsLive(row)).map(row=>({filenameStem:row.filenameStem,sequence:row.sequence,publishedAt:row.publishedAt}))
      accessible=retained.length>0
    }
    if (access.tenant?.name) name = access.tenant.name
    index = Boolean(access.accessible) && isIndexablePublication({
      slug,
      status: access.entitlement?.status ?? null,
      plan: access.entitlement?.plan ?? null,
      periodEnd: access.entitlement?.periodEnd ?? null,
      paidConfirmedAt: access.entitlement?.paidConfirmedAt,
      graceUntil: access.entitlement?.graceUntil,
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
  return { index, title, description, canonical, slug, name,accessible,accessUntil,exists,publishedAt:publication?.publishedAt,sequence:publication?.sequence,versionStem:publication?.filenameStem,retained }
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
  if (!page.index) {
    if(page.accessible) out=out.replace('<div id="root"></div>',`<div id="root">${publicationSummary(page)}</div>`)
    return out
  }

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
  const summary = publicationSummary(page)
  out = out.replace('<div id="root"></div>', `<div id="root">${summary}</div>`)
  return out
}

function publicationSummary(page:PublicationSeo) {
  const base=`/c/${encodeURIComponent(page.slug)}`
  const timestamp=page.publishedAt?`<p>Zadnja objava: <time datetime="${escapeHtml(page.publishedAt)}">${escapeHtml(page.publishedAt)}</time> · verzija ${page.sequence}</p>`:''
  const versions=page.retained??(page.versionStem?[{filenameStem:page.versionStem,sequence:page.sequence!,publishedAt:page.publishedAt!}]:[])
  return `<main class="public-shell"><h1>${escapeHtml(page.name)}</h1><p>${escapeHtml(page.description)}</p>${timestamp}<p><a href="${base}/cjenik.csv">CSV</a> · <a href="${base}/cjenik.xml">XML</a> · <a href="${base}/arhiva">Arhiva</a></p>${versions.map(version=>`<p>Verzija ${version.sequence}: <a href="${base}/${escapeHtml(version.filenameStem)}.csv">CSV</a> · <a href="${base}/${escapeHtml(version.filenameStem)}.xml">XML</a></p>`).join('')}</main>`
}

export type PublicationVariant = 'embed' | 'print'

export function publicationVariantFromUrl(url: URL): PublicationVariant | undefined {
  if (url.searchParams.get('embed') === '1') return 'embed'
  if (url.searchParams.get('print') === '1') return 'print'
  return undefined
}

export function publicationHtmlResponse(html: string, page: PublicationSeo, variant?: PublicationVariant) {
  if(page.accessible===false) return new Response(page.exists?'Ovaj cjenik trenutačno nije dostupan.':'Cjenik nije pronađen.',{status:page.exists?410:404,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow'}})
  // Embed/print variants duplicate the canonical page, so they are never indexable.
  const effective = variant ? { ...page, index: false } : page
  const headers = new Headers({
    'content-type': 'text/html; charset=utf-8',
    'cache-control': (effective.index || variant === 'embed')&&!(effective.accessUntil&&Date.parse(effective.accessUntil)-Date.now()<60_000) ? 'public, max-age=60' : 'no-store',
  })
  if (!effective.index) headers.set('x-robots-tag', 'noindex, nofollow')
  // Public price lists may be embedded in any customer site (embed.js); no X-Frame-Options may be present.
  headers.set('content-security-policy', 'frame-ancestors *')
  headers.delete('x-frame-options')
  return new Response(decoratePublicationShell(html, effective), { headers })
}
