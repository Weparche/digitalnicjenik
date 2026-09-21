// Postbuild step (after `vite build`): renders the real marketing/checker shell (src/App.tsx's
// `Landing`) to static HTML with react-dom/server and writes it into dist/index.html, so a
// crawler that never executes JS still sees the real H1, product copy, and JSON-LD — the same
// content a browser sees after hydration. Uses Vite's own SSR API (no headless browser, no new
// framework) since this stays a plain Vite + React SPA everywhere else.
import { createServer } from 'vite'
import { renderToString } from 'react-dom/server'
import React from 'react'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SITE_URL = 'https://digitalnicjenik.nepar.hr'
const NEPAR_URL = 'https://nepar.hr'
const ORGANIZATION_ID = `${NEPAR_URL}/#organization`
const WEBSITE_ID = `${SITE_URL}/#website`
const PAGE_ID = `${SITE_URL}/#page`
const APP_ID = `${SITE_URL}/#app`
const PRICE_ENGINE_ID = `${NEPAR_URL}/digitalni-cjenik#price-engine`
const OG_IMAGE = `${SITE_URL}/og/digitalni-cjenik-og.png`

const TITLE = 'NEPAR Publisher — cjenik na webu uz MIKROeRAČUN'
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

function buildSchema(productFaq) {
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
        name: TITLE,
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

/** Publication routes must not inherit homepage canonical / share identity. */
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

async function main() {
  // Load TS through Vite SSR — plain Node cannot import .ts without a loader.
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  const [{ Landing }, { productFaq }] = await Promise.all([
    vite.ssrLoadModule('/src/App.tsx'),
    vite.ssrLoadModule('/src/productFaq.ts'),
  ])
  const bodyHtml = renderToString(React.createElement(Landing))
  await vite.close()

  const distIndex = resolve('dist/index.html')
  let html = readFileSync(distIndex, 'utf8')

  // /c/:slug and /arhiva reuse this same build (via a Cloudflare Pages rewrite, see
  // public/_redirects) but render a different component tree (PublicPriceList) client-side, so
  // they must not receive the Landing markup or homepage OG/canonical identity.
  writeFileSync(resolve('dist/app-shell.html'), buildAppShell(html), 'utf8')

  html = html.replace(/<div id="root"><\/div>/, `<div id="root" data-nepar-prerendered="true">${bodyHtml}</div>`)
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(TITLE)}</title>`)
  html = html.replace(
    /<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${escapeHtml(DESCRIPTION)}" />`,
  )
  html = html.replace(
    /<meta property="og:title" content="[^"]*" \/>/,
    `<meta property="og:title" content="${escapeHtml(TITLE)}" />`,
  )
  html = html.replace(
    /<meta property="og:description" content="[^"]*" \/>/,
    `<meta property="og:description" content="${escapeHtml(DESCRIPTION)}" />`,
  )
  // Ensure share image tags stay absolute and complete (already in Vite template; keep them).
  if (!html.includes(`property="og:image" content="${OG_IMAGE}"`)) {
    html = html.replace(
      '</head>',
      `    <meta property="og:image" content="${OG_IMAGE}" />\n    <meta property="og:image:secure_url" content="${OG_IMAGE}" />\n    <meta property="og:image:type" content="image/png" />\n    <meta property="og:image:width" content="1200" />\n    <meta property="og:image:height" content="630" />\n    <meta property="og:image:alt" content="NEPAR Publisher — digitalni cjenik" />\n  </head>`,
    )
  }
  html = html.replace(
    /<meta name="twitter:card" content="[^"]*" \/>/,
    '<meta name="twitter:card" content="summary_large_image" />',
  )
  html = html.replace(
    /<meta name="twitter:title" content="[^"]*" \/>/,
    `<meta name="twitter:title" content="${escapeHtml(TITLE)}" />`,
  )
  html = html.replace(
    /<meta name="twitter:description" content="[^"]*" \/>/,
    `<meta name="twitter:description" content="${escapeHtml(TWITTER_DESCRIPTION)}" />`,
  )
  if (!html.includes('twitter:image')) {
    html = html.replace(
      '</head>',
      `    <meta name="twitter:image" content="${OG_IMAGE}" />\n  </head>`,
    )
  }
  if (!html.includes('data-nepar-schema')) {
    const schema = `    <script type="application/ld+json" data-nepar-schema>${safeJson(buildSchema(productFaq))}</script>\n  </head>`
    html = html.replace('</head>', schema)
  }

  writeFileSync(distIndex, html, 'utf8')
  console.log('Prerendered / (Landing) with product copy, meta, and JSON-LD.')
}

await main()
