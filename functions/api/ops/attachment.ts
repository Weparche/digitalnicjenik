import type { AuthEnv } from '../../_auth'
import { requireAdmin,opsError } from '../../_admin-auth'
export const onRequestGet=async({request,env}:{request:Request;env:AuthEnv})=>{
  try{
    await requireAdmin(request,env)
    const id=new URL(request.url).searchParams.get('inquiry')??''
    const row=await env.DB?.prepare('SELECT attachment_key,attachment_name,attachment_type FROM lead_inquiries WHERE id=?').bind(id).first<{attachment_key:string;attachment_name:string;attachment_type:string}>()
    const file=row?.attachment_key?await env.DRAFTS?.get(row.attachment_key):null
    if(!row||!file)return new Response('Not found',{status:404,headers:{'cache-control':'no-store'}})
    const bytes=Uint8Array.from(atob(await file.text()),char=>char.charCodeAt(0))
    return new Response(bytes,{headers:{'content-type':row.attachment_type||'application/octet-stream','content-disposition':`attachment; filename="${row.attachment_name.replace(/["\r\n]/g,'')}"`,'cache-control':'no-store','x-content-type-options':'nosniff'}})
  }catch(error){return opsError(error)}
}
