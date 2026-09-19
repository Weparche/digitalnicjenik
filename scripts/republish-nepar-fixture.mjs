/**
 * Republish the root marketino-artikli fixture to the demo NEPAR tenant.
 * Usage (after deploy): node scripts/republish-nepar-fixture.mjs
 * Optional: ORIGIN=https://digitalnicjenik.nepar.hr node scripts/republish-nepar-fixture.mjs
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const origin = process.env.ORIGIN || 'https://digitalnicjenik.nepar.hr'
const csv = readFileSync(resolve('marketino-artikli'), 'utf8')

function splitCsv(input, delimiter) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < input.length; i += 1) {
    const character = input[i]
    const next = input[i + 1]
    if (character === '"' && quoted && next === '"') { field += '"'; i += 1; continue }
    if (character === '"') { quoted = !quoted; continue }
    if (character === delimiter && !quoted) { row.push(field); field = ''; continue }
    if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') i += 1
      row.push(field)
      if (row.some((cell) => cell.trim())) rows.push(row)
      row = []
      field = ''
      continue
    }
    field += character
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}

function parseNumber(value) {
  if (!value?.trim()) return null
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.')
  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}

const firstLine = csv.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? ''
const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
const rows = splitCsv(csv.replace(/^\uFEFF/, ''), delimiter)
const headers = rows[0].map((header) => header.replace(/^\uFEFF/, '').trim().toLocaleLowerCase('hr-HR'))
const idx = (names) => headers.findIndex((header) => names.includes(header))
const groupIndex = idx(['grupa*', 'grupa', 'kategorija'])
const nameIndex = idx(['naziv*', 'naziv'])
const typeIndex = idx(['vrsta*', 'vrsta'])
const priceIndex = idx(['cijena*', 'cijena'])
const saleIndex = idx(['akcijska cijena', 'akcija'])

const items = rows.slice(1).flatMap((row) => {
  const name = row[nameIndex]?.trim() ?? ''
  const price = parseNumber(row[priceIndex])
  if (!name || price == null) return []
  const rawType = row[typeIndex]?.trim() || ''
  const type = rawType === '2' ? 'Usluga' : rawType || 'Usluga'
  const salePrice = saleIndex >= 0 ? parseNumber(row[saleIndex]) : null
  return [{
    category: row[groupIndex]?.trim() || undefined,
    name,
    type,
    unit: 'kom',
    price,
    salePrice,
    anchorPrice: price,
    specialSaleApplied: salePrice == null ? false : false,
    specialSaleName: null,
    isNewSinceReferenceDate: false,
  }]
})

const priceList = {
  items,
  currency: 'EUR',
  updatedAt: new Date().toISOString(),
  source: 'marketino-csv',
}

const importResponse = await fetch(`${origin}/api/tenants/nepar/import`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.200' },
  body: JSON.stringify({ priceList, sourceFilename: 'marketino-artikli.csv' }),
})
const imported = await importResponse.json()
if (!importResponse.ok) {
  console.error('Import failed', importResponse.status, imported)
  process.exit(1)
}

const draftId = imported.draft?.id
const publishResponse = await fetch(`${origin}/api/tenants/nepar/publish`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.200' },
  body: JSON.stringify({ draftId }),
})
const published = await publishResponse.json()
if (!publishResponse.ok) {
  console.error('Publish failed', publishResponse.status, published)
  process.exit(1)
}

console.log(`Republished ${items.length} items to ${origin} · publication ${published.publication?.filenameStem || published.publication?.sequence || 'ok'}`)
