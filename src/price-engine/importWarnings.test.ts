import { describe, expect, it } from 'vitest'
import { importIssuesFromParseWarnings } from './validate'

describe('parse warnings → validation issues', () => {
  it('keeps imported rows as warnings and skipped rows as errors', () => {
    const issues = importIssuesFromParseWarnings([
      { row: 3, field: 'price', imported: true, rule: 'item.price.alternative-column', message: 'važeća cijena pronađena je u drugom stupcu.' },
      { row: 4, field: 'price', message: 'nedostaje važeća cijena.' },
    ], 'csv')
    expect(issues[0]).toMatchObject({ severity: 'warning', rule: 'item.price.alternative-column', message: 'Redak 3: važeća cijena pronađena je u drugom stupcu.' })
    expect(issues[0]).not.toHaveProperty('code')
    expect(issues[1]).toMatchObject({ severity: 'error', code: 'IMPORT_ROW_SKIPPED', message: 'Redak 4 nije uvezen: nedostaje važeća cijena.' })
  })
})
