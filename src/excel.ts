import { normalizeNumber } from './price-engine/normalize'
import { importIssuesFromParseWarnings } from './price-engine/validate'
import type { NormalizedPriceList, ParseWarning, ValidationIssue } from './price-engine/types'

export const EXCEL_MAX_BYTES = 5_000_000
export const EXCEL_MAX_ROWS = 5_000
export const EXCEL_MAX_COLUMNS = 50

export type ExcelField =
  | 'name'
  | 'price'
  | 'type'
  | 'category'
  | 'externalId'
  | 'anchorPrice'
  | 'salePrice'
  | 'specialSaleApplied'
  | 'specialSaleName'
  | 'unit'
  | 'isNewSinceReferenceDate'

export type ExcelMapping = Partial<Record<ExcelField, string>>
export type ExcelSheet = { name: string; rows: unknown[][] }
export type ExcelWorkbook = { sheets: ExcelSheet[] }

const aliases: Record<ExcelField, string[]> = {
  name: ['naziv', 'naziv usluge', 'naziv proizvoda', 'naziv artikla', 'artikl', 'usluga', 'name'],
  price: ['cijena', 'maloprodajna cijena', 'mp cijena', 'prodajna cijena', 'price'],
  type: ['vrsta', 'tip', 'vrsta stavke', 'type'],
  category: ['grupa', 'kategorija', 'category'],
  externalId: ['šifra', 'sifra', 'interna šifra', 'interna sifra', 'id', 'code'],
  anchorPrice: [
    'sidrena cijena',
    'sidrena cijena 10.9.2026.',
    'sidrena cijena 10. 9. 2026.',
    'dodatna cijena',
    'dodatna cijena 10.9.2026.',
    'dodatna cijena 10. 9. 2026.',
    'anchor price',
    'reference price',
  ],
  salePrice: ['akcijska cijena', 'akcija', 'sale price'],
  specialSaleApplied: [
    'poseban oblik prodaje',
    'poseban oblik prodaje (da/ne)',
    'posebni oblik prodaje',
    'posebni oblik prodaje (da/ne)',
    'special sale applied',
  ],
  specialSaleName: ['naziv posebnog oblika prodaje', 'naziv posebne prodaje', 'special sale name'],
  unit: ['jedinica', 'jedinica mjere', 'unit'],
  isNewSinceReferenceDate: ['nova usluga', 'novouvedena usluga', 'new service'],
}

const clean = (value: unknown) => String(value ?? '').replace(/^\uFEFF/, '').trim()
const normalizedHeader = (value: unknown) => clean(value).toLocaleLowerCase('hr-HR').replace(/[*_:]+$/g, '').trim()

function booleanValue(value: unknown): boolean | null {
  const normalized = clean(value).toLocaleLowerCase('hr-HR')
  if (!normalized) return null
  if (['da', 'yes', 'true', '1', 'x'].includes(normalized)) return true
  if (['ne', 'no', 'false', '0'].includes(normalized)) return false
  return null
}

export async function readExcelWorkbook(buffer: ArrayBuffer): Promise<ExcelWorkbook> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellFormula: false,
    cellHTML: false,
    cellStyles: false,
    cellText: true,
  })
  const sheets = workbook.SheetNames.map((name) => {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
      header: 1,
      raw: true,
      defval: '',
      blankrows: false,
    })
    const width = rows.reduce((maximum, row) => Math.max(maximum, row.length), 0)
    if (width > EXCEL_MAX_COLUMNS) throw new Error(`Worksheet „${name}” ima više od ${EXCEL_MAX_COLUMNS} stupaca.`)
    if (rows.length > EXCEL_MAX_ROWS + 20) throw new Error(`Worksheet „${name}” ima više od ${EXCEL_MAX_ROWS} redaka.`)
    return { name, rows }
  })
  if (!sheets.length) throw new Error('Excel datoteka nema nijedan worksheet.')
  return { sheets }
}

