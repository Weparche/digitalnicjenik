import { expect, test } from '@playwright/test'

for (const products of [false, true]) {
  test(`publisher ${products ? 'products allow daily publication' : 'services unlock after editing'} and publishes the latest edits`, async ({ page }) => {
    const item = { name: 'Stavka', type: products ? 'Proizvod' : 'Usluga', externalId: '1', price: 12, anchorPrice: 11, anchorReferenceDate: '2026-09-10', specialSaleApplied: false, brand: 'bez marke', barcode: '96385074', unit: 'kg', unitPrice: 12, availability: 'dostupno' }
    const list = { tenant: { id: 't-shop', slug: 'shop', name: 'Shop' }, source: 'nepar', currency: 'EUR', updatedAt: '2026-10-01T06:00:00Z', items: [item] }
    const imports: Array<{ priceList: { items: Array<{ anchorPrice: number }> } }> = []
    const saves: Array<{ priceList: { items: Array<{ anchorPrice: number }> } }> = []
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/auth/me') return route.fulfill({ json: { authenticated: true, user: { id: 'u', email: 'owner@example.hr' }, tenants: [{ id: 't-shop', slug: 'shop', name: 'Shop', role: 'owner' }] } })
      if (path === '/api/orders') return route.fulfill({ json: { ok: true, entitlement: { plan: 'publisher_self_service', status: 'active', periodStart: '2026-01-01T00:00:00Z', periodEnd: '2099-01-01T00:00:00Z' }, features: { publish: true, upload: true, archive: true, qr: true, pdf: true, embed: true, editItems: true, monitoring: true, alerts: true }, upgradeAvailable: false, order: null } })
      if (path === '/api/tenants/shop') return route.fulfill({ json: { priceList: list } })
      if (path.endsWith('/import')) { imports.push(route.request().postDataJSON()); return route.fulfill({ json: { draft: { id: 'draft-' + imports.length }, validation: { issues: [] } } }) }
      if (path.includes('/draft/')) { saves.push(route.request().postDataJSON()); return route.fulfill({ json: { validation: { issues: [] } } }) }
      if (path.endsWith('/publish')) return route.fulfill({ json: { message: 'Cjenik je objavljen.' } })
      return route.fulfill({ status: 404, json: {} })
    })
    await page.goto('/app')
    const publish = page.getByRole('button', { name: 'Objavi novi cjenik', exact: true })
    if (!products) await page.getByRole('button', { name: 'Uredi postojeći cjenik', exact: true }).click()
    await expect(page.getByLabel('Sidrena cijena za Stavka')).toHaveValue('11')
    await expect(publish).toBeEnabled()
    await page.getByLabel('Sidrena cijena za Stavka').fill('10')
    await expect(publish).toBeEnabled()
    await page.getByRole('button', { name: 'Spremi dopune', exact: true }).click()
    await expect(page.getByText('Dopune su spremljene. Provjerite sažetak prije objave.')).toBeVisible()
    await page.getByLabel('Sidrena cijena za Stavka').fill('9')
    await publish.click()
    await expect(page.getByRole('heading', { name: 'Cjenik je objavljen', exact: true })).toBeVisible()
    await expect(page.locator('.publish-link-card').filter({ hasText: 'Stable CSV' }).getByRole('link', { name: 'Otvori' })).toHaveAttribute('href', /\/c\/shop\/cjenik.csv$/)
    expect(imports).toHaveLength(1)
    expect(saves.at(-1)?.priceList.items[0].anchorPrice).toBe(9)
  })
}

test('saving an incomplete CSV preserves skipped-row blockers in the dashboard', async ({ page }) => {
  let findings: Array<Record<string, unknown>> = []
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/me') return route.fulfill({ json: { authenticated: true, user: { id: 'u', email: 'owner@example.hr' }, tenants: [{ id: 't-shop', slug: 'shop', name: 'Shop', role: 'owner' }] } })
    if (path === '/api/orders') return route.fulfill({ json: { ok: true, entitlement: { plan: 'publisher_self_service', status: 'active', periodStart: '2026-01-01T00:00:00Z', periodEnd: '2099-01-01T00:00:00Z' }, features: { publish: true, upload: true, archive: true, qr: true, pdf: true, embed: true, editItems: true, monitoring: true, alerts: true }, upgradeAvailable: false, order: null } })
    if (path === '/api/tenants/shop') return route.fulfill({ json: { priceList: null } })
    if (path.endsWith('/import')) {
      findings = route.request().postDataJSON().importIssues
      return route.fulfill({ json: { draft: { id: 'incomplete' }, validation: { issues: findings } } })
    }
    if (path.includes('/draft/')) return route.fulfill({ json: { validation: { issues: findings } } })
    return route.fulfill({ status: 404, json: {} })
  })
  await page.goto('/app')
  await page.locator('label.upload-action input[accept*=".csv"]').setInputFiles({ name: 'incomplete.csv', mimeType: 'text/csv', buffer: Buffer.from('Naziv,Vrsta,Cijena,Sidrena cijena,Poseban oblik prodaje\nValid,Usluga,10,10,NE\nInvalid,Usluga,abc,10,NE') })
  const publish = page.getByRole('button', { name: 'Objavi novi cjenik', exact: true })
  await expect(publish).toBeDisabled()
  await page.getByRole('button', { name: 'Spremi dopune', exact: true }).click()
  await expect(page.getByText('Dopune su spremljene. Provjerite sažetak prije objave.')).toBeVisible()
  expect(findings).toContainEqual(expect.objectContaining({ code: 'IMPORT_ROW_SKIPPED', row: 3 }))
  await expect(publish).toBeDisabled()
})
