import { isValidGtin, normalizeReferenceDate, validRequiredPrice } from './normalize'
import { isServiceItem } from './profile'
import type { NormalizedPriceList, ParseWarning, ValidationIssue, ValidationResult } from './types'

export { isServiceItem }

const keyFor = (item: NormalizedPriceList['items'][number]) => item.externalId || `${item.category ?? ''}:${item.name}`

export function validatePriceList(priceList: NormalizedPriceList, options: { now?: Date; timeZone?: string } = {}): ValidationResult {
  const issues: ValidationIssue[] = []
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: options.timeZone ?? 'Europe/Zagreb', year: 'numeric', month: '2-digit', day: '2-digit' }).format(options.now ?? new Date())
  if (!priceList.items.length) issues.push({ row: 1, itemKey: 'empty', field: 'import', severity: 'error', message: 'Cjenik mora sadržavati barem jednu stavku.' })
  priceList.items.forEach((item, index) => {
    const row = index + 2
    const itemKey = keyFor(item)
    if (!item.name.trim()) issues.push({ row, itemKey, field: 'name', severity: 'error', message: 'Nedostaje naziv.' })
    const service = isServiceItem(item)
    if (!validRequiredPrice(item.price, service)) issues.push({ row, itemKey, field: 'price', severity: 'error', message: service ? 'Maloprodajna cijena usluge mora biti broj veći ili jednak nuli.' : 'Maloprodajna cijena mora biti pozitivan broj.' })
    if (item.unitPrice != null && (!Number.isFinite(item.unitPrice) || item.unitPrice <= 0)) issues.push({ row, itemKey, field: 'unitPrice', severity: 'error', message: 'Unesena cijena za jedinicu mjere mora biti pozitivan broj, neovisno o izuzeću.' })
    if (!item.type?.trim() || (!service && !/proiz|product|roba|artikl/i.test(item.type))) issues.push({ row, itemKey, field: 'type', severity: 'manual_review', message: 'Vrsta stavke nije dovoljno jasna za objavu.' })
    if (service && !validRequiredPrice(item.anchorPrice, true)) issues.push({ row, itemKey, field: 'anchorPrice', severity: 'manual_review', message: item.anchorPrice == null ? 'Nedostaje sidrena cijena. Potrebna je vrijednost primjenjiva 10. rujna 2026. bez posebnog oblika prodaje.' : 'Sidrena cijena usluge mora biti broj veći ili jednak nuli.' })
    if (!service) validateProductFields(item, row, itemKey, issues)
    const reference = normalizeReferenceDate(item.anchorReferenceDate)
    if (reference && reference > today) issues.push({ row, itemKey, field: 'anchorPrice', severity: 'error', message: 'Datum referentne cijene ne može biti u budućnosti.' })
    if (item.anchorReferenceDate && !reference) issues.push({ row, itemKey, field: 'anchorPrice', severity: 'error', message: 'Datum referentne cijene nije valjan.' })
    if (!service && !reference) issues.push({ row, itemKey, field: 'anchorPrice', severity: 'manual_review', message: 'Odaberite mjerodavni datum referentne cijene proizvoda: 2. svibnja 2025. ili 10. rujna 2026., odnosno datum prvog uvrštenja nove stavke.' })
    if (item.isNewSinceReferenceDate) {
      if (!reference || reference <= '2026-09-10') issues.push({ row, itemKey, field: 'anchorPrice', severity: 'manual_review', message: 'Nova usluga ili proizvod zahtijeva datum prvog uvrštenja nakon 10. rujna 2026. i cijenu s tog datuma.' })
    } else if (reference && !(service ? reference === '2026-09-10' : ['2025-05-02', '2026-09-10'].includes(reference))) {
      issues.push({ row, itemKey, field: 'anchorPrice', severity: 'manual_review', message: 'Provjerite referentni datum; za novu stavku izričito označite prvo uvrštenje.' })
    }
    if (item.salePrice != null && (!Number.isFinite(item.salePrice) || item.salePrice <= 0)) issues.push({ row, itemKey, field: 'price', severity: 'error', message: 'Akcijska cijena mora biti pozitivan broj.' })
    if (item.specialSaleApplied == null) issues.push({ row, itemKey, field: 'specialSaleApplied', severity: 'manual_review', message: 'Potvrdite je li cijena primijenjena tijekom posebnog oblika prodaje.' })
    if (item.salePrice != null && item.salePrice >= item.price) issues.push({ row, itemKey, field: 'price', severity: 'error', message: 'Akcijska cijena mora biti niža od redovne cijene.' })
    if (item.salePrice != null && item.specialSaleApplied === false) issues.push({ row, itemKey, field: 'specialSaleApplied', severity: 'manual_review', message: 'Akcijska cijena nije usklađena s oznakom da nema posebne prodaje.' })
    if (item.specialSaleApplied === true && !item.specialSaleName?.trim()) issues.push({ row, itemKey, field: 'specialSaleName', severity: 'manual_review', message: 'Upišite naziv posebnog oblika prodaje.' })
    if (item.specialSaleApplied === true && (item.lowest30DayPrice == null || !Number.isFinite(item.lowest30DayPrice) || item.lowest30DayPrice <= 0)) issues.push({ row, itemKey, field: 'price', severity: 'manual_review', message: 'Za javni prikaz akcije unesite prethodnu najnižu cijenu iz svoje evidencije (30 dana). Sidrena cijena nije zamjena za taj podatak. Za posebna izuzeća zatražite zasebni pregled.' })
    if (item.lowest30DayPrice != null && (!Number.isFinite(item.lowest30DayPrice) || item.lowest30DayPrice <= 0)) issues.push({ row, itemKey, field: 'price', severity: 'error', message: 'Prethodna najniža cijena mora biti pozitivan broj.' })
    if (item.specialSaleApplied === true && item.lowest30DayPrice != null && (item.salePrice ?? item.price) >= item.lowest30DayPrice) issues.push({ row, itemKey, field: 'price', severity: 'manual_review', message: 'Cijena posebne prodaje nije niža od navedene prethodne najniže cijene. Provjerite evidenciju i primjenjiva pravila.' })
  })
  return finalizeValidation(issues)
}

