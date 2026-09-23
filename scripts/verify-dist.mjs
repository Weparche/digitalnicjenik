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
expect('index.html', 'Koristite MIKROeRAČUN', 'prerendered hero copy is missing')
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
if (!robots.includes('Disallow: /api/')) failures.push('robots.txt: must keep /api/ out of the crawl')
if (!robots.includes('Disallow: /app$')) failures.push('robots.txt: must block /app without blocking /apple-touch-icon.png')
if (!robots.includes('Disallow: /app/')) failures.push('robots.txt: must block /app/ routes')
if (robots.includes('Disallow: /vijesti') || robots.includes('Disallow: /c')) failures.push('robots.txt: must not block public news or cjenik URLs')

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

const HOME_TITLE = 'NEPAR Publisher — cjenik na webu uz MIKROeRAČUN'
const LATEST_SLUG = 'primjeri-digitalnih-cjenika-hrvatska-2026'
const MINISTRY_SLUG = 'ministarstvo-pojasnjenja-digitalni-cjenik-sidrene-cijene-2026'
const NO_WEB_SLUG = 'digitalni-cjenik-bez-web-stranice-drustvene-mreze'
const HOK_SLUG = 'hok-excel-predlosci-digitalni-cjenik-2026'
const CSV_SLUG = 'primjer-csv-digitalnog-cjenika-usluge-2026'
const REGULATORY_SLUG = 'digitalni-cjenik-sidrena-cijena-2026'
const LATEST_CANONICAL = `https://digitalnicjenik.nepar.hr/vijesti/${LATEST_SLUG}/`
const MINISTRY_CANONICAL = `https://digitalnicjenik.nepar.hr/vijesti/${MINISTRY_SLUG}/`
const NO_WEB_CANONICAL = `https://digitalnicjenik.nepar.hr/vijesti/${NO_WEB_SLUG}/`
const HOK_CANONICAL = `https://digitalnicjenik.nepar.hr/vijesti/${HOK_SLUG}/`
const CSV_CANONICAL = `https://digitalnicjenik.nepar.hr/vijesti/${CSV_SLUG}/`
const REGULATORY_CANONICAL = `https://digitalnicjenik.nepar.hr/vijesti/${REGULATORY_SLUG}/`
const LATEST_REL = `vijesti/${LATEST_SLUG}/index.html`
const MINISTRY_REL = `vijesti/${MINISTRY_SLUG}/index.html`
const NO_WEB_REL = `vijesti/${NO_WEB_SLUG}/index.html`
const HOK_REL = `vijesti/${HOK_SLUG}/index.html`
const CSV_REL = `vijesti/${CSV_SLUG}/index.html`
const REGULATORY_REL = `vijesti/${REGULATORY_SLUG}/index.html`

expect('index.html', `href="/vijesti/${LATEST_SLUG}/"`, 'landing widget must link to latest news article')
expect('index.html', 'index,follow,max-image-preview:large', 'homepage must be explicitly indexable')
expect('index.html', 'hreflang="hr"', 'homepage must declare Croatian hreflang')
expect('index.html', 'https://digitalnicjenik.nepar.hr/feed.xml', 'homepage must link the news feed')
expect('sitemap.xml', `<loc>${LATEST_CANONICAL}</loc>`, 'sitemap must include latest article canonical URL')
expect('sitemap.xml', `<loc>${MINISTRY_CANONICAL}</loc>`, 'sitemap must include Ministry article canonical URL')
expect('sitemap.xml', `<loc>${NO_WEB_CANONICAL}</loc>`, 'sitemap must include no-web article canonical URL')
expect('sitemap.xml', `<loc>${HOK_CANONICAL}</loc>`, 'sitemap must include HOK article canonical URL')
expect('sitemap.xml', `<loc>${CSV_CANONICAL}</loc>`, 'sitemap must include CSV guide canonical URL')
expect('sitemap.xml', `<loc>${REGULATORY_CANONICAL}</loc>`, 'sitemap must include regulatory article canonical URL')
expect('sitemap.xml', '<loc>https://digitalnicjenik.nepar.hr/vijesti/</loc>', 'sitemap must include news index')
expect('sitemap.xml', '<loc>https://digitalnicjenik.nepar.hr/c/nepar</loc>', 'sitemap must include the public demo cjenik')
expect('sitemap.xml', '<loc>https://digitalnicjenik.nepar.hr/c/nepar/arhiva</loc>', 'sitemap must include the demo archive')
expect('sitemap.xml', '<loc>https://digitalnicjenik.nepar.hr/c/nepar/cjenik.csv</loc>', 'sitemap must include the demo CSV')
expect('sitemap.xml', '<loc>https://digitalnicjenik.nepar.hr/c/nepar/cjenik.xml</loc>', 'sitemap must include the demo XML')
expect('sitemap.xml', '<loc>https://digitalnicjenik.nepar.hr/examples/primjer-digitalni-cjenik-usluge-2026.csv</loc>', 'sitemap must include the CSV example')
expect('sitemap.xml', '<loc>https://digitalnicjenik.nepar.hr/examples/primjer-digitalni-cjenik-usluge-2026.xml</loc>', 'sitemap must include the XML example')
expect('llms.txt', 'https://digitalnicjenik.nepar.hr/c/nepar', 'llms.txt must list the demo cjenik')
expect('feed.xml', `<link>${LATEST_CANONICAL}</link>`, 'feed must include the latest article')
expect('feed.xml', `<link>${REGULATORY_CANONICAL}</link>`, 'feed must include the regulatory article')
expect('llms.txt', LATEST_CANONICAL, 'llms.txt must list latest article canonical URL')
expect('llms.txt', MINISTRY_CANONICAL, 'llms.txt must list Ministry article canonical URL')
expect('llms.txt', NO_WEB_CANONICAL, 'llms.txt must list no-web article canonical URL')
expect('llms.txt', HOK_CANONICAL, 'llms.txt must list HOK article canonical URL')
expect('llms.txt', CSV_CANONICAL, 'llms.txt must list CSV guide canonical URL')
expect('llms.txt', REGULATORY_CANONICAL, 'llms.txt must list regulatory article canonical URL')

