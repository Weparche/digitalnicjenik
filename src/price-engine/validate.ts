import { isValidGtin } from './normalize'
import { isServiceItem } from './profile'
import type { NormalizedPriceList, ParseWarning, ValidationIssue, ValidationResult } from './types'

export { isServiceItem }

const keyFor = (item: NormalizedPriceList['items'][number]) => item.externalId || `${item.category ?? ''}:${item.name}`

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
    if (!service) validateProductFields(item, row, itemKey, issues)
    if (service && item.isNewSinceReferenceDate) issues.push({ row, itemKey, field: 'anchorPrice', severity: 'manual_review', message: 'Nova usluga zahtijeva ručni pregled referentne cijene.' })
    if (item.salePrice != null && (!Number.isFinite(item.salePrice) || item.salePrice <= 0)) issues.push({ row, itemKey, field: 'price', severity: 'error', message: 'Akcijska cijena mora biti pozitivan broj.' })
    if (item.salePrice != null && item.specialSaleApplied == null) issues.push({ row, itemKey, field: 'specialSaleApplied', severity: 'manual_review', message: 'Potvrdite je li cijena primijenjena tijekom posebnog oblika prodaje.' })
    if (item.specialSaleApplied === true && !item.specialSaleName?.trim()) issues.push({ row, itemKey, field: 'specialSaleName', severity: 'manual_review', message: 'Upišite naziv posebnog oblika prodaje.' })
  })
  return finalizeValidation(issues)
}

const MISSING_ANCHOR_PRODUCT = 'Nedostaje sidrena cijena. Odluka je traži i za proizvode.'

/** Obvezna polja cjenika proizvoda (NN 101/2026-1213, čl. III). Barkod i cijena za jedinicu mjere traže se samo gdje su primjenjivi pa su upozorenja. */
function validateProductFields(item: NormalizedPriceList['items'][number], row: number, itemKey: string, issues: ValidationIssue[]) {
  const text = (value: string | null | undefined) => (value ?? '').trim()
  if (item.anchorPrice == null || !Number.isFinite(item.anchorPrice) || item.anchorPrice <= 0) issues.push({ row, itemKey, field: 'anchorPrice', severity: 'manual_review', message: MISSING_ANCHOR_PRODUCT })
  if (!text(item.externalId)) issues.push({ row, itemKey, field: 'externalId', severity: 'manual_review', message: 'Nedostaje šifra proizvoda.' })
  if (!text(item.brand)) issues.push({ row, itemKey, field: 'brand', severity: 'manual_review', message: 'Nedostaje marka. Upišite „bez marke” ako je proizvod nema.' })
  if (!item.availability) issues.push({ row, itemKey, field: 'availability', severity: 'manual_review', message: 'Navedite je li proizvod dostupan ili nedostupan.' })
  const barcode = text(item.barcode)
  if (!barcode) issues.push({ row, itemKey, field: 'barcode', severity: 'warning', message: 'Nedostaje barkod. Odluka ga traži gdje je primjenjiv.' })
  else if (!isValidGtin(barcode)) issues.push({ row, itemKey, field: 'barcode', severity: 'warning', message: 'Barkod nije valjan (očekuje se EAN-8, EAN-13, UPC-A ili GTIN-14 s ispravnom kontrolnom znamenkom).' })
  if (text(item.unit) && (item.unitPrice == null || !Number.isFinite(item.unitPrice) || item.unitPrice <= 0)) issues.push({ row, itemKey, field: 'unitPrice', severity: 'warning', message: 'Uz jedinicu mjere navedite i cijenu za jedinicu mjere.' })
  if (item.unitPrice != null && !text(item.unit)) issues.push({ row, itemKey, field: 'unit', severity: 'warning', message: 'Cijena za jedinicu mjere traži i navedenu jedinicu mjere.' })
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
