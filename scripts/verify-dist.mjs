// Postbuild gate (after scripts/prerender.mjs): fails the build if dist/ doesn't actually give a
// non-JS crawler what it needs — real robots.txt/sitemap.xml/llms.txt (not the SPA shell), a
// prerendered "/" with a real H1/canonical/JSON-LD, and a genuine 404 artifact for unmatched
// routes. Mirrors the equivalent script in the C:\Nepar repo.
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const distDir = resolve(process.cwd(), 'dist')
const failures = []

function read(relativePath) {
  const filePath = resolve(distDir, relativePath)
  if (!existsSync(filePath)) {
    failures.push(`Missing dist/${relativePath}`)
    return ''
  }
  return readFileSync(filePath, 'utf8')
}

function expect(relativePath, pattern, message) {
  const contents = read(relativePath)
  if (typeof pattern === 'string' ? !contents.includes(pattern) : !pattern.test(contents)) {
    failures.push(`${relativePath}: ${message}`)
  }
}

// --- index.html ("/") ---
const indexHtml = read('index.html')
const h1Count = (indexHtml.match(/<h1\b/gi) || []).length
if (h1Count !== 1) failures.push(`index.html: expected exactly one <h1>, found ${h1Count}`)
expect('index.html', /<h1[^>]*>/, 'prerendered H1 is missing')
expect('index.html', 'Provjerite što imate', 'prerendered hero copy is missing')
expect('index.html', '<link rel="canonical" href="https://digitalnicjenik.nepar.hr/" />', 'self-canonical is missing')
expect('index.html', /<title>[^<]{10,}<\/title>/, 'title is missing or too short')
expect('index.html', /<meta name="description" content="[^"]{20,}" \/>/, 'meta description is missing or too short')
expect('index.html', 'application/ld+json', 'JSON-LD is missing')
expect('index.html', 'https://digitalnicjenik.nepar.hr/#app', 'SoftwareApplication @id is missing from JSON-LD')
expect('index.html', 'https://nepar.hr/digitalni-cjenik#price-engine', 'reused NEPAR Price Engine Service @id is missing')
expect('index.html', 'nepar.hr/digitalni-cjenik/sidrena-cijena', 'inlink to the sidrena-cijena guide is missing')
expect('index.html', 'nepar.hr/digitalni-cjenik/xml-csv', 'inlink to the xml-csv guide is missing')
expect('index.html', 'nepar.hr/digitalni-cjenik/automatizacija', 'inlink to the automatizacija guide is missing')
expect('index.html', '<meta property="og:url" content="https://digitalnicjenik.nepar.hr/" />', 'og:url is missing')
expect('index.html', '<meta property="og:locale" content="hr_HR" />', 'og:locale is missing')
expect('index.html', '<meta property="og:image" content="https://digitalnicjenik.nepar.hr/og/digitalni-cjenik-og.png" />', 'absolute og:image is missing')
expect('index.html', '<meta property="og:image:width" content="1200" />', 'og:image:width must be 1200')
expect('index.html', '<meta property="og:image:height" content="630" />', 'og:image:height must be 630')
expect('index.html', '<meta name="twitter:card" content="summary_large_image" />', 'twitter:card must be summary_large_image')
expect('index.html', 'rel="icon" href="/favicon.svg"', 'favicon.svg reference is missing')
expect('index.html', 'rel="apple-touch-icon" href="/apple-touch-icon.png"', 'apple-touch-icon reference is missing')
if (indexHtml.includes('sameAs')) failures.push('index.html: JSON-LD must not use sameAs between the product and NEPAR Organization')
if (!existsSync(resolve(distDir, 'og/digitalni-cjenik-og.png'))) {
  failures.push('Missing dist/og/digitalni-cjenik-og.png')
}
if (!existsSync(resolve(distDir, 'favicon.svg'))) failures.push('Missing dist/favicon.svg')
if (!existsSync(resolve(distDir, 'favicon-32x32.png'))) failures.push('Missing dist/favicon-32x32.png')
if (!existsSync(resolve(distDir, 'apple-touch-icon.png'))) failures.push('Missing dist/apple-touch-icon.png')

const rootMatch = indexHtml.match(/<div id="root"[^>]*>([\s\S]*)<\/div>\s*<\/body>/)
const rootText = (rootMatch?.[1] ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
if (rootText.length <= 200) failures.push(`index.html: prerendered #root text is only ${rootText.length} chars — looks empty/thin`)

// --- robots.txt ---
const robots = read('robots.txt')
if (!robots.startsWith('User-agent:')) failures.push('robots.txt: is not a plain-text robots file (looks like the SPA shell)')
if (!robots.includes('Sitemap: https://digitalnicjenik.nepar.hr/sitemap.xml')) failures.push('robots.txt: missing Sitemap directive')

// --- sitemap.xml ---
const sitemap = read('sitemap.xml')
if (!sitemap.startsWith('<?xml')) failures.push('sitemap.xml: is not real XML (looks like the SPA shell)')
if (!sitemap.includes('<loc>https://digitalnicjenik.nepar.hr/</loc>')) failures.push('sitemap.xml: missing root URL')

// --- llms.txt ---
const llms = read('llms.txt')
if (llms.includes('<!doctype html>')) failures.push('llms.txt: is not plain text (looks like the SPA shell)')
if (!llms.includes('nepar.hr/digitalni-cjenik')) failures.push('llms.txt: missing links to the nepar.hr educational cluster')

// --- 404.html ---
expect('404.html', '<meta name="robots" content="noindex,nofollow" />', '404 page must be noindex,nofollow')

// --- app-shell.html: the clean, un-prerendered shell for /c/:slug and /arhiva ---
const appShell = read('app-shell.html')
if (appShell.includes('data-nepar-prerendered')) failures.push('app-shell.html: must be the pristine shell, not the prerendered Landing markup')
if (!/<div id="root"><\/div>/.test(appShell)) failures.push('app-shell.html: root div must be empty so client-side rendering picks the right component tree')
expect('app-shell.html', '<meta name="robots" content="noindex,nofollow" />', 'app-shell must be noindex,nofollow')
if (appShell.includes('rel="canonical"')) failures.push('app-shell.html: must not claim homepage canonical')
if (appShell.includes('property="og:url"')) failures.push('app-shell.html: must not claim homepage og:url')

// --- _redirects: no catch-all SPA rewrite ---
const redirects = read('_redirects')
if (/^\/\*\s/m.test(redirects)) failures.push('_redirects: catch-all SPA rewrite would hide real 404 responses.')
if (!redirects.includes('/c/* /app-shell 200')) failures.push('_redirects: missing the /c/* publication route mapping to app-shell')
if (!redirects.includes('/arhiva /app-shell 200')) failures.push('_redirects: missing the /arhiva route mapping to app-shell')
if (!redirects.includes('/app /app-shell 200')) failures.push('_redirects: missing the /app route mapping to app-shell')
if (!redirects.includes('/app/* /app-shell 200')) failures.push('_redirects: missing the /app/* route mapping to app-shell')

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'))
  process.exit(1)
}

console.log('Verified index.html prerender, share meta, robots.txt, sitemap.xml, llms.txt, and 404 artifact.')
