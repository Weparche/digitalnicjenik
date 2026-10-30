import { expect,test } from '@playwright/test'
import { TECHNICAL_CHECKS } from '../shared/website-check'
const result={status:'red',checkerRunId:'11111111-1111-4111-8111-111111111111',message:'Strojni cjenik nije pronađen.',details:{reachable:true,homepageReadable:true,https:true}}
test('landing opens anonymous dashboard immediately and checks the entered URL exactly once',async({page})=>{
  await page.route('**/api/auth/me',route=>route.fulfill({status:401,json:{authenticated:false}}))
  const bodies:Record<string,unknown>[]=[]
  await page.route('**/api/digitalni-cjenik/check',async route=>{bodies.push(route.request().postDataJSON());await route.fulfill({json:result})})
  await page.goto('/')
  await page.getByLabel('Adresa web stranice',{exact:true}).fill('salon.hr')
  await page.getByRole('button',{name:'Provjeri besplatno',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Provjera weba',exact:true})).toBeVisible()
  await expect(page.getByRole('heading',{name:'Rezultat provjere',exact:true})).toBeVisible()
  await expect(page.getByRole('navigation',{name:'Radni prostor'}).getByRole('button').first()).toHaveText('Provjera weba')
  expect(bodies).toHaveLength(1);expect(bodies[0]).toMatchObject({url:'https://salon.hr/',source:'landing'})
  await expect(page).not.toHaveURL(/[?&](url|check)=/)
  await page.getByRole('navigation',{name:'Radni prostor'}).getByRole('button',{name:'Upute',exact:true}).click()
  await page.getByRole('navigation',{name:'Radni prostor'}).getByRole('button',{name:'Provjera weba',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Rezultat provjere',exact:true})).toBeVisible();expect(bodies).toHaveLength(1)
  await page.getByRole('button',{name:'Provjeri besplatno',exact:true}).click()
  await expect.poll(()=>bodies.length).toBe(2);expect(bodies[1].source).toBe('dashboard')
})

for(const width of [390,1440])test(`admin sees anonymous checker runs and keeps filters on refresh at ${width}px`,async({page})=>{
  await page.clock.install();await page.setViewportSize({width,height:1000})
  await page.route('**/api/auth/me',route=>route.fulfill({json:{authenticated:true,isAdmin:true,user:{id:'a',email:'nepar@nepar.hr'},tenants:[]}}))
  await page.route('**/api/ops/dashboard*',route=>route.fulfill({json:{summary:{checksToday:2,checks7days:2,checksTotal:2},tenants:[],orders:[],requests:[],detail:null,page:0}}))
  const runs=[{id:'anonymous',hostname:'salon.hr',url:'https://salon.hr/',score:5,unknown_count:1,source:'landing',lead_email:null,checked_at:'2026-10-30T10:31:00Z',status:'red',checks:TECHNICAL_CHECKS.map(check=>({id:check.id,status:'pass',evidence:'Potvrđeno.'})),discoveredUrls:['https://salon.hr/cjenik.csv'],acquisition:{utm_source:'facebook'}},{id:'lead',hostname:'other.hr',url:'https://other.hr/',score:9,unknown_count:0,source:'dashboard',lead_email:'volunteered@example.hr',checked_at:'2026-10-30T09:31:00Z',checks:[],discoveredUrls:[],acquisition:null}]
  const requests:URL[]=[]
  await page.route('**/api/ops/checks*',route=>{const url=new URL(route.request().url());requests.push(url);return route.fulfill({json:{runs:url.searchParams.get('q')?runs.slice(0,1):runs,page:0,hasMore:false,summary:{today:2,last7days:2,total:2}}})})
  await page.goto('/admin?tab=provjere')
  await expect(page.getByRole('table',{name:'Spremljene provjere'})).toBeVisible()
  const anonymous=page.getByRole('row').filter({hasText:'salon.hr'})
  await expect(anonymous).toContainText('Anonimna provjera');await expect(anonymous).not.toContainText('@')
  await expect(page.getByText('E-mail iz upita · nije verificiran')).toBeVisible()
  await anonymous.getByText('Devet provjera',{exact:true}).click();await expect(anonymous.getByRole('listitem')).toHaveCount(9)
  await page.getByLabel('Pretraži provjere po domeni').fill('salon')
  await page.getByLabel('Rezultat',{exact:true}).selectOption('incomplete')
  await page.getByLabel('Od datuma').fill('2026-10-01')
  await expect.poll(()=>requests.at(-1)?.searchParams.get('from')).toBe('2026-10-01')
  const before=requests.length
  await page.clock.fastForward(31_000);await expect.poll(()=>requests.length).toBeGreaterThan(before)
  await expect(page.getByLabel('Pretraži provjere po domeni')).toHaveValue('salon')
  await expect(page.getByLabel('Rezultat',{exact:true})).toHaveValue('incomplete')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width)
  await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo({top:0,behavior:'instant'})})
  await page.screenshot({path:`.tmp-review/dashboard/admin-checks-${width}.png`,fullPage:true})
})
