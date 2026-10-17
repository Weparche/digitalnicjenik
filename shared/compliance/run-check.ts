import type { D1DatabaseLike } from '../db'
import { entitlementIsLive } from '../entitlements'
import { deterministicHash } from '../../src/price-engine/hash'
import type { Entitlement, NormalizedPriceList } from '../../src/price-engine/types'
import { advanceMonitorState } from './alert-state'
import {
  evaluateArchiveIntegrity, evaluateFeedGaps, evaluateFilename, evaluateFreshness, evaluateRequiredFields, overallFromIssues, type FilenameCheck,
} from './checks'
import { compareFeedToPayload, parseCsvFeed, parseXmlFeed, sha256Hex, type ParsedFeed } from './document-parser'
import { ACTIVE_RULESET, getRuleset, isComplianceProfile } from './rulesets'
import { insertRun, readLatestRun, readState, writeState } from './store'
import type { AlertKind, ComplianceProfile, MonitorIssue, MonitorRunRecord, MonitorState, MonitorTrigger } from './types'

export type MonitorEnv = {
  DB: D1DatabaseLike
  DEMO_WRITE_TENANT?: string
  DEFAULT_PUBLICATION_TIMEZONE?: string
}

export type RunTenantCheckOptions = {
  slug: string
  trigger: MonitorTrigger
  now?: Date
  fetcher?: typeof fetch
  rulesetId?: string
}

export type RunTenantCheckResult =
  | { status: 'skipped'; reason: 'unknown_tenant' | 'not_live' | 'no_publication' }
  | { status: 'checked'; run: MonitorRunRecord; alert: AlertKind | null; state: MonitorState; tenant: { id: string; slug: string; name: string } }

const FETCH_TIMEOUT_MS = 15_000

type PublicationRow = {
  id: string; sequence: number; filename_stem: string; published_at: string; payload_json: string
  compliance_profile: string | null; timezone: string | null; hostname: string | null
}

type FeedProbe = {
  status: number | null
  rows: number | null
  sha256: string | null
  filename: FilenameCheck
  parsed: ParsedFeed | null
}

async function probe(fetcher: typeof fetch, url: string, format: 'csv' | 'xml', stem: string, ruleset: ReturnType<typeof getRuleset>) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  const empty: FeedProbe = { status: null, rows: null, sha256: null, filename: { filename: null, publicationMatch: false, rulesetMatch: false }, parsed: null }
  const issues: MonitorIssue[] = []
  try {
    const response = await fetcher(url, { signal: controller.signal, redirect: 'follow', headers: { 'cache-control': 'no-cache', 'user-agent': 'NEPAR-Compliance-Monitor/1' } })
    const result: FeedProbe = { ...empty, status: response.status }
    if (response.status !== 200) {
      await response.body?.cancel().catch(() => undefined)
      issues.push({ code: 'FEED_HTTP_ERROR', severity: 'fail', field: format, message: `${format.toUpperCase()} vraća HTTP ${response.status}.` })
      return { result, issues }
    }
    const bytes = new Uint8Array(await response.arrayBuffer())
    result.sha256 = await sha256Hex(bytes)
    result.filename = evaluateFilename(response.headers.get('content-disposition'), stem, format, ruleset)
    try {
      const text = new TextDecoder().decode(bytes)
      result.parsed = format === 'csv' ? parseCsvFeed(text) : parseXmlFeed(text)
      result.rows = result.parsed.records.length
    } catch (error) {
      issues.push({ code: 'FEED_UNPARSEABLE', severity: 'fail', field: format, message: `${format.toUpperCase()} nije moguće pročitati: ${error instanceof Error ? error.message : 'nepoznata greška'}` })
    }
    return { result, issues }
  } catch {
    issues.push({ code: 'FEED_HTTP_ERROR', severity: 'fail', field: format, message: `${format.toUpperCase()} nije dostupan (mrežna greška ili istek vremena).` })
    return { result: empty, issues }
  } finally {
    clearTimeout(timer)
  }
}

