import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { EXCEL_MAX_COLUMNS, excelRowsToPriceList, headersForSheet, isHokServiceTemplate, isHokGoodsTemplate, selectExcelSheet, readExcelWorkbook, suggestExcelMapping, type ExcelSheet } from './excel'
import { renderCsv, renderXml, validatePriceList, mergeValidationIssues, parseMarketinoCsv, canonicalPriceHeader } from './price-engine'

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


  it('recognizes and maps the HOK service price-list template headers', () => {
    const headers = [
      'Naziv usluge',
      'Maloprodajna cijena',
      'Poseban oblik prodaje (DA/NE)',
      'Naziv posebnog oblika prodaje',
      'Sidrena cijena 10.9.2026.',
    ]
    expect(isHokServiceTemplate(headers)).toBe(true)
    expect(suggestExcelMapping(headers)).toMatchObject({
      name: 'Naziv usluge',
      price: 'Maloprodajna cijena',
      specialSaleApplied: 'Poseban oblik prodaje (DA/NE)',
      specialSaleName: 'Naziv posebnog oblika prodaje',
      anchorPrice: 'Sidrena cijena 10.9.2026.',
    })

    const sheet: ExcelSheet = {
      name: 'Cjenik USLUGA',
      rows: [
        headers,
        ['Muško šišanje', '20,00', 'NE', '', '18,00'],
        ['Bojanje', '45,00', 'DA', 'Akcija', '40,00'],
      ],
    }
    const converted = excelRowsToPriceList(sheet, 0, suggestExcelMapping(headers))
    expect(converted.priceList.items[0]).toMatchObject({
      name: 'Muško šišanje',
      price: 20,
      anchorPrice: 18,
      specialSaleApplied: false,
    })
    expect(converted.priceList.items[1]).toMatchObject({
      name: 'Bojanje',
      price: 45,
      anchorPrice: 40,
      specialSaleApplied: true,
      specialSaleName: 'Akcija',
    })
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


describe('product columns in Excel imports', () => {
  it('suggests a mapping for Croatian product headers and WooCommerce exports, preferring SKU over ID', async () => {
    const { suggestExcelMapping } = await import('./excel')
    expect(suggestExcelMapping(['Naziv proizvoda', 'Šifra', 'Marka', 'Barkod', 'Jedinica mjere', 'Cijena za jedinicu mjere', 'Maloprodajna cijena', 'Sidrena cijena', 'Dostupnost'])).toMatchObject({
      name: 'Naziv proizvoda', externalId: 'Šifra', brand: 'Marka', barcode: 'Barkod', unit: 'Jedinica mjere', unitPrice: 'Cijena za jedinicu mjere', price: 'Maloprodajna cijena', anchorPrice: 'Sidrena cijena', availability: 'Dostupnost',
    })
    expect(suggestExcelMapping(['ID', 'Type', 'SKU', 'GTIN, UPC, EAN, or ISBN', 'Name', 'In stock?', 'Regular price', 'Categories', 'Brands'])).toMatchObject({
      externalId: 'SKU', barcode: 'GTIN, UPC, EAN, or ISBN', name: 'Name', availability: 'In stock?', price: 'Regular price', category: 'Categories', brand: 'Brands',
    })
  })

  it('converts mapped rows into products, keeping barcode text and reading availability', async () => {
    const { excelRowsToPriceList } = await import('./excel')
    const sheet = { name: 'List1', rows: [['Naziv', 'Cijena', 'Šifra', 'Marka', 'Barkod', 'Dostupnost'], ['Mlijeko', 1.2, 'M-1', 'Dukat', 3850123456786, 'DA'], ['Kruh', '0,99', 'M-2', 'bez marke', '0385 0123', 'ne']] }
    const { priceList } = excelRowsToPriceList(sheet, 0, { name: 'Naziv', price: 'Cijena', externalId: 'Šifra', brand: 'Marka', barcode: 'Barkod', availability: 'Dostupnost' })
    expect(priceList.items[0]).toMatchObject({ brand: 'Dukat', barcode: '3850123456786', availability: 'dostupno' })
    expect(priceList.items[1]).toMatchObject({ price: 0.99, barcode: '03850123', availability: 'nedostupno' })
  })
})

describe('HOK original 17 November 2026 headers (NN 132/2026)', () => {
  // Exact original header text, including the newline in D1 of the services workbook.
  // Synthetic rows are used: the published official templates contain no actual price rows.
  const serviceHeaders = ['Naziv usluge', 'Maloprodajna cijena', 'Poseban oblik prodaje usluga (DA/NE)', 'Bazna cijena usluge\n']
  const goodsHeaders = ['Naziv robe', 'Šifra robe, ako je primjenjivo', 'Marka robe, ako je primjenjivo',
    'Neto količina kada je riječ o robi za koju je posebnim propisom uređena obveza isticanja cijene za jedinicu mjere',
    'Jedinica mjere robe, ako je primjenjivo', 'Maloprodajna cijena robe', 'Poseban oblik prodaje robe (DA/NE)',
    'Cijena za jedinicu mjere robe, ako je primjenjivo', 'Barkod robe, ako je primjenjivo',
    'EAN barkod robe, ako je primjenjivo', 'Bazna cijena robe']
  const cases = [
    { name: 'Cjenik USLUGA', headers: serviceHeaders, row: ['Šišanje', '15,50', 'NE', '15,00'],
      expected: {name:'Šišanje',type:'Usluga',price:15.5,anchorPrice:15,specialSaleApplied:false}, canonical: ['name','price','sale','base'], fields:4 },
    { name: 'CJENIK ROBE', headers: goodsHeaders, row: ['Mlijeko','M001','Marka',1,'l','1,50','NE','1,50','001234','03850123456786','1,40'],
      expected: {name:'Mlijeko',type:'Proizvod',externalId:'M001',brand:'Marka',netQuantity:1,unit:'l',price:1.5,specialSaleApplied:false,unitPrice:1.5,barcode:'001234',eanBarcode:'03850123456786',anchorPrice:1.4},
      canonical:['name','code','brand','quantity','unit','price','sale','unitprice','barcode','ean','base'],fields:11 },
  ]
  it.each(cases)('imports actual HOK header layout in XLSX, ignores instructions and preserves fields ($name)', async (entry) => {
    const wb=XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['UPUTE'],['Ovo nije cjenik']]),'Upute')
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([entry.headers,entry.row]),entry.name)
    const imported=await readExcelWorkbook(XLSX.write(wb,{type:'array',bookType:'xlsx'}) as ArrayBuffer)
    const {sheetIndex,headerRow}=selectExcelSheet(imported)
    expect({sheetIndex,headerRow}).toEqual({sheetIndex:1,headerRow:0})
    const sheet=imported.sheets[sheetIndex]
    const headers=headersForSheet(sheet,headerRow)
    expect(entry.fields===4?isHokServiceTemplate(headers):isHokGoodsTemplate(headers)).toBe(true)
    const {priceList,issues}=excelRowsToPriceList(sheet,headerRow,suggestExcelMapping(headers))
    expect(issues).toEqual([])
    expect(priceList.items).toHaveLength(1)
    expect(priceList.items[0]).toMatchObject(entry.expected)
    const list={...priceList,formatVersion:'nn-132-2026' as const}
    const csv=renderCsv(list)
    expect(csv.split('\r\n')[0].split(';')).toHaveLength(entry.fields)
    expect(csv).toContain(';NE;')
    expect(renderXml(list)).toContain('<poseban_oblik_prodaje>NE</poseban_oblik_prodaje>')
    expect(parseMarketinoCsv(csv).priceList.items[0]).toMatchObject(entry.expected)
    expect(validatePriceList(list).blockingCount).toBe(0)
  })
  it.each(cases)('imports direct HOK CSV export with exact original header text ($name)',entry=>{
    const escape=(value:unknown)=>'"'+String(value).replaceAll('"','""')+'"'
    const csv='\uFEFF'+[entry.headers,entry.row].map(row=>row.map(escape).join(';')).join('\r\n')
    expect(entry.headers.map(canonicalPriceHeader)).toEqual(entry.canonical)
    const result=parseMarketinoCsv(csv)
    expect(result.warnings).toEqual([])
    expect(result.priceList.items[0]).toMatchObject(entry.expected)
  })
})
