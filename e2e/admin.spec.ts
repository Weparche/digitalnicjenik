import { expect, test } from '@playwright/test'

test('admin: key login, lapsed tenant shown as expired, activation asks for confirmation', async ({ page }) => {
  const shell = await (await page.request.get('/app-shell.html')).text()
  await page.route('**/admin', (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: shell }))
  let renewed = 0
  let tenants = [{ slug: 'acme', name: 'Acme d.o.o.', plan: 'publisher_self_service', status: 'trial', periodEnd: '2026-01-01T00:00:00Z', ownerEmail: 'vlasnik@acme.hr', monitorOverall: null, monitorCheckedAt: null }]
  await page.route('**/api/ops/tenants', (route) => route.request().headers()['authorization'] === 'Bearer good-key'
    ? route.fulfill({ json: { tenants } })
    : route.fulfill({ status: 401, json: { error: 'x' } }))
  await page.route('**/api/ops/renew', (route) => {
    renewed += 1
    tenants = [{ ...tenants[0]!, status: 'active', periodEnd: '2099-01-01T00:00:00Z' }]
    return route.fulfill({ json: { ok: true, slug: 'acme', periodEnd: '2099-01-01T00:00:00Z' } })
  })

  await page.goto('/admin')
  await page.getByLabel('Operator ključ').fill('wrong')
  await page.getByRole('button', { name: 'Prijava' }).click()
  await expect(page.getByRole('alert')).toContainText('Ključ nije ispravan')

  await page.getByLabel('Operator ključ').fill('good-key')
  await page.getByRole('button', { name: 'Prijava' }).click()
  await expect(page.getByText('Istekao — javni cjenik je ugašen')).toBeVisible()

  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: 'Aktiviraj (1 god.)' }).click()
  expect(renewed).toBe(0)

  page.once('dialog', (dialog) => { expect(dialog.message()).toContain('Je li uplata'); return dialog.accept() })
  await page.getByRole('button', { name: 'Aktiviraj (1 god.)' }).click()
  await expect(page.getByRole('status')).toContainText('Acme d.o.o.: aktivno do')
  await expect(page.getByText('Aktivan', { exact: true })).toBeVisible()
  expect(renewed).toBe(1)
})
