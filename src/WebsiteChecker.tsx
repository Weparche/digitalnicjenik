import { useEffect,useRef,useState } from 'react'
import { IconArrowRight,IconCircleCheckFilled,IconWorld } from '@tabler/icons-react'
import { normalizeWebsiteInput,technicalReport,type WebsiteCheckResult } from '../shared/website-check'
import { readAcquisitionTouch } from './acquisition'
import { WebsiteCheckResultPanel } from './WebsiteCheckResult'

const loadingCopy=['Otvaramo vašu web stranicu…','Tražimo javni digitalni cjenik…','Provjeravamo dostupne CSV/XML datoteke…','Analiziramo javno dostupne podatke…']
export function WebsiteChecker({initialUrl='',autoRun=false,fromLanding=false,onUpload}:{initialUrl?:string;autoRun?:boolean;fromLanding?:boolean;onUpload:()=>void}){
  const [url,setUrl]=useState(initialUrl),[checkedUrl,setCheckedUrl]=useState(''),[error,setError]=useState('')
  const [result,setResult]=useState<WebsiteCheckResult|null>(null),[checking,setChecking]=useState(false),[phase,setPhase]=useState(0),[cancelled,setCancelled]=useState(false)
  const request=useRef<AbortController|null>(null),anchor=useRef<HTMLDivElement|null>(null),input=useRef<HTMLInputElement|null>(null),stop=useRef(false)
  const landingRequest=useRef(fromLanding)
  async function check(event?:React.FormEvent){
    event?.preventDefault();if(request.current)return
    let normalized:string
    try{normalized=normalizeWebsiteInput(url)}catch{setError('Unesite ispravnu adresu, primjerice vasweb.hr.');input.current?.focus();return}
    const controller=new AbortController();request.current=controller;stop.current=false
    setChecking(true);setResult(null);setError('');setCancelled(false);setCheckedUrl(normalized);setPhase(0)
    const timer=setTimeout(()=>controller.abort(),45_000)
    try{
      const source=landingRequest.current?'landing':'dashboard';landingRequest.current=false
      const response=await fetch('/api/digitalni-cjenik/check',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:normalized,attribution:readAcquisitionTouch(),source}),signal:controller.signal})
      const data=await response.json() as WebsiteCheckResult
      if(!data||!['green','yellow','red','unavailable'].includes(data.status))throw new Error('invalid_response')
      if(!stop.current)setResult(data)
    }catch{if(!stop.current)setResult({status:'unavailable',message:'Provjeru trenutačno nije moguće dovršiti. Pokušajte ponovno ili učitajte datoteku za detaljnu provjeru.'})}
    finally{clearTimeout(timer);request.current=null;setChecking(false)}
  }
  useEffect(()=>{
    const params=new URL(window.location.href);params.searchParams.delete('url');params.searchParams.delete('check');params.searchParams.delete('from');window.history.replaceState({},'',params.pathname+params.search)
    const timer=autoRun&&initialUrl?setTimeout(()=>void check(),0):null
    return()=>{if(timer)clearTimeout(timer);stop.current=true;request.current?.abort()}
  },[])
  useEffect(()=>{if(!checking)return;const timer=setInterval(()=>setPhase(value=>(value+1)%loadingCopy.length),2400);return()=>clearInterval(timer)},[checking])
  useEffect(()=>{if(result){anchor.current?.scrollIntoView({block:'start',behavior:'instant'});anchor.current?.focus({preventScroll:true})}},[result])
  const report=result?technicalReport(result):null
  return <div className="workspace-checker acquisition">
    <section className="workspace-surface"><h2>Provjerite digitalni cjenik na svojem webu</h2><p>Unesite web adresu ili izravni CSV/XML link. Dobit ćete istih devet tehničkih provjera kao na početnoj stranici.</p>
      <form className="acq-form" onSubmit={check} noValidate aria-busy={checking}><label className="sr-only" htmlFor="workspace-check-url">Adresa web stranice</label><div className="acq-input"><IconWorld size={23}/><input ref={input} id="workspace-check-url" inputMode="url" autoComplete="url" autoCapitalize="none" spellCheck={false} maxLength={2048} value={url} onChange={event=>{setUrl(event.target.value);setError('')}} aria-invalid={Boolean(error)} aria-describedby={error?'workspace-check-error':undefined} placeholder="https://vasweb.hr"/></div><button className="acq-primary" type="submit" disabled={checking}>{checking?'Provjeravamo…':'Provjeri besplatno'}<IconArrowRight size={22}/></button></form>
      {error&&<p id="workspace-check-error" role="alert" className="acq-error">{error}</p>}
      <div className="acq-loading" role="status" aria-live="polite">{checking?<><span className="acq-spinner" aria-hidden="true"/>{loadingCopy[phase]}<small>Provjera je u tijeku. Rezultate prikazujemo po završetku dohvata.</small><button className="acq-cancel" type="button" onClick={()=>{stop.current=true;request.current?.abort();setCancelled(true);input.current?.focus()}}>Odustani od provjere</button></>:cancelled?'Provjera je zaustavljena. Možete pokušati ponovno.':null}</div>
      <ul className="acq-trust">{['Bez registracije','Potpuno besplatno'].map(text=><li key={text}><IconCircleCheckFilled size={18}/>{text}</li>)}</ul>
    </section>
    <div className="acq-result-anchor" ref={anchor} tabIndex={-1} aria-label="Rezultat provjere"><span className="sr-only" role="status">{report?`Rezultat: ${report.score} potvrđenih od 9 tehničkih provjera; ${report.unknown} nije moguće potvrditi.`:''}</span>{result&&<WebsiteCheckResultPanel result={result} website={checkedUrl} onRetry={()=>void check()} onUpload={onUpload}/>}</div>
  </div>
}
