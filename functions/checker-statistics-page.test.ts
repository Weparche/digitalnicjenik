import {describe,it,expect} from 'vitest'
import {onRequestGet} from './statistika-digitalnih-cjenika/index'
import type {RuntimeEnv} from './_repository'
const html='<html><p>Automatski agregirani podaci učitavaju se iz produkcijske evidencije.</p></html>'
function env(domains:number):RuntimeEnv{
 const stmt={bind:()=>stmt,first:async<T,>()=>({checks:15,domains,machineConfirmed:3}) as T,all:async<T,>()=>({results:[] as T[]}),run:async()=>({})}
 return {DB:{prepare:()=>stmt,batch:async()=>[]}}
}
const ctx=(domains:number)=>({env:env(domains),request:new Request('https://digitalnicjenik.nepar.hr/statistika-digitalnih-cjenika/'),next:async()=>new Response(html,{headers:{'content-type':'text/html','etag':'old'}})})
describe('public statistics HTML',()=>{
 it('renders aggregate data in crawlable HTML',async()=>{const res=await onRequestGet(ctx(11));expect(await res.text()).toContain('<strong>11</strong> različitih hostnameova');expect(res.headers.get('etag')).toBeNull()})
 it('preserves static page for small sample',async()=>{const res=await onRequestGet(ctx(9));expect(await res.text()).toBe(html)})
})
