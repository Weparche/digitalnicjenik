import { useEffect, useState } from 'react'

export type PublisherTenant = { id: string; slug: string; name: string; role: 'owner' }
export type PublisherSession = {
  authenticated: true
  user: { id: string; email: string }
  tenants: PublisherTenant[]
}

const authErrorCopy: Record<string, string> = {
  invalid_token: 'Prijavni link nije valjan ili je već iskorišten. Zatražite novi.',
  expired_token: 'Prijavni link je istekao. Zatražite novi.',
  send_failed: 'Prijava trenutačno nije moguća. Pokušajte ponovno.',
  rate_limited: 'Previše pokušaja. Pričekajte sat vremena.',
}

function Logo() {
  return <a className="logo" href="/" aria-label="NEPAR Publisher početna"><img src="/assets/nepar-logo.png" alt="NEPAR Solutions" /><span>Publisher</span></a>
}

export function PublisherLogin({ initialError }: { initialError?: string }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState(initialError ? (authErrorCopy[initialError] || 'Prijava nije uspjela.') : '')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setStatus('sending')
    try {
      const response = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const payload = await response.json().catch(() => ({})) as { ok?: boolean; code?: string; error?: string }
      if (!response.ok) {
        if (response.status === 429) throw new Error(authErrorCopy.rate_limited)
        throw new Error(payload.error || 'Prijavni link nije moguće poslati.')
      }
      setStatus('sent')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Prijavni link nije moguće poslati.')
      setStatus('idle')
    }
  }

  return (
    <div className="validator-app-shell premium-entry publisher-shell">
      <header className="app-header">
        <Logo />
        <a className="header-lead" href="/">Natrag na provjeru</a>
      </header>
      <main className="publisher-auth">
        <section className="publisher-auth-panel" aria-labelledby="publisher-login-title">
          <h1 id="publisher-login-title">Prijava u Publisher</h1>
          <p>Unesite e-mail na koji ste aktivirali Publisher. Poslat ćemo jednokratni link za prijavu — bez lozinke.</p>
          {status === 'sent' ? (
            <div className="publisher-auth-sent" role="status">
              <strong>Provjerite e-mail</strong>
              <p>Ako postoji aktivan Publisher račun za tu adresu, link je poslan. Otvorite ga u ovom pregledniku unutar 15 minuta.</p>
            </div>
          ) : (
            <form className="publisher-auth-form" onSubmit={(event) => void submit(event)}>
              <label>
                E-mail
                <input
                  type="email"
                  name="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="vas@salon.hr"
                />
              </label>
              {error && <p className="app-error" role="alert">{error}</p>}
              <button className="app-button app-button-primary" type="submit" disabled={status === 'sending'}>
                {status === 'sending' ? 'Šaljemo link…' : 'Pošalji prijavni link'}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  )
}

export function usePublisherSession() {
  const [session, setSession] = useState<PublisherSession | null | undefined>(undefined)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void fetch('/api/auth/me', { credentials: 'include' })
      .then(async (response) => {
        if (cancelled) return
        if (response.status === 401) {
          setSession(null)
          return
        }
        if (!response.ok) throw new Error('Sesija nije dostupna.')
        const payload = await response.json() as PublisherSession
        setSession(payload.authenticated ? payload : null)
      })
      .catch((caught) => {
        if (cancelled) return
        setError(caught instanceof Error ? caught.message : 'Sesija nije dostupna.')
        setSession(null)
      })
    return () => { cancelled = true }
  }, [])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: '{}' })
    setSession(null)
    window.location.assign('/app')
  }

  return { session, error, logout, setSession }
}
