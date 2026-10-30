import { useEffect,useRef,useState } from 'react'
import { IconArrowRight,IconCheck,IconMail } from '@tabler/icons-react'
import { TurnstileField } from './LeadForm'
import { useTurnstileSiteKey } from './turnstileConfig'
import { technicalReport,STATUS_LABELS } from '../shared/website-check'
import { PLANS,formatEur } from '../shared/pricing'
import { readAcquisitionTouch } from './acquisition'
import type { CheckerContactContext } from './WebsiteChecker'

export function WorkspaceContact({context,defaultEmail='',defaultName='',plan,templateId,initialWebsite='',relatedRunId,onCheck}:{context:CheckerContactContext|null;defaultEmail?:string;defaultName?:string;plan?:string|null;templateId?:string|null;initialWebsite?:string;relatedRunId?:string|null;onCheck:()=>void}){
  const [email,setEmail]=useState(defaultEmail),[name,setName]=useState(defaultName),[message,setMessage]=useState(''),[website,setWebsite]=useState(context?.website??initialWebsite)
  const [token,setToken]=useState(''),[state,setState]=useState<'idle'|'sending'|'sent'>('idle'),[error,setError]=useState('')
  const submission=useRef(crypto.randomUUID()),sentContext=useRef(context)
  const {siteKey,loading}=useTurnstileSiteKey()
  useEffect(()=>{if(context){setWebsite(context.website);if(context!==sentContext.current){setState('idle');submission.current=crypto.randomUUID();sentContext.current=context}}},[context])
  const report=context?technicalReport(context.result):null
  const selected=PLANS.find(item=>item.id===plan)
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setError('');if(!token){setError('Dovršite sigurnosnu provjeru pred slanjem.');return}
    setState('sending')
    const form=new FormData(event.currentTarget),touch=readAcquisitionTouch()
    form.set('submissionId',submission.current);form.set('cf-turnstile-response',token);form.set('intent',plan==='web'?'implementation':'consultation');form.set('platform','ne-znam');form.set('materials','web')
    form.set('context',JSON.stringify({workspaceContact:true,checkerRunId:context?.result.checkerRunId??relatedRunId,website:context?.website,checkerScore:report?.score,checkerStatus:context?.result.status,selectedPlan:selected?.id,templateId:templateId??undefined,discoveredUrls:[context?.result.details?.csvUrl,context?.result.details?.xmlUrl].filter(Boolean)}))
    if(touch)form.set('attribution',JSON.stringify(touch))
    try{const response=await fetch('/api/leads/digitalni-cjenik',{method:'POST',body:form});const data=await response.json() as {ok?:boolean};if(!response.ok||!data.ok)throw new Error();setState('sent')}
    catch{setError('Upit nije poslan. Pokušajte ponovno ili se javite na nepar@nepar.hr.');setState('idle');window.turnstile?.reset();setToken('')}
  }
  if(state==='sent')return <section className="workspace-surface workspace-contact-success" role="status"><IconCheck size={30}/><h2>Upit je poslan</h2><p>NEPAR je zaprimio vaš kontakt{context?' i povezanu analizu weba':''}. Odgovorit ćemo na {email}.</p><button className="workspace-button" type="button" onClick={onCheck}>Natrag na provjeru<IconArrowRight size={17}/></button></section>
  return <section className="workspace-surface workspace-contact" aria-labelledby="workspace-contact-title"><h2 id="workspace-contact-title">{selected?`Zatražite paket ${selected.name}`:context?'Pošaljite upit s rezultatom provjere':'Kako vam možemo pomoći?'}</h2><p>{context?'Adresa i rezultat automatski se prilažu upitu. Ostavite kontakt i kratko opišite što želite riješiti.':'Pišite nam o objavi cjenika, ugradnji ili novom webu.'}</p>{selected&&<p><strong>{selected.name} · {formatEur(selected.price,true)}</strong> — {selected.summary}</p>}
    {context&&report&&<div className="workspace-contact-analysis"><strong>{context.website}</strong><p>{report.unknown===9?'Provjeru nije bilo moguće dovršiti':`${report.score}/9 tehničkih provjera prolazi`}</p><details><summary>Analiza koja ide uz upit</summary><ul>{report.checks.map(check=><li key={check.id}>{check.label}: <strong>{STATUS_LABELS[check.status]}</strong></li>)}</ul></details></div>}
    <form onSubmit={submit} className="workspace-contact-form"><label>Ime ili naziv tvrtke<input name="name" required maxLength={120} autoComplete="name" value={name} onChange={event=>setName(event.target.value)}/></label><label>E-mail<input name="email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)}/></label><label>Web stranica<input name="website" type="url" maxLength={500} value={website} onChange={event=>setWebsite(event.target.value)} placeholder="https://vasweb.hr" readOnly={Boolean(context)}/></label><label>Poruka<textarea name="message" aria-label="Poruka" rows={4} maxLength={3000} value={message} onChange={event=>setMessage(event.target.value)} placeholder="Npr. trebam pomoć s objavom cjenika na svojem webu."/></label><TurnstileField onToken={setToken}/><label className="workspace-contact-privacy"><input name="privacy" type="checkbox" required/><span>Dopuštam obradu podataka radi odgovora na upit. <a href="/privatnost.html" target="_blank" rel="noreferrer">Privatnost</a></span></label>{error&&<p role="alert" className="app-error">{error}</p>}<button className="workspace-button workspace-contact-submit" type="submit" disabled={state==='sending'||loading||!siteKey}><IconMail size={18}/>{state==='sending'?'Šaljemo…':context?'Pošalji upit s analizom':'Pošalji upit'}</button></form><p className="workspace-contact-direct">Možete nam i izravno pisati na <a href="mailto:nepar@nepar.hr">nepar@nepar.hr</a>.</p>
  </section>
}
