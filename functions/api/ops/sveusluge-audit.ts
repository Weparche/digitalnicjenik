import { requireAdmin, opsError, OPS_HEADERS } from '../../_admin-auth'
import type { AuthEnv } from '../../_auth'
import type { D1DatabaseLike } from '../../_repository'
import { recordCheckerRun } from '../../_checker-history'
import { normalizeDigitalPriceListUrl, runDigitalPriceListCheck } from '../digitalni-cjenik/check'
import { technicalReport } from '../../../shared/website-check'

type Env = AuthEnv & NonNullable<Parameters<typeof runDigitalPriceListCheck>[1]> & { SVEUSLUGE_AUDIT_DB?: D1DatabaseLike }
type Candidate = { host: string; last_probe_at: string; last_status: number }
type Run = { id: string; hostname: string; checked_at: string; score: number | null; status: string; unknown_count: number; checks_json: string; discovered_urls_json: string }
const ELIGIBLE = "state = 'NONE' AND lists = 0 AND last_status BETWEEN 200 AND 299 AND last_probe_at >= ?"
const MAX_CANDIDATES = 100
const RECENCY_MS = 7 * 86400000

export function auditCutoff(now = new Date()) { return new Date(now.getTime() - RECENCY_MS).toISOString() }

export function auditHostname(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 253 || !/^[a-z0-9.-]+$/i.test(raw)) return null
  try {
    const url = normalizeDigitalPriceListUrl('https://' + raw)
    return url.hostname === raw.toLowerCase() ? url.hostname : null
  } catch { return null }
}

function reply(body: unknown, status = 200) { return Response.json(body, { status, headers: OPS_HEADERS }) }
function report(run: Run | undefined) {
  if (!run) return null
  return { id: run.id, checkedAt: run.checked_at, score: run.score, status: run.status, unknownCount: run.unknown_count,
    checks: JSON.parse(run.checks_json), discoveredUrls: JSON.parse(run.discovered_urls_json) }
}

/** Authenticated technical inventory. Never exports names, email addresses or phone numbers. */
export async function onRequestGet({request,env}: {request:Request;env:Env}) {
  try {
    await requireAdmin(request,env)
    const source = env.SVEUSLUGE_AUDIT_DB, db = env.DB
    if (!source || !db) return reply({error:'audit_storage_unavailable'},503)
    const cutoff = auditCutoff()
    const count = await source.prepare('SELECT COUNT(*) AS total FROM domains WHERE '+ELIGIBLE).bind(cutoff).first<{total:number}>()
    const rows = await source.prepare('SELECT host,last_probe_at,last_status FROM domains WHERE '+ELIGIBLE+' ORDER BY last_probe_at DESC,host LIMIT ?').bind(cutoff,MAX_CANDIDATES).all<Candidate>()
    const candidates = rows.results.filter(row => auditHostname(row.host) !== null)
    const latest = new Map<string, Run>()
    if (candidates.length) {
      const marks = candidates.map(()=>'?').join(',')
      const runs = await db.prepare('SELECT id,hostname,checked_at,score,status,unknown_count,checks_json,discovered_urls_json FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY hostname ORDER BY checked_at DESC,id DESC) AS rn FROM checker_runs WHERE hostname IN ('+marks+')) WHERE rn=1').bind(...candidates.map(row=>row.host)).all<Run>()
      for (const run of runs.results) latest.set(run.hostname,run)
    }
    return reply({source:'sveusluge', eligibleCount:count?.total??0, maxCandidates:MAX_CANDIDATES,
      note:'NONE is crawler evidence only; it is not a determination of legal compliance. Technical results require interpretation.',
      candidates:candidates.map(row=>({host:row.host,crawlerCheckedAt:row.last_probe_at,crawlerHttpStatus:row.last_status,checker:report(latest.get(row.host))}))})
  } catch(error) { return opsError(error) }
}

/** Manual single-domain audit only. Reuses the real Checker and its SSRF guards; no outbound messages. */
export async function onRequestPost({request,env}: {request:Request;env:Env}) {
  try {
    await requireAdmin(request,env)
    const source=env.SVEUSLUGE_AUDIT_DB, db=env.DB
    if(!source||!db) return reply({error:'audit_storage_unavailable'},503)
    const body=await request.json().catch(()=>null) as {host?:unknown}|null
    const host=auditHostname(body?.host)
    if(!host) return reply({error:'invalid_host'},400)
    const cutoff=auditCutoff()
    const candidate=await source.prepare('SELECT host,last_probe_at,last_status FROM domains WHERE host=? AND '+ELIGIBLE).bind(host,cutoff).first<Candidate>()
    if(!candidate) return reply({error:'not_eligible'},404)
    const previous=await db.prepare('SELECT id,hostname,checked_at,score,status,unknown_count,checks_json,discovered_urls_json FROM checker_runs WHERE hostname=? AND checked_at>=? ORDER BY checked_at DESC,id DESC LIMIT 1').bind(host,cutoff).first<Run>()
    if(previous) return reply({host,reused:true,checker:report(previous)})
    const url='https://'+host+'/'
    const result=await runDigitalPriceListCheck(url,env)
    const id=await recordCheckerRun(db,url,result,null,'dashboard',new Date(),true)
    if(!id) return reply({error:'audit_history_write_failed'},503)
    return reply({host,reused:false,checker:{id,status:result.status,...technicalReport(result)}})
  } catch(error) { return opsError(error) }
}