const MISSING_ANCHOR_PRODUCT = 'Nedostaje sidrena cijena. Odluka je traži i za proizvode.'

/** Product fields; applicability of unit pricing must be supplied explicitly, never inferred from two empty cells. */
function validateProductFields(item: NormalizedPriceList['items'][number], row: number, itemKey: string, issues: ValidationIssue[]) {
  const text = (value: string | null | undefined) => (value ?? '').trim()
  if (item.anchorPrice == null || !Number.isFinite(item.anchorPrice) || item.anchorPrice <= 0) issues.push({ row, itemKey, field: 'anchorPrice', severity: 'manual_review', message: MISSING_ANCHOR_PRODUCT })
  if (!text(item.externalId)) issues.push({ row, itemKey, field: 'externalId', severity: 'manual_review', message: 'Nedostaje šifra proizvoda.' })
  if (!text(item.brand)) issues.push({ row, itemKey, field: 'brand', severity: 'manual_review', message: 'Nedostaje marka. Upišite „bez marke” ako je proizvod nema.' })
  if (!item.availability) issues.push({ row, itemKey, field: 'availability', severity: 'manual_review', message: 'Navedite je li proizvod dostupan ili nedostupan.' })
  const barcode = text(item.barcode)
  if (!barcode) issues.push({ row, itemKey, field: 'barcode', severity: 'manual_review', message: 'Nedostaje barkod proizvoda. Provjerite obvezne podatke prije objave.' })
  else if (!isValidGtin(barcode)) issues.push({ row, itemKey, field: 'barcode', severity: 'warning', message: 'Barkod nije valjan (očekuje se EAN-8, EAN-13, UPC-A ili GTIN-14 s ispravnom kontrolnom znamenkom).' })
  const exempt = text(item.unitPricingExemption).length >= 10
  if (!text(item.unit) && !exempt) issues.push({ row, itemKey, field: 'unit', severity: 'manual_review', message: 'Navedite jedinicu mjere ili obrazložite zašto cijena po jedinici nije primjenjiva.' })
  if ((!exempt || text(item.unit)) && (item.unitPrice == null || !Number.isFinite(item.unitPrice) || item.unitPrice <= 0)) issues.push({ row, itemKey, field: 'unitPrice', severity: 'manual_review', message: 'Navedite pozitivnu cijenu za jedinicu mjere ili obrazložite iznimku.' })
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
