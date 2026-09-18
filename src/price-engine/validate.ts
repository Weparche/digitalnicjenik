import type { NormalizedPriceList, ParseWarning, ValidationIssue, ValidationResult } from './types'

const servicePattern = /uslug|service/i
const keyFor = (item: NormalizedPriceList['items'][number]) => item.externalId || `${item.category ?? ''}:${item.name}`

export function isServiceItem(item: NormalizedPriceList['items'][number]) {
  return servicePattern.test(item.type ?? '')
}

export function validatePriceList(priceList: NormalizedPriceList): ValidationResult {
  const issues: ValidationIssue[] = []
  priceList.items.forEach((item, index) => {
    const row = index + 2
    const itemKey = keyFor(item)
    if (!item.name.trim()) issues.push({ row, itemKey, field: 'name', severity: 'error', message: 'Nedostaje naziv.' })
    if (!Number.isFinite(item.price) || item.price <= 0) issues.push({ row, itemKey, field: 'price', severity: 'error', message: 'Maloprodajna cijena mora biti pozitivan broj.' })
    const service = isServiceItem(item)
    if (!item.type?.trim() || (!service && !/proiz|product|roba|artikl/i.test(item.type))) issues.push({ row, itemKey, field: 'type', severity: 'manual_review', message: 'Vrsta stavke nije dovoljno jasna za objavu.' })
    if (service && (item.anchorPrice == null || !Number.isFinite(item.anchorPrice) || item.anchorPrice <= 0)) issues.push({ row, itemKey, field: 'anchorPrice', severity: 'manual_review', message: 'Nedostaje sidrena cijena. Potrebna je vrijednost primjenjiva 10. rujna 2026. bez posebnog oblika prodaje.' })
    if (service && item.isNewSinceReferenceDate) issues.push({ row, itemKey, field: 'anchorPrice', severity: 'manual_review', message: 'Nova usluga zahtijeva ručni pregled referentne cijene.' })
    if (item.salePrice != null && (!Number.isFinite(item.salePrice) || item.salePrice <= 0)) issues.push({ row, itemKey, field: 'price', severity: 'error', message: 'Akcijska cijena mora biti pozitivan broj.' })
    if (item.salePrice != null && item.specialSaleApplied == null) issues.push({ row, itemKey, field: 'specialSaleApplied', severity: 'manual_review', message: 'Potvrdite je li cijena primijenjena tijekom posebnog oblika prodaje.' })
    if (item.specialSaleApplied === true && !item.specialSaleName?.trim()) issues.push({ row, itemKey, field: 'specialSaleName', severity: 'manual_review', message: 'Upišite naziv posebnog oblika prodaje.' })
  })
  return finalizeValidation(issues)
}

export function importIssuesFromParseWarnings(warnings: ParseWarning[], source: 'csv' | 'xlsx' | 'xml'): ValidationIssue[] {
  return warnings.map((warning) => ({
    row: warning.row,
    itemKey: `import:${warning.row}`,
    field: warning.field || 'import',
    severity: 'error' as const,
    message: warning.message.startsWith('Redak ') ? warning.message : `Redak ${warning.row} nije uvezen: ${warning.message}`,
    code: 'IMPORT_ROW_SKIPPED' as const,
    source,
  }))
}

export function mergeValidationIssues(base: ValidationResult, extra: ValidationIssue[]): ValidationResult {
  return finalizeValidation([...extra, ...base.issues])
}

function finalizeValidation(issues: ValidationIssue[]): ValidationResult {
  const blockingCount = issues.filter((issue) => issue.severity !== 'warning').length
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length
  const hasError = issues.some((issue) => issue.severity === 'error' || issue.code === 'IMPORT_ROW_SKIPPED')
  const hasManual = issues.some((issue) => issue.severity === 'manual_review')
  const status = hasError ? 'invalid' : hasManual ? 'manual_review' : 'ready_to_publish'
  return { status, issues, blockingCount, warningCount }
}