async function statusOf(fetcher: typeof fetch, url: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetcher(url, { signal: controller.signal, redirect: 'follow', headers: { 'cache-control': 'no-cache', 'user-agent': 'NEPAR-Compliance-Monitor/1' } })
    await response.body?.cancel().catch(() => undefined)
    return response.status
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * The single execution path for cron, retry and manual checks.
 * Reads D1, probes the public URLs, persists a `monitor_runs` row, advances the alert state.
 * Sending e-mail is the caller's job (see workers/monitor).
 */
export async function runTenantCheck(env: MonitorEnv, options: RunTenantCheckOptions): Promise<RunTenantCheckResult> {
  const started = Date.now()
  const now = options.now ?? new Date()
  const fetcher = options.fetcher ?? fetch
  const ruleset = getRuleset(options.rulesetId ?? ACTIVE_RULESET)
  const db = env.DB

  const tenant = await db.prepare('SELECT id, slug, name FROM tenants WHERE slug = ?').bind(options.slug).first<{ id: string; slug: string; name: string }>()
  if (!tenant) return { status: 'skipped', reason: 'unknown_tenant' }

  const isDemo = tenant.slug === (env.DEMO_WRITE_TENANT || 'nepar')
  if (!isDemo) {
    const row = await db.prepare('SELECT id, tenant_id, plan, status, period_start, period_end FROM entitlements WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1')
      .bind(tenant.id).first<{ id: string; tenant_id: string; plan: Entitlement['plan']; status: Entitlement['status']; period_start: string | null; period_end: string | null }>()
    const entitlement: Entitlement | null = row ? { id: row.id, tenantId: row.tenant_id, plan: row.plan, status: row.status, periodStart: row.period_start, periodEnd: row.period_end } : null
    // Expired/suspended tenants intentionally serve HTTP 410: that is expected, not an incident.
    if (!entitlementIsLive(entitlement, now.getTime())) return { status: 'skipped', reason: 'not_live' }
  }

  const publication = await db.prepare(
    `SELECT p.id, p.sequence, p.filename_stem, p.published_at, p.payload_json, m.compliance_profile, m.timezone,
       (SELECT hostname FROM publication_targets WHERE tenant_id = p.tenant_id AND status = 'active' ORDER BY created_at LIMIT 1) AS hostname
     FROM price_publications p LEFT JOIN publication_metadata m ON m.tenant_id = p.tenant_id
     WHERE p.tenant_id = ? AND p.is_current = 1 LIMIT 1`,
  ).bind(tenant.id).first<PublicationRow>()
  if (!publication || !publication.hostname) return { status: 'skipped', reason: 'no_publication' }

  const profileKey: ComplianceProfile = isComplianceProfile(publication.compliance_profile) ? publication.compliance_profile : 'products'
  const profile = ruleset.profiles[profileKey]
  const timeZone = publication.timezone || env.DEFAULT_PUBLICATION_TIMEZONE || 'Europe/Zagreb'
  const payload = JSON.parse(publication.payload_json) as NormalizedPriceList
  const expectedRows = payload.items.length
  const payloadSha256 = await deterministicHash(payload)
  const previousRun = await readLatestRun(db, tenant.id)
  const issues: MonitorIssue[] = []
  const base = `https://${publication.hostname}`

  const [csv, xml] = await Promise.all([
    probe(fetcher, `${base}/cjenik.csv`, 'csv', publication.filename_stem, ruleset),
    probe(fetcher, `${base}/cjenik.xml`, 'xml', publication.filename_stem, ruleset),
  ])
  issues.push(...csv.issues, ...xml.issues)

  for (const [format, feed] of [['csv', csv.result], ['xml', xml.result]] as const) {
    if (feed.parsed && feed.rows !== null) {
      if (feed.rows !== expectedRows) {
        issues.push({ code: 'ROW_COUNT_MISMATCH', severity: 'fail', field: format, message: `${format.toUpperCase()} ima ${feed.rows} stavki, očekivano ${expectedRows}.` })
      } else {
        const fidelity = compareFeedToPayload(payload.items, feed.parsed)
        if (fidelity.missing > 0 || fidelity.unexpected > 0) {
          issues.push({ code: 'FEED_CONTENT_MISMATCH', severity: 'fail', field: format, rows: fidelity.missing + fidelity.unexpected, message: `${format.toUpperCase()} se sadržajem (naziv/cijena) ne podudara s objavljenim cjenikom.` })
        }
      }
    }
    if (feed.status === 200) {
      if (!feed.filename.publicationMatch) {
        issues.push({ code: 'FILENAME_PUBLICATION_MISMATCH', severity: 'warn', field: format, message: `Naziv ${format.toUpperCase()} datoteke (${feed.filename.filename ?? 'nema'}) ne odgovara trenutnoj objavi.` })
      }
      if (!feed.filename.rulesetMatch) {
        issues.push({ code: 'FILENAME_RULESET_MISMATCH', severity: 'warn', field: format, message: `Naziv ${format.toUpperCase()} datoteke ne odgovara propisanom obliku (${ruleset.label}).` })
      }
    }
    issues.push(...evaluateFeedGaps(format, profile))
  }

  issues.push(...evaluateRequiredFields(payload.items, profile))

  const freshness = evaluateFreshness(profile, publication.published_at, now, timeZone)
  if (freshness === 'warn') {
    issues.push({ code: 'STALE_PUBLICATION', severity: 'warn', message: 'Nema objave za posljednji radni dan. Ako se cijene nisu mijenjale, objava je i dalje važeća.' })
  }

  const archiveRows = await db.prepare(
    'SELECT filename_stem, published_at, public_until FROM price_publications WHERE tenant_id = ? AND is_current = 0 AND published_at >= ? ORDER BY published_at DESC',
  ).bind(tenant.id, new Date(now.getTime() - ruleset.archiveDays * 86_400_000).toISOString())
    .all<{ filename_stem: string; published_at: string; public_until: string | null }>()
  const archive = evaluateArchiveIntegrity(archiveRows.results.map((row) => ({ publishedAt: row.published_at, publicUntil: row.public_until })), now, ruleset.archiveDays)
  if (archive.available < archive.expected) {
    issues.push({ code: 'ARCHIVE_INCOMPLETE', severity: 'fail', rows: archive.expected - archive.available, message: `Arhiva: dostupno ${archive.available} od ${archive.expected} objava u posljednjih ${ruleset.archiveDays} dana.` })
  }
  const live = archiveRows.results.filter((row) => row.public_until !== null && new Date(row.public_until).getTime() >= now.getTime())
  let archiveLatestStatus: number | null = null
  let archiveOldestStatus: number | null = null
  if (live.length > 0) {
    const latest = live[0]!
    const oldest = live[live.length - 1]!
    archiveLatestStatus = await statusOf(fetcher, `${base}/${latest.filename_stem}.csv`)
    archiveOldestStatus = oldest === latest ? archiveLatestStatus : await statusOf(fetcher, `${base}/${oldest.filename_stem}.csv`)
    if (archiveLatestStatus !== 200 || archiveOldestStatus !== 200) {
      issues.push({ code: 'ARCHIVE_UNREACHABLE', severity: 'fail', message: `Arhivirani cjenik nije dostupan (najnoviji: HTTP ${archiveLatestStatus ?? 'greška'}, najstariji: HTTP ${archiveOldestStatus ?? 'greška'}).` })
    }
  }
  const archivePage = await statusOf(fetcher, `${base}/arhiva`)
  if (archivePage !== 200) {
    issues.push({ code: 'ARCHIVE_PAGE_ERROR', severity: 'warn', message: `Stranica arhive vraća HTTP ${archivePage ?? 'greška'}.` })
  }

  const run: MonitorRunRecord = {
    id: crypto.randomUUID(),
    tenantId: tenant.id,
    publicationId: publication.id,
    checkedAt: now.toISOString(),
    trigger: options.trigger,
    ruleset: ruleset.id,
    profile: profileKey,
    overall: overallFromIssues(issues, freshness),
    csvStatus: csv.result.status,
    xmlStatus: xml.result.status,
    csvRows: csv.result.rows,
    xmlRows: xml.result.rows,
    expectedRows,
    prevRows: previousRun?.expectedRows ?? null,
    filenamePublicationMatch: csv.result.status === 200 && xml.result.status === 200 ? csv.result.filename.publicationMatch && xml.result.filename.publicationMatch : null,
    filenameRulesetMatch: csv.result.status === 200 && xml.result.status === 200 ? csv.result.filename.rulesetMatch && xml.result.filename.rulesetMatch : null,
    filenameCsv: csv.result.filename.filename,
    filenameXml: xml.result.filename.filename,
    freshnessStatus: freshness,
    archiveExpected: archive.expected,
    archiveAvailable: archive.available,
    archiveLatestStatus,
    archiveOldestStatus,
    payloadSha256,
    csvSha256: csv.result.sha256,
    xmlSha256: xml.result.sha256,
    issues,
    durationMs: Date.now() - started,
    publishedAt: publication.published_at,
    publicationSequence: publication.sequence,
  }

  const previousState = await readState(db, tenant.id)
  const { state, alert } = advanceMonitorState(previousState, run.overall, now)
  await insertRun(db, run)
  await writeState(db, state)
  return { status: 'checked', run, alert, state, tenant }
}
