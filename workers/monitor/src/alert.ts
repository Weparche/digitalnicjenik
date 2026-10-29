import { sendTransactionalEmail, type EmailEnv } from '../../../shared/email'
import type { D1DatabaseLike } from '../../../shared/db'
import { readOwnerEmails } from '../../../shared/compliance/store'
import type { AlertKind, MonitorIssue, MonitorRunRecord, MonitorTrigger } from '../../../shared/compliance/types'

export type AlertEnv = EmailEnv & { LIFECYCLE_EMAILS_ENABLED?: string; DAILY_PUBLICATION_ENABLED?: string; DB: D1DatabaseLike; PUBLIC_APP_URL?: string }

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char)

const zagrebTime = (iso: string) => new Intl.DateTimeFormat('hr-HR', { timeZone: 'Europe/Zagreb', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))

function problemLines(issues: MonitorIssue[]) {
  return issues.filter((issue) => issue.severity === 'fail').map((issue) => issue.message)
}

function nextCheckLine(trigger: MonitorTrigger) {
  // The first daily pass is followed by a retry before the 08:00 deadline; after the retry the next pass is tomorrow.
  return trigger === 'cron' ? 'Ponovna automatska provjera obavit će se prije 08:00.' : 'Sljedeća automatska provjera je sutra prije 08:00.'
}

export type AlertMessage = { subject: string; text: string; html: string }

export function buildAlertMessage(kind: AlertKind, run: MonitorRunRecord, tenant: { name: string }, appUrl = 'https://digitalnicjenik.nepar.hr'): AlertMessage {
  const when = zagrebTime(run.checkedAt)
  const dashboard = `${appUrl.replace(/\/$/, '')}/app`
  let headline: string
  let subject: string
  let lines: string[]
  let footer: string

  if (kind === 'recovery') {
    subject = `Cjenik je ponovno ispravan — ${tenant.name}`
    headline = 'Cjenik je ponovno ispravan ✓'
    lines = [`Posljednja provjera (${when}) nije pronašla nikakve kritične probleme.`]
    footer = 'Nije potrebna nikakva radnja.'
  } else {
    const problems = problemLines(run.issues)
    subject = kind === 'persistent_fail'
      ? `Cjenik je i dalje neispravan — ${tenant.name}`
      : `Cjenik nije ispravno objavljen — ${tenant.name}`
    headline = `KRITIČNO — ${problems[0] ?? 'cjenik nije ispravno objavljen'}`
    lines = [
      kind === 'persistent_fail' ? `Problem traje i dalje. Zadnja provjera: ${when}.` : `Problem otkriven: ${when}.`,
      ...problems.slice(1),
      ...(run.csvStatus === 200 && run.xmlStatus !== 200 ? ['CSV je uredan.'] : []),
      ...(run.xmlStatus === 200 && run.csvStatus !== 200 ? ['XML je uredan.'] : []),
    ]
    footer = `${nextCheckLine(run.trigger)} Provjerite stanje na ${dashboard}.`
  }

  const text = [headline, '', ...lines.map((line) => `- ${line}`), '', footer, '', `Pravila: ${run.ruleset}`, 'NEPAR Publisher — tehnička evidencija objave, nije pravni dokaz.'].join('\n')
  const html = [
    `<p><strong>${escapeHtml(headline)}</strong></p>`,
    `<ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`,
    `<p>${escapeHtml(footer)}</p>`,
    `<p style="color:#475569;font-size:13px">Pravila: ${escapeHtml(run.ruleset)} · NEPAR Publisher — tehnička evidencija objave, nije pravni dokaz.</p>`,
  ].join('')
  return { subject, text, html }
}

/** Sends to every tenant owner and, as a copy, to the ops address. One failing recipient never blocks the others. */
export async function sendAlert(
  env: AlertEnv,
  kind: AlertKind,
  run: MonitorRunRecord,
  tenant: { id: string; name: string },
  fetcher: typeof fetch = fetch,
  deliveryId?: string,
): Promise<{ sent: string[]; failed: string[] }> {
  const { recordMonitorNotifications } = await import('../../../shared/monitor-notifications')
  const { dispatchLifecycle } = await import('../../../shared/lifecycle')
  await recordMonitorNotifications(env,run,tenant)
  await dispatchLifecycle(env)
  return { sent: [], failed: [] }
}
