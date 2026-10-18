import type { ComplianceProfile, IssueSeverity } from './types'

/** Canonical item fields used by rules. `brand`, `barcode` and `availability` are required by the regulation for products and are part of the NEPAR product structure. */
export type RuleField =
  | 'name'
  | 'price'
  | 'externalId'
  | 'category'
  | 'unit'
  | 'anchorPrice'
  | 'specialSaleApplied'
  | 'specialSaleName'
  | 'brand'
  | 'barcode'
  | 'availability'

export type RequiredFieldRule = {
  field: RuleField
  label: string
  /** Severity when at least one row misses the field. */
  severity: IssueSeverity
}

export type FreshnessRule =
  /** A new publication is expected for every working day, by `deadlineHour` local time. Never `fail` in Sprint 1 (no working-day calendar). */
  | { kind: 'working_day'; deadlineHour: number }
  /** A publication is only expected when prices change; staleness is not an issue. */
  | { kind: 'on_change' }

export type ProfileRule = {
  label: string
  requiredFields: RequiredFieldRule[]
  freshness: FreshnessRule
}

export type Ruleset = {
  id: string
  label: string
  /** Regex source for `<oblik>_<adresa>_<oznaka>_<broj>_<datum-vrijeme>` (without extension). */
  filenameStemPattern: string
  archiveDays: number
  profiles: Record<ComplianceProfile, ProfileRule>
}

/** Odluka o objavi cjenika (NN 101/2026) — interim regime valid until the new Pravilnik applies. */
const nn1012026: Ruleset = {
  id: 'nn-101-2026',
  label: 'Odluka NN 101/2026',
  filenameStemPattern: '^[a-z0-9-]+_[a-z0-9-]+_[a-z0-9-]+_\\d+_\\d{8}-\\d{6}$',
  archiveDays: 30,
  profiles: {
    products: {
      label: 'cjenik proizvoda',
      freshness: { kind: 'working_day', deadlineHour: 8 },
      requiredFields: [
        { field: 'name', label: 'naziv', severity: 'fail' },
        { field: 'price', label: 'maloprodajna cijena', severity: 'fail' },
        { field: 'externalId', label: 'šifra', severity: 'warn' },
        { field: 'anchorPrice', label: 'sidrena cijena', severity: 'warn' },
        { field: 'brand', label: 'marka', severity: 'warn' },
        { field: 'barcode', label: 'barkod', severity: 'warn' },
        { field: 'availability', label: 'dostupnost', severity: 'warn' },
      ],
    },
    services: {
      label: 'cjenik usluga',
      freshness: { kind: 'on_change' },
      requiredFields: [
        { field: 'name', label: 'naziv usluge', severity: 'fail' },
        { field: 'price', label: 'cijena', severity: 'fail' },
        { field: 'anchorPrice', label: 'sidrena cijena', severity: 'warn' },
      ],
    },
  },
}

// Add the new Pravilnik here (e.g. 'zzp-2026-pravilnik-v1') and switch ACTIVE_RULESET — no Worker changes needed.
export const complianceRules: Record<string, Ruleset> = {
  [nn1012026.id]: nn1012026,
}

export const ACTIVE_RULESET = nn1012026.id

export function getRuleset(id: string = ACTIVE_RULESET): Ruleset {
  const ruleset = complianceRules[id]
  if (!ruleset) throw new Error(`unknown_ruleset:${id}`)
  return ruleset
}

export function isComplianceProfile(value: unknown): value is ComplianceProfile {
  return value === 'products' || value === 'services'
}
