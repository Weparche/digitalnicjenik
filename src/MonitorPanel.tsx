import { useCallback, useEffect, useState } from 'react'
import type { MonitorOverall, MonitorRunRecord } from '../shared/compliance/types'
import { buildMonitorView, formatZagreb, toneMark } from './monitorView'

type MonitorApi = {
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
    try {
      const response = await fetch(endpoint, { credentials: 'include' })
      if (response.ok) setData(await response.json() as MonitorApi)
    } catch {
      /* the panel simply stays empty */
    } finally {
      setLoaded(true)
    }
  }, [endpoint])

  useEffect(() => { void load() }, [load])

  async function runNow() {
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch(endpoint, { method: 'POST', credentials: 'include' })
      if (response.status === 429) setMessage('Provjera je nedavno pokrenuta. Pokušajte ponovno za nekoliko minuta.')
      else if (!response.ok) setMessage('Provjera trenutačno nije moguća.')
      else {
        const body = await response.json() as { status: string }
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
  if (!data) return null

  const view = data.latest ? buildMonitorView(data.latest, data.ruleset.label, data.profile.label) : null

  return (
    <section className={`monitor-panel${view ? ` monitor-${view.tone}` : ''}`} aria-labelledby="monitor-heading">
      <header className="monitor-head">
        <div>
          <span className="app-label">NADZOR USKLAĐENOSTI</span>
          <h2 id="monitor-heading">{view ? view.headline : 'Prva provjera još nije obavljena'}</h2>
          <p>{view ? view.checkedLabel : 'Cjenik provjeravamo svakodnevno, uključujući provjeru nakon roka u 08:00. Možete i odmah pokrenuti provjeru.'}</p>
        </div>
        <button className="app-button app-button-light" type="button" disabled={busy} onClick={() => void runNow()}>{busy ? 'Provjeravam…' : 'Provjeri sada'}</button>
      </header>
      {message && <p className="app-status" role="status">{message}</p>}

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
            <span>Sljedeća provjera: sutra prije 08:00</span>
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
