import {describe,it,expect} from 'vitest'
import {calculateHistory,historyWindow,historyIdentity,observedRetailPrice,zagrebTimeToIso,type HistorySnapshot} from './price-history'
const item={name:'Kava',type:'Proizvod',externalId:'A1',price:8,specialSaleApplied:true}
const key=historyIdentity(item).key
const window=historyWindow('2026-11-17T10:00:00Z')
const snapshots:HistorySnapshot[]=[
 {id:'a',published_at:'2026-10-01T10:00:00Z',superseded_at:'2026-10-25T10:00:00Z',is_current:0},
 {id:'b',published_at:'2026-10-25T10:00:00Z',superseded_at:'2026-11-01T10:00:00Z',is_current:0},
 {id:'c',published_at:'2026-11-01T10:00:00Z',superseded_at:'2026-11-17T10:00:00Z',is_current:0},
 {id:'d',published_at:'2026-11-17T10:00:00Z',superseded_at:null,is_current:1}
]
const obs=[100,90,120,80].map((price,i)=>({publicationId:snapshots[i].id,itemKey:key,price}))
describe('Private 30-day price history',()=>{
 it('includes the price valid at the beginning and excludes the new sale itself',()=>{
  expect(calculateHistory([item],snapshots,obs,window)[0]).toMatchObject({status:'complete',lowest:90})
 })
 it('does not treat a new item or missing version as complete',()=>{
  expect(calculateHistory([item],snapshots.slice(1),obs,window)[0]?.status).toBe('partial')
  expect(calculateHistory([item],snapshots,obs.filter(o=>o.publicationId!=='b'),window)[0]?.status).toBe('partial')
  expect(calculateHistory([item],snapshots,obs,window,true)[0]?.status).toBe('partial')
 })
 it('does not ignore gaps and duplicate identifiers',()=>{
  expect(calculateHistory([item],[{...snapshots[0],superseded_at:'2026-10-20T10:00:00Z'},...snapshots.slice(1)],obs,window)[0]?.status).toBe('partial')
  expect(calculateHistory([item,item],snapshots,obs,window)[0]?.status).toBe('ambiguous')
  expect(calculateHistory([item],snapshots,[...obs,obs[0]],window)[0]?.status).toBe('ambiguous')
 })
 it('includes earlier sale prices, not just regular prices',()=>{
  expect(observedRetailPrice({price:120,salePrice:90,specialSaleApplied:true})).toBe(90)
  expect(observedRetailPrice({price:120,salePrice:90,specialSaleApplied:null})).toBeNull()
 })
 it('uses Croatian calendar days across the clock change',()=>{
  expect(window.from).toBe('2026-10-18T09:00:00.000Z')
  expect(zagrebTimeToIso('2026-11-17T11:00')).toBe(window.to)
 })
})
