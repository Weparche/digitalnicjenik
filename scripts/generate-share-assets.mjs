// One-shot generator for favicon rasters + OG share image.
// Usage: node scripts/generate-share-assets.mjs
// Outputs are committed under public/ so Cloudflare Pages build does not need this step.
import { mkdir, readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = resolve(root, 'public')
const ogDir = resolve(publicDir, 'og')

async function rasterFromSvg(page, size, outPath) {
  const svg = await readFile(resolve(publicDir, 'favicon.svg'), 'utf8')
  const html = `<!doctype html><html><body style="margin:0;background:transparent">
    <div id="i" style="width:${size}px;height:${size}px">${svg}</div>
  </body></html>`
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(html, { waitUntil: 'load' })
  await page.locator('#i').screenshot({ path: outPath, omitBackground: false })
}

async function main() {
  await mkdir(ogDir, { recursive: true })

  const browser = await chromium.launch()
  const page = await browser.newPage()

  const favicon32 = resolve(publicDir, 'favicon-32x32.png')
  const appleTouch = resolve(publicDir, 'apple-touch-icon.png')
  await rasterFromSvg(page, 32, favicon32)
  await rasterFromSvg(page, 180, appleTouch)

  const markBytes = await readFile(appleTouch)
  const markDataUri = `data:image/png;base64,${markBytes.toString('base64')}`
  const templatePath = resolve(root, 'scripts/og-template.html')
  let template = await readFile(templatePath, 'utf8')
  template = template.replace('MARK_SRC', markDataUri)

  await page.setViewportSize({ width: 1200, height: 630 })
  await page.setContent(template, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.screenshot({
    path: resolve(ogDir, 'digitalni-cjenik-og.png'),
    type: 'png',
    clip: { x: 0, y: 0, width: 1200, height: 630 },
  })

  await browser.close()
  console.log('Generated favicon-32x32.png, apple-touch-icon.png, og/digitalni-cjenik-og.png')
}

await main()
