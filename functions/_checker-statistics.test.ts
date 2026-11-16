import { describe, expect, it } from 'vitest'
import { readCheckerStatistics,statisticsPeriod } from './_checker-statistics'
import type { RuntimeEnv } from './_repository'
function env(row:{checks:number;domains:number;machineConfirmed:number}):RuntimeEnv {
 const statement={bind:()=>statement,first:async<T,>()=>row as T,all:async<T,>()=>({results:[] as T[]}),run:async()=>({})}
 return {DB:{prepare:()=>statement,batch:async()=>[]}}
}
describe('public checker statistics',()=>{
 const now=new Date('2026-11-16T11:00:00Z')
 it('uses completed local days and respects timezone',()=>expect(statisticsPeriod(now)).toEqual({from:'2026-11-09',to:'2026-11-15',start:'2026-11-08T23:00:00.000Z',end:'2026-11-15T23:00:00.000Z'}))
 it('suppresses small samples',async()=>expect(await readCheckerStatistics(env({checks:10,domains:9,machineConfirmed:2}),now)).toEqual({from:'2026-11-09',to:'2026-11-15',available:false}))
 it('returns aggregates only',async()=>expect(await readCheckerStatistics(env({checks:15,domains:11,machineConfirmed:3}),now)).toEqual({from:'2026-11-09',to:'2026-11-15',available:true,checks:15,domains:11,machineConfirmed:3,machineNotConfirmed:8}))
})
