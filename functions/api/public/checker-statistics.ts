import type { RuntimeEnv } from '../../_repository'
import { readCheckerStatistics } from '../../_checker-statistics'
export const onRequestGet=async({env}:{env:RuntimeEnv})=>{
 try {return Response.json(await readCheckerStatistics(env),{headers:{'cache-control':'public, max-age=3600','x-content-type-options':'nosniff'}})}
 catch{return Response.json({error:'statistics_unavailable'},{status:503,headers:{'cache-control':'no-store'}})}
}
