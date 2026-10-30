import { expect, test } from '@playwright/test'
import { SITE_PAGES } from '../src/pages/registry'

const paths = ['/digitalni-cjenik/', '/sidrena-cijena/', '/digitalni-cjenik-2026/', '/digitalni-cjenik-za-usluge/', '/digitalni-cjenik-za-webshop/', '/digitalni-cjenik-woocommerce/']

test('public pages prerender useful content, a single canonical and the shared hero entry', async ({ request }) => {
  const sitemap = await (await request.get('/sitemap.xml')).text()
  const llms = await (await request.get('/llms.txt')).text()
  for (const meta of SITE_PAGES) {
    const response = await request.get(meta.path)
    const html = await response.text()
    expect(response.status(), meta.path).toBe(200)
    expect(html.match(/<h1\b/g), meta.path).toHaveLength(1)
    expect(html.match(/<link rel="canonical"/g), meta.path).toHaveLength(1)
    expect(html).toContain(`href="https://digitalnicjenik.nepar.hr${meta.path}"`)
    expect(html).toContain('aria-label="Besplatna provjera weba"')
    expect(html).toContain('name="website"')
    expect(html.indexOf('name="website"')).toBeLessThan(html.indexOf('class="site-section'))
    expect(sitemap).toContain(`https://digitalnicjenik.nepar.hr${meta.path}`)
    expect(llms).toContain(`https://digitalnicjenik.nepar.hr${meta.path}`)
    const graph = JSON.parse(html.match(/<script type="application\/ld\+json" data-nepar-schema>(.*?)<\/script>/s)![1])['@graph']
    expect(graph.some((node: { '@type': string }) => node['@type'] === 'BreadcrumbList')).toBe(true)
    if (meta.kind === 'guide') expect(graph.some((node: { '@type': string }) => node['@type'] === 'Article')).toBe(true)
  }
  expect(sitemap).not.toMatch(/<loc>[^<]*(?:\?|\/app(?:\/|<)|\/admin)/)
})

for (const width of [390, 768, 1440]) test(`SEO pages show the primary check in the first viewport at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  for (const path of [...paths, '/cijene/', '/faq/', '/vijesti/', '/vijesti/digitalni-cjenik-sidrena-cijena-2026/']) {
    await page.goto(path)
    const button = page.getByRole('button', { name: 'Provjeri besplatno', exact: true })
    await expect(button).toBeVisible()
    const box = (await button.boundingBox())!
    expect(box.y + box.height, path).toBeLessThan(900)
    expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBe(width)
    await expect(page.locator('h1')).toHaveCount(1)
  }
})

test('hero check validates input and hands off once without contacting NEPAR', async ({ page }) => {
  let checks = 0
  let inquiries = 0
  await page.route('**/api/auth/me', route => route.fulfill({ json: { authenticated: false } }))
  await page.route('**/api/leads*', route => { inquiries++; return route.fulfill({ json: { ok: true } }) })
  await page.route('**/api/digitalni-cjenik/check', route => { checks++; return route.fulfill({ json: { status: 'red', message: 'Cjenik nije pronađen.', details: { reachable: true, homepageReadable: true, https: true } } }) })
  await page.goto('/digitalni-cjenik-za-usluge/')
  expect(checks).toBe(0)
  await page.getByRole('button', { name: 'Provjeri besplatno' }).click()
  await expect(page.getByRole('alert')).toContainText('Unesite ispravnu adresu')
  await expect(page.getByLabel('Adresa vaše web stranice')).toBeFocused()
  await page.getByLabel('Adresa vaše web stranice').fill('salon.hr')
  await page.getByRole('button', { name: 'Provjeri besplatno' }).click()
  await expect(page).toHaveURL(/\/app\?/)
  await expect.poll(() => checks).toBe(1)
  await expect(page.getByRole('heading', { name: 'Objavite svoj prvi digitalni cjenik' })).toBeVisible()
  expect(inquiries).toBe(0)
})

test('campaign canonicals and plan handoffs preserve the intended purchase path', async ({ page, request }) => {
  const html = await (await request.get('/?paket=publisher&utm_source=test')).text()
  expect(html).toContain('<link rel="canonical" href="https://digitalnicjenik.nepar.hr/" />')
  await page.route('**/api/auth/me', route => route.fulfill({ json: { authenticated: false } }))
  await page.goto('/?paket=publisher')
  await expect(page).toHaveURL(/\/app\?new=1&plan=publisher/)
  await page.goto('/?paket=web')
  await expect(page).toHaveURL(/\/app\?new=1&tab=kontakt&plan=web/)
})
