import {describe,expect,it} from 'vitest'
import {catalogMonitorState,needsMonitorAttention,type CatalogMonitor} from './catalogMonitorView'
const baseline:CatalogMonitor={enabled:true,overall:'ok',checkedAt:'2026-11-17T08:00:00Z',alertOpen:false,jobStatus:'completed',jobUpdatedAt:'2026-11-17T08:01:00Z',currentVersion:true}
describe('catalog monitor summary',()=>{
 it('does not present previous version or pending run as current success',()=>{
   expect(catalogMonitorState(baseline)).toBe('ok')
   expect(catalogMonitorState({...baseline,currentVersion:false})).toBe('outdated')
   expect(catalogMonitorState({...baseline,jobStatus:'running'})).toBe('pending')
   expect(catalogMonitorState({...baseline,jobStatus:'failed'})).toBe('failed')
   expect(needsMonitorAttention({...baseline,currentVersion:false})).toBe(true)
 })
 it('distinguishes disabled and unchecked from active errors',()=>{
   expect(catalogMonitorState(null)).toBe('unavailable')
   expect(catalogMonitorState({...baseline,enabled:false})).toBe('inactive')
   expect(catalogMonitorState({...baseline,checkedAt:null,overall:null})).toBe('unchecked')
   expect(needsMonitorAttention({...baseline,enabled:false,overall:'fail'})).toBe(false)
   expect(needsMonitorAttention({...baseline,alertOpen:true})).toBe(true)
 })
})
