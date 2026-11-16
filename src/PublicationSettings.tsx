import { useEffect, useState } from 'react'
import type { PublicationDetails } from '../shared/publication-details'

export function PublicationSettings({ slug, onSaved }: { slug: string; onSaved: () => void }) {
  const [details, setDetails] = useState<PublicationDetails>({ objectType: 'usluzni-objekt', objectAddress: '', objectCode: '' })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [closedDates, setClosedDates] = useState('')
  const endpoint = `/api/tenants/${encodeURIComponent(slug)}`
  useEffect(() => {
    let cancelled = false
    fetch(endpoint, { credentials: 'include' }).then(async response => {
      if (!response.ok) return
      const data = await response.json() as { metadata?: PublicationDetails }
      if (!cancelled && data.metadata) { setDetails(data.metadata); setClosedDates((data.metadata.closedDates ?? []).join(', ')) }
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [endpoint])
  return <section className="upload-card" aria-labelledby="publication-settings-title">
    <h2 id="publication-settings-title">Podaci objekta za naziv datoteke</h2>
    <p>Prema NN 132/2026 unesite identifikator trgovca. Bit će dio javnog naziva datoteke. Provjerite stvarnu adresu i oznaku. Nakon spremanja objavite novu verziju cjenika; prethodne datoteke ostaju u arhivi.</p>
    <form className="trial-claim-form" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setMessage('')
      try {
        const response = await fetch(`${endpoint}/metadata`, { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...details, closedDates: closedDates.split(',').map(date => date.trim()).filter(Boolean) }) })
        const data = await response.json() as { error?: string }
        if (!response.ok) throw new Error(data.error || 'Podaci nisu spremljeni.')
        setMessage('Podaci su spremljeni. Objavite novu verziju kako bi se primijenili na naziv datoteke.'); onSaved()
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Spremanje nije uspjelo.') }
      finally { setBusy(false) }
    }}>
      <label>Vrsta trgovca<select required value={details.merchantType??''} onChange={event=>setDetails({...details,merchantType:event.target.value as 'legal'|'natural',merchantIdentifier:''})}><option value="">Odaberite</option><option value="legal">Pravna osoba (OIB)</option><option value="natural">Fizička osoba / obrt (matični broj)</option></select></label>
      <label>{details.merchantType==='natural'?'Matični broj fizičke osobe':'OIB pravne osobe'}<input required inputMode="numeric" pattern={details.merchantType==='natural'?'[0-9]{5,15}':'[0-9]{11}'} value={details.merchantIdentifier??''} onChange={event=>setDetails({...details,merchantIdentifier:event.target.value.replace(/\D/g,'')})}/></label>
      <label><input type="checkbox" checked={details.allLocations??false} onChange={event=>setDetails({...details,allLocations:event.target.checked})}/> Isti cjenik za sva prodajna mjesta</label>
      <label>Vrsta objekta<input required={!details.allLocations} minLength={2} maxLength={80} value={details.objectType} onChange={event => setDetails({ ...details, objectType: event.target.value })} /></label>
      <label>Puna adresa objekta<input required={!details.allLocations} minLength={5} maxLength={240} value={details.objectAddress} onChange={event => setDetails({ ...details, objectAddress: event.target.value })} /></label>
      <label>Oznaka objekta<input required={!details.allLocations} maxLength={80} value={details.objectCode} onChange={event => setDetails({ ...details, objectCode: event.target.value })} /></label>
      <fieldset><legend>Radni dani objekta</legend>{['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'].map((label, day) => <label key={day}><input type="checkbox" checked={(details.workingDays ?? [1,2,3,4,5]).includes(day)} onChange={event => setDetails({ ...details, workingDays: event.target.checked ? [...(details.workingDays ?? [1,2,3,4,5]), day] : (details.workingDays ?? [1,2,3,4,5]).filter(value => value !== day) })} />{label}</label>)}</fieldset>
      <label>Neradni datumi<input value={closedDates} onChange={event => setClosedDates(event.target.value)} placeholder="2026-12-25, 2026-12-26" /><small>Datumi u obliku GGGG-MM-DD, odvojeni zarezom.</small></label>
      <button className="app-button app-button-light" disabled={busy} type="submit">{busy ? 'Spremamo…' : 'Spremi podatke objekta'}</button>
      {message && <p role="status">{message}</p>}
    </form>
  </section>
}
