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
    const score=params.get('score')
    if(score==='incomplete')where.push('r.score<9')
    else if(score!==null&&/^[0-9]$/.test(score)){where.push('r.score=?');values.push(Number(score))}
    // Convert local day boundaries to UTC once, with the existing DST-aware helper.
    for(const key of ['from','to'] as const){const date=params.get(key);if(date){try{const boundary=key==='from'?zagrebTime(date,0):zagrebTime(new Date(Date.parse(date+'T12:00:00Z')+86_400_000).toISOString().slice(0,10),0);zagrebTime(date,0);where.push(key==='from'?'r.checked_at>=?':'r.checked_at<?');values.push(boundary)}catch{throw new AccessDeniedError(400,'invalid_date','Unesite valjan datum.')}}}
    const rows=await env.DB.prepare(`SELECT r.*,l.email AS lead_email FROM checker_runs r LEFT JOIN lead_inquiries l ON l.id=r.lead_id WHERE ${where.join(' AND ')} ORDER BY r.checked_at DESC,r.id DESC LIMIT 51 OFFSET ?`).bind(...values,page*50).all<Record<string,unknown>>()
    const counts=await checkerRunCounts(env.DB)
    return Response.json({runs:rows.results.slice(0,50).map(row=>({...row,checks:JSON.parse(String(row.checks_json)),discoveredUrls:JSON.parse(String(row.discovered_urls_json)),acquisition:row.acquisition_json?JSON.parse(String(row.acquisition_json)):null,checks_json:undefined,discovered_urls_json:undefined,acquisition_json:undefined})),page,hasMore:rows.results.length>50,summary:counts},{headers:OPS_HEADERS})
  }catch(error){return opsError(error)}
}
