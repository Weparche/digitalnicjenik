import type { D1DatabaseLike } from '../db'
import { emptyMonitorState } from './alert-state'
import type { AlertKind, ComplianceProfile, FreshnessStatus, MonitorIssue, MonitorOverall, MonitorRunRecord, MonitorState, MonitorTrigger } from './types'

type RunRow = {
  id: string; tenant_id: string; publication_id: string | null; checked_at: string; run_trigger: MonitorTrigger; ruleset: string
  profile: ComplianceProfile; overall: MonitorOverall; csv_status: number | null; xml_status: number | null; csv_rows: number | null
  xml_rows: number | null; expected_rows: number | null; prev_rows: number | null; filename_publication_match: number | null
  filename_ruleset_match: number | null; filename_csv: string | null; filename_xml: string | null; freshness_status: FreshnessStatus
  archive_expected: number | null; archive_available: number | null; archive_latest_status: number | null; archive_oldest_status: number | null
  payload_sha256: string | null; csv_sha256: string | null; xml_sha256: string | null; issues_json: string; duration_ms: number
  published_at: string | null; publication_sequence: number | null
}

const flag = (value: number | null) => (value === null ? null : value === 1)
const bit = (value: boolean | null) => (value === null ? null : value ? 1 : 0)

function parseIssues(value: string): MonitorIssue[] {
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? (parsed as MonitorIssue[]) : []
  } catch {
    return []
  }
}

export function mapRun(row: RunRow): MonitorRunRecord {
  return {
    id: row.id, tenantId: row.tenant_id, publicationId: row.publication_id, checkedAt: row.checked_at, trigger: row.run_trigger,
    ruleset: row.ruleset, profile: row.profile, overall: row.overall, csvStatus: row.csv_status, xmlStatus: row.xml_status,
    csvRows: row.csv_rows, xmlRows: row.xml_rows, expectedRows: row.expected_rows, prevRows: row.prev_rows,
    filenamePublicationMatch: flag(row.filename_publication_match), filenameRulesetMatch: flag(row.filename_ruleset_match),
    filenameCsv: row.filename_csv, filenameXml: row.filename_xml, freshnessStatus: row.freshness_status,
    archiveExpected: row.archive_expected, archiveAvailable: row.archive_available, archiveLatestStatus: row.archive_latest_status,
    archiveOldestStatus: row.archive_oldest_status, payloadSha256: row.payload_sha256, csvSha256: row.csv_sha256, xmlSha256: row.xml_sha256,
    issues: parseIssues(row.issues_json), durationMs: row.duration_ms, publishedAt: row.published_at, publicationSequence: row.publication_sequence,
  }
}

