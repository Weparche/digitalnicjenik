import { useMemo, useState } from 'react'
import {
  EXCEL_MAX_BYTES,
  excelRowsToPriceList,
  headersForSheet,
  isHokServiceTemplate,
  readExcelWorkbook,
  suggestExcelMapping,
  type ExcelField,
  type ExcelMapping,
  type ExcelWorkbook,
} from './excel'
import type { NormalizedPriceList, ValidationIssue } from './price-engine'

const fieldLabels: Array<{ field: ExcelField; label: string; required?: boolean }> = [
  { field: 'name', label: 'Naziv', required: true },
  { field: 'price', label: 'Maloprodajna cijena', required: true },
  { field: 'type', label: 'Vrsta' },
  { field: 'category', label: 'Kategorija' },
  { field: 'externalId', label: 'Šifra' },
  { field: 'anchorPrice', label: 'Sidrena cijena' },
  { field: 'salePrice', label: 'Akcijska cijena' },
  { field: 'specialSaleApplied', label: 'Poseban oblik prodaje' },
  { field: 'specialSaleName', label: 'Naziv posebne prodaje' },
  { field: 'unit', label: 'Jedinica' },
  { field: 'isNewSinceReferenceDate', label: 'Nova usluga' },
]

export function ExcelConverter({ onConverted }: { onConverted: (list: NormalizedPriceList, sourceFile: File, importIssues?: ValidationIssue[]) => void }) {
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [workbook, setWorkbook] = useState<ExcelWorkbook | null>(null)
  const [sheetIndex, setSheetIndex] = useState(0)
  const [headerRow, setHeaderRow] = useState(0)
  const [mapping, setMapping] = useState<ExcelMapping>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const sheet = workbook?.sheets[sheetIndex]
  const headers = useMemo(() => sheet ? headersForSheet(sheet, headerRow) : [], [sheet, headerRow])
  const previewRows = sheet?.rows.slice(headerRow + 1, headerRow + 6) ?? []
  const hokServiceTemplate = useMemo(() => isHokServiceTemplate(headers), [headers])

  function applySuggestedMapping(nextHeaders: string[]) {
    setMapping(suggestExcelMapping(nextHeaders))
  }

  async function loadExcel(file?: File) {
    if (!file) return
    setError('')
    setWorkbook(null)
    setSourceFile(null)
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setError('Učitajte Excel datoteku s nastavkom .xlsx ili .xls.')
      return
    }
    if (file.size > EXCEL_MAX_BYTES) {
      setError('Excel datoteka je prevelika. Maksimalna veličina je 5 MB.')
      return
    }
    setBusy(true)
    try {
      const nextWorkbook = await readExcelWorkbook(await file.arrayBuffer())
      setSourceFile(file)
      setWorkbook(nextWorkbook)
      setSheetIndex(0)
      setHeaderRow(0)
      applySuggestedMapping(headersForSheet(nextWorkbook.sheets[0], 0))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Excel datoteku nije moguće pročitati.')
    } finally {
      setBusy(false)
    }
  }

  function changeSheet(nextIndex: number) {
    const nextSheet = workbook?.sheets[nextIndex]
    if (!nextSheet) return
    setSheetIndex(nextIndex)
    setHeaderRow(0)
    applySuggestedMapping(headersForSheet(nextSheet, 0))
  }

  function changeHeaderRow(nextRow: number) {
    if (!sheet) return
    setHeaderRow(nextRow)
    applySuggestedMapping(headersForSheet(sheet, nextRow))
  }

  function convert() {
    if (!sheet || !sourceFile) return
    setError('')
    try {
      const converted = excelRowsToPriceList(sheet, headerRow, mapping)
      onConverted(converted.priceList, sourceFile, converted.issues)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Excel nije moguće pretvoriti.')
    }
  }

  return <section className="excel-converter" aria-labelledby="excel-title">
    <div className="excel-intro">
      <div><span className="app-label">IMATE EXCEL CJENIK?</span><h2 id="excel-title">Pretvorite Excel u provjerljivi CSV ili XML.</h2><p>Datoteka se obrađuje u vašem pregledniku. HOK predložak cjenika usluga prepoznajemo automatski; kod ostalih datoteka vi potvrđujete koji stupac znači naziv, cijenu i ostale podatke.</p></div>
      <label className="excel-upload"><input type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={(event) => void loadExcel(event.target.files?.[0])} /><strong>{busy ? 'Čitamo Excel…' : 'Odaberite Excel'}</strong><span>.xlsx ili .xls · do 5 MB</span></label>
    </div>
    {error && <p className="app-error" role="alert">{error}</p>}
    {hokServiceTemplate && <p className="app-success" role="status"><strong>Prepoznat HOK predložak cjenika usluga.</strong> Standardna polja su automatski mapirana; prije nastavka provjerite stupce i vrijednosti.</p>}
    {workbook && sheet && <div className="excel-workspace">
      <div className="excel-controls">
        <label>Worksheet<select value={sheetIndex} onChange={(event) => changeSheet(Number(event.target.value))}>{workbook.sheets.map((entry, index) => <option value={index} key={entry.name}>{entry.name}</option>)}</select></label>
        <label>Redak zaglavlja<select value={headerRow} onChange={(event) => changeHeaderRow(Number(event.target.value))}>{sheet.rows.slice(0, 10).map((_, index) => <option value={index} key={index}>Redak {index + 1}</option>)}</select></label>
      </div>
      <div className="excel-mapping" aria-label="Mapiranje Excel stupaca">
        {fieldLabels.map(({ field, label, required }) => <label key={field}><span>{label}{required && <b>obavezno</b>}</span><select value={mapping[field] ?? ''} onChange={(event) => setMapping((current) => ({ ...current, [field]: event.target.value || undefined }))}><option value="">Ne mapiraj</option>{headers.map((header, index) => <option value={header} key={`${header}-${index}`}>{header}</option>)}</select></label>)}
      </div>
      <div className="excel-preview" tabIndex={0} aria-label="Pregled prvih pet Excel redaka"><table><thead><tr>{headers.map((header, index) => <th key={`${header}-${index}`}>{header}</th>)}</tr></thead><tbody>{previewRows.map((row, rowIndex) => <tr key={rowIndex}>{headers.map((_, columnIndex) => <td key={columnIndex}>{String(row[columnIndex] ?? '')}</td>)}</tr>)}</tbody></table></div>
      <div className="excel-submit"><p>Formule i makroi se ne izvršavaju. Koristi se samo spremljena vrijednost ćelije.</p><button className="app-button app-button-primary" type="button" onClick={convert}>Pretvori i provjeri</button></div>
    </div>}
  </section>
}

