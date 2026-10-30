import { useId, useState, type FormEvent } from 'react'
import { IconArrowRight, IconWorld } from '@tabler/icons-react'
import { normalizeWebsiteInput } from '../shared/website-check'
import './website-check-entry.css'

/** All public entry points hand the explicit submission to the same workspace checker. */
export function WebsiteCheckEntry({ source, landing = false }: { source: string; landing?: boolean }) {
  const generatedId = useId()
  const id = landing ? 'acq-url' : `website-${generatedId}`
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    let normalized: string
    try { normalized = normalizeWebsiteInput(url) }
    catch { setError('Unesite ispravnu adresu, primjerice vasweb.hr.'); document.getElementById(id)?.focus(); return }
    const params = new URLSearchParams({ new: '1', tab: 'provjera', url: normalized, check: '1', from: 'landing' })
    window.location.assign(`/app?${params}`)
  }
  return <div className={landing ? 'website-entry is-landing' : 'website-entry'}>
    <form id={landing ? 'checker' : undefined} data-entry-source={source} className={landing ? 'acq-form' : 'website-entry-form'} onSubmit={submit} noValidate aria-label="Besplatna provjera weba">
      <label className={landing ? 'sr-only' : 'website-entry-label'} htmlFor={id}>{landing ? 'Adresa web stranice' : 'Adresa vaše web stranice'}</label>
      <div className={landing ? 'acq-input' : 'website-entry-input'}><IconWorld size={22} aria-hidden="true"/>
        <input id={id} name="website" inputMode="url" autoComplete="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={2048} value={url} onChange={event => { setUrl(event.target.value); setError('') }} aria-invalid={Boolean(error)} aria-describedby={`${id}-note${error ? ` ${id}-error` : ''}`} placeholder={landing ? 'https://vasweb.hr' : 'vasweb.hr'}/>
      </div>
      <button type="submit" className={landing ? 'acq-primary' : 'website-entry-submit'}>Provjeri besplatno<IconArrowRight size={22} aria-hidden="true"/></button>
    </form>
    {error && <p id={`${id}-error`} className="website-entry-error" role="alert">{error}</p>}
    <p id={`${id}-note`} className={landing ? 'sr-only' : 'website-entry-note'}>Bez registracije. Rezultat se otvara u vašem radnom prostoru.</p>
  </div>
}
