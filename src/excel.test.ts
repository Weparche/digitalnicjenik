import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { EXCEL_MAX_COLUMNS, excelRowsToPriceList, headersForSheet, readExcelWorkbook, suggestExcelMapping, type ExcelSheet } from './excel'
import { renderCsv, renderXml, validatePriceList, mergeValidationIssues } from './price-engine'

function workbookBytes(bookType: 'xlsx' | 'xls' = 'xlsx') {
  const workbook = XLSX.utils.book_new()
  const first = XLSX.utils.aoa_to_sheet([
    ['Naziv', 'Cijena', 'Vrsta', 'Sidrena cijena', 'Akcijska cijena'],
    ['Šišanje', 20, 'Usluga', 18, ''],
    ['Bojanje', 45, 'Usluga', 40, 39],
  ])
  first.B2 = { t: 'n', v: 20, f: '10+10' }
  XLSX.utils.book_append_sheet(workbook, first, 'Cjenik')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Naziv', 'Cijena'], ['Proizvod', 7.5]]), 'Druga poslovnica')
  return XLSX.write(workbook, { type: 'array', bookType }) as ArrayBuffer
}

describe('Excel conversion', () => {
  it.each(['xlsx', 'xls'] as const)('reads %s locally, preserves saved formula values and supports worksheets', async (bookType) => {
    const workbook = await readExcelWorkbook(workbookBytes(bookType))
    expect(workbook.sheets.map((sheet) => sheet.name)).toEqual(['Cjenik', 'Druga poslovnica'])
    expect(workbook.sheets[0].rows[1][1]).toBe(20)
    const headers = headersForSheet(workbook.sheets[0], 0)
    const mapping = suggestExcelMapping(headers)
    const list = excelRowsToPriceList(workbook.sheets[0], 0, mapping).priceList
    expect(list.items).toHaveLength(2)
    expect(list.items[0]).toMatchObject({ name: 'Šišanje', price: 20, type: 'Usluga', anchorPrice: 18 })
    expect(validatePriceList(list).issues.some((issue) => issue.field === 'anchorPrice')).toBe(false)
    expect(renderCsv(list)).toContain('Šišanje')
    expect(renderXml(list)).toContain('<name>Šišanje</name>')
  })

  it('requires explicit name and price mapping and keeps sale completion in the shared validator', () => {
    const sheet: ExcelSheet = { name: 'Cjenik', rows: [['Usluga', 'Iznos', 'Akcija'], ['Masaža', '30,00', '25,00']] }
    expect(() => excelRowsToPriceList(sheet, 0, {})).toThrow(/naziv i maloprodajnu cijenu/i)
    const list = excelRowsToPriceList(sheet, 0, { name: 'Usluga', price: 'Iznos', salePrice: 'Akcija' }).priceList
    expect(list.items[0].salePrice).toBe(25)
    expect(validatePriceList(list).issues.some((issue) => issue.field === 'specialSaleApplied')).toBe(true)
  })

  it('emits IMPORT_ROW_SKIPPED for blank-price rows and blocks ready_to_publish', () => {
    const sheet: ExcelSheet = {
      name: 'Cjenik',
      rows: [
        ['Naziv', 'Cijena', 'Vrsta'],
        ['Valjana', 20, 'Usluga'],
        ['Preskočena', '', 'Usluga'],
      ],
    }
    const converted = excelRowsToPriceList(sheet, 0, { name: 'Naziv', price: 'Cijena', type: 'Vrsta' })
    expect(converted.priceList.items).toHaveLength(1)
    expect(converted.issues[0]).toMatchObject({ code: 'IMPORT_ROW_SKIPPED', source: 'xlsx', field: 'price', row: 3 })
    const validation = mergeValidationIssues(validatePriceList(converted.priceList), converted.issues)
    expect(validation.status).toBe('invalid')
    expect(validation.blockingCount).toBeGreaterThan(0)
  })

  it('rejects worksheets wider than the deterministic column limit', async () => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([Array.from({ length: EXCEL_MAX_COLUMNS + 1 }, (_, index) => `C${index}`)]), 'Preširoko')
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    await expect(readExcelWorkbook(bytes)).rejects.toThrow(/više od 50 stupaca/i)
  })
})

