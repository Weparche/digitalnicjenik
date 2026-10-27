import { expect, test } from '@playwright/test'

for (const path of ['/vodici/sidrena-cijena/', '/vodici/automatizacija-digitalnog-cjenika/']) {
  test(`migrated guide ${path} is crawlable and linked on mobile`, async ({ page, request }) => {
    const response = await request.get(path)
    const html = await response.text()
    expect(response.status()).toBe(200)
    expect(html).toContain(`https://digitalnicjenik.nepar.hr${path}`)
    expect(html).toMatch(/<h1[ >]/)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/vodici/')
    await page.locator(`.site-card-list a[href="${path}"]`).click()
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://digitalnicjenik.nepar.hr${path}`)
    if (path.includes('automatizacija')) {
      await expect(page.locator('article')).toContainText('AutoSync nije dostupan')
      await expect(page.locator('article')).toContainText('ne objavljuje promjene umjesto vas')
    } else await expect(page.locator('article')).toContainText('2. svibnja 2025.')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
    await page.screenshot({ path: `.tmp-review/${path.includes('automatizacija') ? 'automation' : 'anchor'}-mobile.png`, fullPage: true })
  })
}
