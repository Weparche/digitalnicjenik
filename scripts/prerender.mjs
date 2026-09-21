// Postbuild step (after `vite build`): renders marketing shell + /vijesti to static HTML.
import { createServer } from 'vite'
import { renderToString } from 'react-dom/server'
import React from 'react'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const SITE_URL = 'https://digitalnicjenik.nepar.hr'
const NEPAR_URL = 'https://nepar.hr'
const ORGANIZATION_ID = `${NEPAR_URL}/#organization`
const WEBSITE_ID = `${SITE_URL}/#website`
const PAGE_ID = `${SITE_URL}/#page`
const APP_ID = `${SITE_URL}/#app`
const PRICE_ENGINE_ID = `${NEPAR_URL}/digitalni-cjenik#price-engine`
const OG_IMAGE = `${SITE_URL}/og/digitalni-cjenik-og.png`

export const HOME_TITLE = 'NEPAR Publisher — cjenik na webu uz MIKROeRAČUN'
const DESCRIPTION =
  'MIKROeRAČUN je za eRačune. NEPAR Publisher objavljuje Excel/CSV cjenik na vašem webu — validacija, javni CSV/XML, probni rok 7 dana, akcija 39,90 €/god.'
const TWITTER_DESCRIPTION =
  'Publishing layer za javni cjenik: Excel/CSV → validacija → 7 dana probe → Publisher self-service.'

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function safeJson(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c')
}

function buildHomeSchema(productFaq) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': ORGANIZATION_ID,
        name: 'Nepar Solutions',
        legalName: 'Nepar, obrt za digitalna rješenja i usluge',
        url: `${NEPAR_URL}/`,
        email: 'nepar@nepar.hr',
      },
      {
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        name: 'NEPAR Publisher',
        url: `${SITE_URL}/`,
        inLanguage: 'hr',
        publisher: { '@id': ORGANIZATION_ID },
      },
      {
        '@type': 'WebPage',
        '@id': PAGE_ID,
        name: HOME_TITLE,
        description: DESCRIPTION,
        url: `${SITE_URL}/`,
        inLanguage: 'hr',
        isPartOf: { '@id': WEBSITE_ID },
        about: [
          { '@type': 'Thing', name: 'Digitalni cjenik' },
          { '@type': 'Thing', name: 'XML/CSV cjenik' },
          { '@type': 'Thing', name: 'Automatizacija cjenika' },
        ],
        mainEntity: { '@id': APP_ID },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': APP_ID,
        name: 'NEPAR Publisher',
        description: DESCRIPTION,
        url: `${SITE_URL}/`,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        inLanguage: 'hr',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        provider: { '@id': ORGANIZATION_ID },
        isRelatedTo: { '@id': PRICE_ENGINE_ID },
      },
      {
        '@type': 'Service',
        '@id': PRICE_ENGINE_ID,
        name: 'NEPAR Digital Price Engine',
        url: `${NEPAR_URL}/digitalni-cjenik`,
        provider: { '@id': ORGANIZATION_ID },
      },
      {
        '@type': 'FAQPage',
        '@id': `${SITE_URL}/#faq`,
        mainEntity: productFaq.map((entry) => ({
          '@type': 'Question',
          name: entry.question,
          acceptedAnswer: { '@type': 'Answer', text: entry.answer },
        })),
      },
    ],
  }
}

function buildNewsArticleSchema(post, pageUrl, imageUrl) {
  const articleId = `${pageUrl}#article`
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': ORGANIZATION_ID,
        name: 'Nepar Solutions',
        url: `${NEPAR_URL}/`,
      },
      {
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        name: 'NEPAR Publisher',
        url: `${SITE_URL}/`,
        inLanguage: 'hr-HR',
        publisher: { '@id': ORGANIZATION_ID },
      },
      {
        '@type': 'NewsArticle',
        '@id': articleId,
        headline: post.title,
        description: post.description,
        url: pageUrl,
        mainEntityOfPage: pageUrl,
        datePublished: post.publishedAt,
        dateModified: post.updatedAt,
        inLanguage: 'hr-HR',
        articleSection: post.schemaSection ?? 'Vijesti',
        author: { '@type': 'Organization', name: post.author.name, url: post.author.url },
        publisher: { '@id': ORGANIZATION_ID },
        image: [imageUrl],
        isPartOf: { '@id': WEBSITE_ID },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Početna', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Vijesti', item: `${SITE_URL}/vijesti` },
          { '@type': 'ListItem', position: 3, name: post.title, item: pageUrl },
        ],
      },
    ],
  }
}

