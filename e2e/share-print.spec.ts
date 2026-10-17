import { expect, test, type Page } from '@playwright/test'

const priceList = {
  tenant: { id: 't', slug: 'nepar', name: 'Testni obrt' },
  source: 'nepar',
  currency: 'EUR',
  updatedAt: '2026-11-17T05:00:00.000Z',
  items: Array.from({ length: 3 }, (_, index) => ({ category: 'Usluge', name: `Usluga ${index + 1}`, externalId: `S${index + 1}`, price: 10 + index, anchorPrice: 10 + index })),
}

// vite preview serves static files only, so the Pages Function responses are stubbed.
async function stubPublicPage(page: Page) {
  const shell = await (await page.request.get('/app-shell.html')).text()
  await page.route('**/c/nepar?*', (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: shell }))
  await page.route('**/api/tenants/nepar', (route) => route.fulfill({
    json: { priceList, publication: null, publications: [{ id: 'p1', sequence: 4, filenameStem: 'obrt_adresa_p-01_4_20261117-060000', publishedAt: priceList.updatedAt, isCurrent: true }] },
  }))
}

test('print view: QR code, print button and repeating table header', async ({ page }) => {
  await stubPublicPage(page)
  await page.goto('/c/nepar?print=1')

  await expect(page.getByRole('button', { name: 'Ispis / Spremi kao PDF' })).toBeVisible()
  await expect(page.locator('.print-qr svg.qr-code')).toBeVisible()
  await expect(page.locator('.print-qr svg.qr-code path')).toHaveAttribute('d', /M\d+ \d+h1v1h-1z/)
  await expect(page.locator('.print-table tbody tr').filter({ hasText: 'Usluga 2' })).toBeVisible()

  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.print-toolbar')).toBeHidden()
  expect(await page.locator('.print-table thead').evaluate((node) => getComputedStyle(node).display)).toBe('table-header-group')
  expect(await page.locator('.print-table tbody tr').first().evaluate((node) => getComputedStyle(node).breakInside)).toBe('avoid')
})

test('embed.js injects an iframe that resizes only on messages from that iframe', async ({ page }) => {
  await stubPublicPage(page)
  await page.route('**/embed-host', (route) => route.fulfill({
    contentType: 'text/html; charset=utf-8',
    body: '<!doctype html><html><body><p>Moja stranica</p><script src="/embed.js" data-cjenik="nepar" data-height="900"></script></body></html>',
  }))
  await page.goto('/embed-host')

  const iframe = page.locator('iframe[title="Digitalni cjenik"]')
  await expect(iframe).toHaveAttribute('src', /\/c\/nepar\?embed=1$/)
  await expect(page.frameLocator('iframe').getByText('Usluga 1')).toBeVisible()
  // The framed page reports its real (much smaller) height, replacing the initial 900px.
  await expect.poll(async () => (await iframe.boundingBox())?.height ?? 900).toBeLessThan(900)

  const settled = (await iframe.boundingBox())!.height
  // A forged message from the host page itself (not from the iframe) must be ignored.
  await page.evaluate(() => window.postMessage({ type: 'nepar-cjenik-resize', slug: 'nepar', height: 5000 }, '*'))
  await page.waitForTimeout(200)
  expect((await iframe.boundingBox())!.height).toBe(settled)
})