if (existsSync(resolve(distDir, 'vijesti/unknown-slug/index.html'))) {
  failures.push('dist/vijesti/unknown-slug/index.html must not exist')
}

function verifyArticle(relPath, canonical, expectedHeadline, extraChecks) {
  const articleHtml = read(relPath)
  const articleH1 = (articleHtml.match(/<h1\b/gi) || []).length
  if (articleH1 !== 1) failures.push(`${relPath}: expected exactly one <h1>, found ${articleH1}`)
  const articleTitleMatch = articleHtml.match(/<title>([^<]+)<\/title>/)
  if (!articleTitleMatch) failures.push(`${relPath}: missing <title>`)
  else if (articleTitleMatch[1] === HOME_TITLE) {
    failures.push(`${relPath}: title must differ from homepage title`)
  }
  expect(relPath, `<link rel="canonical" href="${canonical}" />`, `${relPath}: canonical missing`)
  expect(relPath, /<meta name="description" content="[^"]{20,}" \/>/, `${relPath}: meta description missing`)
  expect(relPath, 'NewsArticle', `${relPath}: JSON-LD must include NewsArticle`)
  expect(relPath, 'datePublished', `${relPath}: JSON-LD must include datePublished`)
  expect(relPath, 'dateModified', `${relPath}: JSON-LD must include dateModified`)
  expect(relPath, 'Provjerite digitalni cjenik svoje web stranice', `${relPath}: article website checker is missing`)
  expect(relPath, 'https://digitalnicjenik.nepar.hr/#csv-validator', `${relPath}: article checker must link to Publisher`)
  expect(relPath, 'mailto:nepar@nepar.hr', `${relPath}: article checker must include email inquiry CTA`)
  if (/noindex/i.test(articleHtml)) failures.push(`${relPath}: must not be noindex`)
  expect(relPath, '<meta property="og:type" content="article" />', `${relPath}: og:type must be article`)
  expect(relPath, 'article:published_time', `${relPath}: article published time is missing`)
  expect(relPath, 'hreflang="hr"', `${relPath}: hreflang is missing`)
  expect(
    relPath,
    'https://digitalnicjenik.nepar.hr/og/vijesti-digitalni-cjenik-2026.png',
    `${relPath}: og:image must use editorial image`,
  )

  const schemaMatch = articleHtml.match(
    /<script type="application\/ld\+json" data-nepar-schema>([\s\S]*?)<\/script>/,
  )
  if (!schemaMatch) failures.push(`${relPath}: missing JSON-LD script`)
  else {
    try {
      const schema = JSON.parse(schemaMatch[1])
      const graph = schema['@graph'] ?? []
      const newsArticle = graph.find((node) => node['@type'] === 'NewsArticle')
      if (!newsArticle) failures.push(`${relPath}: JSON-LD graph missing NewsArticle node`)
      else if (newsArticle.headline !== expectedHeadline) {
        failures.push(`${relPath}: NewsArticle headline must match article H1 title`)
      }
    } catch {
      failures.push(`${relPath}: JSON-LD is not valid JSON`)
    }
  }

  if (!articleHtml.includes(`href="${canonical}"`)) {
    failures.push(`${relPath}: canonical href must match sitemap loc`)
  }

  for (const [needle, message] of extraChecks) {
    expect(relPath, needle, message)
  }
}

