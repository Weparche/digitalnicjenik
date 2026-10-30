import { useCallback,useEffect,useRef,useState } from 'react'
import { IconArrowLeft,IconArrowUpRight,IconCheck,IconChevronRight,IconCreditCard,IconFileSearch,IconFileText,IconLayoutDashboard,IconMessage,IconRefresh,IconSearch } from '@tabler/icons-react'
import { PublisherLogin,usePublisherSession } from './PublisherAuth'
import { WorkspaceShell } from './WorkspaceShell'
import { PLANS,formatEur,installationPriceLabel } from '../shared/pricing'
import { formatCents,orderLabel,type OrderKind } from '../shared/payment'
import { zagrebEndOfDay } from '../shared/zagreb-time'
import './operations.css'
import { AdminChecks } from './AdminChecks'

type Access={state:string;live:boolean;periodEnd:string|null;graceUntil:string|null;accessUntil:string|null}
type Tenant={id:string;slug:string;name:string;plan:string;status:string;period_start:string|null;period_end:string|null;owner_email:string|null;item_count:number|null;published_at:string|null;sequence:number|null;publication_count:number;monitor_overall:string|null;monitor_checked_at:string|null;pending_orders:number;reported_at:string|null;access:Access;public_url:string}
type Order={reference:string;slug:string;name:string;owner_email:string;kind:OrderKind;amount_cents:number;installation:number;status:string;created_at:string;payment_reported_at:string|null;billing_name:string;email:string}
type Detail=Tenant&{metadata:Record<string,unknown>|null;publications:Array<{id:string;sequence:number;filename_stem:string;published_at:string}>;audit:Array<{action:string;actor_email:string|null;reason:string;created_at:string}>;nextMail:{event_type:string;scheduled_at:string;status:string}|null;deliveries:Array<{event_type:string;recipient:string;status:string;sent_at:string|null;attempted_at:string|null}>}
type Inquiry={id:string;source:string;kind:string;email:string;name?:string;message:string;state:string;template_id:string|null;tenant_id?:string;attachment_name?:string;attachment_key?:string}
type Data={summary:Record<string,number>;tenants:Tenant[];orders:Order[];requests:Inquiry[];detail:Detail|null;page:number}
type Write=(endpoint:string,body:Record<string,unknown>,confirmation:string)=>Promise<boolean>
const tabs=['Pregled','Provjere','Cjenici','Uplate','Upiti'] as const
type Tab=typeof tabs[number]
const tabIcons={Pregled:IconLayoutDashboard,Provjere:IconFileSearch,Cjenici:IconFileText,Uplate:IconCreditCard,Upiti:IconMessage}
const time=(iso:string|null|undefined)=>iso?new Intl.DateTimeFormat('hr-HR',{timeZone:'Europe/Zagreb',dateStyle:'short',timeStyle:'short'}).format(new Date(iso)):'—'
const planName=(plan:string)=>plan==='managed'?PLANS[2].name:plan==='publisher_self_service'?PLANS[1].name:plan==='web_link'?PLANS[0].name:'Bez paketa'
const stateName:Record<string,string>={trial:'Besplatna objava',active:'Aktivan',grace:'Obnova čeka uplatu',expired:'Deaktiviran',suspended:'Suspendiran',none:'Bez objave'}
const descriptions:Record<Tab,string>={Pregled:'Što danas treba vašu pažnju.',Provjere:'Tehničke provjere javno dostupnih cjenika.',Cjenici:'Korisnici, javni linkovi i trajanje pretplate.',Uplate:'Potvrdite bankovnu uplatu i odmah aktivirajte paket.',Upiti:'Zahtjevi za ugradnju i Web + Publisher.'}

