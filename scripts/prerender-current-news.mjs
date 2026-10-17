import { createServer } from 'vite'
import { renderToString } from 'react-dom/server'
import React from 'react'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const SITE_URL = 'https://digitalnicjenik.nepar.hr'
const SLUG = 'nacrti-pravilnika-digitalni-cjenik-bazna-cijena-2026'
const escapeHtml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
const [{ DRAFT_RULES_POST: post }, { NewsArticle }] = await Promise.all([
  vite.ssrLoadModule('/src/news/posts-current.ts'),
  vite.ssrLoadModule('/src/news/NewsArticle.tsx'),
])
const bodyHtml = renderToString(React.createElement(NewsArticle, { slug: SLUG }))
await vite.close()

const templatePath = resolve('dist/vijesti/odgoda-digitalnih-cjenika-sidrenih-cijena-2026/index.html')
let html = readFileSync(templatePath, 'utf8')
const canonical = `${SITE_URL}/vijesti/${SLUG}/`
const imageUrl = `${SITE_URL}${post.image.src}`

html = html.replace(/<div id="root"[^>]*>[\s\S]*?<\/div>\s*<script type="module"/, `<div id="root" data-nepar-prerendered="true">${bodyHtml}</div>\n    <script type="module"`)
html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(post.seoTitle)}</title>`)
html = html.replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${escapeHtml(post.description)}" />`)
html = html.replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${canonical}" />`)
html = html.replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${canonical}" />`)
html = html.replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${escapeHtml(post.seoTitle)}" />`)
html = html.replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${escapeHtml(post.description)}" />`)
html = html.replace(/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${imageUrl}" />`)
html = html.replace(/<meta property="og:image:secure_url" content="[^"]*" \/>/, `<meta property="og:image:secure_url" content="${imageUrl}" />`)
html = html.replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${escapeHtml(post.seoTitle)}" />`)
html = html.replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${escapeHtml(post.description)}" />`)
html = html.replace(/<meta name="twitter:image" content="[^"]*" \/>/, `<meta name="twitter:image" content="${imageUrl}" />`)
html = html.replace(/<meta property="article:published_time" content="[^"]*" \/>/, `<meta property="article:published_time" content="${post.publishedAt}" />`)
html = html.replace(/<meta property="article:modified_time" content="[^"]*" \/>/, `<meta property="article:modified_time" content="${post.updatedAt}" />`)
html = html.replace(/<script type="application\/ld\+json" data-nepar-schema>[\s\S]*?<\/script>/, `<script type="application/ld+json" data-nepar-schema>${JSON.stringify({ '@context': 'https://schema.org', '@type': 'NewsArticle', headline: post.title, description: post.description, url: canonical, datePublished: post.publishedAt, dateModified: post.updatedAt, inLanguage: 'hr-HR', image: [imageUrl], author: { '@type': 'Organization', name: post.author.name, url: post.author.url }, publisher: { '@type': 'Organization', name: 'Nepar Solutions', url: 'https://nepar.hr/' } }).replaceAll('<', '\\u003c')}</script>`)

const outputPath = resolve(`dist/vijesti/${SLUG}/index.html`)
mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, html, 'utf8')

for (const path of ['dist/sitemap.xml', 'public/sitemap.xml']) {
  let value = readFileSync(resolve(path), 'utf8')
  if (!value.includes(canonical)) value = value.replace('</urlset>', `  <url><loc>${canonical}</loc><lastmod>2026-10-17</lastmod></url>\n</urlset>`)
  writeFileSync(resolve(path), value, 'utf8')
}

for (const path of ['dist/llms.txt', 'public/llms.txt']) {
  let value = readFileSync(resolve(path), 'utf8')
  if (!value.includes(canonical)) value += `\n- [${post.title}](${canonical}): ${post.description}\n`
  writeFileSync(resolve(path), value, 'utf8')
}

for (const path of ['dist/feed.xml', 'public/feed.xml']) {
  let value = readFileSync(resolve(path), 'utf8')
  if (!value.includes(canonical)) {
    const item = `<item><title>${escapeHtml(post.title)}</title><link>${canonical}</link><guid>${canonical}</guid><pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate><description>${escapeHtml(post.description)}</description></item>`
    value = value.replace('</channel>', `${item}\n</channel>`)
  }
  writeFileSync(resolve(path), value, 'utf8')
}

console.log(`Prerendered current news /vijesti/${SLUG}/ and added it to sitemap, llms.txt, and feed.`)
