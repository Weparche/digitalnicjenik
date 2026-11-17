import {useEffect,useState} from 'react'
export type BusinessProfile={id:string;name:string;merchantType:'legal'|'natural';merchantIdentifier:string;address:string;billingOib:string|null}
export function useBusinessProfiles(enabled=true){
  const [profiles,setProfiles]=useState<BusinessProfile[]>([])
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(enabled)
  const [version,setVersion]=useState(0)
  useEffect(()=>{
    if(!enabled)return
    const controller=new AbortController()
    setLoading(true);setError('')
    void fetch('/api/publisher/business-profiles',{credentials:'include',signal:controller.signal,cache:'no-store'})
      .then(async r=>{if(!r.ok)throw new Error('Poslovni profili trenutačno nisu dostupni.');return r.json() as Promise<{profiles:BusinessProfile[]}>})
      .then(d=>{if(!controller.signal.aborted)setProfiles(d.profiles)})
      .catch(()=>{if(!controller.signal.aborted)setError('Poslovni profili trenutačno nisu dostupni.')})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false)})
    return()=>controller.abort()
  },[enabled,version])
  return {profiles,error,loading,refresh:()=>setVersion(n=>n+1)}
}
export function BusinessProfilesPanel(){
  const {profiles,error,loading,refresh}=useBusinessProfiles()
  const [open,setOpen]=useState(false)
  const [name,setName]=useState('')
  const [type,setType]=useState<'legal'|'natural'>('natural')
  const [identifier,setIdentifier]=useState('')
  const [address,setAddress]=useState('')
  const [oib,setOib]=useState('')
  const [editing,setEditing]=useState(false)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  function select(p?:BusinessProfile){
    setName(p?.name??'');setType(p?.merchantType??'natural');setIdentifier(p?.merchantIdentifier??'');setAddress(p?.address??'');setOib(p?.billingOib??'');setEditing(Boolean(p));setMessage('');setOpen(true)
  }
  async function save(e:React.FormEvent){
    e.preventDefault();setBusy(true);setMessage('')
    try{
      const r=await fetch('/api/publisher/business-profiles',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({name,merchantType:type,merchantIdentifier:identifier,address,billingOib:type==='legal'?identifier:oib})})
      const data=await r.json() as {error?:string}
      if(!r.ok)throw new Error(data.error||'Spremanje nije uspjelo.')
      setOpen(false);setMessage('Poslovni profil je spremljen.');refresh()
    }catch(e){setMessage(e instanceof Error?e.message:'Spremanje nije uspjelo.')}finally{setBusy(false)}
  }
  return <section className="workspace-surface catalog-profiles"><div className="catalog-intro"><div><h2>Poslovni profili</h2><p>Spremite zajedničke podatke obrta ili tvrtke i odaberite ih pri izradi novog cjenika. Postojeće objave se ne mijenjaju.</p></div><button className="workspace-button" type="button" onClick={()=>select()}>Dodaj poslovni profil</button></div>
    {loading&&<p role="status">Učitavamo profile…</p>}{error&&<p role="alert">{error} <button type="button" className="workspace-button" onClick={refresh}>Osvježi</button></p>}
    {profiles.map(p=><div className="catalog-profile-row" key={p.id}><div><strong>{p.name}</strong><p>{p.merchantType==='legal'?'OIB':'Matični broj'}: {p.merchantIdentifier}{p.address?' · '+p.address:''}</p></div><button type="button" className="workspace-button" onClick={()=>select(p)}>Uredi profil</button><a className="workspace-button" href={'/app?new=1&add=1&tab=cjenik&profile='+encodeURIComponent(p.id)}>Novi cjenik</a></div>)}
    {open&&<form className="trial-claim-form catalog-profile-form" onSubmit={e=>void save(e)}><label>Pravni naziv poslovnog subjekta<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label><label>Vrsta trgovca<select value={type} disabled={editing} onChange={e=>{setType(e.target.value as 'legal'|'natural');setIdentifier('');setOib('')}}><option value="natural">Fizička osoba / obrt</option><option value="legal">Pravna osoba</option></select></label><label>{type==='legal'?'OIB pravne osobe':'Matični broj fizičke osobe'}<input required inputMode="numeric" pattern={type==='legal'?'[0-9]{11}':'[0-9]{5,15}'} readOnly={editing} value={identifier} onChange={e=>setIdentifier(e.target.value.replace(/\D/g,''))}/></label>{type==='natural'&&<label>OIB za naplatu (nije obvezno)<input inputMode="numeric" pattern="[0-9]{11}" value={oib} onChange={e=>setOib(e.target.value.replace(/\D/g,''))}/></label>}<label>Adresa poslovanja<input value={address} maxLength={240} onChange={e=>setAddress(e.target.value)}/></label><div className="catalog-actions"><button className="app-button app-button-primary" disabled={busy} type="submit">Spremi profil</button><button className="workspace-button" type="button" disabled={busy} onClick={()=>setOpen(false)}>Odustani</button></div></form>}
    {message&&<p role="status">{message}</p>}
  </section>
}
