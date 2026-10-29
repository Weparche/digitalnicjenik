import { useCallback,useEffect,useRef,useState } from 'react'
import { PublisherLogin,usePublisherSession } from './PublisherAuth'
import { PLANS,formatEur,installationPriceLabel } from '../shared/pricing'
import { formatCents,orderLabel,type OrderKind } from '../shared/payment'
import { zagrebEndOfDay } from '../shared/zagreb-time'
import './operations.css'

type Access={state:string;live:boolean;periodEnd:string|null;graceUntil:string|null;accessUntil:string|null}
type Tenant={id:string;slug:string;name:string;plan:string;status:string;period_start:string|null;period_end:string|null;owner_email:string|null;item_count:number|null;published_at:string|null;sequence:number|null;publication_count:number;monitor_overall:string|null;monitor_checked_at:string|null;pending_orders:number;reported_at:string|null;access:Access;public_url:string}
type Order={reference:string;slug:string;name:string;owner_email:string;kind:OrderKind;amount_cents:number;installation:number;status:string;created_at:string;payment_reported_at:string|null;billing_name:string;email:string}
type Detail=Tenant&{metadata:Record<string,unknown>|null;publications:Array<{id:string;sequence:number;filename_stem:string;published_at:string}>;audit:Array<{action:string;actor_email:string|null;reason:string;created_at:string}>;nextMail:{event_type:string;scheduled_at:string;status:string}|null;deliveries:Array<{event_type:string;recipient:string;status:string;sent_at:string|null;attempted_at:string|null}>}
type Inquiry={id:string;source:string;kind:string;email:string;message:string;state:string;template_id:string|null;tenant_id?:string}
type Data={summary:Record<string,number>;tenants:Tenant[];orders:Order[];requests:Inquiry[];detail:Detail|null;page:number}
const tabs=['Pregled','Provjere','Cjenici','Uplate','Upiti'] as const
type Tab=typeof tabs[number]
const time=(iso:string|null|undefined)=>iso?new Intl.DateTimeFormat('hr-HR',{timeZone:'Europe/Zagreb',dateStyle:'short',timeStyle:'short'}).format(new Date(iso)):'—'
const planName=(plan:string)=>plan==='managed'?PLANS[2].name:plan==='publisher_self_service'?PLANS[1].name:PLANS[0].name
const stateName:Record<string,string>={trial:'Besplatna objava',active:'Aktivan',grace:'Obnova čeka uplatu',expired:'Deaktiviran',suspended:'Suspendiran',none:'Bez licence'}

