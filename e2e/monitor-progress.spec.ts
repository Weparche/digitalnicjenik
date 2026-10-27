import { expect, test } from '@playwright/test'
import type { MonitorRunRecord } from '../shared/compliance/types'

const latest: MonitorRunRecord = { id: 'run-1', tenantId: 't-shop', publicationId: 'p1', checkedAt: '2026-10-27T07:00:00Z', trigger: 'manual', ruleset: 'nn-101-2026', profile: 'services', overall: 'ok', csvStatus: 200, xmlStatus: 200, csvRows: 1, xmlRows: 1, expectedRows: 1, prevRows: 1, filenamePublicationMatch: true, filenameRulesetMatch: true, filenameCsv: 'a.csv', filenameXml: 'a.xml', freshnessStatus: 'n/a', archiveExpected: 35, archiveAvailable: 35, archiveLatestStatus: 200, archiveOldestStatus: 200, payloadSha256: null, csvSha256: null, xmlSha256: null, issues: [], durationMs: 100, publishedAt: '2026-10-27T06:00:00Z', publicationSequence: 1 }

for (const width of [390, 1440]) test(`monitor shows progress and replaces it with the completed result at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 })
  let phase: 'idle' | 'running' | 'completed' | 'skipped' = 'idle'
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/me') return route.fulfill({ json: { authenticated: true, user: { id: 'u', email: 'owner@example.hr' }, tenants: [{ id: 't-shop', slug: 'shop', name: 'Shop', role: 'owner' }] } })
    if (path.endsWith('/entitlement')) return route.fulfill({ json: { entitlement: { status: 'active', periodEnd: '2099-01-01T00:00:00Z' } } })
    if (path.endsWith('/monitor')) {
      if (route.request().method() === 'POST') { phase = 'running'; return route.fulfill({ status: 202, json: { status: 'queued', jobId: 'job-1' } }) }
      return route.fulfill({ json: { latest: phase === 'idle' ? null : latest, history: [], lastOkAt: null, ruleset: { id: 'nn-101-2026', label: 'NN 101/2026' }, profile: { id: 'services', label: 'Usluge' }, job: phase === 'idle' ? null : { id: 'job-1', status: phase, checked: phase === 'running' ? 10 : 35, total: 35 } } })
    }
    if (path === '/api/tenants/shop') return route.fulfill({ json: { priceList: { tenant: { id: 't-shop', slug: 'shop', name: 'Shop' }, source: 'nepar', currency: 'EUR', updatedAt: latest.checkedAt, items: [{ name: 'Test', type: 'Usluga', price: 10, anchorPrice: 10, specialSaleApplied: false }] } } })
    return route.fulfill({ status: 404, json: {} })
  })
  await page.goto('/app')
  const panel = page.locator('.monitor-panel')
  await panel.getByRole('button', { name: 'Provjeri sada', exact: true }).click()
  await expect(panel.getByRole('heading', { name: 'Provjera je u tijeku' })).toBeVisible()
  await expect(panel.getByRole('progressbar')).toHaveAttribute('value', '10')
  await expect(panel.getByRole('button', { name: 'Provjera u tijeku…' })).toBeDisabled()
  await panel.screenshot({ path: `.tmp-review/monitor-progress-${width}.png` })
  phase = 'completed'
  await expect(panel.getByRole('heading', { name: 'Provjera je u tijeku' })).toHaveCount(0, { timeout: 10_000 })
  await expect(panel.getByRole('button', { name: 'Provjeri sada', exact: true })).toBeEnabled()
  await panel.screenshot({ path: `.tmp-review/monitor-completed-${width}.png` })
  phase = 'skipped'
  await page.reload()
  await expect(panel.getByRole('heading', { name: 'Provjeru nije moguće dovršiti' })).toBeVisible()
  await expect(page.locator('.monitor-ok')).toHaveCount(0)
})
