import type { MonitorRunRecord } from './compliance/types'
import { lifecycleStatement,type LifecycleEnv } from './lifecycle'

/** Incident identity survives cron jobs; it is not a monitor job/delivery ID. */
export async function recordMonitorNotifications(env:LifecycleEnv,run:MonitorRunRecord,tenant:{id:string;name:string}) {
  const problems=run.issues.filter(issue=>issue.severity==='fail'||issue.code==='PUBLIC_PAGE_UNCONFIRMED')
  const unconfirmed=problems.some(issue=>issue.code==='PUBLIC_PAGE_UNCONFIRMED'||(issue.code==='FEED_HTTP_ERROR'&&(run.csvStatus===null||run.xmlStatus===null)))
  const kind=unconfirmed?'unconfirmed':problems.some(issue=>issue.code==='PUBLIC_PAGE_UNAVAILABLE')?'public_unavailable':problems.some(issue=>issue.code==='FEED_HTTP_ERROR')?'feed_unavailable':problems.length?'content_problem':null
  const open=(await env.DB.prepare('SELECT id,kind FROM monitor_incidents WHERE tenant_id=? AND resolved_at IS NULL').bind(tenant.id).all<{id:string;kind:string}>()).results
  if(kind) {
    await env.DB.prepare('INSERT OR IGNORE INTO monitor_incidents(id,tenant_id,kind,opened_at) VALUES (?,?,?,?)').bind(crypto.randomUUID(),tenant.id,kind,run.checkedAt).run()
    const incident=await env.DB.prepare('SELECT id FROM monitor_incidents WHERE tenant_id=? AND kind=? AND resolved_at IS NULL').bind(tenant.id,kind).first<{id:string}>()
    if(incident) await lifecycleStatement(env.DB,{id:`incident:${incident.id}:opened`,tenantId:tenant.id,type:'monitor_problem',entityId:incident.id,payload:{headline:unconfirmed?'Monitoring nije mogao potvrditi stanje cjenika':kind==='public_unavailable'?'Javni cjenik nije dostupan':kind==='feed_unavailable'?'CSV/XML cjenik nije dostupan':'Potrebna provjera objavljenog cjenika',message:problems.map(issue=>issue.message).join('\n')}}).run()
  } else if(run.overall==='ok') {
    for(const incident of open) await env.DB.batch([
      env.DB.prepare('UPDATE monitor_incidents SET resolved_at=? WHERE id=? AND resolved_at IS NULL').bind(run.checkedAt,incident.id),
      lifecycleStatement(env.DB,{id:`incident:${incident.id}:recovery`,tenantId:tenant.id,type:'monitor_recovery',entityId:incident.id,payload:{message:'Posljednja provjera ponovno je potvrdila dostupnost i podržani sadržaj cjenika.'}}),
    ])
  }
}
