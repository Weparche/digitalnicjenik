import { describe, expect, it } from 'vitest'
import fixture from '../../marketino-artikli?raw'
import { parseMarketinoCsv } from './adapters/marketinoCsv'
import { createFilenameStem, filenameTimestamp, sanitizeFilenamePart } from './filename'
import { validatePriceList } from './validate'

describe('NEPAR regulatory validator', () => {
  it('keeps the NEPAR fixture publish-ready with sidrena cijena filled', () => {
    const parsed = parseMarketinoCsv(fixture, { id: 'nepar', slug: 'nepar', name: 'NEPAR' })
    const validation = validatePriceList(parsed.priceList)

    expect(parsed.priceList.items).toHaveLength(29)
    expect(parsed.priceList.items.some((item) => item.name.includes('Plugin'))).toBe(true)
    expect(validation.status).toBe('ready_to_publish')
    expect(validation.issues.some((issue) => issue.field === 'anchorPrice')).toBe(false)
  })

  it('maps only an explicit anchor column and never PN/PNP', () => {
    const explicit = parseMarketinoCsv('Grupa*;Naziv*;Vrsta*;Cijena*;Sidrena cijena\nWeb;Usluga;2;50;45')
    const legacy = parseMarketinoCsv('Grupa*;Naziv*;Vrsta*;Cijena*;PN(€);PNP(%)\nWeb;Usluga;2;50;45;10')

    expect(explicit.priceList.items[0].anchorPrice).toBe(45)
    expect(legacy.priceList.items[0].anchorPrice).toBeNull()
    expect(validatePriceList(legacy.priceList).status).toBe('manual_review')
  })

  it('requires explicit special-sale confirmation and name', () => {
    const pending = parseMarketinoCsv('Naziv*;Vrsta*;Cijena*;Akcijska cijena;Sidrena cijena\nUsluga;2;50;40;45')
    const confirmed = parseMarketinoCsv('Naziv*;Vrsta*;Cijena*;Akcijska cijena;Sidrena cijena;Poseban oblik prodaje;Naziv posebnog oblika prodaje;Najniža cijena u 30 dana\nUsluga;2;50;40;45;da;Rasprodaja;45')

    expect(validatePriceList(pending.priceList).issues.some((issue) => issue.field === 'specialSaleApplied')).toBe(true)
    expect(validatePriceList(confirmed.priceList).status).toBe('ready_to_publish')
    expect(confirmed.priceList.items[0]).toMatchObject({ specialSaleApplied: true, specialSaleName: 'Rasprodaja' })
  })

  it('routes unknown and newly introduced service cases to manual review', () => {
    const unknown = parseMarketinoCsv('Naziv*;Vrsta*;Cijena*\nUsluga;nepoznato;50')
    const newService = { ...unknown.priceList, items: [{ ...unknown.priceList.items[0], type: 'Usluga', anchorPrice: 45, isNewSinceReferenceDate: true }] }

    expect(validatePriceList(unknown.priceList).issues.some((issue) => issue.field === 'type')).toBe(true)
    expect(validatePriceList(newService).status).toBe('manual_review')
    expect(validatePriceList(newService).issues.some((issue) => issue.rule === 'anchor.date.new-without-date')).toBe(true)
  })

  it('accepts a first-listing reference date after 10 September 2026 without a proprietary new-item flag', () => {
    const base = parseMarketinoCsv('Naziv usluge;Cijena;Sidrena cijena;Poseban oblik prodaje\nNova usluga;49.90;49.90;false').priceList
    const dated = { ...base, items: [{ ...base.items[0], anchorReferenceDate: '2026-10-15' }] }
    expect(validatePriceList(dated, { now: new Date('2026-10-27T12:00:00Z') }).issues).toEqual([])
    const early = { ...base, items: [{ ...base.items[0], anchorReferenceDate: '2026-08-01' }] }
    expect(validatePriceList(early, { now: new Date('2026-10-27T12:00:00Z') }).issues.map((issue) => issue.rule)).toEqual(['anchor.date.before-reference'])
  })
})

describe('immutable filename generation', () => {
  it('sanitizes traversal and produces a timezone-aware stem without extension', () => {
    const publishedAt = new Date('2026-09-17T12:35:00.000Z')
    const stem = createFilenameStem({ objectType: 'Uslužni / objekt', objectAddress: '../Ilica 10', objectCode: 'Poslovnica 1', timezone: 'Europe/Zagreb' }, 7, publishedAt)

    expect(stem).toBe('usluzni-objekt_ilica-10_poslovnica-1_7_20260917-143500')
    expect(stem).not.toMatch(/[./\\]/)
    expect(stem).not.toMatch(/\.(csv|xml)$/)
    expect(sanitizeFilenamePart('../')).toBe('objekt')
    expect(filenameTimestamp(publishedAt, 'Europe/Zagreb')).toBe('20260917-143500')
  })
})
