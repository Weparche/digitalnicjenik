import type { D1DatabaseLike } from '../../_repository'
export const onRequestPost=async({request,env}:{request:Request;env:{DB?:D1DatabaseLike}})=>{
 const headers={'cache-control':'no-store'}
 if(request.headers.get('origin')!==new URL(request.url).origin)return new Response(null,{status:403,headers})
 if(!env.DB)return new Response(null,{status:204,headers})
 try{
   const length=Number(request.headers.get('content-length')||0);if(length>512)return new Response(null,{status:413,headers})
   const raw=await request.text();if(raw.length>512)return new Response(null,{status:413,headers})
   const {runId,event}=JSON.parse(raw)
   if(typeof runId!=='string'||!/^[0-9a-f-]{36}$/i.test(runId)||!['upload_click','upload','order'].includes(event))return new Response(null,{status:400,headers})
   await env.DB.prepare('INSERT OR IGNORE INTO checker_interactions(run_id,event,created_at) SELECT id,?,? FROM checker_runs WHERE id=? AND is_internal=0 AND checked_at>=?').bind(event,new Date().toISOString(),runId,new Date(Date.now()-86_400_000).toISOString()).run()
 }catch{/* client-side telemetry, not a transaction */}
 return new Response(null,{status:204,headers})
}
