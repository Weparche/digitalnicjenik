import { expect,it } from 'vitest'
import { env } from 'cloudflare:test'
import { createSessionForUser } from './_auth'
import { onRequestGet } from './api/publisher/catalogs'

it('catalog overview only returns owned lists, without publishing or changing data',async()=>{
  const stamp=new Date().toISOString()
  const user='catalog-owner-test'
  await env.DB.batch([
    env.DB.prepare('INSERT INTO auth_users(id,email,created_at,updated_at) VALUES (?,?,?,?)').bind(user,'catalog-owner@example.hr',stamp,stamp),
    ...['catalog-a','catalog-b','catalog-other'].map(id=>env.DB.prepare('INSERT INTO tenants(id,slug,name,created_at,updated_at) VALUES (?,?,?,?,?)').bind(id,id,id,stamp,stamp)),
    ...['catalog-a','catalog-b'].map(id=>env.DB.prepare('INSERT INTO tenant_members(id,tenant_id,user_id,role,created_at) VALUES (?,?,?,?,?)').bind('member-'+id,id,user,'owner',stamp)),
  ])
  const session=await createSessionForUser({DB:env.DB},user)
  const call=(cookie?:string)=>onRequestGet({request:new Request('https://app.test/api/publisher/catalogs',{headers:cookie?{cookie}:{}}),env:{DB:env.DB}})
  expect((await call()).status).toBe(401)
  const response=await call('nepar_session='+session.sessionToken)
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('no-store')
  const body=await response.json() as {catalogs:Array<{slug:string;publicLive:boolean;itemCount:number|null}>}
  expect(body.catalogs.map(c=>c.slug)).toEqual(['catalog-a','catalog-b'])
  expect(body.catalogs.every(c=>!c.publicLive&&c.itemCount===null)).toBe(true)
})
