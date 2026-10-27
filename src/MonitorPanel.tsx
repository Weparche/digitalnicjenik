import { useCallback, useEffect, useState } from 'react'
import type { MonitorOverall, MonitorRunRecord } from '../shared/compliance/types'
import { buildMonitorView, formatZagreb, toneMark } from './monitorView'
import type { latestMonitorJob } from '../shared/compliance/jobs'

type MonitorApi = {
  job?: Awaited<ReturnType<typeof latestMonitorJob>>
  latest: MonitorRunRecord | null
  history: Array<{ id: string; checkedAt: string; overall: MonitorOverall }>
  lastOkAt: string | null
  ruleset: { id: string; label: string }
  profile: { id: string; label: string }
}

const OVERALL_LABEL: Record<MonitorOverall, string> = { ok: 'U redu', warn: 'Upozorenje', fail: 'Greška', skipped: 'Preskočeno' }

export function MonitorPanel({ slug }: { slug: string }) {
  const [data, setData] = useState<MonitorApi | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const endpoint = `/api/tenants/${encodeURIComponent(slug)}/monitor`

  const load = useCallback(async () => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 10_000)
    try {
      const response = await fetch(endpoint, { credentials: 'include', signal: controller.signal })
      if (response.ok) setData(await response.json() as MonitorApi)
    } catch {
      setMessage('Stanje nije moguće osvježiti. Pokušajte ponovno.')
    } finally {
      window.clearTimeout(timeout)
      setLoaded(true)
    }
  }, [endpoint])

  useEffect(() => { void load() }, [load])
  const pending = Boolean(data?.job && ['queued', 'running', 'notifying'].includes(data.job.status))
  const failed = Boolean(data?.job && ['failed', 'skipped'].includes(data.job.status))
  useEffect(() => {
    if (!pending) return
    let loading = false
    const timer = window.setInterval(async () => {
      if (loading) return
      loading = true
      try { await load() } finally { loading = false }
    }, 3000)
    return () => window.clearInterval(timer)
  }, [load, pending])

  async function runNow() {
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch(endpoint, { method: 'POST', credentials: 'include' })
      if (response.status === 429) setMessage('Provjera je nedavno pokrenuta. Pokušajte ponovno za nekoliko minuta.')
      else if (!response.ok) setMessage('Provjera trenutačno nije moguća.')
      else {
        const body = await response.json() as { status: string; jobId?: string }
        if (body.status === 'skipped') setMessage('Provjera se ne izvodi dok Publisher nije aktivan.')
        await load()
      }
    } catch {
      setMessage('Provjera trenutačno nije moguća.')
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) return <section className="monitor-panel" aria-label="Nadzor usklađenosti"><p className="app-status" role="status">Učitavamo stanje nadzora…</p></section>
  if (!data) return <section className="monitor-panel" aria-label="Nadzor cjenika"><h2>Stanje nadzora nije dostupno</h2><p role="status">{message || 'Pokušajte ponovno.'}</p><button className="app-button app-button-light" type="button" onClick={() => void load()}>Pokušaj ponovno</button></section>

  const view = data.latest && !pending && !failed ? buildMonitorView(data.latest, data.ruleset.label, data.profile.label) : null

  return (
    <section className={`monitor-panel${view ? ` monitor-${view.tone}` : ''}`} aria-labelledby="monitor-heading">
      <header className="monitor-head">
        <div>
          <h2 id="monitor-heading">{pending ? 'Provjera je u tijeku' : failed ? 'Provjeru nije moguće dovršiti' : view ? view.headline : 'Prva provjera još nije obavljena'}</h2>
          <p>{failed ? 'Pokušajte ponovno. Prethodni rezultat ne potvrđuje stanje ove provjere.' : pending ? 'Provjeravamo aktualni cjenik i arhivu. Rezultat će se prikazati kada provjera završi.' : view ? view.checkedLabel : 'Cjenik provjeravamo svakodnevno, uključujući provjeru nakon roka u 08:00. Možete i odmah pokrenuti provjeru.'}</p>
        </div>
        <button className="app-button app-button-light" type="button" disabled={busy || pending} onClick={() => void runNow()}>{busy || pending ? 'Provjera u tijeku…' : 'Provjeri sada'}</button>
      </header>
      {message && <p className="monitor-status" role="status">{message}</p>}
      {pending && data.job && <div role="status" className="monitor-status">
        {data.job.total > 0 ? <><p>Provjereno {data.job.checked} od {data.job.total} arhivskih objava.</p><progress className="monitor-progress" aria-label="Napredak provjere arhive" value={data.job.checked} max={data.job.total} /></> : <p>Provjeravamo dostupnost i sadržaj datoteka…</p>}
      </div>}

      {view && (
        <>
          <div className="monitor-grid">
            {view.sections.map((section) => (
              <div className="monitor-section" key={section.title}>
                <h3>{section.title}</h3>
                <dl>
                  {section.rows.map((row) => (
                    <div className={`monitor-row monitor-row-${row.tone}`} key={row.label}>
                      <dt>{row.label}</dt>
                      <dd><span aria-hidden="true">{toneMark(row.tone)}</span> {row.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>

          {view.findings.length > 0 && (
            <ul className="monitor-findings" aria-label="Pronađeni problemi">
              {view.findings.map((issue, index) => (
                <li key={`${issue.code}-${issue.field ?? ''}-${index}`} className={`monitor-finding-${issue.severity}`}>
                  <span aria-hidden="true">{issue.severity === 'fail' ? '✕' : '⚠'}</span> {issue.message}
                </li>
              ))}
            </ul>
          )}

          {view.notices.length > 0 && (
            <details className="monitor-notices">
              <summary>Polja propisana pravilima koja NEPAR format još ne sadrži ({view.notices.length})</summary>
              <ul>{view.notices.map((issue, index) => <li key={`${issue.code}-${issue.field ?? ''}-${index}`}>{issue.message}</li>)}</ul>
            </details>
          )}

          <footer className="monitor-foot">
            <span>Zadnja uspješna provjera: {data.lastOkAt ? formatZagreb(data.lastOkAt) : 'još nema'}</span>
            <span>Nadzor se nastavlja prema dnevnom rasporedu.</span>
            {data.history.length > 1 && (
              <ol className="monitor-history" aria-label="Povijest provjera (zadnjih 14 dana)">
                {data.history.slice(0, 14).reverse().map((item) => (
                  <li key={item.id} className={`monitor-dot monitor-dot-${item.overall}`} title={`${formatZagreb(item.checkedAt)} — ${OVERALL_LABEL[item.overall]}`}>
                    <span className="sr-only">{formatZagreb(item.checkedAt)}: {OVERALL_LABEL[item.overall]}</span>
                  </li>
                ))}
              </ol>
            )}
          </footer>
          <p className="monitor-disclaimer">Tehnička evidencija objave — nije pravni dokaz usklađenosti.</p>
        </>
      )}
    </section>
  )
}
