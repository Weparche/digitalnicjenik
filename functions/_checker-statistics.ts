import type { RuntimeEnv } from './_repository'
import { zagrebTime } from '../shared/zagreb-time'
import type { CheckerStatistics } from '../shared/checker-statistics'
export function statisticsPeriod(now=new Date()){
 const parts=new Intl.DateTimeFormat('en',{timeZone:'Europe/Zagreb',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now)
 const today=['year','month','day'].map(t=>parts.find(p=>p.type===t)!.value).join('-')
 const day=(offset:number)=>new Date(Date.parse(today+'T00:00:00Z')+offset*86400000).toISOString().slice(0,10)
 return {from:day(-7),to:day(-1),start:zagrebTime(day(-7),0),end:zagrebTime(today,0)}
}
export async function readCheckerStatistics(env:RuntimeEnv,now=new Date()):Promise<CheckerStatistics>{
 const {from,to,start,end}=statisticsPeriod(now)
 if(!env.DB)throw Error('db_unavailable')
 const row=await env.DB.prepare(`WITH filtered AS (SELECT hostname,checked_at,id,checks_json FROM checker_runs WHERE checked_at>=? AND checked_at<? AND is_internal=0 AND source IN ('landing','dashboard') AND lower(hostname)!='nepar.hr' AND lower(hostname) NOT LIKE '%.nepar.hr'),
 latest AS (SELECT *,row_number() OVER(PARTITION BY hostname ORDER BY checked_at DESC,id DESC) AS rn FROM filtered)
 SELECT (SELECT count(*) FROM filtered) AS checks,count(*) AS domains,coalesce(sum(CASE WHEN EXISTS(SELECT 1 FROM json_each(CASE WHEN json_valid(checks_json) THEN checks_json ELSE '[]' END) AS j WHERE json_extract(j.value,'$.id')='machine' AND json_extract(j.value,'$.status')='pass') THEN 1 ELSE 0 END),0) AS machineConfirmed FROM latest WHERE rn=1`).bind(start,end).first<{checks:number;domains:number;machineConfirmed:number}>()
 if(!row||row.domains<10)return {from,to,available:false}
 return {from,to,available:true,checks:row.checks,domains:row.domains,machineConfirmed:row.machineConfirmed,machineNotConfirmed:row.domains-row.machineConfirmed}
}
