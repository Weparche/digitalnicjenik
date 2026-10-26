import { describe, expect, it } from 'vitest'
import csvExample from '../../public/examples/nepar-format-primjer-usluge.csv?raw'
import xmlExample from '../../public/examples/nepar-format-primjer-usluge.xml?raw'
import { CSV_HISTORY_HEADER, renderCsv } from '../price-engine/csv'
import { renderXml } from '../price-engine/xml'
import { allFaqEntries } from './faqData'
import { COMPARE_COLUMNS, COMPARE_ROWS } from './ComparePage'
import { CSV_COLUMNS, PRODUCT_CSV_COLUMNS } from './SpecPage'
import { SITE_PAGES } from './registry'
import productCsvExample from '../../public/examples/nepar-format-primjer-proizvodi.csv?raw'
import productXmlExample from '../../public/examples/nepar-format-primjer-proizvodi.xml?raw'
import { NEPAR_FORMAT_EXAMPLE, NEPAR_PRODUCT_FORMAT_EXAMPLE } from './formatExample'
import { validatePriceList } from '../price-engine/validate'

describe('downloadable format examples', () => {
  it('stay identical to what the renderers produce (regenerate public/examples if this fails)', () => {
    expect(csvExample).toBe(renderCsv(NEPAR_FORMAT_EXAMPLE))
    expect(xmlExample).toBe(renderXml(NEPAR_FORMAT_EXAMPLE))
    expect(productCsvExample).toBe(renderCsv(NEPAR_PRODUCT_FORMAT_EXAMPLE))
    expect(productXmlExample).toBe(renderXml(NEPAR_PRODUCT_FORMAT_EXAMPLE))
  })

  it('both examples pass the validator that the documentation describes', () => {
    expect(validatePriceList(NEPAR_FORMAT_EXAMPLE).status).toBe('ready_to_publish')
    expect(validatePriceList(NEPAR_PRODUCT_FORMAT_EXAMPLE).status).toBe('ready_to_publish')
  })

  it('documented CSV columns are exactly the columns the renderer writes', () => {
    const header = renderCsv(NEPAR_FORMAT_EXAMPLE).replace(/^\uFEFF/, '').split('\r\n')[0]!.split(',')
    expect([...CSV_COLUMNS.map((column) => column.column), ...CSV_HISTORY_HEADER]).toEqual(header)
    const productHeader = renderCsv(NEPAR_PRODUCT_FORMAT_EXAMPLE).replace(/^\uFEFF/, '').split('\r\n')[0]!.split(',')
    expect([...[...CSV_COLUMNS, ...PRODUCT_CSV_COLUMNS].map((column) => column.column), ...CSV_HISTORY_HEADER]).toEqual(productHeader)
  })
})

describe('content integrity', () => {
  it('every page has a unique path, title and a description of useful length', () => {
    expect(new Set(SITE_PAGES.map((page) => page.path)).size).toBe(SITE_PAGES.length)
    expect(new Set(SITE_PAGES.map((page) => page.seoTitle)).size).toBe(SITE_PAGES.length)
    for (const page of SITE_PAGES) {
      expect(page.description.length).toBeGreaterThanOrEqual(70)
      expect(page.description.length).toBeLessThanOrEqual(200)
      expect(page.path.startsWith('/') && page.path.endsWith('/')).toBe(true)
    }
  })

  it('FAQ answers are unique, and none carry the stale 1.10.2026 start as current', () => {
    expect(new Set(allFaqEntries.map((entry) => entry.question)).size).toBe(allFaqEntries.length)
    for (const entry of allFaqEntries) {
      expect(entry.answer.length).toBeGreaterThan(40)
    }
    const deadline = allFaqEntries.find((entry) => entry.question === 'Do kada treba objaviti digitalni cjenik?')
    expect(deadline?.answer).toContain('17. studenoga 2026')
  })

  it('comparison table has a cell for every column in every row', () => {
    for (const row of COMPARE_ROWS) expect(row.cells).toHaveLength(COMPARE_COLUMNS.length)
  })
})
