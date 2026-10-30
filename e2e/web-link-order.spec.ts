import { expect, test, type Page } from '@playwright/test'

const WEB_LINK = { publish: true, upload: true, archive: true, qr: true, pdf: true, embed: true, editItems: false, monitoring: false, alerts: false }
const session = { authenticated: true, user: { id: 'u', email: 'vlasnik@salon.hr' }, tenants: [{ id: 't-salon', slug: 'salon', name: 'Salon Lana', role: 'owner' }] }
const item = { name: 'Šišanje', type: 'Usluga', externalId: '1', price: 15, anchorPrice: 15, anchorReferenceDate: '2026-09-10', specialSaleApplied: false }
const priceList = { tenant: { id: 't-salon', slug: 'salon', name: 'Salon Lana' }, source: 'nepar', currency: 'EUR', updatedAt: '2026-10-27T06:00:00Z', items: [item] }
const order = {
  reference: '2026-1042', kind: 'web_link', installation: true, amountCents: 4980, amountLabel: '49,80 €', customerType: 'company', billingName: 'Salon Lana obrt',
  oib: '69435151530', address: 'Ilica 10', postalCity: '10000 Zagreb', email: 'vlasnik@salon.hr', createdAt: '2026-10-28T13:35:00Z', description: 'Digitalni cjenik salon',
  payee: { name: 'Nepar, vl. Ivan Gorupić', street: 'Koprivnička ulica 52', postalCity: '10000 Zagreb', iban: 'HR0623600001103276807', model: 'HR00' },
  hub3: ['HRVHUB30', 'EUR', '000000000004980', 'Salon Lana obrt', 'Ilica 10', '10000 Zagreb', 'Nepar, vl. Ivan Gorupic', 'Koprivnicka ulica 52', '10000 Zagreb', 'HR0623600001103276807', 'HR00', '2026-1042', 'OTHR', 'Digitalni cjenik salon'].join('\n'),
}

async function mockApi(page: Page, licence: () => Record<string, unknown>, onOrder?: (body: Record<string, unknown>) => void) {
  // Fixtures use absolute deadlines; pin the browser clock so they stay in the future.
  await page.clock.setFixedTime(new Date('2026-10-28T14:00:00Z'))
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/me') return route.fulfill({ json: session })
    if (path === '/api/orders' && route.request().method() === 'POST') {
      onOrder?.(route.request().postDataJSON())
      return route.fulfill({ json: { ok: true, order, activeUntil: '2026-10-29T09:00:00Z' } })
    }
    if (path === '/api/orders') return route.fulfill({ json: { ok: true, ...licence() } })
    if (path === '/api/tenants/salon') return route.fulfill({ json: { priceList } })
    return route.fulfill({ status: 404, json: {} })
  })
}

