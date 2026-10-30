import { expect,it } from 'vitest'
import { env } from 'cloudflare:test'
import { createPrivateDraft,startTrialClaim,type TrialEnv } from './_trial'
import { createSessionForUser } from './_auth'
import { onRequestPost } from './api/trials/start'
import { onRequestGet as me } from './api/auth/me'
import { onRequestGet as csv } from './c/[slug]/cjenik.csv'
import { onRequestPost as confirmPayment } from './api/ops/renew'
import { placeOrder } from './_orders'
import type { NormalizedPriceList } from '../src/price-engine/types'

const list:NormalizedPriceList={tenant:{id:'draft',slug:'draft',name:'Draft'},source:'nepar',currency:'EUR',updatedAt:new Date().toISOString(),items:[{name:'Haircut',type:'Usluga',price:15,anchorPrice:15,specialSaleApplied:false}]}
const details={objectType:'usluzni-objekt',objectAddress:'Ilica 10, 10000 Zagreb',objectCode:'1',workingDays:[1,2,3,4,5]}
function runtime(){
  const objects=new Map<string,string>();const sent:unknown[]=[]
  const instance:TrialEnv={DB:env.DB,AUTH_RATE_LIMIT_SECRET:'workspace-test-secret',EMAIL_FROM:'publisher@nepar.hr',EMAIL:{send:async message=>{sent.push(message);return {}}},DRAFTS:{put:async(key,value)=>{objects.set(key,value)},get:async key=>objects.has(key)?{text:async()=>objects.get(key)!}:null}}
  return {instance,sent}
}
it('lets a verified account without a tenant publish immediately and acquire owner membership',async()=>{
  const {instance,sent}=runtime();const stamp=new Date().toISOString()
  await env.DB.prepare('INSERT INTO auth_users(id,email,email_verified_at,created_at,updated_at) VALUES (?,?,?,?,?)').bind('new-owner','workspace@example.hr',stamp,stamp,stamp).run()
  const session=await createSessionForUser(instance,'new-owner')
  const cookie='nepar_session='+session.sessionToken
  const before=await me({request:new Request('https://app.test/api/auth/me',{headers:{cookie}}),env:instance})
  expect(await before.json()).toMatchObject({authenticated:true,tenants:[]})
  const draft=await createPrivateDraft(instance,list,'salon.csv','nepar',[],details)
  const request=()=>new Request('https://app.test/api/trials/start',{method:'POST',headers:{origin:'https://app.test',cookie,'content-type':'application/json'},body:JSON.stringify({draftId:draft.draftId,businessName:'Workspace Salon',slug:'workspace-salon',email:'attacker@example.hr'})})
  const result=await onRequestPost({request:request(),env:instance})
  expect(result.status).toBe(200)
  expect(await result.json()).toMatchObject({published:true,slug:'workspace-salon',email:'workspace@example.hr'})
  expect(sent).toHaveLength(0)
  const after=await me({request:new Request('https://app.test/api/auth/me',{headers:{cookie}}),env:instance})
  expect(await after.json()).toMatchObject({tenants:[{slug:'workspace-salon',role:'owner'}]})
  expect((await csv({request:new Request('https://app.test/c/workspace-salon/cjenik.csv'),params:{slug:'workspace-salon'},env:instance})).status).toBe(200)
  expect((await onRequestPost({request:request(),env:instance})).status).toBe(200)
  expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM tenants WHERE slug='workspace-salon'").first<{n:number}>())?.n).toBe(1)
})
it('requires an actually verified server-side owner before bypassing email verification',async()=>{
  const {instance}=runtime();const stamp=new Date().toISOString()
  await env.DB.prepare('INSERT INTO auth_users(id,email,created_at,updated_at) VALUES (?,?,?,?)').bind('unverified-owner','unverified@example.hr',stamp,stamp).run()
  const draft=await createPrivateDraft(instance,list,'salon.csv','nepar',[],details)
  await expect(startTrialClaim(new Request('https://app.test/api/trials/start'),instance,{draftId:draft.draftId,email:'unverified@example.hr',businessName:'Unverified Salon',slug:'unverified-salon'},fetch,{id:'unverified-owner',email:'unverified@example.hr'})).rejects.toMatchObject({code:'verification_required',status:403})
})
it('rejects cross-origin onboarding before changing any account data',async()=>{
  const {instance}=runtime()
  expect((await onRequestPost({request:new Request('https://app.test/api/trials/start',{method:'POST',headers:{origin:'https://other.test'},body:'{}'}),env:instance})).status).toBe(403)
})

it('activates an expired public link with one admin payment confirmation, without choosing a plan or a manual action',async()=>{
  const {instance}=runtime();const stamp=new Date().toISOString()
  await env.DB.batch([
    env.DB.prepare('INSERT INTO auth_users(id,email,email_verified_at,created_at,updated_at) VALUES (?,?,?,?,?)').bind('payment-owner','payment@example.hr',stamp,stamp,stamp),
    env.DB.prepare('INSERT INTO auth_users(id,email,email_verified_at,created_at,updated_at) VALUES (?,?,?,?,?)').bind('payment-admin','nepar@nepar.hr',stamp,stamp,stamp),
  ])
  const draft=await createPrivateDraft(instance,list,'payments.csv','nepar',[],{...details,objectCode:'2'})
  await startTrialClaim(new Request('https://app.test/api/trials/start'),instance,{draftId:draft.draftId,email:'payment@example.hr',businessName:'Payment Salon',slug:'payment-salon'},fetch,{id:'payment-owner',email:'payment@example.hr'})
  const tenant=(await env.DB.prepare("SELECT id,slug,name FROM tenants WHERE slug='payment-salon'").first<{id:string;slug:string;name:string}>())!
  await env.DB.prepare("UPDATE entitlements SET status='expired',period_end='2020-01-01' WHERE tenant_id=?").bind(tenant.id).run()
  const context={request:new Request('https://app.test/c/payment-salon/cjenik.csv'),params:{slug:tenant.slug},env:instance}
  expect((await csv(context)).status).toBe(410)
  const {order}=await placeOrder(instance,tenant,{kind:'publisher',billingName:tenant.name,customerType:'person',address:'Ilica 10',postalCity:'10000 Zagreb',email:'payment@example.hr'})
  const session=await createSessionForUser(instance,'payment-admin')
  const request=()=>new Request('https://app.test/api/ops/renew',{method:'POST',headers:{origin:'https://app.test',cookie:'nepar_session='+session.sessionToken,'content-type':'application/json'},body:JSON.stringify({slug:tenant.slug,action:'confirm_payment',reference:order.reference})})
  const adminEnv={...instance,ADMIN_EMAILS:'nepar@nepar.hr'}
  expect((await confirmPayment({request:request(),env:adminEnv})).status).toBe(200)
  expect((await csv(context)).status).toBe(200)
  const first=await env.DB.prepare('SELECT plan,period_end FROM entitlements WHERE tenant_id=?').bind(tenant.id).first()
  expect(first).toMatchObject({plan:'publisher_self_service'})
  await confirmPayment({request:request(),env:adminEnv})
  expect(await env.DB.prepare('SELECT plan,period_end FROM entitlements WHERE tenant_id=?').bind(tenant.id).first()).toEqual(first)
})
