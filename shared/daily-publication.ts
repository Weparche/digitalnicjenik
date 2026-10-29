import { createDraft, publishDraft, readCurrentPublication, readEntitlement, readMetadataForSlug, type RuntimeEnv } from '../functions/_repository'
import { entitlementIsLive } from './entitlements'
import { usesProductStructure } from '../src/price-engine/profile'
import { createFilenameStemPrefix } from '../src/price-engine/filename'
import { lifecycleStatement } from './lifecycle'

export type DailyEnv = Omit<RuntimeEnv,'DRAFTS'> & { DB: NonNullable<RuntimeEnv['DB']> }
function local(date:Date,timeZone:string) {
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(v=>[v.type,v.value]))
  return {day:`${p.year}-${p.month}-${p.day}`,minutes:Number(p.hour)*60+Number(p.minute)}
}
export async function dailyPublication(env:DailyEnv,slug:string,now=new Date(),watchdog:boolean|'force'=false) {
  if(env.DAILY_PUBLICATION_ENABLED!=='true') return {status:'disabled'}
  const entitlement=await readEntitlement(env,slug)
  if(!entitlementIsLive(entitlement,now.getTime())) return {status:'not_live'}
  const current=await readCurrentPublication(env,slug)
  if(!current||!usesProductStructure(current.payload)) return {status:'services'}
  const metadata=await readMetadataForSlug(env,slug)
  if(!metadata) return {status:'no_metadata'}
  const time=local(now,metadata.timezone)
  const weekday=new Date(`${time.day}T12:00:00Z`).getUTCDay()
  if(!(metadata.workingDays??[1,2,3,4,5]).includes(weekday)||(metadata.closedDates??[]).includes(time.day)) return {status:'closed'}
  if(local(new Date(current.publishedAt),metadata.timezone).day===time.day) return {status:'already_published'}
  if(watchdog) {
    if(watchdog!=='force'&&time.minutes!==435) return {status:'outside_watchdog'}
    for(const audience of ['owner','ops'] as const) await lifecycleStatement(env.DB,{id:`daily:${current.tenantId}:${time.day}:failed:${audience}`,tenantId:current.tenantId,type:'daily_publish_failed',audience,payload:{day:time.day,message:'Današnja automatska objava još nije potvrđena. Provjerite objavu u dashboardu.'}}).run()
    return {status:'alerted'}
  }
  if(time.minutes<390||time.minutes>=480) return {status:'outside_window'}
  const jobId=`daily:${current.tenantId}:${time.day}`
  const stamp=now.toISOString()
  await env.DB.prepare('INSERT OR IGNORE INTO daily_publication_jobs(id,tenant_id,publication_day,created_at,updated_at) VALUES (?,?,?,?,?)').bind(jobId,current.tenantId,time.day,stamp,stamp).run()
  const token=crypto.randomUUID()
  const claim=await env.DB.prepare("UPDATE daily_publication_jobs SET status='running',attempts=attempts+1,lease_token=?,lease_until=?,updated_at=? WHERE id=? AND status IN ('pending','failed','running') AND (lease_until IS NULL OR lease_until<?)").bind(token,new Date(now.getTime()+120_000).toISOString(),stamp,jobId,stamp).run()
  if(!claim.meta?.changes) return {status:'busy'}
  try {
    // Unpublished object metadata must never slip into an automated publication.
    const metaRow=await env.DB.prepare('SELECT updated_at FROM publication_metadata WHERE tenant_id=?').bind(current.tenantId).first<{updated_at:string}>()
    if((metaRow&&Date.parse(metaRow.updated_at)>Date.parse(current.publishedAt))||!current.filenameStem.startsWith(createFilenameStemPrefix(metadata)+'_')) throw new Error('Objavite spremljene podatke objekta prije automatske objave.')
    const draft=await createDraft(env,slug,{...current.payload,updatedAt:stamp},'automatska-dnevna-objava','daily-publication')
    if(!draft.draft||draft.validation.blockingCount) throw new Error('Posljednja objava ne prolazi aktualnu validaciju.')
    await env.DB.prepare('UPDATE price_uploads SET base_publication_id=?,base_metadata_updated_at=? WHERE id=?').bind(current.id,metaRow?.updated_at??null,draft.draft.id).run()
    const result=await publishDraft(env,slug,draft.draft.id,false,{now,expectedCurrentId:current.id})
    await env.DB.prepare("UPDATE daily_publication_jobs SET status='completed',expected_publication_id=?,draft_id=?,lease_token=NULL,lease_until=NULL,updated_at=? WHERE id=? AND lease_token=?").bind(current.id,draft.draft.id,stamp,jobId,token).run()
    return {status:'published',publication:result.publication}
  } catch(error) {
    await env.DB.prepare("UPDATE daily_publication_jobs SET status='failed',error=?,lease_token=NULL,lease_until=NULL,updated_at=? WHERE id=? AND lease_token=?").bind(error instanceof Error?error.message:'daily_publish_failed',stamp,jobId,token).run()
    throw error
  }
}