test('free publication: keep the link, fill billing details, pay by HUB-3 2D barcode', async ({ page }) => {
  let placed: Record<string, unknown> | null = null
  await mockApi(page, () => placed
    ? { entitlement: { plan: 'web_link', status: 'trial', periodStart: '2026-10-28T09:00:00Z', periodEnd: '2026-10-29T09:00:00Z' }, features: WEB_LINK, upgradeAvailable: false, order }
    : { entitlement: { plan: 'web_link', status: 'trial', periodStart: '2026-10-28T09:00:00Z', periodEnd: '2026-10-29T09:00:00Z' }, features: WEB_LINK, upgradeAvailable: false, order: null },
  (body) => { placed = body })

  await page.goto('/app?tab=pretplata')
  await expect(page.locator('.licence-card')).toContainText('29. 10. 2026. u 10:00')
  await expect(page.locator('body')).not.toContainText(/probn/i)

  await page.getByRole('button', { name: 'Zadrži ovaj link trajno — 19,90 €/god →' }).click()
  await page.getByLabel('Naziv tvrtke ili obrta').fill('Salon Lana obrt')
  await page.getByLabel('OIB', { exact: true }).fill('69435151530')
  await page.getByLabel('Adresa', { exact: true }).fill('Ilica 10')
  await page.getByLabel('Poštanski broj i grad').fill('10000 Zagreb')
  await expect(page.getByLabel('E-mail za račun')).toHaveValue('vlasnik@salon.hr')
  await page.getByLabel(/Dodajte pomoć s ugradnjom/).check()
  await expect(page.getByText('Ukupno za uplatu')).toContainText('49,80 €')
  await page.getByRole('button', { name: 'Nastavi na uplatu →' }).click()

  expect(placed).toMatchObject({ kind: 'web_link', installation: true, customerType: 'company', billingName: 'Salon Lana obrt', oib: '69435151530' })
  await expect(page.getByRole('heading', { name: 'Uplata — Web Link' })).toBeVisible()
  await expect(page.locator('.payment-amount')).toHaveText('49,80 €')
  await expect(page.locator('.hub3-barcode-image svg')).toBeVisible()
  await expect(page.locator('.payment-note')).toContainText('Tek nakon potvrde bankovne uplate')

  await page.getByRole('tab', { name: 'Podaci za uplatu' }).click()
  await expect(page.locator('.payment-details')).toContainText('HR0623600001103276807')
  await expect(page.locator('.payment-details')).toContainText('HR00 2026-1042')
  await expect(page.locator('.payment-details')).toContainText('Nepar, vl. Ivan Gorupić')
})

test('a pending order on the dashboard says until when the link stays live', async ({ page }) => {
  await mockApi(page, () => ({ entitlement: { plan: 'web_link', status: 'trial', periodStart: '2026-10-28T09:00:00Z', periodEnd: '2026-10-29T09:00:00Z' }, features: WEB_LINK, upgradeAvailable: false, order }))
  await page.goto('/app?tab=pretplata')
  await expect(page.getByRole('heading', { name: 'Čekamo uplatu' })).toBeVisible()
  await expect(page.locator('.licence-card')).toContainText('Link ostaje aktivan do 29. 10. 2026. u 10:00.')
  await expect(page.locator('.hub3-barcode-image svg')).toBeVisible()
})

test('active Web Link: no item editing or monitoring, Publisher upsell for +30 € within 30 days', async ({ page }) => {
  await mockApi(page, () => ({ entitlement: { plan: 'web_link', status: 'active', periodStart: '2026-10-20T09:00:00Z', periodEnd: '2027-10-20T09:00:00Z' }, features: WEB_LINK, upgradeAvailable: true, order: null }))
  await page.goto('/app?tab=pretplata')
  await expect(page.getByRole('heading', { name: 'Aktivno do 20. 10. 2027. u 11:00' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Nadogradi na Publisher +30,00 € jednokratno' })).toBeVisible()
  await expect(page.getByText('Nadogradnja vrijedi za preostalo plaćeno razdoblje. Kraj razdoblja ostaje isti.')).toBeVisible()
  await page.getByRole('button',{name:'Moj cjenik',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Vaša posljednja objava'})).toBeVisible()
  await expect(page.getByRole('button', { name: 'Uredi postojeći cjenik' })).toHaveCount(0)
  await expect(page.locator('.monitor-panel')).toHaveCount(0)
})

test('after the 30-day window Publisher is offered at renewal', async ({ page }) => {
  await mockApi(page, () => ({ entitlement: { plan: 'web_link', status: 'active', periodStart: '2026-08-01T09:00:00Z', periodEnd: '2027-08-01T09:00:00Z' }, features: WEB_LINK, upgradeAvailable: false, order: null }))
  await page.goto('/app?tab=pretplata')
  await expect(page.getByText('Publisher možete odabrati kod obnove.')).toBeVisible()
  await expect(page.getByRole('button', { name: /Nadogradi na Publisher/ })).toHaveCount(0)
})
