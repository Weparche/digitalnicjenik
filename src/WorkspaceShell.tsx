import { useEffect, useRef, useState, type ReactNode } from 'react'
import { IconArrowUpRight,IconChevronLeft,IconChevronRight,IconHelp,IconLayoutDashboard,IconLogout,IconMenu2,IconUserCircle,IconX } from '@tabler/icons-react'
import '@fontsource-variable/inter/wght.css'

export type WorkspaceNavItem={id:string;label:string;icon:typeof IconLayoutDashboard;count?:number}
export function WorkspaceShell({children,items,active,onNavigate,title,subtitle,email,admin=false,onLogout,tools,isAdmin=false}:{children:ReactNode;items:WorkspaceNavItem[];active:string;onNavigate:(id:string)=>void;title:string;subtitle?:string;email?:string;admin?:boolean;onLogout?:()=>void;tools?:ReactNode;isAdmin?:boolean}){
  const [moreOpen,setMoreOpen]=useState(false)
  const [keyboardOpen,setKeyboardOpen]=useState(false)
  const moreRef=useRef<HTMLButtonElement>(null)
  const morePanel=useRef<HTMLDivElement>(null)
  const mobileIds=items.some(item=>item.id==='pregled')?['pregled','provjera','cjenik','pretplata']:['provjera','cjenik',items.some(item=>item.id==='objava')?'objava':'upute','pretplata']
  const mobileLabels:Record<string,string>={pregled:'Cjenici',provjera:'Provjera',cjenik:'Cjenik',objava:'Objava',upute:'Upute',pretplata:'Paketi'}
  const primary=mobileIds.flatMap(id=>items.filter(item=>item.id===id))
  const extra=items.filter(item=>!mobileIds.includes(item.id))
  const moreActive=extra.some(item=>item.id===active)
  const selectMobile=(id:string)=>{setMoreOpen(false);onNavigate(id)}
  useEffect(()=>{setMoreOpen(false)},[active])
  useEffect(()=>{if(!moreOpen)return;morePanel.current?.querySelector<HTMLElement>('button')?.focus();const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setMoreOpen(false);moreRef.current?.focus()}};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape)},[moreOpen])
  // The virtual keyboard reduces the visual viewport on mobile. Keep actions in the
  // normal flow while editing so the keyboard and fixed bars cannot cover fields.
  useEffect(()=>{
    if(admin)return
    const mobile=window.matchMedia('(max-width:760px)')
    const viewport=window.visualViewport
    const height=()=>viewport?.height??window.innerHeight
    let baseline=height()
    let lastWidth=window.innerWidth
    let frame=0
    const editable=()=>{
      const element=document.activeElement
      return element instanceof HTMLElement && (element.isContentEditable||element.matches('textarea:not([readonly]):not([disabled]),input:not([readonly]):not([disabled]):is([type=text],[type=email],[type=url],[type=search],[type=tel],[type=password],[type=number],:not([type]))'))
    }
    const update=()=>{
      cancelAnimationFrame(frame)
      frame=requestAnimationFrame(()=>{
        const current=height()
        if(window.innerWidth!==lastWidth){lastWidth=window.innerWidth;baseline=current}
        const focused=editable()
        if(!focused && current>=baseline-100)baseline=current
        const open=mobile.matches&&focused&&(viewport?.scale??1)<=1.05&&baseline-current>120
        setKeyboardOpen(open)
      })
    }
    window.addEventListener('resize',update)
    viewport?.addEventListener('resize',update)
    document.addEventListener('focusin',update)
    document.addEventListener('focusout',update)
    update()
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',update);viewport?.removeEventListener('resize',update);document.removeEventListener('focusin',update);document.removeEventListener('focusout',update)}
  },[admin])
  useEffect(()=>{if(keyboardOpen)setMoreOpen(false)},[keyboardOpen])
  const navRef=useRef<HTMLElement>(null)
  const [edges,setEdges]=useState({left:false,right:false})
  const itemIds=items.map(item=>item.id).join('|')
  useEffect(()=>{
    const nav=navRef.current
    if(!nav)return
    const update=()=>{
      const max=nav.scrollWidth-nav.clientWidth
      const left=nav.scrollLeft>2,right=max-nav.scrollLeft>2
      setEdges(previous=>previous.left===left&&previous.right===right?previous:{left,right})
    }
    const observer=new ResizeObserver(update)
    observer.observe(nav)
    Array.from(nav.children).forEach(child=>observer.observe(child))
    nav.addEventListener('scroll',update,{passive:true})
    update()
    return()=>{observer.disconnect();nav.removeEventListener('scroll',update)}
  },[itemIds])
  useEffect(()=>{
    const nav=navRef.current
    if(!nav||!window.matchMedia('(max-width:760px)').matches)return
    const button=nav.querySelector<HTMLElement>('[aria-current="page"]')
    if(!button)return
    const bounds=nav.getBoundingClientRect(),item=button.getBoundingClientRect()
    if(item.left<bounds.left+4)nav.scrollLeft+=item.left-bounds.left-4
    else if(item.right>bounds.right-4)nav.scrollLeft+=item.right-bounds.right+4
  },[active,itemIds])
  function moveNavigation(direction:number){
    const nav=navRef.current
    if(nav)nav.scrollBy({left:direction*Math.max(120,nav.clientWidth*.7),behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'})
  }
  return <div className={`workspace${admin?' workspace-admin':''}`} data-keyboard-open={keyboardOpen?'true':undefined}>
    <a className="workspace-skip" href="#workspace-content">Preskoči na sadržaj</a>
    <aside className="workspace-sidebar">
      <a className="workspace-brand" href="/" aria-label="NEPAR početna"><svg width="27" height="28" viewBox="0 0 32 34" aria-hidden="true"><rect x="1" y="18" width="8" height="15" rx="3"/><rect x="12" y="9" width="8" height="24" rx="3"/><rect x="23" y="1" width="8" height="32" rx="3"/></svg><span>NEPAR<small>{admin?'Administracija':'Digitalni cjenik'}</small></span></a>
      {!admin&&<div className="workspace-mobile-account">{email?<button type="button" aria-label="Korisnički račun" onClick={()=>setMoreOpen(v=>!v)}><IconUserCircle size={25}/></button>:<a href="/app?login=1">Prijava</a>}</div>}
      <div className="workspace-nav-frame" data-overflow={edges.left||edges.right?'true':'false'}><button className="workspace-nav-arrow workspace-nav-arrow-prev" type="button" aria-label="Pomakni izbornik ulijevo" aria-controls="workspace-navigation" disabled={!edges.left} onClick={()=>moveNavigation(-1)}><IconChevronLeft size={20}/></button><nav ref={navRef} id="workspace-navigation" className="workspace-nav" aria-label={admin?'Administracija':'Radni prostor'}>{items.map(item=>{const Icon=item.icon;return <button type="button" key={item.id} aria-current={active===item.id?'page':undefined} onClick={()=>onNavigate(item.id)}><Icon size={20} stroke={1.7}/><span>{item.label}</span>{Boolean(item.count)&&<span className="workspace-count">{item.count}</span>}</button>})}</nav><button className="workspace-nav-arrow workspace-nav-arrow-next" type="button" aria-label="Pomakni izbornik udesno" aria-controls="workspace-navigation" disabled={!edges.right} onClick={()=>moveNavigation(1)}><IconChevronRight size={20}/></button></div>
      <div className="workspace-sidebar-footer">{isAdmin&&!admin&&<a href="/admin"><IconLayoutDashboard size={19}/>Administracija<IconArrowUpRight size={16}/></a>}{admin&&<a href="/app"><IconArrowUpRight size={19}/>Moj radni prostor</a>}<a href="mailto:nepar@nepar.hr"><IconHelp size={19}/>Pomoć i podrška</a><a href="/">Natrag na početnu<IconArrowUpRight size={16}/></a></div>
    </aside>
    <div className="workspace-body">
      <header className="workspace-topbar"><span>{admin?'Operativni centar':'Moj radni prostor'}</span><div className="workspace-account"><span className="workspace-avatar" aria-hidden="true">{email?.slice(0,1).toUpperCase()||'N'}</span><span>{email||'Besplatna priprema'}</span>{onLogout?<button type="button" onClick={onLogout} aria-label="Odjava" title="Odjava"><IconLogout size={19}/></button>:<a href="/app?login=1">Prijava</a>}</div></header>
      <main id="workspace-content" className="workspace-content" tabIndex={-1}><div className="workspace-page-heading"><div><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{tools&&<div className="workspace-heading-tools">{tools}</div>}</div>{children}<footer className="workspace-mobile-help"><a href="mailto:nepar@nepar.hr">Pomoć i podrška</a>{isAdmin&&!admin&&<a href="/admin">Administracija</a>}{admin&&<a href="/app">Moj radni prostor</a>}<a href="/">Početna</a></footer></main>
    </div>
    {!admin&&<div className="workspace-mobile-dock">
      {moreOpen&&<button className="workspace-more-backdrop" type="button" aria-label="Zatvori izbornik" onClick={()=>{setMoreOpen(false);moreRef.current?.focus()}}/>}
      <nav className="workspace-mobile-nav" aria-label="Radni prostor">
        {primary.map(item=>{const Icon=item.icon;return <button type="button" key={item.id} aria-label={item.label} aria-current={active===item.id?'page':undefined} onClick={()=>selectMobile(item.id)}><span className="workspace-tab-icon"><Icon size={23} stroke={1.8}/></span><span>{mobileLabels[item.id]}</span></button>})}
        <button ref={moreRef} type="button" aria-label="Više" aria-expanded={moreOpen} aria-controls="workspace-more-panel" aria-current={moreActive?'page':undefined} onClick={()=>setMoreOpen(v=>!v)}><span className="workspace-tab-icon"><IconMenu2 size={23}/></span><span>Više</span></button>
        {moreOpen&&<div id="workspace-more-panel" ref={morePanel} className="workspace-more-panel"><div className="workspace-more-heading"><strong>Više mogućnosti</strong><button type="button" aria-label="Zatvori više mogućnosti" onClick={()=>{setMoreOpen(false);moreRef.current?.focus()}}><IconX size={22}/></button></div>
          {extra.map(item=>{const Icon=item.icon;return <button type="button" key={item.id} aria-current={active===item.id?'page':undefined} onClick={()=>selectMobile(item.id)}><Icon size={21}/>{item.label}{Boolean(item.count)&&<span className="workspace-count">{item.count}</span>}</button>})}
          <div className="workspace-more-account"><IconUserCircle size={23}/><span>{email||'Besplatna priprema'}</span></div>
          {onLogout?<button type="button" onClick={()=>{setMoreOpen(false);onLogout()}}><IconLogout size={21}/>Odjava</button>:<a href="/app?login=1"><IconUserCircle size={21}/>Prijava</a>}
          {isAdmin&&<a href="/admin"><IconLayoutDashboard size={21}/>Administracija</a>}
          <a href="mailto:nepar@nepar.hr"><IconHelp size={21}/>Pomoć i podrška</a><a href="/"><IconArrowUpRight size={21}/>Početna</a>
        </div>}
      </nav>
    </div>}
  </div>
}
