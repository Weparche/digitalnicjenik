import type { RuntimeEnv } from '../_repository'
import { readCheckerStatistics } from '../_checker-statistics'
const placeholder='<p>Automatski agregirani podaci učitavaju se iz produkcijske evidencije.</p>'
export const onRequestGet=async({env,next,request}:{env:RuntimeEnv;next:()=>Promise<Response>;request:Request})=>{
 const url=new URL(request.url)
 if(url.pathname==='/statistika-digitalnih-cjenika'){url.pathname+='/';return Response.redirect(url.toString(),301)}
 const response=await next()
 if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))return response
 try{
  const stats=await readCheckerStatistics(env)
  if(!stats.available)return response
  const html=await response.clone().text()
  if(!html.includes(placeholder))return response
  // Values are generated ISO dates and numeric SQL aggregates, never user input.
  const live='<p>Razdoblje: '+stats.from+' – '+stats.to+' (Europe/Zagreb).</p><ul class="news-bullets"><li><strong>'+stats.checks+'</strong> evidentiranih provjera</li><li><strong>'+stats.domains+'</strong> različitih hostnameova</li><li><strong>'+stats.machineConfirmed+'</strong> potvrđenih CSV/XML datoteka</li><li><strong>'+stats.machineNotConfirmed+'</strong> rezultata bez potvrđene datoteke (uključuje neuspješan dohvat)</li></ul>'
  const headers=new Headers(response.headers);for(const key of ['content-length','content-encoding','etag','last-modified'])headers.delete(key)
  headers.set('cache-control','public, max-age=3600')
  return new Response(html.replace(placeholder,live),{status:response.status,headers})
 }catch{return response}
}