function PaymentTable({orders,busy,write,onTenant,selected}:{orders:Order[];busy:boolean;write:Write;onTenant?:(slug:string)=>void;selected?:string|null}){
  return <div className="ops-table-wrap"><table role="table"><thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">Poslovanje</th><th role="columnheader" scope="col">Narudžba</th><th role="columnheader" scope="col">Iznos</th><th role="columnheader" scope="col">Status</th><th role="columnheader" scope="col">Radnja</th></tr></thead><tbody role="rowgroup">{orders.map(order=><tr role="row" key={order.reference} className={selected===order.reference?'ops-selected':''}>
    <td role="cell"><strong>{order.name}</strong><span className="ops-secondary">{order.owner_email||order.email}</span></td>
    <td role="cell" data-label="Narudžba"><strong className="ops-reference">{order.reference}</strong><span className="ops-secondary">{orderLabel(order.kind)}{order.installation?' + ugradnja':''}</span><span className="ops-secondary">{time(order.created_at)}</span></td>
    <td role="cell" data-label="Iznos"><strong className="ops-amount">{formatCents(order.amount_cents)}</strong></td>
    <td role="cell" data-label="Status"><span className={`ops-status ops-status-${order.status==='paid'?'active':order.payment_reported_at&&order.status==='pending'?'reported':order.status}`}>{order.status==='paid'?'Potvrđena':order.status==='cancelled'?'Otkazana':order.payment_reported_at?'Uplata prijavljena':'Čeka uplatu'}</span>{order.status==='pending'&&order.payment_reported_at&&<span className="ops-secondary">{time(order.payment_reported_at)}</span>}</td>
    <td role="cell"><div className="ops-row-actions">{order.status==='pending'?<button className="workspace-button workspace-button-primary" disabled={busy} type="button" onClick={()=>void write('/api/ops/renew',{slug:order.slug,action:'confirm_payment',reference:order.reference},`Potvrditi bankovnu uplatu ${formatCents(order.amount_cents)} za ${order.reference} (${orderLabel(order.kind)})? ${order.kind==='installation'?'Ugradnja ne mijenja pretplatu.':'Paket se aktivira ili produljuje odmah.'}`)}><IconCheck size={16}/>Potvrdi uplatu</button>:<a className="workspace-button" href={`/c/${order.slug}`} target="_blank" rel="noreferrer">Otvori cjenik<IconArrowUpRight size={15}/></a>}{onTenant&&<button className="workspace-button-link" type="button" onClick={()=>onTenant(order.slug)}>Detalji cjenika<IconChevronRight size={16}/></button>}</div>{order.status==='pending'&&<details className="ops-row-more"><summary>Ostale radnje</summary><button className="workspace-button-link" disabled={busy} type="button" onClick={()=>void write('/api/ops/renew',{slug:order.slug,action:'cancel_order',reference:order.reference,reason:'Administrator je otkazao neplaćenu narudžbu'},`Otkazati neplaćenu narudžbu ${order.reference}?`)}>Otkaži narudžbu</button></details>}</td>
  </tr>)}</tbody></table></div>
}

