import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

test('a valid HOK file leads to explicit object metadata before a trial claim', async ({ page }) => {
  await page.route('**/api/public-config', route => route.fulfill({ json: { turnstileSiteKey: 'test-site-key' } }))
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?*', route => route.fulfill({ contentType: 'application/javascript', body: `window.turnstile={render:function(el,options){setTimeout(function(){options.callback('test-token')},10);return 'test-widget'},remove:function(){},reset:function(){}}` }))
  await page.route('**/api/trials/start*', route => route.fulfill({ json: route.request().method() === 'GET' ? { suggested: 'salon-test', available: true } : { ok: true } }))
  await page.route('**/api/drafts', route => route.fulfill({ json: { ok: true, draftId: 'test-draft' } }))
  await page.goto('/#csv-validator')
  await page.locator('#csv-validator label.upload-action input[accept*=".csv"]').setInputFiles({ name: 'hok.csv', mimeType: 'text/csv', buffer: readFileSync(new URL('../public/examples/primjer-digitalni-cjenik-usluge-2026.csv', import.meta.url)) })
  const panel = page.locator('.validation-app-panel')
  await expect(panel.getByRole('button', { name: /Objavi besplatno na 24 h/ })).toBeEnabled()
  await panel.getByRole('button', { name: /Objavi besplatno na 24 h/ }).click()
  await page.getByLabel('Naziv poslovanja', { exact: true }).fill('Salon Test')
  await page.getByLabel('E-mail', { exact: true }).fill('test@example.hr')
  await page.getByLabel('Adresa vašeg cjenika', { exact: true }).fill('salon-test')
  await page.getByLabel('Puna adresa objekta', { exact: true }).fill('Ilica 10, 10000 Zagreb')
  await page.getByLabel('Oznaka objekta', { exact: true }).fill('P1')
  const draftRequest = page.waitForRequest(request => request.url().endsWith('/api/drafts') && request.method() === 'POST')
  await page.getByRole('button', { name: /Pošalji potvrdni link/ }).click()
  expect((await draftRequest).postDataJSON().publicationDetails).toMatchObject({ objectAddress: 'Ilica 10, 10000 Zagreb', objectCode: 'P1', objectType: 'usluzni-objekt' })
  await expect(page.getByRole('heading', { name: 'Poslali smo potvrdni link' })).toBeVisible()
})