function buildNewsIndexSchema(posts) {
  const indexUrl = `${SITE_URL}/vijesti`
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': ORGANIZATION_ID,
        name: 'Nepar Solutions',
        url: `${NEPAR_URL}/`,
      },
      {
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        name: 'NEPAR Publisher',
        url: `${SITE_URL}/`,
        inLanguage: 'hr-HR',
        publisher: { '@id': ORGANIZATION_ID },
      },
      {
        '@type': 'CollectionPage',
        '@id': `${indexUrl}#page`,
        name: 'Vijesti o digitalnom cjeniku',
        url: indexUrl,
        isPartOf: { '@id': WEBSITE_ID },
      },
      {
        '@type': 'ItemList',
        itemListElement: posts.map((post, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: `${SITE_URL}/vijesti/${post.slug}`,
          name: post.title,
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Početna', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Vijesti', item: indexUrl },
        ],
      },
    ],
  }
}

function buildAppShell(html) {
  let shell = html
  shell = shell.replace(/<link\s+rel="canonical"[^>]*>\s*/gi, '')
  shell = shell.replace(/<meta\s+property="og:[^"]*"\s+content="[^"]*"\s*\/>\s*/gi, '')
  shell = shell.replace(/<meta\s+name="twitter:[^"]*"\s+content="[^"]*"\s*\/>\s*/gi, '')
  if (!/name="robots"/i.test(shell)) {
    shell = shell.replace('<head>', '<head>\n    <meta name="robots" content="noindex,nofollow" />')
  } else {
    shell = shell.replace(
      /<meta\s+name="robots"\s+content="[^"]*"\s*\/>/i,
      '<meta name="robots" content="noindex,nofollow" />',
    )
  }
  shell = shell.replace(/<title>[\s\S]*?<\/title>/, '<title>NEPAR Publisher</title>')
  return shell
}

function stripExistingSchema(html) {
  return html.replace(
    /<script type="application\/ld\+json" data-nepar-schema>[\s\S]*?<\/script>\s*/gi,
    '',
  )
}

function applyPageMeta(html, {
  title,
  description,
  canonical,
  ogImage,
  ogTitle,
  ogDescription,
  schema,
}) {
  let out = stripExistingSchema(html)
  out = out.replace(/<link\s+rel="canonical"[^>]*>\s*/gi, '')
  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
  out = out.replace(
    /<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${escapeHtml(description)}" />`,
  )
  out = out.replace(
    /<meta property="og:url" content="[^"]*" \/>/,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
  )
  out = out.replace(
    /<meta property="og:title" content="[^"]*" \/>/,
    `<meta property="og:title" content="${escapeHtml(ogTitle ?? title)}" />`,
  )
  out = out.replace(
    /<meta property="og:description" content="[^"]*" \/>/,
    `<meta property="og:description" content="${escapeHtml(ogDescription ?? description)}" />`,
  )
  out = out.replace(
    /<meta property="og:image" content="[^"]*" \/>/,
    `<meta property="og:image" content="${escapeHtml(ogImage)}" />`,
  )
  out = out.replace(
    /<meta property="og:image:secure_url" content="[^"]*" \/>/,
    `<meta property="og:image:secure_url" content="${escapeHtml(ogImage)}" />`,
  )
  out = out.replace(
    /<meta name="twitter:title" content="[^"]*" \/>/,
    `<meta name="twitter:title" content="${escapeHtml(ogTitle ?? title)}" />`,
  )
  out = out.replace(
    /<meta name="twitter:description" content="[^"]*" \/>/,
    `<meta name="twitter:description" content="${escapeHtml(ogDescription ?? description)}" />`,
  )
  out = out.replace(
    /<meta name="twitter:image" content="[^"]*" \/>/,
    `<meta name="twitter:image" content="${escapeHtml(ogImage)}" />`,
  )
  const canonicalTag = `    <link rel="canonical" href="${escapeHtml(canonical)}" />\n  `
  out = out.replace('<head>', `<head>\n${canonicalTag}`)
  const schemaScript = `    <script type="application/ld+json" data-nepar-schema>${safeJson(schema)}</script>\n  `
  out = out.replace('</head>', `${schemaScript}</head>`)
  return out
}

