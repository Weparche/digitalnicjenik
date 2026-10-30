import { technicalReport,TECHNICAL_CHECKS,STATUS_LABELS,type TechnicalStatus,type WebsiteCheckResult } from '../shared/website-check'
import { sanitizeAttribution } from '../shared/acquisition'
import type { D1DatabaseLike } from './_repository'
import { zagrebTime } from '../shared/zagreb-time'
import { lifecycleStatement,zagrebDay } from '../shared/lifecycle'

export type CheckerMailRun={url:string;hostname:string;score:number|null;unknown_count:number;checks_json:string;discovered_urls_json:string;checked_at?:string}
export function checkerMailSummary(run:CheckerMailRun){
  const checks=JSON.parse(run.checks_json) as Array<{id:string;status:TechnicalStatus;evidence:string}>
  const urls=JSON.parse(run.discovered_urls_json) as string[]
  return [`Provjereni web: ${run.url}`,...(run.checked_at?[`Vrijeme provjere: ${new Intl.DateTimeFormat('hr-HR',{timeZone:'Europe/Zagreb',dateStyle:'short',timeStyle:'short'}).format(new Date(run.checked_at))}`]:[]),`Rezultat: ${run.score===null||run.unknown_count===9?'nije potvrđen':`${run.score}/9`}`,`Nepotvrđenih provjera: ${run.unknown_count}`,...checks.map(check=>`${TECHNICAL_CHECKS.find(item=>item.id===check.id)?.label??check.id}: ${STATUS_LABELS[check.status]} — ${check.evidence}`),...(urls.length?['Pronađene poveznice:',...urls]:[])].join('\n')
}
export const checkerOpsEventId=(url:string,now=new Date())=>`checker-attention:${new URL(url).hostname}:${zagrebDay(now)}`

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

export async function recordCheckerRun(db:D1DatabaseLike|undefined,url:string,result:WebsiteCheckResult,attribution:unknown,source:unknown,now=new Date()){
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
    const hostname=new URL(clean).hostname,checksJson=JSON.stringify(checks),urlsJson=JSON.stringify(discovered)
    await db.batch([
      db.prepare('INSERT INTO checker_runs(id,checked_at,url,hostname,status,score,unknown_count,checks_json,discovered_urls_json,acquisition_json,source) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id,now.toISOString(),clean,hostname,result.status,report.score,report.unknown,checksJson,urlsJson,touch?JSON.stringify(touch):null,source==='landing'?'landing':'dashboard'),
      ...(report.score<9?[lifecycleStatement(db,{id:checkerOpsEventId(clean,now),type:'inquiry_checker_attention',entityId:id,audience:'ops',due:now.toISOString(),payload:{hostname,score:report.unknown===9?'nepotvrđeno':`${report.score}/9`,message:checkerMailSummary({url:clean,hostname,score:report.score,unknown_count:report.unknown,checks_json:checksJson,discovered_urls_json:urlsJson,checked_at:now.toISOString()})+'\n\nAnonimna provjera — e-mail posjetitelja nije prikupljen.'}})]:[]),
    ])
    return id
  }catch{
    // A missing migration/storage outage must not break the registration-free checker.
    console.error('checker_history_write_failed')
    return null
  }
}
