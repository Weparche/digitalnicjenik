import type { NormalizedPriceItem } from '../../src/price-engine/types'
import { FEED_FIELDS } from './document-parser'
import type { ProfileRule, RuleField, Ruleset } from './rulesets'
import type { FreshnessStatus, MonitorIssue, MonitorOverall } from './types'

const DAY_MS = 86_400_000

/** Fields the NEPAR data model (NormalizedPriceItem) can carry at all. Others are reported as a data-model gap, not a per-row failure. */
const MODEL_FIELDS: ReadonlySet<RuleField> = new Set<RuleField>([
  'name', 'price', 'externalId', 'category', 'unit', 'anchorPrice', 'specialSaleApplied', 'specialSaleName',
])

function isBlank(value: unknown) {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
}

function fieldMissing(item: NormalizedPriceItem, field: RuleField) {
  if (field === 'price') return !Number.isFinite(item.price) || item.price <= 0
  if (field === 'anchorPrice') return item.anchorPrice == null || !Number.isFinite(item.anchorPrice) || item.anchorPrice <= 0
  return isBlank((item as Record<string, unknown>)[field])
}

/** Required-field findings computed on the published payload (the source of truth for both feeds). */
export function evaluateRequiredFields(items: NormalizedPriceItem[], profile: ProfileRule): MonitorIssue[] {
  const issues: MonitorIssue[] = []
  for (const rule of profile.requiredFields) {
    if (!MODEL_FIELDS.has(rule.field)) {
      issues.push({
        code: 'FIELD_NOT_IN_DATA_MODEL',
        severity: 'info',
        field: rule.field,
        message: `Polje „${rule.label}” propisano je pravilima, ali NEPAR format cjenika ga još ne sadrži.`,
      })
      continue
    }
    const rows = items.filter((item) => fieldMissing(item, rule.field)).length
    if (rows > 0) {
      issues.push({
        code: 'MISSING_REQUIRED_FIELD',
        severity: rule.severity,
        field: rule.field,
        rows,
        message: `${rows} stavki nema: ${rule.label}.`,
      })
    }
  }
  const saleWithoutFlag = items.filter((item) => item.salePrice != null && item.specialSaleApplied == null).length
  if (saleWithoutFlag > 0) {
    issues.push({ code: 'INVALID_SPECIAL_SALE', severity: 'warn', field: 'specialSaleApplied', rows: saleWithoutFlag, message: `${saleWithoutFlag} stavki ima akcijsku cijenu bez oznake posebnog oblika prodaje.` })
  }
  return issues
}

/** Fields the ruleset requires that a given feed format does not carry (e.g. XML has no šifra/jedinica). */
export function evaluateFeedGaps(format: 'csv' | 'xml', profile: ProfileRule): MonitorIssue[] {
  const carried = new Set<string>(FEED_FIELDS[format])
  return profile.requiredFields
    .filter((rule) => MODEL_FIELDS.has(rule.field) && !carried.has(rule.field))
    .map((rule) => ({
      code: 'FIELD_NOT_IN_FEED',
      severity: 'info' as const,
      field: rule.field,
      message: `${format.toUpperCase()} datoteka ne sadrži polje „${rule.label}”.`,
    }))
}

export function parseContentDispositionFilename(header: string | null | undefined): string | null {
  if (!header) return null
  const star = /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i.exec(header)
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ''))
    } catch {
      /* fall through to plain filename */
    }
  }
  const plain = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(header)
  const value = plain?.[1] ?? plain?.[2]
  return value ? value.trim() : null
}

export type FilenameCheck = { filename: string | null; publicationMatch: boolean; rulesetMatch: boolean }

export function evaluateFilename(header: string | null | undefined, expectedStem: string, extension: 'csv' | 'xml', ruleset: Ruleset): FilenameCheck {
  const filename = parseContentDispositionFilename(header)
  if (!filename) return { filename: null, publicationMatch: false, rulesetMatch: false }
  const suffix = `.${extension}`
  const stem = filename.endsWith(suffix) ? filename.slice(0, -suffix.length) : null
  return {
    filename,
    publicationMatch: filename === `${expectedStem}${suffix}`,
    rulesetMatch: stem !== null && new RegExp(ruleset.filenameStemPattern).test(stem),
  }
}

function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '0'
  return { year: Number(get('year')), month: Number(get('month')), day: Number(get('day')), hour: Number(get('hour')) }
}

const dayNumber = (year: number, month: number, day: number) => Math.floor(Date.UTC(year, month - 1, day) / DAY_MS)

/** Most recent working day (Mon–Fri) on or before `dayNum` (days since epoch). No holiday calendar yet. */
function lastWorkingDayOnOrBefore(dayNum: number) {
  let day = dayNum
  // 1970-01-01 was a Thursday → (day + 4) % 7: 0=Sun … 6=Sat
  while (((day + 4) % 7 + 7) % 7 === 0 || ((day + 4) % 7 + 7) % 7 === 6) day -= 1
  return day
}

/**
 * Products: a publication is expected for the latest working day whose deadline has passed.
 * Never returns a hard failure; services: `n/a` (only publish on change).
 */
export function evaluateFreshness(profile: ProfileRule, publishedAt: string, now: Date, timeZone: string): FreshnessStatus {
  if (profile.freshness.kind === 'on_change') return 'n/a'
  const local = localParts(now, timeZone)
  const today = dayNumber(local.year, local.month, local.day)
  const expectedDay = lastWorkingDayOnOrBefore(local.hour >= profile.freshness.deadlineHour ? today : today - 1)
  const published = localParts(new Date(publishedAt), timeZone)
  return dayNumber(published.year, published.month, published.day) >= expectedDay ? 'ok' : 'warn'
}

export type ArchivePublication = { publishedAt: string; publicUntil: string | null }

/**
 * DB-level archive integrity: every non-current publication published within the archive window
 * must still be public (`public_until` in the future).
 */
export function evaluateArchiveIntegrity(publications: ArchivePublication[], now: Date, archiveDays: number) {
  const windowStart = now.getTime() - archiveDays * DAY_MS
  const inWindow = publications.filter((publication) => new Date(publication.publishedAt).getTime() >= windowStart)
  const available = inWindow.filter((publication) => publication.publicUntil !== null && new Date(publication.publicUntil).getTime() >= now.getTime())
  return { expected: inWindow.length, available: available.length }
}

export function overallFromIssues(issues: MonitorIssue[], freshness: FreshnessStatus): MonitorOverall {
  if (issues.some((issue) => issue.severity === 'fail')) return 'fail'
  if (freshness === 'warn' || issues.some((issue) => issue.severity === 'warn')) return 'warn'
  return 'ok'
}