function writeHtmlPage(filePath, shellHtml, bodyHtml, meta, schema) {
  mkdirSync(dirname(filePath), { recursive: true })
  let html = shellHtml.replace(
    /<div id="root"><\/div>/,
    `<div id="root" data-nepar-prerendered="true">${bodyHtml}</div>`,
  )
  html = applyPageMeta(html, { ...meta, schema })
  writeFileSync(filePath, html, 'utf8')
}

function isoDateForSitemap(iso) {
  return iso.slice(0, 10)
}

function generateSitemap(posts) {
  const urls = [
    { loc: `${SITE_URL}/`, lastmod: null },
    { loc: `${SITE_URL}/vijesti`, lastmod: null },
    ...posts.map((post) => ({
      loc: `${SITE_URL}/vijesti/${post.slug}`,
      lastmod: isoDateForSitemap(post.updatedAt),
    })),
  ]
  const body = urls
    .map((entry) => {
      const lastmod = entry.lastmod ? `\n    <lastmod>${entry.lastmod}</lastmod>` : ''
      return `  <url>\n    <loc>${entry.loc}</loc>${lastmod}\n  </url>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}

function generateLlms(posts) {
  const lines = [
    '# NEPAR Publisher — Digitalni cjenik',
    '',
    'NEPAR Publisher je alat kojim vlasnik web stranice provjerava ima li javno dostupan',
    'strojno čitljiv (CSV ili XML) digitalni cjenik, validira postojeću datoteku, pretvara',
    'Excel cjenik u CSV/XML i po potrebi naruči potpunu tehničku implementaciju.',
    '',
    'Proizvod pruža: NEPAR (Nepar, obrt za digitalna rješenja i usluge) — https://nepar.hr',
    '',
    `Kanonski URL proizvoda: ${SITE_URL}/`,
    '',
    '## Vijesti (digitalnicjenik.nepar.hr)',
    '',
    `Index: ${SITE_URL}/vijesti`,
    '',
  ]
  for (const post of posts) {
    lines.push(`- ${SITE_URL}/vijesti/${post.slug} — ${post.excerpt}`)
  }
  lines.push(
    '',
    'Detaljna pravna i tehnička dokumentacija o obvezi digitalnog cjenika, sidrenoj cijeni',
    'i automatizaciji objavljena je na nepar.hr:',
    '',
    '- https://nepar.hr/digitalni-cjenik — pregled obveze i NEPAR Digital Price Engine',
    '- https://nepar.hr/digitalni-cjenik/sidrena-cijena — sidrena/dodatna cijena',
    '- https://nepar.hr/digitalni-cjenik/xml-csv — XML/CSV format i zahtjevi',
    '- https://nepar.hr/digitalni-cjenik/automatizacija — automatizacija objave cjenika',
    '',
    'Napomena: ovaj llms.txt je informativni artefakt za strojno čitanje i ne utječe na',
    'Google rangiranje.',
    '',
  )
  return lines.join('\n')
}

function applyHomeMeta(html) {
  let out = html
  out = out.replace(/<div id="root"><\/div>/, (match) => match) // noop placeholder
  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(HOME_TITLE)}</title>`)
  out = out.replace(
    /<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${escapeHtml(DESCRIPTION)}" />`,
  )
  out = out.replace(
    /<meta property="og:title" content="[^"]*" \/>/,
    `<meta property="og:title" content="${escapeHtml(HOME_TITLE)}" />`,
  )
  out = out.replace(
    /<meta property="og:description" content="[^"]*" \/>/,
    `<meta property="og:description" content="${escapeHtml(DESCRIPTION)}" />`,
  )
  out = out.replace(
    /<meta name="twitter:card" content="[^"]*" \/>/,
    '<meta name="twitter:card" content="summary_large_image" />',
  )
  out = out.replace(
    /<meta name="twitter:title" content="[^"]*" \/>/,
    `<meta name="twitter:title" content="${escapeHtml(HOME_TITLE)}" />`,
  )
  out = out.replace(
    /<meta name="twitter:description" content="[^"]*" \/>/,
    `<meta name="twitter:description" content="${escapeHtml(TWITTER_DESCRIPTION)}" />`,
  )
  if (!out.includes(`property="og:image" content="${OG_IMAGE}"`)) {
    out = out.replace(
      '</head>',
      `    <meta property="og:image" content="${OG_IMAGE}" />\n    <meta property="og:image:secure_url" content="${OG_IMAGE}" />\n    <meta property="og:image:type" content="image/png" />\n    <meta property="og:image:width" content="1200" />\n    <meta property="og:image:height" content="630" />\n    <meta property="og:image:alt" content="NEPAR Publisher — digitalni cjenik" />\n  </head>`,
    )
  }
  if (!out.includes('twitter:image')) {
    out = out.replace('</head>', `    <meta name="twitter:image" content="${OG_IMAGE}" />\n  </head>`)
  }
  if (!out.includes('data-nepar-schema')) {
    return out
  }
  return out
}

