import {expect,it} from 'vitest'
import {env} from 'cloudflare:test'
import {createSessionForUser} from './_auth'
import {onRequestGet,onRequestPost} from './api/publisher/business-profiles'
it('stores reusable profiles privately and validates the identifier and origin',async()=>{
  const stamp=new Date().toISOString()
  for(const id of ['profile-owner-a','profile-owner-b'])await env.DB.prepare('INSERT INTO auth_users(id,email,created_at,updated_at) VALUES (?,?,?,?)').bind(id,id+'@example.hr',stamp,stamp).run()
  const a=await createSessionForUser({DB:env.DB},'profile-owner-a')
  const b=await createSessionForUser({DB:env.DB},'profile-owner-b')
  const ctx=(token:string,body?:Record<string,unknown>,origin='https://app.test')=>({request:new Request('https://app.test/api/publisher/business-profiles',{method:body?'POST':'GET',headers:{cookie:'nepar_session='+token,origin,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env:{DB:env.DB}})
  const data={name:'NEPAR obrt',merchantType:'natural',merchantIdentifier:'12345678',address:'Zagreb',billingOib:'69435151530'}
  expect((await onRequestPost(ctx(a.sessionToken,data,'https://other.test'))).status).toBe(403)
  expect((await onRequestPost(ctx(a.sessionToken,{...data,billingOib:'00000000000'}))).status).toBe(400)
  expect((await onRequestPost(ctx(a.sessionToken,data))).status).toBe(200)
  expect((await onRequestPost(ctx(a.sessionToken,{...data,name:'NEPAR ažurirano'}))).status).toBe(200)
  const response=await onRequestGet(ctx(a.sessionToken));expect(response.headers.get('cache-control')).toBe('no-store')
  const body=await response.json() as {profiles:Array<{name:string;merchantIdentifier:string}>}
  expect(body.profiles).toHaveLength(1);expect(body.profiles[0]).toMatchObject({name:'NEPAR ažurirano',merchantIdentifier:'12345678'})
  expect(await (await onRequestGet(ctx(b.sessionToken))).json()).toEqual({profiles:[]})
})
