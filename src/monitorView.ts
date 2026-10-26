import type { MonitorIssue, MonitorOverall, MonitorRunRecord } from '../shared/compliance/types'

export type Tone = 'ok' | 'warn' | 'fail'

export type MonitorRow = { label: string; value: string; tone: Tone }

export type MonitorView = {
  tone: Tone
  headline: string
  checkedLabel: string
  sections: Array<{ title: string; rows: MonitorRow[] }>
  /** Concrete per-field findings, e.g. "14 stavki nema: sidrena cijena." */
  findings: MonitorIssue[]
  /** Fields the ruleset requires but the NEPAR format cannot carry yet — shown collapsed, never as an alarm. */
  notices: MonitorIssue[]
}

const MARK: Record<Tone, string> = { ok: '✓', warn: '⚠', fail: '✕' }
export const toneMark = (tone: Tone) => MARK[tone]

export function formatZagreb(iso: string, withTime = true) {
  return new Intl.DateTimeFormat('hr-HR', { timeZone: 'Europe/Zagreb', dateStyle: 'medium', ...(withTime ? { timeStyle: 'short' } : {}) }).format(new Date(iso))
}

const toneOfOverall = (overall: MonitorOverall): Tone => (overall === 'fail' ? 'fail' : overall === 'warn' ? 'warn' : 'ok')
const httpTone = (status: number | null): Tone => (status === 200 ? 'ok' : 'fail')
const httpLabel = (status: number | null) => (status === null ? 'nedostupno' : `HTTP ${status}`)
const countFormat = new Intl.NumberFormat('hr-HR')

function rowsRow(label: string, rows: number | null, expected: number | null): MonitorRow {
  if (rows === null) return { label, value: 'nije moguće pročitati', tone: 'fail' }
  return { label, value: `${countFormat.format(rows)}${expected !== null && rows !== expected ? ` (očekivano ${countFormat.format(expected)})` : ''}`, tone: expected === null || rows === expected ? 'ok' : 'fail' }
}

function matchRow(label: string, match: boolean | null): MonitorRow {
  if (match === null) return { label, value: 'nije provjereno', tone: 'warn' }
  return { label, value: match ? 'odgovara' : 'ne odgovara', tone: match ? 'ok' : 'warn' }
}

export function buildMonitorView(run: MonitorRunRecord, ruleLabel: string, profileLabel: string): MonitorView {
  const tone = toneOfOverall(run.overall)
  const headline = tone === 'ok'
    ? 'SVE U REDU ✓'
    : tone === 'warn'
      ? '⚠ UPOZORENJE — provjerite cjenik'
      : `KRITIČNO — ${run.issues.find((issue) => issue.severity === 'fail')?.message ?? 'cjenik nije ispravno objavljen'}`

  const delta = run.prevRows !== null && run.expectedRows !== null ? run.expectedRows - run.prevRows : null
  const missing = run.issues.filter((issue) => issue.code === 'MISSING_REQUIRED_FIELD' || issue.code === 'INVALID_SPECIAL_SALE' || issue.code === 'PUBLISHED_VALIDATION_ISSUE')
  const archiveTone: Tone = run.archiveExpected === null || run.archiveAvailable === null
    ? 'warn'
    : run.archiveAvailable < run.archiveExpected || (run.archiveLatestStatus !== null && run.archiveLatestStatus !== 200) || (run.archiveOldestStatus !== null && run.archiveOldestStatus !== 200)
      ? 'fail'
      : 'ok'

  const sections: MonitorView['sections'] = [
    {
      title: 'Objava',
      rows: [
        { label: 'Objavljeno', value: run.publishedAt ? `${formatZagreb(run.publishedAt)}${run.publicationSequence ? ` · verzija ${run.publicationSequence}` : ''}` : 'nepoznato', tone: run.freshnessStatus === 'warn' ? 'warn' : 'ok' },
        { label: 'Stavki', value: run.expectedRows === null ? '—' : `${countFormat.format(run.expectedRows)} ${run.profile === 'services' ? 'usluga' : 'proizvoda'}`, tone: 'ok' },
        ...(delta === null ? [] : [{ label: 'Promjena od prethodne provjere', value: delta > 0 ? `+${delta}` : String(delta), tone: 'ok' as Tone }]),
        ...(run.freshnessStatus === 'n/a' ? [] : [{ label: 'Aktualnost', value: run.freshnessStatus === 'ok' ? 'objava za posljednji radni dan postoji' : 'nema objave za posljednji radni dan', tone: (run.freshnessStatus === 'ok' ? 'ok' : 'warn') as Tone }]),
      ],
    },
    {
      title: 'Strojni cjenik',
      rows: [
        { label: 'CSV', value: httpLabel(run.csvStatus), tone: httpTone(run.csvStatus) },
        { label: 'XML', value: httpLabel(run.xmlStatus), tone: httpTone(run.xmlStatus) },
        rowsRow('CSV stavke', run.csvRows, run.expectedRows),
        rowsRow('XML stavke', run.xmlRows, run.expectedRows),
        matchRow('Naziv datoteke · trenutna objava', run.filenamePublicationMatch),
        matchRow('Naziv datoteke · propisani oblik', run.filenameRulesetMatch),
        missing.length === 0
          ? { label: 'Obvezna polja', value: 'potpuna', tone: 'ok' }
          : { label: 'Obvezna polja', value: `${missing.reduce((sum, issue) => sum + (issue.rows ?? 0), 0)} nedostajućih vrijednosti`, tone: missing.some((issue) => issue.severity === 'fail') ? 'fail' : 'warn' },
      ],
    },
    {
      title: 'Arhiva',
      rows: [
        { label: '30-dnevna evidencija', value: run.archiveExpected === null ? '—' : `${run.archiveAvailable ?? 0}/${run.archiveExpected}`, tone: archiveTone },
        ...(run.archiveLatestStatus === null ? [] : [{ label: 'Najnoviji arhivirani cjenik', value: httpLabel(run.archiveLatestStatus), tone: httpTone(run.archiveLatestStatus) }]),
        ...(run.archiveOldestStatus === null ? [] : [{ label: 'Najstariji važeći cjenik', value: httpLabel(run.archiveOldestStatus), tone: httpTone(run.archiveOldestStatus) }]),
      ],
    },
  ]

  return {
    tone,
    headline,
    checkedLabel: `Provjereno ${formatZagreb(run.checkedAt)} · Pravila: ${ruleLabel} (${profileLabel})`,
    sections,
    findings: run.issues.filter((issue) => issue.severity === 'fail' || issue.severity === 'warn'),
    notices: run.issues.filter((issue) => issue.severity === 'info'),
  }
}
