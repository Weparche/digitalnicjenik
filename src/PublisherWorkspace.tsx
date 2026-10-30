import { useCallback,useEffect,useRef,useState,type ReactNode } from 'react'
import { IconArrowRight,IconArrowUpRight,IconBook,IconCheck,IconClock,IconCreditCard,IconFileText,IconLink,IconRefresh,IconShieldCheck } from '@tabler/icons-react'
import { WorkspaceShell } from './WorkspaceShell'
import { usePublisherSession,PublisherLogin } from './PublisherAuth'
import { fetchLicence,LicenceCard } from './PaymentOrder'
import { licenceState,untilLabel,type Licence } from './licenceView'
import { entitlementAccess } from '../shared/entitlements'
import { PLANS } from '../shared/pricing'
import { ShareAndPrintCard } from './ShareAndPrintCard'
import { OwnedArchive,InstallationChoice } from './PublicationOverview'
import { PublicationSettings } from './PublicationSettings'
import { MonitorPanel } from './MonitorPanel'
import { FirstPublicationNotice,TrialOffer,WorkspaceInstructions,WorkspacePackages } from './WorkspaceResources'

export type WorkspaceEditorProps={tenantSlug:string;tenantId:string;tenantName:string;publishBlocked:boolean;canEditItems:boolean;entitlementStatus?:string;trialEndsAt?:string|null}
const navigation=[{id:'cjenik',label:'Moj cjenik',icon:IconFileText},{id:'upute',label:'Upute',icon:IconBook},{id:'objava',label:'Objava i ugradnja',icon:IconLink},{id:'pretplata',label:'Paketi i cijene',icon:IconCreditCard}]
const titles:Record<string,string>={cjenik:'Moj cjenik',upute:'Upute',objava:'Objava i ugradnja',pretplata:'Paketi i cijene',nadzor:'Nadzor cjenika'}
export function PublisherWorkspace({renderEditor,renderOnboarding}:{renderEditor:(props:WorkspaceEditorProps)=>ReactNode;renderOnboarding:(email?:string)=>ReactNode}){
  const {session,error:authError,logout}=usePublisherSession()
  const [params]=useState(()=>new URLSearchParams(window.location.search))
  const [tab,setTab]=useState(()=>params.has('order')||params.has('renew')?'pretplata':titles[params.get('tab')??'']?params.get('tab')!:'cjenik')
  const [licence,setLicence]=useState<Licence|null>(null)
  const [error,setError]=useState('')
  const [loaded,setLoaded]=useState(false)
  const inFlight=useRef<AbortController|null>(null)
  const selectedSlug=params.get('tenant')||params.get('slug')
  const [tenantId,setTenantId]=useState('')
  const tenant=(tenantId?session?.tenants.find(t=>t.id===tenantId):session?.tenants.find(t=>t.slug===selectedSlug))||session?.tenants[0]
  const reload=useCallback(async()=>{
    if(!tenant)return
    inFlight.current?.abort();const controller=new AbortController();inFlight.current=controller
    try{const data=await fetchLicence(tenant.slug,controller.signal);if(controller.signal.aborted)return;if(!data)throw new Error('Podaci o pretplati nisu dostupni. Pokušajte osvježiti.');if(data.tenant&&data.tenant.id!==tenant.id)setTenantId(data.tenant.id);const url=new URL(window.location.href);url.searchParams.set('tenant',data.tenant?.slug??tenant.slug);window.history.replaceState({},'',url.pathname+url.search);setLicence(data);setError('')}
    catch(caught){if(!controller.signal.aborted)setError(caught instanceof Error?caught.message:'Dohvat nije uspio.')}
    finally{if(!controller.signal.aborted)setLoaded(true)}
  },[tenant?.slug])
  useEffect(()=>{setLoaded(false);void reload();return()=>inFlight.current?.abort()},[reload])
  useEffect(()=>{
    if(!tenant)return
    const timer=setInterval(()=>{if(document.visibilityState==='visible')void reload()},30_000)
    const visible=()=>{if(document.visibilityState==='visible')void reload()}
    document.addEventListener('visibilitychange',visible)
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',visible)}
  },[tenant?.slug,reload])
  function navigate(next:string){setTab(next);const url=new URL(window.location.href);url.searchParams.set('tab',next);url.searchParams.delete('welcome');window.history.replaceState({},'',url.pathname+url.search)}
  const newWorkspace=params.get('new')==='1'||params.get('upload')==='1'
  if(session===undefined)return <WorkspaceShell title="Učitavamo radni prostor" items={navigation} active="cjenik" onNavigate={()=>{}}><div className="workspace-skeleton" role="status" aria-label="Učitavanje"><span/><span/><span/></div></WorkspaceShell>
  if(!session&&!newWorkspace)return <PublisherLogin initialError={params.get('authError')??authError}/>
  if(!tenant)return <WorkspaceShell title={tab==='upute'||tab==='pretplata'?titles[tab]:'Pripremite svoj prvi cjenik'} subtitle={tab==='cjenik'?'Učitajte datoteku, provjerite podatke i objavite svoj javni link.':undefined} items={navigation.filter(item=>item.id!=='objava')} active={tab==='upute'||tab==='pretplata'?tab:'cjenik'} onNavigate={navigate} email={session?.user.email} isAdmin={session?.isAdmin} onLogout={session?()=>void logout():undefined}>
    <div hidden={tab==='upute'||tab==='pretplata'}>
    {session?.isAdmin&&<div className="workspace-notice"><IconShieldCheck size={21}/><div><strong>Prijavljeni ste kao administrator.</strong><p>Za korisnike i uplate otvorite administraciju. Ovdje možete pripremiti vlastiti cjenik.</p></div><a className="workspace-button" href="/admin">Otvori administraciju<IconArrowUpRight size={17}/></a></div>}
    <TrialOffer onHelp={()=>navigate('upute')}/>
    <div className="workspace-setup"><div className="workspace-steps" aria-label="Koraci objave"><span aria-current="step">Učitajte cjenik</span><IconArrowRight size={16}/><span>Provjerite podatke</span><IconArrowRight size={16}/><span>Objavite link</span></div>{renderOnboarding(session?.user.email)}</div>
    </div>
    {tab==='upute'&&<WorkspaceInstructions onPrepare={()=>navigate('cjenik')}/>}
    {tab==='pretplata'&&<WorkspacePackages onPrepare={()=>navigate('cjenik')}/>}
  </WorkspaceShell>
  const effective=licence?.entitlement?entitlementAccess({id:'view',tenantId:tenant.id,...licence.entitlement}):null
  const state=licenceState(licence)
  const paymentReported=Boolean(licence?.order?.paymentReportedAt&&licence.order.status!=='paid'&&licence.order.status!=='cancelled')
  const firstPublication=(params.get('created')==='1'||params.get('welcome')==='1')&&tenant.slug===selectedSlug&&licence?.entitlement?.status==='trial'&&effective?.live&&!licence.order
  const publicUrl=`${window.location.origin}/c/${tenant.slug}`
  const plan=licence?.entitlement?.plan==='managed'?PLANS[2]:licence?.features.editItems?PLANS[1]:PLANS[0]
  const items=licence?.features.monitoring?[...navigation,{id:'nadzor',label:'Nadzor',icon:IconShieldCheck}]:navigation
  const status=state==='none'?'Objava još nije aktivirana':state==='grace'?'Obnova čeka uplatu':state==='suspended'?'Pristup je suspendiran':state==='expired'?'Javni link nije aktivan':state==='free'||state==='awaiting_payment'?'Besplatna objava 24 h':'Javni link je aktivan'
  return <WorkspaceShell title={titles[tab]??titles.cjenik} subtitle={tenant.name} email={session?.user.email} isAdmin={session?.isAdmin} items={items} active={tab} onNavigate={navigate} onLogout={()=>void logout()} tools={<><span className="workspace-plan">{plan.name}</span>{session&&session.tenants.length>1&&<select aria-label="Odaberi cjenik" value={tenant.id} onChange={event=>{setTenantId(event.target.value);setLicence(null);const url=new URL(window.location.href);const next=session?.tenants.find(t=>t.id===event.target.value);if(next)url.searchParams.set('tenant',next.slug);url.searchParams.delete('order');window.history.replaceState({},'',url.pathname+url.search)}}>{session.tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>}<a className="workspace-button" href={publicUrl} target="_blank" rel="noreferrer">Otvori javni cjenik<IconArrowUpRight size={17}/></a></>}>
    {(error||authError)&&<div className="workspace-notice workspace-notice-error" role="alert"><p>{error||authError}</p><button type="button" onClick={()=>void reload()}><IconRefresh size={17}/>Pokušaj ponovno</button></div>}
    {!loaded?<div className="workspace-skeleton" role="status" aria-label="Učitavanje cjenika"><span/><span/><span/></div>:<>
      {tab==='cjenik'&&firstPublication&&licence?.entitlement?.periodEnd&&<FirstPublicationNotice publicUrl={publicUrl} expiresAt={licence.entitlement.periodEnd}/>}
      {tab==='cjenik'&&paymentReported&&<section className="workspace-notice" aria-label="Status prijavljene uplate"><IconClock size={23}/><div><h2>{licence?.order?.kind==='installation'?'Uplata za ugradnju je prijavljena — čeka potvrdu':'Uplata je prijavljena — čeka potvrdu'}</h2><p>Prijava za narudžbu {licence?.order?.reference} je spremljena. Ne trebate ponovno uplatiti. {licence?.order?.kind==='installation'?'Ugradnju dogovaramo nakon provjere uplate.':'Aktivacija ili obnova slijedi nakon provjere bankovne uplate.'}</p></div><button className="workspace-button" type="button" onClick={()=>navigate('pretplata')}>Pogledaj status uplate<IconArrowRight size={17}/></button></section>}
      {tab==='cjenik'&&!paymentReported&&!firstPublication&&(state==='free'||state==='awaiting_payment')&&<TrialOffer published onHelp={()=>navigate('pretplata')}/>}
      {tab==='cjenik'&&<div className={`workspace-live-strip${effective?.live?'':' workspace-live-strip-warning'}`}><span className="workspace-status"><IconCheck size={17}/>{status}</span><span>{effective?.accessUntil&&state==='grace'?`Aktivan do ${untilLabel(effective.accessUntil)}`:licence?.entitlement?.periodEnd?`Vrijedi do ${untilLabel(licence.entitlement.periodEnd)}`:''}</span>{!paymentReported&&state!=='publisher'&&state!=='web_link'&&<button type="button" onClick={()=>navigate('pretplata')}>{licence?.order?'Otvori uplatu':'Zadrži isti link'}<IconArrowRight size={16}/></button>}</div>}
      <div hidden={tab!=='cjenik'}>{renderEditor({tenantSlug:tenant.slug,tenantId:tenant.id,tenantName:tenant.name,publishBlocked:!effective?.live,canEditItems:licence?.features.editItems??false,entitlementStatus:licence?.entitlement?.status,trialEndsAt:licence?.entitlement?.periodEnd})}</div>
      {tab==='objava'&&<div className="workspace-stack"><section className="workspace-surface"><h2>Jedan link za sve objave</h2><p>Kopirajte svoj URL ili ga ugradite na postojeći web. Zamjena cjenika zadržava istu adresu.</p><ShareAndPrintCard slug={tenant.slug} publicUrl={publicUrl}/></section><section className="workspace-surface"><InstallationChoice slug={tenant.slug}/></section><section className="workspace-surface"><OwnedArchive slug={tenant.slug}/></section><details className="workspace-surface"><summary>Podaci objekta i radni dani</summary><PublicationSettings slug={tenant.slug} onSaved={()=>void reload()}/></details></div>}
      {tab==='upute'&&<WorkspaceInstructions onPrepare={()=>navigate('cjenik')}/>}
      {tab==='pretplata'&&<div className="workspace-stack">{licence&&<div className="workspace-billing"><LicenceCard licence={licence} email={session?.user.email??''} name={tenant.name} onChanged={()=>void reload()}/></div>}<WorkspacePackages/></div>}
      {tab==='nadzor'&&licence?.features.monitoring&&<MonitorPanel slug={tenant.slug}/>}
      {tab==='nadzor'&&!licence?.features.monitoring&&<section className="workspace-surface"><h2>Nadzor je dostupan uz Publisher</h2><p>Provjerava dostupnost javnog cjenika i šalje upozorenja kada je potrebna vaša pažnja.</p><button className="workspace-button" type="button" onClick={()=>navigate('pretplata')}>Pogledaj nadogradnju</button></section>}
    </>}
  </WorkspaceShell>
}