verifyArticle(
  LATEST_REL,
  LATEST_CANONICAL,
  'Javni digitalni cjenici već su online: 5 primjera iz Hrvatske',
  [
    ['https://autogubic.hr/cjenik', 'examples article must link NEPAR Auto Gubic reference implementation'],
    ['NEPAR-ova referentna implementacija za Auto Gubić', 'examples article must identify NEPAR reference implementation'],
    ['https://www.knofek.hr/digitalni-cjenik/', 'examples article must link KNOFEK'],
    ['https://optikavisual.com/cjenik/', 'examples article must link Optika VISUAL'],
    ['https://modusdesignshop.hr/cjenik/', 'examples article must link Modus Design Shop'],
    ['https://webstudiosime.hr/digitalni-cjenik/', 'examples article must link Web Studio Šime'],
    ['tehnički pregled', 'examples article must include compliance disclaimer'],
  ],
)

verifyArticle(
  MINISTRY_REL,
  MINISTRY_CANONICAL,
  'Ministarstvo objavilo detaljna pojašnjenja za digitalni cjenik i sidrene cijene',
  [
    ['mingo.gov.hr/vijesti/pojasnjenja-za-primjenu-dodatne-cijene-i-objavu-cjenika-od-1-listopada/10440', 'Ministry article HTML must link Ministry clarification'],
    ['zasebnu CSV/XML datoteku', 'Ministry article must explain separate files per location'],
    ['web shop', 'Ministry article must explain separate web-shop file'],
    ['u praksi ispunjava već', 'Ministry article must include automated-retrieval clarification'],
  ],
)

verifyArticle(
  NO_WEB_REL,
  NO_WEB_CANONICAL,
  'Nemate web stranicu? Ministar pojasnio tko ne mora imati digitalni cjenik',
  [
    ['vijesti.hrt.hr/gospodarstvo/ante-susnjar-dnevnik-htv-a-12918686', 'no-web article HTML must link HRT clarification'],
    ['/vijesti/ministarstvo-pojasnjenja-digitalni-cjenik-sidrene-cijene-2026', 'no-web article must link written Ministry clarification'],
  ],
)

verifyArticle(
  HOK_REL,
  HOK_CANONICAL,
  'HOK objavio Excel predloške za digitalni cjenik: što obrtnici trebaju napraviti do 1. listopada',
  [
    ['hok.hr/novosti-iz-hok/dodatna-cijena-i-objava-cjenika', 'HOK article HTML must link HOK source'],
    ['href="/#csv-validator"', 'HOK article must link the Excel/CSV validator'],
    ['/vijesti/primjer-csv-digitalnog-cjenika-usluge-2026', 'HOK article must link the CSV guide'],
  ],
)

verifyArticle(CSV_REL, CSV_CANONICAL, 'Primjer CSV digitalnog cjenika za pružatelje usluga', [
  ['narodne-novine.nn.hr/clanci/sluzbeni/2026_09_101_1213.html', 'CSV guide HTML must link NN 1213'],
  ['Naziv usluge;Maloprodajna cijena', 'CSV guide must include HOK-style CSV example in HTML'],
  ['/examples/primjer-digitalni-cjenik-usluge-2026.csv', 'CSV guide must link downloadable CSV example'],
])

verifyArticle(
  REGULATORY_REL,
  REGULATORY_CANONICAL,
  'Digitalni cjenik od 1. listopada 2026.: što se mijenja za vlasnike web stranica',
  [
    ['narodne-novine.nn.hr/clanci/sluzbeni/2026_09_101_1213.html', 'regulatory article HTML must link NN 1213'],
    ['hok.hr/novosti-iz-hok/dodatna-cijena-i-objava-cjenika', 'regulatory article HTML must link HOK'],
  ],
)

expect('vijesti/index.html', `href="/vijesti/${LATEST_SLUG}/"`, 'news index must link to latest examples article')
expect('vijesti/index.html', `href="/vijesti/${MINISTRY_SLUG}/"`, 'news index must link to Ministry article')
expect('vijesti/index.html', `href="/vijesti/${NO_WEB_SLUG}/"`, 'news index must link to no-web article')
expect('vijesti/index.html', `href="/vijesti/${HOK_SLUG}/"`, 'news index must link to HOK article')
expect('vijesti/index.html', `href="/vijesti/${CSV_SLUG}/"`, 'news index must link to CSV guide')
expect('vijesti/index.html', `href="/vijesti/${REGULATORY_SLUG}/"`, 'news index must link to regulatory article')
expect('vijesti/index.html', '<link rel="canonical" href="https://digitalnicjenik.nepar.hr/vijesti/" />', 'news index canonical must use the trailing-slash URL')

if (!existsSync(resolve(distDir, 'og/vijesti-digitalni-cjenik-2026.png'))) {
  failures.push('Missing dist/og/vijesti-digitalni-cjenik-2026.png')
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'))
  process.exit(1)
}

console.log('Verified index.html prerender, share meta, robots.txt, sitemap.xml, llms.txt, and 404 artifact.')
