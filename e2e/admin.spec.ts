import { expect,test,type Page } from '@playwright/test'

const tenant={id:'t1',slug:'salon',name:'Salon Lana',plan:'web_link',status:'trial',period_start:'2026-10-28',period_end:'2099-01-01',owner_email:'owner@salon.hr',item_count:12,published_at:'2026-10-28T09:00:00Z',sequence:2,publication_count:2,monitor_overall:null,monitor_checked_at:null,pending_orders:1,reported_at:'2026-10-29T09:00:00Z',access:{state:'trial',live:true,periodEnd:'2099-01-01',graceUntil:null,accessUntil:'2099-01-01'},public_url:'/c/salon'}
const order={reference:'2026-1042',slug:'salon',name:'Salon Lana',owner_email:'owner@salon.hr',kind:'web_link',amount_cents:4980,installation:1,status:'pending',created_at:'2026-10-28T09:00:00Z',payment_reported_at:'2026-10-29T09:00:00Z'}
async function shell(page:Page){
  const html=await(await page.request.get('/app-shell.html')).text()
  await page.route('**/admin{,?**}',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:html}))
}
test('admin login uses magic link and preserves the concrete order context',async({page})=>{
  await shell(page)
  await page.route('**/api/auth/me',route=>route.fulfill({status:401,json:{authenticated:false}}))
  let login:Record<string,unknown>|undefined
  await page.route('**/api/auth/magic-link',route=>{login=route.request().postDataJSON();return route.fulfill({json:{ok:true}})})
  await page.goto('/admin?tab=uplate&order=2026-1042')
  await expect(page.getByLabel('E-mail',{exact:true})).toHaveValue('nepar@nepar.hr')
  await expect(page.getByLabel('Operator ključ')).toHaveCount(0)
  await page.getByRole('button',{name:'Pošalji prijavni link'}).click()
  await expect(page.getByText('Provjerite e-mail',{exact:true})).toBeVisible()
  expect(login).toMatchObject({email:'nepar@nepar.hr',returnTo:'/admin?tab=uplate&order=2026-1042'})
})
test('ordinary signed-in users do not get an operational UI',async({page})=>{
  await shell(page)
  let ops=0
  await page.route('**/api/auth/me',route=>route.fulfill({json:{authenticated:true,isAdmin:false,user:{id:'u',email:'owner@salon.hr'},tenants:[]}}))
  await page.route('**/api/ops/**',route=>{ops++;return route.fulfill({status:403,json:{}})})
  await page.goto('/admin')
  await expect(page.getByRole('heading',{name:'Pristup nije dopušten'})).toBeVisible()
  expect(ops).toBe(0)
})
for(const width of [390,768,1440])test(`admin confirmation, preserved forms and visible polling at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000})
  await shell(page)
  await page.route('**/api/auth/me',route=>route.fulfill({json:{authenticated:true,isAdmin:true,user:{id:'a',email:'nepar@nepar.hr'},tenants:[]}}))
  let requests=0;let confirmed=false;let writes=0
  await page.route('**/api/ops/dashboard?**',route=>{
    requests++
    const url=new URL(route.request().url())
    return route.fulfill({json:{summary:{reported:confirmed?0:1,pending:confirmed?0:1},tenants:[tenant],orders:[{...order,status:confirmed?'paid':'pending'}],requests:[],page:0,detail:url.searchParams.get('tenant')?{...tenant,metadata:{},publications:[],audit:[],nextMail:null,deliveries:[]}:null}})
  })
  await page.route('**/api/ops/renew',route=>{
    writes++;expect(route.request().postDataJSON()).toMatchObject({action:'confirm_payment',reference:'2026-1042',slug:'salon'})
    confirmed=true;return route.fulfill({json:{ok:true}})
  })
  await page.goto('/admin?tab=uplate&order=2026-1042')
  await expect(page.getByRole('cell',{name:'2026-1042',exact:true})).toBeVisible()
  page.once('dialog',dialog=>dialog.dismiss())
  await page.getByRole('button',{name:'Potvrdi uplatu',exact:true}).click()
  expect(writes).toBe(0)
  page.once('dialog',dialog=>{expect(dialog.message()).toContain('2026-1042');return dialog.accept()})
  await page.getByRole('button',{name:'Potvrdi uplatu',exact:true}).click()
  await expect(page.getByRole('cell',{name:'Potvrđena',exact:true})).toBeVisible()
  expect(writes).toBe(1)
  await page.getByRole('button',{name:'Otvori tenant',exact:true}).click()
  await page.getByLabel('Razlog',{exact:true}).fill('Dogovor s korisnikom')
  await page.getByRole('searchbox').fill('salon')
  await page.getByLabel('Filter',{exact:true}).selectOption('web_link')
  await page.clock.install()
  const before=requests
  await page.clock.fastForward(31_000)
  await expect.poll(()=>requests).toBeGreaterThan(before)
  await expect(page.getByLabel('Razlog',{exact:true})).toHaveValue('Dogovor s korisnikom')
  await expect(page.getByRole('searchbox')).toHaveValue('salon')
  await expect(page.getByLabel('Filter',{exact:true})).toHaveValue('web_link')
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});document.dispatchEvent(new Event('visibilitychange'))})
  const hidden=requests
  await page.clock.fastForward(61_000)
  expect(requests).toBe(hidden)
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});document.dispatchEvent(new Event('visibilitychange'))})
  await expect.poll(()=>requests).toBeGreaterThan(hidden)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width)
  await page.screenshot({path:`.tmp-review/launch-admin-${width}.png`,fullPage:true})
})
