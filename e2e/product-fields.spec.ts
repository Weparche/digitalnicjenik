import { expect, test } from '@playwright/test'

const productCsv = [
  'Grupa,Naziv,Vrsta,Interna šifra,Cijena,Sidrena cijena,Marka,Barkod,Jedinica,Cijena za jedinicu mjere,Dostupnost,Poseban oblik prodaje,Datum referentne cijene',
  'Mliječni,Mlijeko 1 l,Proizvod,M-001,1.20,1.10,Dukat,4006381333931,l,1.20,dostupno,NE,2025-05-02',
  'Pekarski,Kruh,Proizvod,,0.99,0.95,,,,,,NE,2025-05-02',
].join('\n')

test('product list: Odluka fields are grouped, editable, and clear the blocker count', async ({ page }) => {
  await page.goto('/#csv-validator')
  await page.locator('#csv-validator label.upload-action input[accept*=".csv"]').setInputFiles({ name: 'proizvodi.csv', mimeType: 'text/csv', buffer: Buffer.from(productCsv, 'utf8') })

  const panel = page.locator('.validation-app-panel')
  await expect(panel).toBeVisible()
  await expect(panel.getByText('Cjenik proizvoda: podaci koje Odluka traži')).toBeVisible()
  await expect(panel.getByText(/1 stavka nema šifru/)).toBeVisible()
  await expect(panel.getByText(/1 stavka nema marku/)).toBeVisible()
  await expect(panel.getByText(/1 stavka nema oznaku dostupnosti/)).toBeVisible()
  await expect(panel.getByText(/1 stavka nema valjan barkod/)).toBeVisible()
  const counter = panel.locator('.validation-app-count')
  await expect(counter).toContainText('6')
  await expect(counter).toContainText('za dopunu')

  // The complete row keeps its parsed values in editable product columns.
  await expect(panel.getByLabel('Marka za Mlijeko 1 l')).toHaveValue('Dukat')
  await expect(panel.getByLabel('Barkod za Mlijeko 1 l')).toHaveValue('4006381333931')

  await panel.getByRole('button', { name: /Sve bez oznake: dostupno/ }).click()
  await expect(panel.getByLabel('Dostupnost za Kruh')).toHaveValue('dostupno')
  await panel.getByLabel('Šifra za Kruh').fill('M-002')
  await panel.getByLabel('Marka za Kruh').fill('bez marke')

  await panel.getByLabel('Barkod za Kruh').fill('96385074')
  await panel.getByLabel('Jedinica mjere za Kruh', { exact: true }).fill('kg')
  await panel.getByLabel('Cijena za jedinicu mjere za Kruh').fill('1.98')
  await expect(counter).toContainText('bez blokera')
  await expect(panel.getByText(/1 stavka nema valjan barkod/)).toHaveCount(0)
})
