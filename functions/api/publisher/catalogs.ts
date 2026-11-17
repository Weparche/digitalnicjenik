import { resolveSession, type AuthEnv } from '../../_auth'
import { entitlementAccess } from '../../../shared/entitlements'
import type { Entitlement } from '../../../src/price-engine/types'
import type { RuntimeEnv } from '../../_repository'

type Row = {
  id:string; slug:string; name:string; merchant_identifier:string|null; merchant_type:'legal'|'natural'|null;
  object_code:string|null; object_address:string|null; published_at:string|null; sequence:number|null;
  item_count:number|null; format_version:string|null; entitlement_id:string|null;
  plan:Entitlement['plan']|null; status:Entitlement['status']|null; period_start:string|null;
  period_end:string|null; paid_confirmed_at:string|null; grace_until:string|null;
}
const headers={'cache-control':'no-store'}
export async function onRequestGet({request,env}:{request:Request;env:AuthEnv & RuntimeEnv}){
  const session=await resolveSession(env,request)
  if(!session)return Response.json({error:'unauthorized'},{status:401,headers})
  if(!env.DB)return Response.json({error:'unavailable'},{status:503,headers})
  // Ownership is enforced by the join, never by a client supplied identifier.
  const rows=await env.DB.prepare(`SELECT t.id,t.slug,t.name,m.merchant_identifier,m.merchant_type,m.object_code,m.object_address,
    p.published_at,p.sequence,CASE WHEN p.id IS NULL THEN NULL ELSE json_array_length(p.payload_json,'$.items') END AS item_count,
    json_extract(p.payload_json,'$.formatVersion') AS format_version,
    e.id AS entitlement_id,e.plan,e.status,e.period_start,e.period_end,e.paid_confirmed_at,e.grace_until
    FROM tenant_members tm JOIN tenants t ON t.id=tm.tenant_id
    LEFT JOIN publication_metadata m ON m.tenant_id=t.id
    LEFT JOIN price_publications p ON p.tenant_id=t.id AND p.is_current=1
    LEFT JOIN entitlements e ON e.id=(SELECT id FROM entitlements WHERE tenant_id=t.id ORDER BY created_at DESC LIMIT 1)
    WHERE tm.user_id=? ORDER BY t.name COLLATE NOCASE,t.slug`).bind(session.user.id).all<Row>()
  return Response.json({catalogs:rows.results.map(row=>{
    const entitlement:Entitlement|null=row.entitlement_id&&row.plan&&row.status?{id:row.entitlement_id,tenantId:row.id,plan:row.plan,status:row.status,periodStart:row.period_start,periodEnd:row.period_end,paidConfirmedAt:row.paid_confirmed_at,graceUntil:row.grace_until}:null
    const access=entitlementAccess(entitlement)
    return {id:row.id,slug:row.slug,name:row.name,merchantIdentifier:row.merchant_identifier,merchantType:row.merchant_type,
      objectCode:row.object_code,objectAddress:row.object_address,publishedAt:row.published_at,sequence:row.sequence,itemCount:row.item_count,
      formatVersion:row.format_version,plan:row.plan,accessState:access.state,accessUntil:access.accessUntil,
      publicLive:Boolean(row.published_at&&(access.live||row.slug===(env.DEMO_WRITE_TENANT||'nepar')))}
  })},{headers})
}