function TenantDetail({detail,orders,write,busy}:{detail:Detail;orders:Order[];write:Write;busy:boolean}){
  const [action,setAction]=useState('extend')
  const [reason,setReason]=useState('')
  const [targetPlan,setTargetPlan]=useState(detail.plan)
  const [date,setDate]=useState('')
  const [quoteOpen,setQuoteOpen]=useState(false)
  return <div className="ops-detail workspace-stack">
    <section className="workspace-surface"><div className="ops-section-heading"><div><h2>{detail.name}</h2><p>{detail.owner_email||'E-mail vlasnika nije povezan'}</p></div><span className={`ops-status ops-status-${detail.access.state}`}>{stateName[detail.access.state]}</span></div><dl className="ops-facts">{[['Paket',planName(detail.plan)],['Vrijedi do',time(detail.period_end)],['Javni pristup do',time(detail.access.accessUntil)],['Stavke / verzije',`${detail.item_count??0} stavki · ${detail.publication_count} verzija`],['Zadnja objava',time(detail.published_at)],['Monitoring',detail.monitor_overall==='ok'?'Uredno':detail.monitor_overall==='fail'?'Potrebna provjera':detail.monitor_overall==='warn'?'Upozorenje':'Nije uključen']].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><a className="workspace-button" href={detail.public_url} target="_blank" rel="noreferrer">Otvori javni cjenik<IconArrowUpRight size={17}/></a></section>
    <section className="workspace-surface"><h2>Narudžbe i uplate</h2>{orders.length?<PaymentTable orders={orders} busy={busy} write={write}/>:<p>Nema otvorenih narudžbi. Za redovnu uplatu potvrdite konkretnu narudžbu kada se pojavi ovdje.</p>}</section>
    <details className="workspace-surface ops-advanced"><summary>Napredne radnje i ručne izmjene</summary><p>Za iznimne slučajeve. Redovnu uplatu potvrdite iz narudžbe iznad — paket i trajanje primjenjuju se automatski.</p><form className="ops-action-form" onSubmit={event=>{
      event.preventDefault();const body:Record<string,unknown>={slug:detail.slug,action,reason};if(action==='change_plan')body.plan=targetPlan;if(action==='set_expiry')body.periodEnd=zagrebEndOfDay(date)
      void write('/api/ops/renew',body,`Potvrditi ručnu izmjenu za ${detail.name}? Radnja: ${action}. Trenutni paket: ${planName(detail.plan)}, rok ${time(detail.period_end)}. Razlog: ${reason}`).then(saved=>{if(saved)setReason('')})
    }}><label>Radnja<select value={action} onChange={event=>setAction(event.target.value)}>{Object.entries({extend:'Produlji za 1 godinu',activate:'Aktiviraj bez bankovne narudžbe',set_expiry:'Postavi datum isteka',change_plan:'Promijeni paket',confirm_legacy_paid:'Potvrdi ranije plaćeno godišnje razdoblje',suspend:'Suspendiraj pristup',reactivate:'Ukloni suspenziju'}).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>{action==='change_plan'&&<label>Novi paket<select value={targetPlan} onChange={event=>setTargetPlan(event.target.value)}><option value="web_link">Web Link</option><option value="publisher_self_service">Publisher</option><option value="managed">Web + Publisher</option></select></label>}{action==='set_expiry'&&<label>Datum isteka<input type="date" required value={date} onChange={event=>setDate(event.target.value)}/><small>Do kraja dana, Europe/Zagreb.</small></label>}<label>Razlog<input required minLength={3} maxLength={500} value={reason} onChange={event=>setReason(event.target.value)}/></label>{detail.pending_orders>0&&<p className="app-error">Otvorenu narudžbu prvo potvrdite ili otkažite prije ručne promjene.</p>}<button className="workspace-button" type="submit" disabled={busy}>Pregledaj i potvrdi</button></form>
      <button className="workspace-button-link" type="button" onClick={()=>setQuoteOpen(!quoteOpen)}>Kreiraj narudžbu po prihvaćenoj ponudi</button>{quoteOpen&&<form className="ops-action-form" onSubmit={event=>{event.preventDefault();const fields=Object.fromEntries(new FormData(event.currentTarget));void write('/api/ops/orders',{...fields,slug:detail.slug,reason:'Prihvaćena ponuda za standardnu uslugu'},'Kreirati bankovnu narudžbu prema prihvaćenoj ponudi?')}}><label>Usluga<select name="kind"><option value="web_publisher">Web + Publisher · {formatEur(PLANS[2].price,true)}</option><option value="installation">Standardna ugradnja · {installationPriceLabel()}</option></select></label>{[['billingName','Naziv tvrtke',detail.name],['oib','OIB',''],['address','Adresa',''],['postalCity','Poštanski broj i grad',''],['email','E-mail za račun',detail.owner_email??'']].map(([name,label,value])=><label key={name}>{label}<input name={name} required defaultValue={value} type={name==='email'?'email':'text'}/></label>)}<button className="workspace-button" type="submit" disabled={busy}>Kreiraj narudžbu</button></form>}
    </details>
    <details className="workspace-surface"><summary>E-mailovi i posljednje dostave</summary><h3>Sljedeći zakazani mail</h3><p>{detail.nextMail?`${detail.nextMail.event_type} · ${time(detail.nextMail.scheduled_at)} · ${detail.nextMail.status}`:'Nema zakazanih poruka.'}</p>{detail.deliveries.length?detail.deliveries.map((delivery,index)=><div className="ops-history-row" key={index}><strong>{delivery.event_type}</strong><span>{delivery.recipient}</span><span>{delivery.status} · {time(delivery.sent_at??delivery.attempted_at)}</span></div>):<p>Nema zabilježenih dostava.</p>}</details>
    <details className="workspace-surface"><summary>Objavljene verzije ({detail.publication_count})</summary>{detail.publications.map(pub=><div className="ops-history-row" key={pub.id}><strong>Verzija {pub.sequence}</strong><span>{time(pub.published_at)}</span><span><a href={`/api/ops/version?tenant=${detail.slug}&id=${pub.id}&format=csv`}>CSV</a> · <a href={`/api/ops/version?tenant=${detail.slug}&id=${pub.id}&format=xml`}>XML</a></span></div>)}</details>
    <details className="workspace-surface"><summary>Povijest administratorskih izmjena</summary>{detail.audit.length?detail.audit.map((entry,index)=><div className="ops-history-row" key={index}><strong>{entry.action}</strong><span>{entry.actor_email??'Servisni pristup'} · {time(entry.created_at)}</span><span>{entry.reason}</span></div>):<p>Nema ručnih izmjena.</p>}</details>
  </div>
}

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
  const [confirmedSlug,setConfirmedSlug]=useState('')
  const [busy,setBusy]=useState(false)
  const [updated,setUpdated]=useState('')
  const [checksRefresh,setChecksRefresh]=useState(0)
  const inFlight=useRef<AbortController|null>(null)
  const generation=useRef(0)
  const requestKeys=useRef(new Map<string,string>())
  const load=useCallback(async()=>{
    if(!session?.isAdmin)return
    inFlight.current?.abort();const controller=new AbortController();inFlight.current=controller
    const version=++generation.current
    const params=new URLSearchParams({q,page:String(page)})
    if(slug)params.set('tenant',slug)
    if(selectedOrder&&!slug&&!q)params.set('order',selectedOrder)
    try{
      const response=await fetch('/api/ops/dashboard?'+params,{credentials:'include',signal:controller.signal,cache:'no-store'})
      if(!response.ok)throw new Error(response.status===401?'Sesija je istekla. Ponovno se prijavite.':response.status===403?'Nemate administratorsko pravo.':'Osvježavanje nije uspjelo. Pokušajte ponovno; posljednji podaci ostaju prikazani.')
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
    const params=new URLSearchParams(window.location.search);params.set('tab',tab.toLowerCase())
    if(q)params.set('q',q);else params.delete('q')
    if(slug)params.set('tenant',slug);else params.delete('tenant')
    window.history.replaceState({},'','/admin?'+params)
  },[tab,q,slug])
  async function write(endpoint:string,body:Record<string,unknown>,confirmation:string){
    if(busy||!window.confirm(confirmation))return false
    const identity=JSON.stringify({endpoint,...body});let requestKey=requestKeys.current.get(identity)
    if(!requestKey){requestKey=crypto.randomUUID();requestKeys.current.set(identity,requestKey)}
    setBusy(true);setError('');setMessage('');setConfirmedSlug('')
    try{
      const response=await fetch(endpoint,{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({...body,requestKey})})
      const payload=await response.json() as {error?:string;status?:string}
      if(!response.ok)throw new Error(payload.error??'Operacija nije uspjela.')
      requestKeys.current.delete(identity)
      if(body.action==='confirm_payment'){
        const order=data?.orders.find(o=>o.reference===body.reference)
        setMessage(order?.kind==='installation'?`Uplata ${body.reference} je potvrđena. Ugradnja je spremna za dogovor.`:payload.status==='suspended'?`Uplata ${body.reference} je potvrđena. Pristup ostaje suspendiran.`:`Uplata ${body.reference} je potvrđena. Paket je aktiviran na istom linku.`)
        if(order?.kind!=='installation'&&payload.status!=='suspended')setConfirmedSlug(String(body.slug))
      }else setMessage('Promjena je spremljena.')
      await load()
      return true
    }catch(caught){setError(caught instanceof Error?caught.message:'Operacija nije uspjela.');return false}finally{setBusy(false)}
  }
  const nav=tabs.map(label=>({id:label,label,icon:tabIcons[label],count:label==='Uplate'?data?.summary.reported:undefined}))
  const navigate=(id:string)=>{setTab(id as Tab);setFilter('all');setPage(0);setSlug('');setQ('');const url=new URL(window.location.href);url.searchParams.delete('order');window.history.replaceState({},'',url.pathname+url.search)}
  if(!session&&session!==undefined)return <PublisherLogin admin initialError={initial.get('authError')??authError}/>
  if(session&&!session.isAdmin)return <WorkspaceShell title="Pristup nije dopušten" items={[]} active="" onNavigate={()=>{}} email={session.user.email} onLogout={()=>void logout('/admin')}><p>Prijavljeni račun nema administratorsko pravo.</p><a className="workspace-button" href="/app">Otvori moj cjenik</a></WorkspaceShell>
  const openTenant=(value:string)=>{setSlug(value);setTab('Cjenici');setFilter('all');setPage(0)}
  const orders=(data?.orders??[]).filter(order=>filter==='all'||(filter==='reported'?order.status==='pending'&&Boolean(order.payment_reported_at):order.status===filter))
  const tenants=(data?.tenants??[]).filter(tenant=>filter==='all'||tenant.plan===filter||tenant.access.state===filter||(filter==='pending'&&tenant.pending_orders>0)||(filter==='expiring'&&Boolean(tenant.period_end)&&Date.parse(tenant.period_end!)>Date.now()&&Date.parse(tenant.period_end!)<Date.now()+7*86_400_000))
  const queue=(data?.orders??[]).filter(order=>order.status==='pending')
  const summary=data?.summary??{}
  const detail=data?.detail
  return <WorkspaceShell admin title={tab==='Pregled'?'Pregled poslovanja':detail&&tab==='Cjenici'?detail.name:tab} subtitle={descriptions[tab]} items={nav} active={tab} onNavigate={navigate} email={session?.user.email} onLogout={session?()=>void logout('/admin'):undefined} tools={<button className="workspace-button" type="button" onClick={()=>{void load();setChecksRefresh(value=>value+1)}}><IconRefresh size={17}/>Osvježi</button>}>
    <div className="ops-shell">
      <div className="ops-sync">Zadnje osvježeno: {updated||'učitavanje…'}</div>
      {(error||authError)&&<div className="workspace-notice workspace-notice-error" role="alert"><p>{error||authError}</p></div>}
      {message&&<div className="workspace-notice ops-success" role="status"><IconCheck size={22}/><p>{message}</p>{confirmedSlug&&<a className="workspace-button" href={`/c/${confirmedSlug}`} target="_blank" rel="noreferrer">Otvori aktivni link<IconArrowUpRight size={16}/></a>}</div>}
      {!data&&<div className="workspace-skeleton" role="status" aria-label="Učitavanje operativnih podataka"><span/><span/><span/></div>}
      {data&&tab==='Pregled'&&<>
        <dl className="ops-stats">{[['reported','Uplate za potvrdu'],['pending','Otvorene narudžbe'],['expiring','Istječe za 7 dana'],['monitorProblems','Monitoring upozorenja']].map(([key,label])=><div key={key}><dt>{label}</dt><dd>{summary[key]??0}</dd></div>)}</dl>
        <div className="ops-business-summary"><h2>Provjere weba</h2><dl>{[['checksToday','Danas'],['checks7days','Zadnjih 7 dana'],['checksTotal','Ukupno']].map(([key,label])=><div key={key}><dt>{label}</dt><dd>{summary[key]??0}</dd></div>)}</dl><button type="button" className="workspace-button-link" onClick={()=>navigate('Provjere')}>Otvori povijest provjera<IconChevronRight size={16}/></button></div>
        <section className="ops-section"><div className="ops-section-heading"><div><h2>Uplate koje čekaju obradu</h2><p>Provjerite bankovni račun i potvrdite narudžbu. Ostalo se primjenjuje automatski.</p></div><button type="button" className="workspace-button-link" onClick={()=>navigate('Uplate')}>Sve uplate<IconChevronRight size={16}/></button></div>{queue.length?<PaymentTable orders={queue.slice(0,6)} busy={busy} write={write} onTenant={openTenant}/>:<div className="ops-empty"><IconCheck size={24}/><h3>Sve uplate su obrađene</h3><p>Nova prijavljena uplata pojavit će se ovdje.</p></div>}</section>
        <div className="ops-business-summary"><h2>Aktivne objave</h2><dl>{[['web_link','Web Link'],['publisher_self_service','Publisher'],['managed','Web + Publisher'],['trial','Besplatne objave'],['grace','Obnova u graceu'],['expired','Deaktivirani linkovi']].map(([key,label])=><div key={key}><dt>{label}</dt><dd>{summary[key]??0}</dd></div>)}</dl></div>
      </>}
      {session?.isAdmin&&<AdminChecks active={tab==='Provjere'} refresh={checksRefresh}/>}
      {data&&tab==='Cjenici'&&!detail&&<section className="ops-section"><div className="ops-list-tools"><label className="ops-search"><IconSearch size={18}/><input type="search" aria-label="Pretraži cjenike" placeholder="Firma, e-mail, slug ili referenca…" value={q} onChange={event=>{setQ(event.target.value);setPage(0)}}/></label><select aria-label="Filter" value={filter} onChange={event=>setFilter(event.target.value)}>{Object.entries({all:'Svi cjenici',trial:'Besplatne objave',web_link:'Web Link',publisher_self_service:'Publisher',managed:'Web + Publisher',active:'Aktivni',grace:'Obnova čeka uplatu',expired:'Deaktivirani',suspended:'Suspendirani',expiring:'Uskoro istječe',pending:'Otvorena uplata'}).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div><div className="ops-table-wrap"><table role="table"><thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">Poslovanje</th><th role="columnheader" scope="col">Paket</th><th role="columnheader" scope="col">Objava</th><th role="columnheader" scope="col">Vrijedi do</th><th role="columnheader" scope="col">Stanje</th><th role="columnheader" scope="col">Radnja</th></tr></thead><tbody role="rowgroup">{tenants.map(tenant=><tr role="row" key={tenant.id}><td role="cell"><strong>{tenant.name}</strong><span className="ops-secondary">{tenant.owner_email||tenant.slug}</span></td><td role="cell" data-label="Paket">{planName(tenant.plan)}</td><td role="cell" data-label="Objava">{tenant.item_count??0} stavki<span className="ops-secondary">v{tenant.sequence??'—'} · {time(tenant.published_at)}</span></td><td role="cell" data-label="Vrijedi do">{time(tenant.period_end)}</td><td role="cell" data-label="Stanje"><span className={`ops-status ops-status-${tenant.access.state}`}>{stateName[tenant.access.state]}</span>{tenant.reported_at&&<span className="ops-secondary">Uplata prijavljena</span>}</td><td role="cell"><button className="workspace-button-link" type="button" onClick={()=>openTenant(tenant.slug)}>Otvori detalje<IconChevronRight size={16}/></button></td></tr>)}</tbody></table></div>{!tenants.length&&<div className="ops-empty"><h3>Nema rezultata</h3><p>Pokušajte s drugim nazivom ili uklonite filter.</p><button className="workspace-button" type="button" onClick={()=>{setQ('');setFilter('all')}}>Ukloni filtere</button></div>}</section>}
      {detail&&tab==='Cjenici'&&<><button className="workspace-button-link ops-back" type="button" onClick={()=>{setSlug('');setQ('')}}><IconArrowLeft size={17}/>Svi cjenici</button><TenantDetail key={detail.id} detail={detail} orders={data?.orders??[]} write={write} busy={busy}/></>}
      {data&&tab==='Uplate'&&<section className="ops-section"><div className="ops-list-tools"><label className="ops-search"><IconSearch size={18}/><input type="search" aria-label="Pretraži uplate" placeholder="Referenca, firma ili e-mail…" value={q} onChange={event=>{setQ(event.target.value);setPage(0)}}/></label><select aria-label="Status" value={filter} onChange={event=>setFilter(event.target.value)}>{Object.entries({all:'Sve uplate',reported:'Prijavljene — za potvrdu',pending:'Čekaju uplatu',paid:'Potvrđene',cancelled:'Otkazane'}).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div><PaymentTable orders={orders} busy={busy} write={write} onTenant={openTenant} selected={selectedOrder}/>{!orders.length&&<div className="ops-empty"><h3>Nema uplata za odabrani prikaz</h3><p>Promijenite pretragu ili status narudžbe.</p></div>}</section>}
      {data&&tab==='Upiti'&&<section className="ops-section">{data.requests.length?data.requests.map(inquiry=><article className="ops-inquiry" key={inquiry.source+inquiry.id}><div><h2>{inquiry.name||inquiry.email}</h2><span className="ops-secondary">{inquiry.kind} · {inquiry.state}{inquiry.template_id?' · '+inquiry.template_id:''}</span><p>{inquiry.message}</p>{inquiry.attachment_key&&<a href={`/api/ops/attachment?inquiry=${inquiry.id}`}>Preuzmi {inquiry.attachment_name||'privitak'}</a>}</div><a className="workspace-button" href={`mailto:${inquiry.email}`}>Odgovori<IconArrowUpRight size={16}/></a></article>):<div className="ops-empty"><IconMessage size={26}/><h2>Za sada nema upita</h2><p>Zahtjevi za ugradnju i novi web pojavit će se ovdje.</p></div>}</section>}
      {data&&(tab==='Uplate'||tab==='Cjenici')&&!detail&&<footer className="ops-pagination"><button className="workspace-button" type="button" disabled={page===0} onClick={()=>setPage(page-1)}>Prethodna</button><span>Stranica {page+1}</span><button className="workspace-button" type="button" disabled={(tab==='Uplate'?data.orders.length:data.tenants.length)<50} onClick={()=>setPage(page+1)}>Sljedeća</button></footer>}
    </div>
  </WorkspaceShell>
}
