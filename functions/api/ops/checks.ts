import type { AuthEnv } from '../../_auth'
import { requireAdmin,opsError,OPS_HEADERS } from '../../_admin-auth'
import { AccessDeniedError } from '../../_write-auth'
import { zagrebTime } from '../../../shared/zagreb-time'
import { checkerRunCounts } from '../../_checker-history'

export const onRequestGet=async({request,env}:{request:Request;env:AuthEnv})=>{
  try{
    await requireAdmin(request,env)
    if(!env.DB)throw new AccessDeniedError(503,'db_unavailable','Baza nije dostupna.')
    const params=new URL(request.url).searchParams
    const q=(params.get('q')??'').trim().toLowerCase().slice(0,120)
    const page=Math.max(0,Math.min(100000,Math.floor(Number(params.get('page'))||0)))
    const where=['1=1'],values:unknown[]=[]
    if(q){where.push('r.hostname LIKE ?');values.push('%'+q.replace(/[\\%_]/g,'\\$&')+'%');where[where.length-1]+=" ESCAPE '\\'"}
    const scope=params.get('scope');if(scope==='public')where.push('r.is_internal=0');else if(scope==='internal')where.push('r.is_internal=1');
    const score=params.get('score')
    if(score==='incomplete')where.push('r.score<9')
    else if(score!==null&&/^[0-9]$/.test(score)){where.push('r.score=?');values.push(Number(score))}
    // Convert local day boundaries to UTC once, with the existing DST-aware helper.
    for(const key of ['from','to'] as const){const date=params.get(key);if(date){try{const boundary=key==='from'?zagrebTime(date,0):zagrebTime(new Date(Date.parse(date+'T12:00:00Z')+86_400_000).toISOString().slice(0,10),0);zagrebTime(date,0);where.push(key==='from'?'r.checked_at>=?':'r.checked_at<?');values.push(boundary)}catch{throw new AccessDeniedError(400,'invalid_date','Unesite valjan datum.')}}}
    const rows=await env.DB.prepare(`SELECT r.*,l.email AS lead_email,(SELECT count(*) FROM checker_runs t WHERE replace(t.hostname,'www.','')=replace(r.hostname,'www.','') AND t.is_internal=r.is_internal) AS domain_runs,(SELECT p.score FROM checker_runs p WHERE p.hostname=r.hostname AND p.is_internal=r.is_internal AND (p.checked_at<r.checked_at OR (p.checked_at=r.checked_at AND p.id<r.id)) ORDER BY p.checked_at DESC,p.id DESC LIMIT 1) AS previous_score,(SELECT group_concat(event) FROM checker_interactions e WHERE e.run_id=r.id) AS interactions FROM checker_runs r LEFT JOIN lead_inquiries l ON l.id=r.lead_id WHERE ${where.join(' AND ')} ORDER BY r.checked_at DESC,r.id DESC LIMIT 51 OFFSET ?`).bind(...values,page*50).all<Record<string,unknown>>()
    const counts=await checkerRunCounts(env.DB)
    const domains=await env.DB.prepare(`WITH scoped AS (SELECT *, CASE WHEN hostname LIKE 'www.%' THEN substr(hostname,5) ELSE hostname END AS domain FROM checker_runs WHERE is_internal=0), ranked AS (SELECT *,row_number() OVER(PARTITION BY domain ORDER BY checked_at DESC,id DESC) rn,count(*) OVER(PARTITION BY domain) n FROM scoped) SELECT domain,n AS checks,score,checked_at,coalesce(json_extract(acquisition_json,'$.utm_source'),'nepoznat') AS source FROM ranked WHERE rn=1 AND n>1 ORDER BY n DESC,checked_at DESC LIMIT 20`).all<Record<string,unknown>>();
    const funnel=await env.DB.prepare(`SELECT COUNT(*) AS public_checks,COALESCE(SUM(lead_id IS NOT NULL),0) AS leads,COALESCE(SUM(EXISTS(SELECT 1 FROM checker_interactions e WHERE e.run_id=r.id AND e.event='upload')),0) AS uploads,COALESCE(SUM(EXISTS(SELECT 1 FROM checker_interactions e WHERE e.run_id=r.id AND e.event='order')),0) AS orders,COALESCE(SUM(EXISTS(SELECT 1 FROM checker_interactions e WHERE e.run_id=r.id AND e.event='upload_click')),0) AS upload_clicks FROM checker_runs r WHERE is_internal=0`).first();
    const sources=await env.DB.prepare(`SELECT coalesce(json_extract(acquisition_json,'$.utm_source'),'nepoznat') AS source,COUNT(*) AS checks,COALESCE(SUM(lead_id IS NOT NULL),0) AS leads FROM checker_runs WHERE is_internal=0 GROUP BY 1 ORDER BY 2 DESC LIMIT 20`).all<Record<string,unknown>>();
    return Response.json({domains:domains.results,funnel,sources:sources.results,runs:rows.results.slice(0,50).map(row=>({...row,checks:JSON.parse(String(row.checks_json)),discoveredUrls:JSON.parse(String(row.discovered_urls_json)),acquisition:row.acquisition_json?JSON.parse(String(row.acquisition_json)):null,checks_json:undefined,discovered_urls_json:undefined,acquisition_json:undefined})),page,hasMore:rows.results.length>50,summary:counts},{headers:OPS_HEADERS})
  }catch(error){return opsError(error)}
}
