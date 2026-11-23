/** Advisory HTML-only price signals. Never a substitute for the NN 132 CSV/XML validation. */
export type VisiblePriceRow = {
  name: string
  currentPrice: number
  basePrice: number | null
  referenceDate: string | null
  status: 'paired' | 'current_only' | 'needs_review'
  evidence: string
  url: string
}
export type VisiblePricesReport = {
  status: 'found' | 'partial' | 'not_found' | 'unavailable'
  rows: VisiblePriceRow[]
  pagesScanned: number
  limitation?: string
}

const MAX_ROWS = 30
const AMOUNT = /(?:\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d{1,6}(?:[.,]\d{1,2})?)\s*(?:€|\beur(?:a)?\b)|(?:€|\beur(?:a)?\b)\s*(?:\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d{1,6}(?:[.,]\d{1,2})?)/gi
const BASE_LABEL = /\b(?:bazna|sidrena)\s+cijen[ae]\b/i
const REFERENCE_LABEL = /\bcijen[ae]\s+(?:na\s+(?:dan\s+)?)?10\s*[.\/-]\s*0?9\s*[.\/-]\s*2026\b/i
const REFERENCE_DATE = /\b10\s*[.\/-]\s*0?9\s*[.\/-]\s*2026\b|\b2026-09-10\b/i
const GENERIC_TITLE = /^(?:cjenik|cijene|naše cijene|usluge|ponuda|paketi|programi|početna|kontakt|o nama|više informacija|sve cijene|cijena)$/i

