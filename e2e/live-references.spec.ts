import { expect, test } from '@playwright/test'

test('landing shows seven dated verified references with real Publisher destinations', async ({ page }) => {
  await page.goto('/')
  const section = page.locator('#reference')
  await expect(section.getByRole('heading', {name:'Digitalni cjenici koji već rade.'})).toBeVisible()
  const cards = section.locator('.acq-reference-card')
  await expect(cards).toHaveCount(7)
  expect(await cards.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')))).toEqual(['/c/auto-gubic','/c/handyman','/c/nepar-kids','/c/nepar-solutions','/c/geoadrese','/c/kpdinfo','/c/digitalni-cjenik'])
  await expect(section.locator('.acq-reference-score')).toHaveText(Array(7).fill('9/9'))
  await expect(section).toContainText('63/63')
  await expect(section).toContainText('Nisu potvrda pravne usklađenosti.')
  await expect(section.getByRole('link',{name:'Objavite i svoj digitalni cjenik'})).toHaveAttribute('href','/app?new=1&plan=link')
  await expect(page.getByRole('heading',{level:1})).toContainText('besplatno')
  for (const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:844})
    const layout = await cards.evaluateAll(nodes=>({first:nodes[0].getBoundingClientRect().top, second:nodes[1].getBoundingClientRect().top, third:nodes[2].getBoundingClientRect().top, overflow:nodes.some(n=>n.scrollWidth>n.clientWidth+1), pageOverflow:document.documentElement.scrollWidth>innerWidth+1}))
    expect(layout.first).toBe(layout.second)
    if(width<1000) expect(layout.third).toBeGreaterThan(layout.second)
    expect(layout.overflow).toBe(false)
    expect(layout.pageOverflow).toBe(false)
  }
})

test('landing pricing uses adjacent desktop cards and stacked mobile cards', async ({ page }) => {
  await page.goto('/')
  const section = page.locator('#rjesenja')
  await expect(section.getByRole('heading', {name:'Trebate riješiti digitalni cjenik?'})).toBeVisible()
  await expect(section).toContainText('Besplatna objava 24 sata.')
  await expect(section).toContainText('Bez kartice i bez automatske naplate.')
  await expect(section.getByRole('button',{name:'Odaberi Web Link'})).toBeVisible()
  await expect(section.getByRole('button',{name:'Zatraži ugradnju'})).toBeVisible()
  for (const width of [320,390,768,1024,1440]) {
    await page.setViewportSize({width,height:844})
    const layout = await section.evaluate(el=>{
      const plan=el.querySelector('.acq-plan')!.getBoundingClientRect()
      const extra=el.querySelector('.acq-extra')!.getBoundingClientRect()
      return {planTop:plan.top,extraTop:extra.top,planRight:plan.right,extraLeft:extra.left,overflow:document.documentElement.scrollWidth>innerWidth+1}
    })
    if(width>=1000) {expect(Math.abs(layout.planTop-layout.extraTop)).toBeLessThan(2); expect(layout.extraLeft).toBeGreaterThan(layout.planRight)}
    else expect(layout.extraTop).toBeGreaterThan(layout.planTop)
    expect(layout.overflow).toBe(false)
  }
})
