import { expect, test } from '@playwright/test'

const productCsv = [
  'Grupa,Naziv,Vrsta,Interna šifra,Cijena,Sidrena cijena,Marka,Barkod,Jedinica,Cijena za jedinicu mjere,Dostupnost',
  'Mliječni,Mlijeko 1 l,Proizvod,M-001,1.20,1.10,Dukat,4006381333931,l,1.20,dostupno',
  'Pekarski,Kruh,Proizvod,,0.99,0.95,,,,,',
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
  await expect(counter).toContainText('3')
  await expect(counter).toContainText('za dopunu')

  // The complete row keeps its parsed values in editable product columns.
  await expect(panel.getByLabel('Marka za Mlijeko 1 l')).toHaveValue('Dukat')
  await expect(panel.getByLabel('Barkod za Mlijeko 1 l')).toHaveValue('4006381333931')

  await panel.getByRole('button', { name: /Sve bez oznake: dostupno/ }).click()
  await expect(panel.getByLabel('Dostupnost za Kruh')).toHaveValue('dostupno')
  await panel.getByLabel('Šifra za Kruh').fill('M-002')
  await panel.getByLabel('Marka za Kruh').fill('bez marke')

  // Barcode stays as a warning (Odluka: gdje je primjenjiv), so it does not block: only review items were counted.
  await expect(counter).toContainText('bez blokera')
  await expect(panel.getByText(/1 stavka nema valjan barkod/)).toBeVisible()
})
