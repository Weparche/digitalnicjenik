import { expect, test } from '@playwright/test'

const skipCsv = [
  'Naziv*;Cijena*;Vrsta*',
  'Valjana;20;Usluga',
  'BezCijene;;Usluga',
].join('\n')

test('shows skipped-row import issue and keeps Publish disabled', async ({ page }) => {
  await page.goto('/')

  await page.locator('label.upload-action input[accept*=".csv"]').setInputFiles({
    name: 'skip-rows.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(skipCsv, 'utf8'),
  })

  const panel = page.locator('.validation-app-panel')
  await expect(panel).toBeVisible()
  await expect(panel.getByText(/Redak\s+3\s+nije uvezen/i)).toBeVisible()
  await expect(panel.locator('td strong', { hasText: 'Valjana' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Objavi novi cjenik' })).toBeDisabled()
})
