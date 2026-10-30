import type { AuthEnv } from '../../_auth'
import { requireAdmin,opsError,OPS_HEADERS } from '../../_admin-auth'
import { entitlementAccess } from '../../../shared/entitlements'
import { mapEntitlement,type EntitlementRow } from '../../../shared/lifecycle'
import { AccessDeniedError } from '../../_write-auth'
import { checkerRunCounts } from '../../_checker-history'

export const onRequestGet=async({request,env}:{request:Request;env:AuthEnv})=>{
  try {
    await requireAdmin(request,env)
    if(!env.DB) throw new AccessDeniedError(503,'db_unavailable','Baza nije dostupna.')
    const db=env.DB
    const url=new URL(request.url)
    const q='%'+(url.searchParams.get('q')??'').trim().toLowerCase().slice(0,120)+'%'
    const offset=Math.max(0,Math.min(100000,Number(url.searchParams.get('page'))||0))*50
    const selectedReference=url.searchParams.get('order')
    const selectedOrder=selectedReference?await db.prepare('SELECT t.slug FROM payment_orders o JOIN tenants t ON t.id=o.tenant_id WHERE o.reference=?').bind(selectedReference).first<{slug:string}>():null
    const slug=url.searchParams.get('tenant')??selectedOrder?.slug??null
    const tenants=await db.prepare(`SELECT t.id,t.slug,t.name,e.id AS entitlement_id,e.plan,e.status,e.period_start,e.period_end,e.paid_confirmed_at,e.grace_until,
      (SELECT email FROM auth_users u JOIN tenant_members m ON u.id=m.user_id WHERE m.tenant_id=t.id ORDER BY m.created_at LIMIT 1) AS owner_email,
      (SELECT COUNT(*) FROM price_publications WHERE tenant_id=t.id) AS publication_count,
      p.published_at,p.sequence,json_array_length(p.payload_json,'$.items') AS item_count,
      (SELECT overall FROM monitor_runs WHERE tenant_id=t.id ORDER BY checked_at DESC LIMIT 1) AS monitor_overall,
      (SELECT checked_at FROM monitor_runs WHERE tenant_id=t.id ORDER BY checked_at DESC LIMIT 1) AS monitor_checked_at,
      (SELECT MAX(payment_reported_at) FROM payment_orders WHERE tenant_id=t.id AND status='pending') AS reported_at,
      (SELECT COUNT(*) FROM payment_orders WHERE tenant_id=t.id AND status='pending') AS pending_orders
      FROM tenants t LEFT JOIN entitlements e ON e.id=(SELECT id FROM entitlements WHERE tenant_id=t.id ORDER BY created_at DESC LIMIT 1)
      LEFT JOIN price_publications p ON p.tenant_id=t.id AND p.is_current=1
      WHERE (? IS NULL OR t.slug=?) AND (lower(t.name) LIKE ? OR lower(t.slug) LIKE ? OR EXISTS(SELECT 1 FROM auth_users u JOIN tenant_members m ON m.user_id=u.id WHERE m.tenant_id=t.id AND lower(u.email) LIKE ?) OR EXISTS(SELECT 1 FROM payment_orders o WHERE o.tenant_id=t.id AND lower(o.reference) LIKE ?))
      ORDER BY (reported_at IS NULL),(pending_orders=0),CASE monitor_overall WHEN 'fail' THEN 0 WHEN 'warn' THEN 1 ELSE 2 END,(e.period_end IS NULL),e.period_end,t.slug LIMIT 50 OFFSET ?`).bind(slug,slug,q,q,q,q,offset).all<Record<string,unknown>>()
    const tenantViews=tenants.results.map(row=>({ ...row,id:String(row.id),slug:String(row.slug),name:String(row.name),access:entitlementAccess(row.entitlement_id?mapEntitlement({...row,id:row.entitlement_id,tenant_id:row.id} as EntitlementRow):null),public_url:`/c/${row.slug}` }))
    const orders=await db.prepare(`SELECT o.*,t.slug,t.name,(SELECT u.email FROM auth_users u JOIN tenant_members m ON m.user_id=u.id WHERE m.tenant_id=t.id ORDER BY m.created_at LIMIT 1) AS owner_email
      FROM payment_orders o JOIN tenants t ON t.id=o.tenant_id
      WHERE (? IS NULL OR t.slug=?) AND (lower(t.name) LIKE ? OR lower(t.slug) LIKE ? OR lower(o.reference) LIKE ? OR lower(o.email) LIKE ?)
      ORDER BY (o.reference IS NOT ?),CASE WHEN o.status='pending' AND o.payment_reported_at IS NOT NULL THEN 0 WHEN o.status='pending' THEN 1 WHEN o.status='paid' THEN 2 ELSE 3 END,o.created_at DESC LIMIT 50 OFFSET ?`).bind(slug,slug,q,q,q,q,selectedReference,offset).all()
    const annual=(await db.prepare("SELECT * FROM entitlements WHERE plan!='validator' AND tenant_id NOT IN (SELECT id FROM tenants WHERE slug=?)").bind(env.DEMO_WRITE_TENANT||'nepar').all<EntitlementRow>()).results
    const summary:Record<string,number>={trial:0,web_link:0,publisher_self_service:0,managed:0,grace:0,expired:0,expiring:0,suspended:0,pending:0,reported:0,monitorProblems:0}
    for(const row of annual) {
      const access=entitlementAccess(mapEntitlement(row))
      if(access.state==='active') summary[row.plan]++
      else if(access.state in summary) summary[access.state]++
      if(access.live&&row.period_end&&Date.parse(row.period_end)>Date.now()&&Date.parse(row.period_end)<=Date.now()+7*86_400_000) summary.expiring++
    }
    const paymentCounts=await db.prepare("SELECT COUNT(*) AS pending,SUM(payment_reported_at IS NOT NULL) AS reported FROM payment_orders WHERE status='pending'").first<{pending:number;reported:number}>()
    summary.pending=paymentCounts?.pending??0;summary.reported=paymentCounts?.reported??0
    const problems=await db.prepare("SELECT COUNT(*) AS n FROM monitor_state WHERE last_overall IN ('warn','fail')").first<{n:number}>()
    summary.monitorProblems=problems?.n??0
    const checker=await checkerRunCounts(db)
    summary.checksToday=checker?.today??0;summary.checks7days=checker?.last7days??0;summary.checksTotal=checker?.total??0
    const requests=await db.prepare(`SELECT id,'tenant' AS source,tenant_id,intent AS kind,requester_email AS email,message,service,template_id,workflow_status AS state,created_at FROM upgrade_requests ORDER BY created_at DESC LIMIT 50`).all()
    const leads=await db.prepare('SELECT *,\'lead\' AS source,status AS state FROM lead_inquiries ORDER BY created_at DESC LIMIT 50').all()
    let detail:Record<string,unknown>|null=null
    const tenant=slug?tenantViews.find(row=>row.slug===slug):null
    if(tenant) {
      const [metadata,publications,audit,nextMail,deliveries]=await Promise.all([
        db.prepare('SELECT * FROM publication_metadata WHERE tenant_id=?').bind(tenant.id).first(),
        db.prepare('SELECT id,sequence,filename_stem,published_at,is_current,public_until FROM price_publications WHERE tenant_id=? ORDER BY sequence DESC LIMIT 50').bind(tenant.id).all(),
        db.prepare('SELECT action,actor_email,actor_type,reason,old_json,new_json,created_at FROM admin_audit WHERE tenant_id=? ORDER BY created_at DESC LIMIT 5').bind(tenant.id).all(),
        db.prepare("SELECT event_type,scheduled_at,status FROM lifecycle_events WHERE tenant_id=? AND status IN ('pending','processing','attention') ORDER BY scheduled_at LIMIT 1").bind(tenant.id).first(),
        db.prepare('SELECT e.event_type,d.recipient,d.status,d.sent_at,d.attempted_at,d.provider_status FROM lifecycle_deliveries d JOIN lifecycle_events e ON e.id=d.event_id WHERE e.tenant_id=? ORDER BY COALESCE(d.sent_at,d.attempted_at) DESC LIMIT 5').bind(tenant.id).all(),
      ])
      detail={...tenant,metadata,publications:publications.results,audit:audit.results,nextMail,deliveries:deliveries.results}
    }
    return Response.json({summary,tenants:tenantViews,orders:orders.results,requests:[...requests.results,...leads.results],detail,page:offset/50},{headers:OPS_HEADERS})
  } catch(error) {return opsError(error)}
}