function decodeEntities(text: string): string {
  return text
    .replace(/&(?:nbsp|#160|#xa0);/gi, ' ')
    .replace(/&(?:euro|#8364|#x20ac);/gi, '€')
    .replace(/&(?:amp|quot|apos|lt|gt);/gi, value => ({ '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' })[value.toLowerCase()] || value)
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_match, code: string) => {
      const point = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code)
      return Number.isInteger(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ' '
    })
}
function linesFromHtml(html: string): string[] {
  const visible = html
    .replace(/<!--[^]*?-->/g, ' ')
    .replace(/<(?:script|style|noscript|svg|nav|header|footer|form|template)\b[^>]*>[\s\S]*?<\/\s*(?:script|style|noscript|svg|nav|header|footer|form|template)\s*>/gi, ' ')
    .replace(/<[^>]*\b(?:hidden|aria-hidden\s*=\s*["']true["'])[^>]*>[\s\S]*?<\/[^>]+>/gi, ' ')
    .replace(/<h[1-6]\b[^>]*>/gi, '\n__PRICE_HEADING__')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(?:p|h[1-6]|li|tr|section|article)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  return decodeEntities(visible).split(/\r?\n/).map(v => v.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 1500)
}
function amounts(line: string): Array<{ value: number; start: number }> {
  return Array.from(line.matchAll(AMOUNT)).map(match => {
    const number = match[0].match(/\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d{1,6}(?:[.,]\d{1,2})?/)
    const source = number?.[0] || ''
    const normalized = source.includes(',') ? source.replace(/\./g, '').replace(',', '.') : source
    return { value: Number(normalized), start: match.index || 0 }
  }).filter(n => Number.isFinite(n.value) && n.value >= 0 && n.value < 1_000_000)
}
function safeName(value: string): string | null {
  const name = value.replace(/^(?:cijena|redovna cijena|mjesečna cijena|već od|od)\s*[:–-]?\s*/i, '').replace(/\s*[:;–-]\s*$/, '').trim()
  if (name.length < 3 || name.length > 85 || GENERIC_TITLE.test(name) || BASE_LABEL.test(name) || REFERENCE_LABEL.test(name)) return null
  if (!/[a-zčćđšž]{3}/i.test(name) || /\b(?:cookie|privatnost|uvjeti|adresa|telefon|copyright|prijava)\b/i.test(name)) return null
  return name
}
function referenceDate(line: string): string | null {
  return REFERENCE_DATE.test(line) ? '2026-09-10' : null
}
function isBase(line: string): boolean {
  return BASE_LABEL.test(line) || REFERENCE_LABEL.test(line) || (/\bcijena\s+na\s+dan\b/i.test(line) && REFERENCE_DATE.test(line))
}
function rowStatus(row: VisiblePriceRow): VisiblePriceRow['status'] {
  return row.basePrice === null ? 'current_only' : row.referenceDate ? 'paired' : 'needs_review'
}

/**
 * Extracts visible, clearly associated service prices. A pairing means both numbers
 * appear next to the same named offer, NOT that the historical price is legally correct.
 */
export function detectVisiblePrices(html: string, url: string): VisiblePriceRow[] {
  const lines = linesFromHtml(html)
  const rows: VisiblePriceRow[] = []
  let heading: string | null = null
  const cursor: { lastRow: { row: VisiblePriceRow; line: number } | null } = { lastRow: null }
  const add = (name: string, value: number, evidence: string, line: number) => {
    const row: VisiblePriceRow = { name, currentPrice: value, basePrice: null, referenceDate: null, status: 'current_only', evidence: evidence.slice(0, 260), url }
    rows.push(row)
    cursor.lastRow = { row, line }
  }
  for (let index = 0; index < lines.length && rows.length < MAX_ROWS; index++) {
    const line = lines[index]
    const prices = amounts(line)
    if (!prices.length) {
      if (!isBase(line)) {
        const candidate = safeName(line.replace(/^__PRICE_HEADING__/, ''))
        if (candidate && candidate.length < 65 && (/^__PRICE_HEADING__/.test(line) || /\b(?:nastava|tečaj|kurs|radionica|paket|usluga)\b/i.test(line))) { heading = candidate; cursor.lastRow = null }
      }
      continue
    }
    const base = isBase(line)
    if (base) {
      // One line may contain both a regular and a base price.
      const labelStart = line.search(BASE_LABEL) >= 0 ? line.search(BASE_LABEL) : line.search(REFERENCE_LABEL)
      const previous = prices.find(p => p.start < labelStart)
      const anchor = prices.find(p => p.start > labelStart)
      if (previous && anchor) {
        const name = safeName(line.slice(0, previous.start).replace(/^__PRICE_HEADING__/, '')) || heading
        if (name) {
          add(name, previous.value, line, index)
          const row = rows[rows.length - 1]
          row.basePrice = anchor.value
          row.referenceDate = referenceDate(line)
          row.status = rowStatus(row)
        }
      } else if (cursor.lastRow && index - cursor.lastRow.line <= 3 && anchor && heading === cursor.lastRow.row.name) {
        cursor.lastRow.row.basePrice = anchor.value
        cursor.lastRow.row.referenceDate = referenceDate(line) || cursor.lastRow.row.referenceDate
        cursor.lastRow.row.evidence = (cursor.lastRow.row.evidence + ' | ' + line).slice(0, 260)
        cursor.lastRow.row.status = rowStatus(cursor.lastRow.row)
      }
      continue
    }
    const named = safeName(line.slice(0, prices[0].start))
    const name = named || heading
    if (!name || prices.length > 2) continue
    // Never associate a repeated amount with the previous offer if a new label appears.
    if (named) heading = named
    add(name, prices[0].value, line, index)
  }
  const dedup = new Map<string, VisiblePriceRow>()
  for (const row of rows) {
    const key = row.url + '|' + row.name.toLocaleLowerCase('hr-HR') + '|' + row.currentPrice
    const previous = dedup.get(key)
    if (!previous || (previous.basePrice === null && row.basePrice !== null)) dedup.set(key, row)
  }
  return [...dedup.values()].slice(0, MAX_ROWS)
}

export function summarizeVisiblePrices(rows: VisiblePriceRow[], pagesScanned: number, inaccessible = false): VisiblePricesReport {
  const confirmed = rows.filter(row => row.status === 'paired').length
  return {
    status: inaccessible && !rows.length ? 'unavailable' : !rows.length ? 'not_found' : confirmed === rows.length ? 'found' : 'partial',
    rows: rows.slice(0, MAX_ROWS),
    pagesScanned,
    limitation: inaccessible ? 'Dio HTML sadržaja nije bilo moguće dohvatiti ili prikazati.' : undefined,
  }
}
