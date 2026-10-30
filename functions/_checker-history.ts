import { technicalReport,type WebsiteCheckResult } from '../shared/website-check'
import { sanitizeAttribution } from '../shared/acquisition'
import type { D1DatabaseLike } from './_repository'
import { zagrebTime } from '../shared/zagreb-time'

export async function checkerRunCounts(db:D1DatabaseLike){
  const now=new Date(),parts=new Intl.DateTimeFormat('en',{timeZone:'Europe/Zagreb',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now)
  const today=['year','month','day'].map(type=>parts.find(part=>part.type===type)!.value).join('-')
  return await db.prepare('SELECT COUNT(*) AS total,COALESCE(SUM(checked_at>=?),0) AS last7days,COALESCE(SUM(checked_at>=?),0) AS today FROM checker_runs').bind(new Date(now.getTime()-7*86_400_000).toISOString(),zagrebTime(today,0)).first<{total:number;last7days:number;today:number}>()
}

/** Remove credentials, query tokens and fragments before storing operational URLs. */
export function checkerHistoryUrl(raw:unknown):string|null{
  try{
    if(typeof raw!=='string'||raw.length>2048)return null
    const url=new URL(raw)
    if(!['https:','http:'].includes(url.protocol))return null
    url.username='';url.password='';url.search='';url.hash=''
    return url.href
  }catch{return null}
}

export async function recordCheckerRun(db:D1DatabaseLike|undefined,url:string,result:WebsiteCheckResult,attribution:unknown,source:unknown){
  if(!db)return null
  const clean=checkerHistoryUrl(url)
  if(!clean)return null
  const report=technicalReport(result)
  const checks=report.checks.map(check=>({id:check.id,status:check.status,evidence:check.evidence.slice(0,500)}))
  const details=result.details
  const discovered=[...new Set([details?.csvUrl,details?.xmlUrl,details?.pricePageUrl,details?.archiveUrl,details?.publicLinkUrl].map(checkerHistoryUrl).filter((value):value is string=>Boolean(value)))].slice(0,5)
  const touch=sanitizeAttribution(attribution)
  const id=crypto.randomUUID()
  try{
    await db.prepare('INSERT INTO checker_runs(id,checked_at,url,hostname,status,score,unknown_count,checks_json,discovered_urls_json,acquisition_json,source) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id,new Date().toISOString(),clean,new URL(clean).hostname,result.status,report.score,report.unknown,JSON.stringify(checks),JSON.stringify(discovered),touch?JSON.stringify(touch):null,source==='landing'?'landing':'dashboard').run()
    return id
  }catch{
    // A missing migration/storage outage must not break the registration-free checker.
    console.error('checker_history_write_failed')
    return null
  }
}
