import { expect, test } from '@playwright/test'

const hokUrl='https://www.hok.hr/novosti-iz-hok/dodatna-cijena-i-upute-za-objavu-cjenika-i-usluga'

test('HOK resources are discoverable from landing and the import workspace', async ({page})=>{
  await page.goto('/')
  const card=page.getByRole('region',{name:'Imate HOK Excel predložak?'})
  await expect(card).toBeVisible()
  await expect(card.getByRole('link',{name:/Preuzmite službene HOK predloške/})).toHaveAttribute('href',hokUrl)
  await card.getByRole('link',{name:'Učitaj HOK predložak'}).click()
  await expect(page).toHaveURL(/\/app\?new=1/)
  await expect(page.getByText('Kompatibilno s HOK Excel predlošcima 2026.')).toBeVisible()
  await expect(page.getByRole('link',{name:/Preuzmi službene predloške/})).toHaveAttribute('href',hokUrl)
  await expect(page.getByLabel('Učitaj cjenik')).toHaveAttribute('accept',/\.xlsx/)
})