async function main() {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  const [{ Landing }, { productFaq }, { NEWS_POSTS }, { NewsIndex }, { NewsArticle }] =
    await Promise.all([
      vite.ssrLoadModule('/src/App.tsx'),
      vite.ssrLoadModule('/src/productFaq.ts'),
      vite.ssrLoadModule('/src/news/posts.ts'),
      vite.ssrLoadModule('/src/news/NewsIndex.tsx'),
      vite.ssrLoadModule('/src/news/NewsArticle.tsx'),
    ])
  const landingHtml = renderToString(React.createElement(Landing))
  const newsIndexHtml = renderToString(React.createElement(NewsIndex))
  await vite.close()

  const distIndex = resolve('dist/index.html')
  const pristineShell = readFileSync(distIndex, 'utf8')
  writeFileSync(resolve('dist/app-shell.html'), buildAppShell(pristineShell), 'utf8')

  let homeHtml = pristineShell.replace(
    /<div id="root"><\/div>/,
    `<div id="root" data-nepar-prerendered="true">${landingHtml}</div>`,
  )
  homeHtml = applyHomeMeta(homeHtml)
  if (!homeHtml.includes('data-nepar-schema')) {
    const schema = `    <script type="application/ld+json" data-nepar-schema>${safeJson(buildHomeSchema(productFaq))}</script>\n  `
    homeHtml = homeHtml.replace('</head>', `${schema}</head>`)
  }
  writeFileSync(distIndex, homeHtml, 'utf8')
  console.log('Prerendered / (Landing) with product copy, meta, and JSON-LD.')

  const newsIndexUrl = `${SITE_URL}/vijesti`
  writeHtmlPage(
    resolve('dist/vijesti/index.html'),
    pristineShell,
    newsIndexHtml,
    {
      title: 'Vijesti o digitalnom cjeniku | NEPAR Publisher',
      description:
        'Regulativa digitalnog cjenika, sidrena odnosno dodatna cijena i CSV/XML objava — vodiči NEPAR Publishera.',
      canonical: newsIndexUrl,
      ogImage: OG_IMAGE,
    },
    buildNewsIndexSchema(NEWS_POSTS),
  )
  console.log('Prerendered /vijesti index.')

  for (const post of NEWS_POSTS) {
    const pageUrl = `${SITE_URL}/vijesti/${post.slug}`
    const imageUrl = `${SITE_URL}${post.image.src}`
    const bodyHtml = renderToString(React.createElement(NewsArticle, { slug: post.slug }))
    writeHtmlPage(
      resolve(`dist/vijesti/${post.slug}/index.html`),
      pristineShell,
      bodyHtml,
      {
        title: post.seoTitle,
        description: post.description,
        canonical: pageUrl,
        ogImage: imageUrl,
        ogTitle: post.seoTitle,
        ogDescription: post.description,
      },
      buildNewsArticleSchema(post, pageUrl, imageUrl),
    )
    console.log(`Prerendered /vijesti/${post.slug}`)
  }

  writeFileSync(resolve('dist/sitemap.xml'), generateSitemap(NEWS_POSTS), 'utf8')
  writeFileSync(resolve('dist/llms.txt'), generateLlms(NEWS_POSTS), 'utf8')
  console.log('Generated dist/sitemap.xml and dist/llms.txt from posts.')
}

await main()
