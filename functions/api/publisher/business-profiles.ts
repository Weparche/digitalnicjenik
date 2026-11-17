import { resolveSession,type AuthEnv } from '../../_auth'
import { isValidOib } from '../../../shared/business-profile'
const headers={'cache-control':'no-store'}
type ProfileRow={id:string;name:string;merchant_type:'legal'|'natural';merchant_identifier:string;address:string;billing_oib:string|null}
function present(row:ProfileRow){return {id:row.id,name:row.name,merchantType:row.merchant_type,merchantIdentifier:row.merchant_identifier,address:row.address,billingOib:row.billing_oib}}
export async function onRequestGet({request,env}:{request:Request;env:AuthEnv}){
  const session=await resolveSession(env,request)
  if(!session)return Response.json({error:'unauthorized'},{status:401,headers})
  if(!env.DB)return Response.json({error:'unavailable'},{status:503,headers})
  const rows=await env.DB.prepare('SELECT id,name,merchant_type,merchant_identifier,address,billing_oib FROM publisher_business_profiles WHERE user_id=? ORDER BY name COLLATE NOCASE').bind(session.user.id).all<ProfileRow>()
  return Response.json({profiles:rows.results.map(present)},{headers})
}
export async function onRequestPost({request,env}:{request:Request;env:AuthEnv}){
  if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'invalid_origin'},{status:403,headers})
  const session=await resolveSession(env,request)
  if(!session)return Response.json({error:'unauthorized'},{status:401,headers})
  if(!env.DB)return Response.json({error:'unavailable'},{status:503,headers})
  const input=await request.json().catch(()=>null) as Record<string,unknown>|null
  const name=typeof input?.name==='string'?input.name.trim():''
  const type=input?.merchantType
  const identifier=typeof input?.merchantIdentifier==='string'?input.merchantIdentifier.trim():''
  const address=typeof input?.address==='string'?input.address.trim():''
  const oib=typeof input?.billingOib==='string'?input.billingOib.trim():''
  if(name.length<2||name.length>120||address.length>240||!(type==='legal'||type==='natural')||
    !(type==='legal'?isValidOib(identifier):/^[0-9]{5,15}$/.test(identifier))||(oib&&!isValidOib(oib))||(type==='legal'&&oib&&oib!==identifier))
    return Response.json({error:'Provjerite naziv, identifikator trgovca i OIB.'},{status:400,headers})
  const now=new Date().toISOString()
  await env.DB.prepare(`INSERT INTO publisher_business_profiles(id,user_id,name,merchant_type,merchant_identifier,address,billing_oib,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,merchant_type,merchant_identifier) DO UPDATE SET name=excluded.name,address=excluded.address,billing_oib=excluded.billing_oib,updated_at=excluded.updated_at`)
    .bind(crypto.randomUUID(),session.user.id,name,type,identifier,address,type==='legal'?identifier:oib||null,now,now).run()
  const row=await env.DB.prepare('SELECT id,name,merchant_type,merchant_identifier,address,billing_oib FROM publisher_business_profiles WHERE user_id=? AND merchant_type=? AND merchant_identifier=?').bind(session.user.id,type,identifier).first<ProfileRow>()
  if(!row)return Response.json({error:'Spremanje nije uspjelo.'},{status:500,headers})
  return Response.json({profile:present(row)},{headers})
}