export function AdminPanel(){
  const {session,logout,error:authError}=usePublisherSession()
  const initial=new URLSearchParams(window.location.search)
  const selectedOrder=initial.get('order')
  const [tab,setTab]=useState<Tab>(()=>tabs.find(value=>value.toLowerCase()===initial.get('tab'))??'Pregled')
  const [q,setQ]=useState(initial.get('q')??'')
  const [filter,setFilter]=useState('all')
  const [slug,setSlug]=useState(initial.get('tenant')??'')
  const [page,setPage]=useState(0)
  const [data,setData]=useState<Data|null>(null)
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')
  const [busy,setBusy]=useState(false)
  const [updated,setUpdated]=useState('')
  const [action,setAction]=useState('extend')
  const [reason,setReason]=useState('')
  const [targetPlan,setTargetPlan]=useState('web_link')
  const [date,setDate]=useState('')
  const [quoteOpen,setQuoteOpen]=useState(false)
  const inFlight=useRef<AbortController|null>(null)
  const generation=useRef(0)
  const requestKeys=useRef(new Map<string,string>())
  const load=useCallback(async()=>{
    if(!session?.isAdmin)return
    inFlight.current?.abort()
    const controller=new AbortController();inFlight.current=controller
    const version=++generation.current
    const params=new URLSearchParams({q,page:String(page)})
    if(slug)params.set('tenant',slug)
    if(selectedOrder&&!slug)params.set('order',selectedOrder)
    try{
      const response=await fetch('/api/ops/dashboard?'+params,{credentials:'include',signal:controller.signal,cache:'no-store'})
      if(!response.ok)throw new Error(response.status===401?'Sesija je istekla. Ponovno se prijavite.':response.status===403?'Nemate administratorsko pravo.':'Osvježavanje nije uspjelo. Prikazani su posljednji dohvaćeni podaci.')
      const payload=await response.json() as Data
      if(version===generation.current){setData(payload);setUpdated(new Intl.DateTimeFormat('hr-HR',{timeZone:'Europe/Zagreb',hour:'2-digit',minute:'2-digit'}).format(new Date()));setError('')}
    }catch(caught){if(!controller.signal.aborted)setError(caught instanceof Error?caught.message:'Dohvat nije uspio.')}
  },[session?.isAdmin,q,page,slug,selectedOrder])
  useEffect(()=>{
    const timer=setTimeout(()=>void load(),200)
    const poll=setInterval(()=>{if(document.visibilityState==='visible')void load()},30_000)
    const onVisible=()=>{if(document.visibilityState==='visible')void load();else inFlight.current?.abort()}
    document.addEventListener('visibilitychange',onVisible)
    return()=>{clearTimeout(timer);clearInterval(poll);document.removeEventListener('visibilitychange',onVisible);inFlight.current?.abort()}
  },[load])
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search)
    params.set('tab',tab.toLowerCase())
    if(q)params.set('q',q);else params.delete('q')
    if(slug)params.set('tenant',slug);else params.delete('tenant')
    window.history.replaceState({},'','/admin?'+params)
  },[tab,q,slug])
  async function write(endpoint:string,body:Record<string,unknown>,confirmation:string){
    if(busy||!window.confirm(confirmation))return
    const identity=JSON.stringify({endpoint,...body})
    let requestKey=requestKeys.current.get(identity)
    if(!requestKey){requestKey=crypto.randomUUID();requestKeys.current.set(identity,requestKey)}
    setBusy(true);setError('');setMessage('')
    try{
      const response=await fetch(endpoint,{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({...body,requestKey})})
      const payload=await response.json() as {error?:string}
      if(!response.ok)throw new Error(payload.error??'Operacija nije uspjela.')
      requestKeys.current.delete(identity);setMessage('Promjena je spremljena.');setReason('');setQuoteOpen(false);await load()
    }catch(caught){setError(caught instanceof Error?caught.message:'Operacija nije uspjela.')}finally{setBusy(false)}
  }
  if(session===undefined)return <main className="ops-shell"><p role="status">Provjeravamo prijavu…</p></main>
  if(!session)return <PublisherLogin admin initialError={new URLSearchParams(window.location.search).get('authError')??undefined}/>
  if(!session.isAdmin)return <main className="ops-shell"><h1>Pristup nije dopušten</h1><p>Prijavljeni račun nema administratorsko pravo.</p><button type="button" onClick={()=>void logout('/admin')}>Odjava</button></main>
  const orders=(data?.orders??[]).filter(order=>filter==='all'||(filter==='reported'?order.status==='pending'&&Boolean(order.payment_reported_at):order.status===filter))
  const tenants=(data?.tenants??[]).filter(tenant=>filter==='all'||tenant.plan===filter||tenant.access.state===filter||(filter==='pending'&&tenant.pending_orders>0)||(filter==='expiring'&&Boolean(tenant.period_end)&&Date.parse(tenant.period_end!)>Date.now()&&Date.parse(tenant.period_end!)<Date.now()+7*86_400_000))
  const detail=data?.detail
  const openTenant=(value:string)=>{setSlug(value);setTab('Cjenici');setQuoteOpen(false)}
  return <main className="ops-shell">
    <header className="ops-header"><div><a href="/">NEPAR</a><h1>Operativni pregled</h1></div><div><span>{session.user.email}</span><button type="button" onClick={()=>void logout('/admin')}>Odjava</button></div></header>
    <nav className="ops-tabs" aria-label="Administracija">{tabs.map(value=><button key={value} type="button" aria-current={tab===value?'page':undefined} onClick={()=>{setTab(value);setFilter('all');setPage(0)}}>{value}</button>)}</nav>
    <div className="ops-tools"><label>Pretraži firmu, slug, e-mail ili referencu<input type="search" value={q} onChange={event=>{setQ(event.target.value);setPage(0)}}/></label><button type="button" onClick={()=>void load()}>Osvježi</button><span>Zadnje osvježeno: {updated||'—'}</span></div>
    {(error||authError)&&<p className="app-error" role="alert">{error||authError}</p>}{message&&<p role="status">{message}</p>}
    {!data&&<p role="status">Učitavamo operativne podatke…</p>}
    {data&&tab==='Pregled'&&<section><h2>Za obradu</h2><dl className="ops-stats">{Object.entries({reported:'Prijavljena uplata',pending:'Pending narudžbe',grace:'U grace razdoblju',expiring:'Istječe unutar 7 dana',trial:'Besplatne objave',web_link:'Aktivni Web Link',publisher_self_service:'Aktivni Publisher',managed:'Aktivni Web + Publisher',expired:'Deaktivirani linkovi',monitorProblems:'Monitoring problemi'}).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{data.summary[key]??0}</dd></div>)}</dl><button type="button" onClick={()=>{setTab('Uplate');setFilter('reported')}}>Otvori prijavljene uplate</button></section>}
    {tab==='Provjere'&&<section><h2>Provjere webova</h2><p>Anonimni checker radi bez registracije. Pojedinačna povijest, povezivanje naknadnih upita i 90-dnevno čišćenje dio su sljedeće isporuke; ovdje se ne prikazuju izmišljeni kontakti ili povijesni rezultati.</p><a href="/">Otvori sigurnu provjeru weba</a></section>}
    {tab==='Cjenici'&&<section><h2>Cjenici</h2><label>Filter<select aria-label="Filter" value={filter} onChange={event=>setFilter(event.target.value)}>{Object.entries({all:'Svi',trial:'Besplatne objave',web_link:'Web Link',publisher_self_service:'Publisher',managed:'Web + Publisher',active:'Aktivni',grace:'Grace',expired:'Deaktivirani',suspended:'Suspendirani',expiring:'Uskoro istječe',pending:'Pending uplata'}).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>{slug&&<button type="button" onClick={()=>setSlug('')}>Prikaži sve tenante</button>}
      <div className="ops-table-wrap"><table><thead><tr><th>Firma / vlasnik</th><th>Paket i stanje</th><th>Objava</th><th>Vrijedi do</th><th>Monitoring / uplata</th><th>Akcije</th></tr></thead><tbody>{tenants.map(tenant=><tr key={tenant.id}><td><strong>{tenant.name}</strong><span>{tenant.slug}</span><span>{tenant.owner_email??'Bez owner kontakta'}</span></td><td>{planName(tenant.plan)}<span>{stateName[tenant.access.state]}</span></td><td>{tenant.item_count??0} stavki<span>{time(tenant.published_at)} · v{tenant.sequence??'—'}</span></td><td>{time(tenant.period_end)}{tenant.access.state==='grace'&&<span>Deaktivacija: {time(tenant.access.graceUntil)}</span>}</td><td>{tenant.monitor_overall??'Nije uključeno'}<span>{tenant.reported_at?'Uplata prijavljena':tenant.pending_orders?'Čeka uplatu':'—'}</span></td><td><button type="button" onClick={()=>openTenant(tenant.slug)}>Otvori tenant</button><a href={tenant.public_url} target="_blank" rel="noreferrer">Javni cjenik</a></td></tr>)}</tbody></table></div>{!tenants.length&&<p>Nema rezultata za odabrani filter.</p>}
    </section>}
    {tab==='Uplate'&&<section><h2>Uplate</h2><label>Status<select aria-label="Status" value={filter} onChange={event=>setFilter(event.target.value)}>{Object.entries({all:'Sve',reported:'Prijavljene — čekaju potvrdu',pending:'Pending',paid:'Potvrđene',cancelled:'Otkazane'}).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><div className="ops-table-wrap"><table><thead><tr><th>Firma / vlasnik</th><th>Referenca</th><th>Paket / iznos</th><th>Narudžba / prijava</th><th>Status</th><th>Akcije</th></tr></thead><tbody>{orders.map(order=><tr key={order.reference} className={selectedOrder===order.reference?'ops-selected':''}><td><strong>{order.name}</strong><span>{order.owner_email}</span></td><td>{order.reference}</td><td>{orderLabel(order.kind)}<span>{formatCents(order.amount_cents)}{order.installation?' · + ugradnja':''}</span></td><td>{time(order.created_at)}<span>{order.payment_reported_at?'Prijavljena '+time(order.payment_reported_at):'Nije prijavljena'}</span></td><td>{order.status==='paid'?'Potvrđena':order.status==='cancelled'?'Otkazana':order.payment_reported_at?'Prijavljena':'Pending'}</td><td>{order.status==='pending'&&<><button disabled={busy} type="button" onClick={()=>void write('/api/ops/renew',{slug:order.slug,action:'confirm_payment',reference:order.reference},`Je li na bankovnom računu evidentirana uplata ${formatCents(order.amount_cents)} za ${order.reference} (${orderLabel(order.kind)})?`)}>Potvrdi uplatu</button><button disabled={busy} type="button" onClick={()=>void write('/api/ops/renew',{slug:order.slug,action:'cancel_order',reference:order.reference,reason:'Administrator je otkazao neplaćenu narudžbu'},`Otkazati neplaćenu narudžbu ${order.reference}?`)}>Otkaži narudžbu</button></>}<button type="button" onClick={()=>openTenant(order.slug)}>Otvori tenant</button></td></tr>)}</tbody></table></div>{!orders.length&&<p>Nema narudžbi za odabrani filter.</p>}</section>}
    {tab==='Upiti'&&<section><h2>Upiti</h2>{data?.requests.map(inquiry=><article className="ops-inquiry" key={inquiry.source+inquiry.id}><h3>{inquiry.kind}</h3><p>{inquiry.email} · {inquiry.state}{inquiry.template_id?' · tema '+inquiry.template_id:''}</p><p>{inquiry.message}</p><a href={`mailto:${inquiry.email}`}>Odgovori e-mailom</a></article>)}{!data?.requests.length&&<p>Nema otvorenih upita.</p>}</section>}
    {detail&&tab==='Cjenici'&&<section className="ops-detail"><h2>{detail.name} — detalj</h2><dl><dt>Owner</dt><dd>{detail.owner_email}</dd><dt>Paket / stanje</dt><dd>{planName(detail.plan)} · {stateName[detail.access.state]}</dd><dt>Razdoblje</dt><dd>{time(detail.period_start)} — {time(detail.period_end)}</dd><dt>Javni pristup do</dt><dd>{time(detail.access.accessUntil)}</dd><dt>Publikacije</dt><dd>{detail.publication_count}</dd><dt>Posljednji monitoring</dt><dd>{detail.monitor_overall??'—'} · {time(detail.monitor_checked_at)}</dd></dl>
      <form className="ops-action-form" onSubmit={event=>{event.preventDefault();const body:Record<string,unknown>={slug:detail.slug,action,reason};if(action==='change_plan')body.plan=targetPlan;if(action==='set_expiry')body.periodEnd=zagrebEndOfDay(date);void write('/api/ops/renew',body,`Potvrditi operaciju „${action}” za ${detail.name}? Trenutni paket: ${planName(detail.plan)}, rok ${time(detail.period_end)}. ${action==='change_plan'?'Novi paket: '+planName(targetPlan):action==='set_expiry'?'Novi rok: '+date:action==='extend'||action==='activate'?'Dodaje se 365 dana od kasnijeg od sada i postojećeg roka.':''}`)}}><h3>Kontrolirana ručna radnja</h3><label>Radnja<select value={action} onChange={event=>setAction(event.target.value)}>{Object.entries({extend:'Produlji za 1 godinu',activate:'Aktiviraj',set_expiry:'Postavi datum isteka',change_plan:'Promijeni paket',confirm_legacy_paid:'Potvrdi ranije plaćeno godišnje razdoblje',suspend:'Suspendiraj',reactivate:'Reaktiviraj'}).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>{action==='change_plan'&&<label>Novi paket<select value={targetPlan} onChange={event=>setTargetPlan(event.target.value)}><option value="web_link">Web Link</option><option value="publisher_self_service">Publisher</option><option value="managed">Web + Publisher</option></select></label>}{action==='set_expiry'&&<label>Datum isteka<input type="date" required value={date} onChange={event=>setDate(event.target.value)}/><small>Vrijedi do kraja odabranog dana, Europe/Zagreb.</small></label>}<label>Razlog<input required minLength={3} maxLength={500} value={reason} onChange={event=>setReason(event.target.value)}/></label>{detail.pending_orders>0&&<p className="app-error">Postoji otvorena narudžba. Potvrdite je ili otkažite prije konfliktne ručne radnje.</p>}<button type="submit" disabled={busy}>Pregledaj i potvrdi</button></form>
      <button type="button" onClick={()=>setQuoteOpen(!quoteOpen)}>Kreiraj bankovnu narudžbu po ponudi</button>{quoteOpen&&<form className="ops-action-form" onSubmit={event=>{event.preventDefault();const fields=Object.fromEntries(new FormData(event.currentTarget));void write('/api/ops/orders',{...fields,slug:detail.slug,reason:'Prihvaćena ponuda za standardnu uslugu'},'Kreirati narudžbu prema prihvaćenoj ponudi?')}}><label>Usluga<select name="kind"><option value="web_publisher">Web + Publisher — {formatEur(PLANS[2].price,true)}</option><option value="installation">Standardna ugradnja — {installationPriceLabel()}</option></select></label>{[['billingName','Naziv tvrtke',detail.name],['oib','OIB',''],['address','Adresa',''],['postalCity','Poštanski broj i grad',''],['email','E-mail za račun',detail.owner_email??'']].map(([name,label,value])=><label key={name}>{label}<input name={name} required defaultValue={value} type={name==='email'?'email':'text'}/></label>)}<button type="submit" disabled={busy}>Kreiraj narudžbu</button></form>}
      <h3>Sljedeći zakazani mail</h3><p>{detail.nextMail?`${detail.nextMail.event_type} · ${time(detail.nextMail.scheduled_at)} · ${detail.nextMail.status}`:'Nema zakazanog događaja; rokovi se pregledavaju svaki sat.'}</p><h3>Posljednje lifecycle dostave</h3>{detail.deliveries.map((delivery,index)=><p key={index}>{delivery.event_type} · {delivery.recipient} · {delivery.status} · {time(delivery.sent_at??delivery.attempted_at)}</p>)}
      <details><summary>Posljednje administrativne akcije</summary>{detail.audit.map((entry,index)=><p key={index}>{time(entry.created_at)} · {entry.actor_email??'Service fallback'} · {entry.action} · {entry.reason}</p>)}</details><details><summary>Objavljene verzije ({detail.publication_count})</summary>{detail.publications.map(pub=><p key={pub.id}>v{pub.sequence} · {time(pub.published_at)} · <a href={`/api/ops/version?tenant=${detail.slug}&id=${pub.id}&format=csv`}>CSV</a> · <a href={`/api/ops/version?tenant=${detail.slug}&id=${pub.id}&format=xml`}>XML</a></p>)}</details>
    </section>}
    {tab!=='Pregled'&&tab!=='Provjere'&&<footer className="ops-pagination"><button type="button" disabled={page===0} onClick={()=>setPage(page-1)}>Prethodna</button><span>Stranica {page+1}</span><button type="button" disabled={(tab==='Uplate'?data?.orders.length:data?.tenants.length)!==50} onClick={()=>setPage(page+1)}>Sljedeća</button></footer>}
  </main>
}