export function headersForSheet(sheet: ExcelSheet, headerRowIndex: number): string[] {
  const row = sheet.rows[headerRowIndex] ?? []
  return row.slice(0, EXCEL_MAX_COLUMNS).map((value, index) => clean(value) || `Stupac ${index + 1}`)
}

export function isHokServiceTemplate(headers: string[]): boolean {
  const normalized = new Set(headers.map(normalizedHeader))
  const requiredGroups = [
    ['naziv usluge'],
    ['maloprodajna cijena'],
    ['poseban oblik prodaje (da/ne)', 'posebni oblik prodaje (da/ne)'],
    ['naziv posebnog oblika prodaje'],
    [
      'sidrena cijena 10.9.2026.',
      'sidrena cijena 10. 9. 2026.',
      'dodatna cijena 10.9.2026.',
      'dodatna cijena 10. 9. 2026.',
    ],
  ]
  return requiredGroups.every((group) => group.some((header) => normalized.has(header)))
}

export function suggestExcelMapping(headers: string[]): ExcelMapping {
  const mapping: ExcelMapping = {}
  for (const field of Object.keys(aliases) as ExcelField[]) {
    const index = headers.findIndex((header) => aliases[field].includes(normalizedHeader(header)))
    if (index >= 0) mapping[field] = headers[index]
  }
  return mapping
}

export function excelRowsToPriceList(
  sheet: ExcelSheet,
  headerRowIndex: number,
  mapping: ExcelMapping,
  tenant = { id: 'nepar', slug: 'nepar', name: 'NEPAR' },
): { priceList: NormalizedPriceList; issues: ValidationIssue[] } {
  if (!mapping.name || !mapping.price) throw new Error('Odaberite stupce za naziv i maloprodajnu cijenu.')
  const headers = headersForSheet(sheet, headerRowIndex)
  const indexes = Object.fromEntries(
    (Object.entries(mapping) as [ExcelField, string][]).map(([field, header]) => [field, headers.indexOf(header)]),
  ) as Partial<Record<ExcelField, number>>
  if ((indexes.name ?? -1) < 0 || (indexes.price ?? -1) < 0) throw new Error('Odabrani obavezni stupci više nisu dostupni.')

  const rows = sheet.rows.slice(headerRowIndex + 1, headerRowIndex + 1 + EXCEL_MAX_ROWS)
  const warnings: ParseWarning[] = []
  const items = rows.flatMap((row, index) => {
    const value = (field: ExcelField) => {
      const column = indexes[field]
      return column == null || column < 0 ? '' : row[column]
    }
    const name = clean(value('name'))
    const price = normalizeNumber(value('price'))
    const absoluteRow = headerRowIndex + index + 2
    if (!name && !row.some((cell) => clean(cell))) return []
    if (!name || price == null) {
      warnings.push({
        row: absoluteRow,
        field: !name ? 'name' : 'price',
        message: !name ? 'nedostaje naziv.' : 'cijena nije broj.',
      })
      return []
    }
    const rawType = clean(value('type'))
    const salePrice = normalizeNumber(value('salePrice'))
    const specialSaleApplied = booleanValue(value('specialSaleApplied'))
    return [{
      name,
      price,
      type: rawType === '2' ? 'Usluga' : rawType || undefined,
      category: clean(value('category')) || undefined,
      externalId: clean(value('externalId')) || undefined,
      anchorPrice: normalizeNumber(value('anchorPrice')),
      salePrice,
      specialSaleApplied: indexes.specialSaleApplied == null ? (salePrice == null ? false : null) : specialSaleApplied,
      specialSaleName: clean(value('specialSaleName')) || null,
      unit: clean(value('unit')) || null,
      isNewSinceReferenceDate: booleanValue(value('isNewSinceReferenceDate')) === true,
    }]
  })
  if (!items.length) throw new Error('Nakon mapiranja nije pronađena nijedna stavka s nazivom i cijenom.')
  const priceList: NormalizedPriceList = { tenant, source: 'nepar', currency: 'EUR', updatedAt: new Date().toISOString(), items }
  return { priceList, issues: importIssuesFromParseWarnings(warnings, 'xlsx') }
}

