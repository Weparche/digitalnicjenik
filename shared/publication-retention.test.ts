import { describe,it,expect } from 'vitest'
import {retentionIsLive} from './publication-retention'
describe('public archive retention',()=>{
 const start=Date.parse('2026-11-17T10:00:00Z')
 const day=86400000
 it('keeps the last published version for fifteen days after publication if service expires',()=>{
 const p={isCurrent:true,publishedAt:new Date(start).toISOString(),publicUntil:null}
 expect(retentionIsLive(p,start+14*day)).toBe(true)
 expect(retentionIsLive(p,start+16*day)).toBe(false)
 })
 it('honors previously assigned longer archive deadlines without rewriting them',()=>{
 const p={isCurrent:false,publishedAt:new Date(start-day).toISOString(),publicUntil:new Date(start+30*day).toISOString()}
 expect(retentionIsLive(p,start+29*day)).toBe(true)
 expect(retentionIsLive(p,start+31*day)).toBe(false)
 })
})