export async function insertRun(db: D1DatabaseLike, run: MonitorRunRecord) {
  await db.prepare(
    `INSERT INTO monitor_runs (id, tenant_id, publication_id, checked_at, run_trigger, ruleset, profile, overall, csv_status, xml_status, csv_rows, xml_rows,
      expected_rows, prev_rows, filename_publication_match, filename_ruleset_match, filename_csv, filename_xml, freshness_status, archive_expected,
      archive_available, archive_latest_status, archive_oldest_status, payload_sha256, csv_sha256, xml_sha256, issues_json, duration_ms, published_at, publication_sequence)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).bind(
    run.id, run.tenantId, run.publicationId, run.checkedAt, run.trigger, run.ruleset, run.profile, run.overall, run.csvStatus, run.xmlStatus, run.csvRows, run.xmlRows,
    run.expectedRows, run.prevRows, bit(run.filenamePublicationMatch), bit(run.filenameRulesetMatch), run.filenameCsv, run.filenameXml, run.freshnessStatus,
    run.archiveExpected, run.archiveAvailable, run.archiveLatestStatus, run.archiveOldestStatus, run.payloadSha256, run.csvSha256, run.xmlSha256,
    JSON.stringify(run.issues), run.durationMs, run.publishedAt, run.publicationSequence,
  ).run()
}

export async function readLatestRun(db: D1DatabaseLike, tenantId: string): Promise<MonitorRunRecord | null> {
  const row = await db.prepare('SELECT * FROM monitor_runs WHERE tenant_id = ? ORDER BY checked_at DESC LIMIT 1').bind(tenantId).first<RunRow>()
  return row ? mapRun(row) : null
}

export async function readRunHistory(db: D1DatabaseLike, tenantId: string, sinceIso: string, limit = 60): Promise<MonitorRunRecord[]> {
  const rows = await db.prepare('SELECT * FROM monitor_runs WHERE tenant_id = ? AND checked_at >= ? ORDER BY checked_at DESC LIMIT ?').bind(tenantId, sinceIso, limit).all<RunRow>()
  return rows.results.map(mapRun)
}

type StateRow = {
  tenant_id: string; last_overall: MonitorOverall | null; last_ok_at: string | null; last_alert_at: string | null; last_alert_kind: AlertKind | null
  alert_open: number; consecutive_failures: number; last_manual_at: string | null
}

export async function readState(db: D1DatabaseLike, tenantId: string): Promise<MonitorState> {
  const row = await db.prepare('SELECT * FROM monitor_state WHERE tenant_id = ?').bind(tenantId).first<StateRow>()
  if (!row) return emptyMonitorState(tenantId)
  return {
    tenantId: row.tenant_id, lastOverall: row.last_overall, lastOkAt: row.last_ok_at, lastAlertAt: row.last_alert_at, lastAlertKind: row.last_alert_kind,
    alertOpen: row.alert_open === 1, consecutiveFailures: row.consecutive_failures, lastManualAt: row.last_manual_at,
  }
}

/** Upsert without touching `last_manual_at` (owned by claimManualRun). */
export async function writeState(db: D1DatabaseLike, state: MonitorState) {
  await db.prepare(
    `INSERT INTO monitor_state (tenant_id, last_overall, last_ok_at, last_alert_at, last_alert_kind, alert_open, consecutive_failures)
     VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(tenant_id) DO UPDATE SET last_overall = excluded.last_overall, last_ok_at = excluded.last_ok_at, last_alert_at = excluded.last_alert_at,
       last_alert_kind = excluded.last_alert_kind, alert_open = excluded.alert_open, consecutive_failures = excluded.consecutive_failures`,
  ).bind(state.tenantId, state.lastOverall, state.lastOkAt, state.lastAlertAt, state.lastAlertKind, state.alertOpen ? 1 : 0, state.consecutiveFailures).run()
}

export const MANUAL_RUN_MIN_INTERVAL_MS = 5 * 60 * 1000

/**
 * Atomic manual-run rate limit: one conditional upsert, so two simultaneous requests cannot both pass.
 * Returns true when the caller now owns the slot.
 */
export async function claimManualRun(db: D1DatabaseLike, tenantId: string, now: Date, minIntervalMs = MANUAL_RUN_MIN_INTERVAL_MS) {
  const cutoff = new Date(now.getTime() - minIntervalMs).toISOString()
  const result = await db.prepare(
    `INSERT INTO monitor_state (tenant_id, last_manual_at) VALUES (?, ?)
     ON CONFLICT(tenant_id) DO UPDATE SET last_manual_at = excluded.last_manual_at
     WHERE monitor_state.last_manual_at IS NULL OR monitor_state.last_manual_at <= ?`,
  ).bind(tenantId, now.toISOString(), cutoff).run()
  return result.meta?.changes === 1
}

export type MonitorTarget = { tenantId: string; slug: string; name: string }

/** Tenants with an active public target and a current publication. Entitlement is checked per tenant in runTenantCheck. */
export async function listMonitorTargets(db: D1DatabaseLike): Promise<MonitorTarget[]> {
  const rows = await db.prepare(
    `SELECT DISTINCT t.id AS tenant_id, t.slug, t.name FROM tenants t
     JOIN publication_targets target ON target.tenant_id = t.id AND target.status = 'active'
     JOIN price_publications p ON p.tenant_id = t.id AND p.is_current = 1
     ORDER BY t.slug`,
  ).all<{ tenant_id: string; slug: string; name: string }>()
  return rows.results.map((row) => ({ tenantId: row.tenant_id, slug: row.slug, name: row.name }))
}

/** Retry pass: tenants whose latest run is warn/fail, or that have no run since `sinceIso`. */
export async function selectRetryTargets(db: D1DatabaseLike, targets: MonitorTarget[], sinceIso: string): Promise<MonitorTarget[]> {
  const latest = await db.prepare(
    `SELECT r.tenant_id, r.overall, r.checked_at FROM monitor_runs r
     JOIN (SELECT tenant_id, MAX(checked_at) AS checked_at FROM monitor_runs GROUP BY tenant_id) m
       ON m.tenant_id = r.tenant_id AND m.checked_at = r.checked_at`,
  ).all<{ tenant_id: string; overall: MonitorOverall; checked_at: string }>()
  const byTenant = new Map(latest.results.map((row) => [row.tenant_id, row]))
  return targets.filter((target) => {
    const last = byTenant.get(target.tenantId)
    if (!last || last.checked_at < sinceIso) return true
    return last.overall === 'warn' || last.overall === 'fail'
  })
}

export async function readOwnerEmails(db: D1DatabaseLike, tenantId: string): Promise<string[]> {
  const rows = await db.prepare(
    `SELECT u.email FROM tenant_members m JOIN auth_users u ON u.id = m.user_id WHERE m.tenant_id = ? ORDER BY m.created_at`,
  ).bind(tenantId).all<{ email: string }>()
  return rows.results.map((row) => row.email)
}
