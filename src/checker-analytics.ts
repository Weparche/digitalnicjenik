/** Session-local checker attribution. No email, file content, checkout data or persistent visitor identifier. */
const KEY='nepar-checker-session-v3'
export function rememberCheckerRun(id?:string|null){try{if(id&&/^[0-9a-f-]{36}$/i.test(id))sessionStorage.setItem(KEY,JSON.stringify({id,at:Date.now()}));else sessionStorage.removeItem(KEY)}catch{/* private mode */}}
export function trackCheckerInteraction(event:'upload_click'|'upload'|'order'){try{const data=JSON.parse(sessionStorage.getItem(KEY)||'null');if(!data||Date.now()-data.at>24*60*60*1000)return;void fetch('/api/digitalni-cjenik/interaction',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({runId:data.id,event}),keepalive:true}).catch(()=>{})}catch{/* telemetry must never block user flow */}}
