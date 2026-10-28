import { useState } from 'react'
import { adminState, daysLeft, isPaymentRequest, orderBadge, PLAN_LABEL, projectedPeriodEnd, REQUEST_LABEL, STATE_LABEL, type AdminTenant } from './adminView'
import { formatZagreb } from './monitorView'

const MONITOR_LABEL: Record<string, string> = { ok: '✓ U redu', warn: '⚠ Upozorenje', fail: '✕ Greška', skipped: 'Preskočeno' }

/**
 * Operator-only page (/admin): after a bank transfer lands, activate or extend a tenant for one year.
 * The operator key is typed in and kept in memory only — never persisted in the browser.
 */
export function AdminPanel() {
  const [key, setKey] = useState('')
  const [tenants, setTenants] = useState<AdminTenant[] | null>(null)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const authHeaders = (): Record<string, string> => ({ authorization: `Bearer ${key.trim()}` })

  async function load(event?: React.FormEvent) {
    event?.preventDefault()
    setError('')
    setBusy('load')
    try {
      const response = await fetch('/api/ops/tenants', { headers: authHeaders() })
      if (response.status === 401) throw new Error('Ključ nije ispravan.')
      if (!response.ok) throw new Error('Popis trenutačno nije dostupan.')
      setTenants((await response.json() as { tenants: AdminTenant[] }).tenants)
    } catch (caught) {
      setTenants(null)
      setError(caught instanceof Error ? caught.message : 'Prijava nije uspjela.')
    } finally {
      setBusy('')
    }
  }

  async function activate(tenant: AdminTenant) {
    const projected = projectedPeriodEnd(tenant.periodEnd, Date.now(), { status: tenant.status, orderKind: tenant.order?.kind })
    const order = tenant.order ? `\n\n${orderBadge(tenant.order)}${tenant.order.billingName ? ` — ${tenant.order.billingName}` : ''}` : ''
    const ok = window.confirm(`Je li uplata za „${tenant.name}” (${tenant.slug}) legla na račun?${order}\n\nAktivacija vrijedi do ${formatZagreb(projected, false)}.`)
    if (!ok) return
    setError('')
    setMessage('')
    setBusy(tenant.slug)
    try {
      const response = await fetch('/api/ops/renew', {
        method: 'POST',
        headers: { ...authHeaders(), 'content-type': 'application/json' },
        body: JSON.stringify({ slug: tenant.slug }),
      })
      if (!response.ok) throw new Error('Aktivacija nije uspjela.')
      const result = await response.json() as { periodEnd: string; plan?: string }
      setMessage(`${tenant.name}: ${PLAN_LABEL[result.plan ?? ''] ?? 'aktivno'} do ${formatZagreb(result.periodEnd, false)}.`)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Aktivacija nije uspjela.')
    } finally {
      setBusy('')
    }
  }

  if (!tenants) {
    return (
      <main className="admin-shell">
        <h1>Administracija</h1>
        <form className="admin-login" onSubmit={(event) => void load(event)}>
          <label>Operator ključ
            <input type="password" autoComplete="off" value={key} onChange={(event) => setKey(event.target.value)} required />
          </label>
          <button className="app-button app-button-primary" type="submit" disabled={busy === 'load' || !key.trim()}>{busy === 'load' ? 'Provjeravam…' : 'Prijava'}</button>
        </form>
        {error && <p className="app-error" role="alert">{error}</p>}
      </main>
    )
  }

  return (
    <main className="admin-shell">
      <h1>Administracija</h1>
      <p className="admin-hint">Potvrdite uplatu tek kad legne na račun (poziv na broj = referenca narudžbe). Web Link vrijedi godinu dana; nadogradnja na Publisher zadržava plaćeno razdoblje.</p>
      {message && <p className="app-success" role="status">{message}</p>}
      {error && <p className="app-error" role="alert">{error}</p>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th scope="col">Tenant</th><th scope="col">Vlasnik</th><th scope="col">Plan</th><th scope="col">Stanje</th><th scope="col">Vrijedi do</th><th scope="col">Nadzor</th><th scope="col"><span className="sr-only">Radnja</span></th></tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => {
              const state = adminState(tenant)
              const days = daysLeft(tenant.periodEnd)
              return (
                <tr key={tenant.slug}>
                  <td><strong>{tenant.name}</strong><small>{tenant.slug}</small>{tenant.order && <span className="admin-badge admin-badge-pending">{orderBadge(tenant.order)}{tenant.order.billingName ? ` · ${tenant.order.billingName}` : ''}</span>}{tenant.request && <span className={`admin-badge ${isPaymentRequest(tenant.request) ? 'admin-badge-pending' : 'admin-badge-help'}`}>{REQUEST_LABEL[tenant.request.intent] ?? tenant.request.intent}{tenant.request.createdAt ? ` · ${formatZagreb(tenant.request.createdAt, false)}` : ''}</span>}</td>
                  <td>{tenant.ownerEmail ?? '—'}</td>
                  <td>{tenant.plan ? PLAN_LABEL[tenant.plan] ?? tenant.plan : '—'}</td>
                  <td><span className={`admin-badge admin-badge-${state}`}>{STATE_LABEL[state]}</span></td>
                  <td>{tenant.periodEnd ? formatZagreb(tenant.periodEnd, false) : '—'}{days !== null && state !== 'expired' && <small>{days} dana</small>}</td>
                  <td>{tenant.monitorOverall ? MONITOR_LABEL[tenant.monitorOverall] ?? tenant.monitorOverall : '—'}{tenant.monitorCheckedAt && <small>{formatZagreb(tenant.monitorCheckedAt)}</small>}</td>
                  <td><button className="app-button app-button-light" type="button" disabled={busy !== '' || state === 'none'} onClick={() => void activate(tenant)}>{busy === tenant.slug ? 'Aktiviram…' : tenant.order ? (tenant.order.kind === 'publisher_upgrade' ? 'Potvrdi uplatu (Publisher)' : 'Potvrdi uplatu') : state === 'active' ? 'Produlji za 1 god.' : 'Aktiviraj (1 god.)'}</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <button className="app-link-button" type="button" onClick={() => { setTenants(null); setKey(''); setMessage('') }}>Odjava</button>
    </main>
  )
}
