import { expect,test,type Page } from '@playwright/test'

const tenant={id:'t-salon',slug:'salon',name:'Salon Lana',role:'owner'}
const owner={authenticated:true,isAdmin:false,user:{id:'u',email:'owner@salon.hr'},tenants:[tenant]}
const items=[{name:'Šišanje',type:'Usluga',price:15,anchorPrice:15,specialSaleApplied:false,anchorReferenceDate:'2026-09-10'}]
const list={tenant,source:'nepar',currency:'EUR',updatedAt:'2026-10-29T09:00:00Z',items}
const features={publish:true,upload:true,archive:true,qr:true,pdf:true,embed:true,editItems:false,monitoring:false,alerts:false,staticWebsite:false}
const publication={id:'p1',sequence:2,publishedAt:'2026-10-29T09:00:00Z',filenameStem:'salon-2',payload:list}
const csv='Naziv,Vrsta,Cijena,Sidrena cijena,Poseban oblik prodaje\nŠišanje,Usluga,15,15,NE'
async function api(page:Page,publisher=false){
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname
    if(path==='/api/auth/me')return route.fulfill({json:owner})
    if(path==='/api/orders')return route.fulfill({json:{entitlement:{plan:publisher?'publisher_self_service':'web_link',status:'active',periodStart:'2026-10-29T09:00:00Z',periodEnd:'2099-10-29T09:00:00Z'},features:{...features,editItems:publisher,monitoring:publisher},order:null,upgradeAvailable:true}})
    if(path==='/api/tenants/salon')return route.fulfill({json:{priceList:list,publication}})
    if(path==='/api/public-config')return route.fulfill({json:{turnstileSiteKey:'test-key'}})
    return route.fulfill({status:404,json:{}})
  })
}
test('hero upload opens the working dashboard instead of expanding the landing',async({page})=>{
  await page.route('**/api/auth/me',route=>route.fulfill({status:401,json:{authenticated:false}}))
  await page.goto('/')
  await expect(page.locator('#csv-validator')).toHaveCount(0)
  await expect(page.locator('.excel-converter')).toHaveCount(0)
  await page.getByRole('button',{name:'Učitaj cjenik',exact:true}).click()
  await expect(page).toHaveURL(/\/app\?new=1$/)
  await expect(page.getByRole('heading',{name:'Pripremite svoj prvi cjenik'})).toBeVisible()
  await page.getByLabel('Učitaj cjenik',{exact:true}).setInputFiles({name:'salon.csv',mimeType:'text/csv',buffer:Buffer.from(csv)})
  await expect(page.getByRole('button',{name:/Objavi besplatno na 24 h/})).toBeEnabled()
})
test('a verified user without a tenant has a complete first-publication flow',async({page})=>{
  let created=false;let claim:Record<string,unknown>|undefined
  await api(page)
  await page.route('**/api/auth/me',route=>route.fulfill({json:{...owner,tenants:created?[tenant]:[]}}))
  await page.route('**/api/trials/start?**',route=>route.fulfill({json:{suggested:'salon-lana',available:true}}))
  await page.route('**/api/drafts',route=>route.fulfill({json:{ok:true,draftId:'private-draft'}}))
  await page.route('**/api/trials/start',route=>{claim=route.request().postDataJSON();created=true;return route.fulfill({json:{ok:true,published:true,slug:'salon'}})})
  await page.goto('/app')
  await expect(page.getByText('Nema aktivnog tenanta')).toHaveCount(0)
  await page.getByLabel('Učitaj cjenik',{exact:true}).setInputFiles({name:'salon.csv',mimeType:'text/csv',buffer:Buffer.from(csv)})
  await page.getByRole('button',{name:/Objavi besplatno na 24 h/}).click()
  await page.getByLabel('Naziv poslovanja',{exact:true}).fill('Salon Lana')
  await page.getByLabel('Puna adresa objekta',{exact:true}).fill('Ilica 10, 10000 Zagreb')
  await expect(page.getByLabel('E-mail',{exact:true})).toHaveCount(0)
  await page.getByRole('button',{name:'Objavi moj cjenik',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Moj cjenik',exact:true})).toBeVisible()
  expect(claim).toMatchObject({draftId:'private-draft',email:'owner@salon.hr',businessName:'Salon Lana'})
  await expect(page.getByRole('heading',{name:'Poslali smo potvrdni link'})).toHaveCount(0)
})
for(const width of [390,768,1440])test(`Web Link dashboard focuses on the current link and replacement at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});await api(page)
  await page.goto('/app')
  await expect(page.getByRole('heading',{name:'Moj cjenik',exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:'Zamijeni cjenik',exact:true})).toBeVisible()
  await expect(page.getByText('Javni link je aktivan',{exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:/Nadogradi na Publisher/})).toHaveCount(0)
  await expect(page.locator('.monitor-panel')).toHaveCount(0)
  const nav=page.getByRole('navigation',{name:'Radni prostor'})
  await expect(nav.getByRole('button',{name:'Paketi i cijene'})).toBeVisible()
  await expect(page.getByRole('region',{name:'Besplatna objava i cijena'})).toHaveCount(0)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width)
  await page.screenshot({path:`.tmp-review/dashboard/user-final-${width}.png`,fullPage:true})
  await page.getByRole('button',{name:'Zamijeni cjenik',exact:true}).click()
  await page.getByLabel('Učitaj cjenik',{exact:true}).setInputFiles({name:'invalid.csv',mimeType:'text/csv',buffer:Buffer.from('Naziv,Vrsta,Cijena,Sidrena cijena,Poseban oblik prodaje\nValid,Usluga,10,10,NE\nBad,Usluga,abc,10,NE')})
  await expect(page.getByRole('button',{name:'Objavi zamjenu cjenika'})).toBeDisabled()
  await expect(page.getByRole('link',{name:/127.0.0.1.*salon/})).toBeVisible()
})
test('Publisher keeps unsaved edits when subscription data refreshes',async({page})=>{
  await page.clock.install();await api(page,true);await page.goto('/app')
  await page.getByLabel('Sidrena cijena za Šišanje',{exact:true}).fill('12')
  const refresh=page.waitForRequest('**/api/orders*')
  await page.clock.fastForward(31_000);await refresh
  await expect(page.getByLabel('Sidrena cijena za Šišanje',{exact:true})).toHaveValue('12')
  await expect(page.getByRole('button',{name:'Spremi promjene',exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:'Dodaj stavku',exact:true})).toBeVisible()
  await page.getByRole('navigation',{name:'Radni prostor'}).getByRole('button',{name:'Upute',exact:true}).click()
  await page.getByRole('button',{name:'Otvori moj cjenik',exact:true}).click()
  await expect(page.getByLabel('Sidrena cijena za Šišanje',{exact:true})).toHaveValue('12')
})

test('first-publication guidance and package prices stay inside the dashboard without losing an upload',async({page})=>{
  await api(page)
  await page.route('**/api/auth/me',route=>route.fulfill({status:401,json:{authenticated:false}}))
  await page.setViewportSize({width:390,height:1000})
  await page.goto('/app?new=1')
  const offer=page.getByRole('region',{name:'Besplatna objava i cijena'})
  await expect(offer.getByRole('heading',{name:'Objavite cjenik besplatno na 24 h'})).toBeVisible()
  await expect(offer).toContainText('19,90 € za cijelu godinu')
  await page.getByLabel('Učitaj cjenik',{exact:true}).setInputFiles({name:'salon.csv',mimeType:'text/csv',buffer:Buffer.from(csv)})
  const nav=page.getByRole('navigation',{name:'Radni prostor'})
  await expect(nav.getByRole('button').nth(1)).toHaveText('Upute')
  await nav.getByRole('button',{name:'Upute',exact:true}).click()
  await expect(page.getByRole('link',{name:'Otvori HOK Excel predloške'})).toHaveAttribute('href',/^https:\/\/www.hok.hr\//)
  await expect(page.getByText('Ovo nije preslika službenog HOK predloška.',{exact:false})).toBeVisible()
  await expect(page.getByRole('link',{name:'NEPAR primjer usluga (.csv)'})).toHaveAttribute('download','')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390)
  await page.screenshot({path:'.tmp-review/dashboard/instructions-390.png',fullPage:true})
  await nav.getByRole('button',{name:'Paketi i cijene',exact:true}).click()
  const packages=page.getByRole('region',{name:'Godišnji paketi'})
  for(const price of ['19,90 €','49,90 €','99,00 €','+30,00 €','29,90 €'])await expect(packages).toContainText(price)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390)
  await page.screenshot({path:'.tmp-review/dashboard/packages-390.png',fullPage:true})
  await page.getByRole('button',{name:'Pripremi cjenik besplatno'}).click()
  await expect(page.getByRole('button',{name:/Objavi besplatno na 24 h/})).toBeEnabled()
})

test('a free published price list explains the annual cost and opens its payment view',async({page})=>{
  await api(page)
  await page.route('**/api/orders*',route=>route.fulfill({json:{entitlement:{plan:'web_link',status:'trial',periodStart:new Date().toISOString(),periodEnd:new Date(Date.now()+86_400_000).toISOString()},features,order:null,upgradeAvailable:false}}))
  await page.goto('/app')
  const offer=page.getByRole('region',{name:'Besplatna objava i cijena'})
  await expect(offer).toContainText('19,90 € za cijelu godinu')
  await offer.getByRole('button',{name:'Kako zadržati link?'}).click()
  await expect(page.getByRole('heading',{name:'Paketi i cijene',exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:/Zadrži ovaj link trajno/})).toBeVisible()
})
test('an admin without a personal price list gets an explicit administration shortcut',async({page})=>{
  await page.route('**/api/auth/me',route=>route.fulfill({json:{...owner,isAdmin:true,user:{id:'admin',email:'nepar@nepar.hr'},tenants:[]}}))
  await page.goto('/app')
  await expect(page.getByRole('link',{name:'Otvori administraciju',exact:true})).toHaveAttribute('href','/admin')
  await expect(page.getByLabel('Učitaj cjenik',{exact:true})).toBeVisible()
})

test('login welcomes every package and keeps the order return context',async({page})=>{
  await page.route('**/api/auth/me',route=>route.fulfill({status:401,json:{authenticated:false}}))
  let body:Record<string,unknown>|undefined
  await page.route('**/api/auth/magic-link',route=>{body=route.request().postDataJSON();return route.fulfill({json:{ok:true}})})
  await page.goto('/app?order=2026-1042&tenant=salon')
  await expect(page.getByRole('heading',{name:'Prijava u NEPAR',exact:true})).toBeVisible()
  await expect(page.getByRole('link',{name:'Pripremite prvu besplatnu objavu.'})).toHaveAttribute('href','/app?new=1')
  await page.getByLabel('E-mail',{exact:true}).fill('owner@salon.hr')
  await page.getByRole('button',{name:'Pošalji prijavni link'}).click()
  await expect(page.getByRole('status')).toContainText('Link vrijedi 15 minuta')
  await expect(page.getByText(/aktivan Publisher račun/)).toHaveCount(0)
  expect(body).toMatchObject({email:'owner@salon.hr',returnTo:'/app?order=2026-1042&tenant=salon'})
  await page.screenshot({path:'.tmp-review/dashboard/login-final.png',fullPage:true})
})

for(const entry of ['created=1&tenant=salon','welcome=1&slug=salon'])test(`first publication shows its real deadline and a working copy action: ${entry}`,async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write'])
  await page.setViewportSize({width:390,height:1000});await api(page)
  await page.route('**/api/orders*',route=>route.fulfill({json:{entitlement:{plan:'web_link',status:'trial',periodStart:'2099-10-28T09:00:00Z',periodEnd:'2099-10-29T09:00:00Z'},features,order:null,upgradeAvailable:false}}))
  await page.goto('/app?'+entry)
  const success=page.getByRole('region',{name:'Cjenik je objavljen',exact:true})
  await expect(success).toContainText('29. 10. 2099.')
  await expect(success.getByRole('link',{name:/http.*salon/})).toHaveAttribute('href',/\/c\/salon$/)
  await success.getByRole('button',{name:'Kopiraj link',exact:true}).click()
  await expect(success.getByRole('status')).toHaveText('Link je spreman za dijeljenje.')
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(new URL('/c/salon',page.url()).href)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390)
  await page.screenshot({path:'.tmp-review/dashboard/first-published-390.png',fullPage:true})
})

test('reported payment appears on My price list and confirmation refreshes the actual access period',async({page})=>{
  await page.clock.install();await page.setViewportSize({width:390,height:1000});await api(page)
  let reported=false,paid=false
  const order={reference:'2026-1042',kind:'web_link',installation:false,amountCents:1990,amountLabel:'19,90 €',customerType:'company',billingName:'Salon Lana',oib:null,address:'Ilica 10',postalCity:'10000 Zagreb',email:'owner@salon.hr',createdAt:'2026-10-29T09:00:00Z',description:'Digitalni cjenik',payee:{name:'NEPAR',street:'Ilica 1',postalCity:'10000 Zagreb',iban:'HR0623600001103276807',model:'HR00'},hub3:'HRVHUB30\nEUR\n000000000001990'}
  await page.route('**/api/orders*',route=>route.fulfill({json:{entitlement:{plan:'web_link',status:paid?'active':'trial',periodStart:'2026-10-29T09:00:00Z',periodEnd:paid?'2099-11-29T09:00:00Z':'2099-10-29T09:00:00Z'},features,order:{...order,status:paid?'paid':'pending',paymentReportedAt:reported?'2026-10-29T10:00:00Z':null},upgradeAvailable:false}}))
  await page.route('**/api/orders/report',route=>{expect(route.request().method()).toBe('POST');expect(route.request().postDataJSON()).toEqual({reference:order.reference});reported=true;return route.fulfill({json:{ok:true}})})
  await page.goto('/app?tab=pretplata')
  await page.getByRole('button',{name:'Uplatio sam',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Uplata je prijavljena — čeka potvrdu',exact:true})).toBeVisible()
  await page.getByRole('navigation',{name:'Radni prostor'}).getByRole('button',{name:'Moj cjenik',exact:true}).click()
  const notice=page.getByRole('region',{name:'Status prijavljene uplate'})
  await expect(notice).toContainText('Ne trebate ponovno uplatiti')
  expect((await notice.getByRole('heading').boundingBox())!.width).toBeGreaterThan(250)
  await expect(page.getByRole('region',{name:'Besplatna objava i cijena'})).toHaveCount(0)
  await expect(page.getByRole('button',{name:'Zadrži isti link',exact:true})).toHaveCount(0)
  await expect(page.getByText('Javni link je aktivan',{exact:true})).toHaveCount(0)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390)
  await page.screenshot({path:'.tmp-review/dashboard/payment-reported-390.png',fullPage:true})
  paid=true
  const refresh=page.waitForRequest(request=>new URL(request.url()).pathname==='/api/orders')
  await page.clock.fastForward(31_000);await refresh
  await expect(notice).toHaveCount(0)
  await expect(page.getByText('Javni link je aktivan',{exact:true})).toBeVisible()
  await expect(page.locator('.workspace-live-strip')).toContainText('29. 11. 2099.')
})

test('a second owned price list keeps its tenant when ordering after the welcome callback',async({page})=>{
  await api(page)
  await page.route('**/api/auth/me',route=>route.fulfill({json:{...owner,tenants:[{...tenant,id:'first',slug:'first'},tenant]}}))
  let placed:Record<string,unknown>|undefined
  await page.route('**/api/orders*',route=>{
    if(route.request().method()==='POST'){placed=route.request().postDataJSON();return route.fulfill({json:{ok:true}})}
    return route.fulfill({json:{tenant,entitlement:{plan:'web_link',status:'trial',periodStart:'2099-10-28T09:00:00Z',periodEnd:'2099-10-29T09:00:00Z'},features,order:null,upgradeAvailable:false}})
  })
  await page.goto('/app?welcome=1&slug=salon')
  await page.getByRole('navigation',{name:'Radni prostor'}).getByRole('button',{name:'Paketi i cijene',exact:true}).click()
  await page.getByRole('button',{name:/Zadrži ovaj link trajno/}).click()
  await page.getByLabel('OIB',{exact:true}).fill('69435151530')
  await page.getByLabel('Adresa',{exact:true}).fill('Ilica 10')
  await page.getByLabel('Poštanski broj i grad').fill('10000 Zagreb')
  await page.getByRole('button',{name:'Nastavi na uplatu →'}).click()
  await expect.poll(()=>placed?.tenant).toBe('salon')
})
