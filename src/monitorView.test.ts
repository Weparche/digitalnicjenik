import { describe, expect, it } from 'vitest'
import type { MonitorRunRecord } from '../shared/compliance/types'
import { buildMonitorView } from './monitorView'

const run = (overrides: Partial<MonitorRunRecord> = {}): MonitorRunRecord => ({
  id: 'r', tenantId: 't', publicationId: 'p', checkedAt: '2026-11-17T05:31:00Z', trigger: 'cron', ruleset: 'nn-101-2026', profile: 'products', overall: 'ok',
  csvStatus: 200, xmlStatus: 200, csvRows: 1483, xmlRows: 1483, expectedRows: 1483, prevRows: 1479, filenamePublicationMatch: true, filenameRulesetMatch: true,
  filenameCsv: 'a.csv', filenameXml: 'a.xml', freshnessStatus: 'ok', archiveExpected: 22, archiveAvailable: 22, archiveLatestStatus: 200, archiveOldestStatus: 200,
  payloadSha256: null, csvSha256: null, xmlSha256: null, issues: [], durationMs: 10, publishedAt: '2026-11-17T04:58:00Z', publicationSequence: 183, ...overrides,
})

const flat = (view: ReturnType<typeof buildMonitorView>) => Object.fromEntries(view.sections.flatMap((section) => section.rows).map((row) => [row.label, row]))

describe('buildMonitorView', () => {
  it('shows the healthy state like the roadmap sketch', () => {
    const view = buildMonitorView(run(), 'Odluka NN 101/2026', 'cjenik proizvoda')
    expect(view.tone).toBe('ok')
    expect(view.headline).toBe('SVE U REDU ✓')
    expect(view.checkedLabel).toContain('Odluka NN 101/2026 (cjenik proizvoda)')
    const rows = flat(view)
    expect(rows['Promjena od prethodne provjere']!.value).toBe('+4')
    expect(rows['CSV']).toMatchObject({ value: 'HTTP 200', tone: 'ok' })
    expect(rows['30-dnevna evidencija']).toMatchObject({ value: '22/22', tone: 'ok' })
    expect(rows['Obvezna polja']).toMatchObject({ value: 'potpuna', tone: 'ok' })
  })

  it('names the broken feed in the critical headline', () => {
    const view = buildMonitorView(run({ overall: 'fail', xmlStatus: 404, xmlRows: null, issues: [{ code: 'FEED_HTTP_ERROR', severity: 'fail', field: 'xml', message: 'XML vraća HTTP 404.' }] }), 'x', 'y')
    expect(view.tone).toBe('fail')
    expect(view.headline).toBe('KRITIČNO — XML vraća HTTP 404.')
    expect(flat(view)['XML']).toMatchObject({ value: 'HTTP 404', tone: 'fail' })
    expect(flat(view)['XML stavke']).toMatchObject({ tone: 'fail' })
  })

  it('breaks missing required fields down per field and keeps data-model gaps as quiet notices', () => {
    const view = buildMonitorView(run({
      overall: 'warn',
      issues: [
        { code: 'MISSING_REQUIRED_FIELD', severity: 'warn', field: 'anchorPrice', rows: 14, message: '14 stavki nema: sidrena cijena.' },
        { code: 'FIELD_NOT_IN_DATA_MODEL', severity: 'info', field: 'barcode', message: 'Polje „barkod” …' },
      ],
    }), 'x', 'y')
    expect(view.tone).toBe('warn')
    expect(view.findings.map((issue) => issue.message)).toEqual(['14 stavki nema: sidrena cijena.'])
    expect(view.notices).toHaveLength(1)
    expect(flat(view)['Obvezna polja']).toMatchObject({ value: '14 nedostajućih vrijednosti', tone: 'warn' })
  })

  it('flags an incomplete archive and shows both filename signals separately', () => {
    const view = buildMonitorView(run({ archiveAvailable: 20, filenamePublicationMatch: true, filenameRulesetMatch: false }), 'x', 'y')
    const rows = flat(view)
    expect(rows['30-dnevna evidencija']).toMatchObject({ value: '20/22', tone: 'fail' })
    expect(rows['Naziv datoteke · trenutna objava']!.tone).toBe('ok')
    expect(rows['Naziv datoteke · propisani oblik']).toMatchObject({ value: 'ne odgovara', tone: 'warn' })
  })

  it('omits freshness for services', () => {
    const rows = flat(buildMonitorView(run({ profile: 'services', freshnessStatus: 'n/a' }), 'x', 'y'))
    expect(rows['Aktualnost']).toBeUndefined()
    expect(rows['Stavki']!.value).toContain('usluga')
  })
})
