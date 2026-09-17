import { describe, expect, it } from 'vitest'
import fixture from '../../marketino-artikli?raw'
import { canonicalize, deterministicHash, SnapshotEngine } from './hash'
import { parseMarketinoCsv } from './adapters/marketinoCsv'
import { renderCsv } from './csv'
import { parseXmlPriceList, renderXml } from './xml'

describe('MarketinoCsvAdapter against the real export', () => {
  it('parses all service rows, Croatian text, categories and numeric prices', () => {
    const result = parseMarketinoCsv(fixture)
    expect(result.priceList.items).toHaveLength(26)
    expect(result.priceList.items[0]).toMatchObject({ category: 'Usluge', name: 'Administracija sadržaja', price: 40 })
    expect(result.priceList.items.find((item) => item.name === 'Napredna tehnička i on-page SEO optimizacija')?.price).toBe(250)
    expect(result.priceList.items.every((item) => typeof item.price === 'number')).toBe(true)
    expect(new Set(result.priceList.items.map((item) => item.category)).size).toBeGreaterThan(1)
  })

  it('supports quoted values, empty optional cells, semicolon delimiter and decimal comma', () => {
    const result = parseMarketinoCsv(`Grupa*;Naziv*;Vrsta*;Cijena*;Akcijska cijena\nWeb;"A & B, ""Pro""";2;1.234,50;999,50\n`)
    expect(result.priceList.items[0]).toMatchObject({ name: 'A & B, "Pro"', price: 1234.5, salePrice: 999.5 })
  })
})

describe('NEPAR Price Engine outputs', () => {
  const base = parseMarketinoCsv(fixture).priceList
  it('creates deterministic hashes and detects price changes', async () => {
    expect(await deterministicHash(base)).toBe(await deterministicHash(structuredClone(base)))
    const changed = { ...base, items: base.items.map((item) => item.name === 'Web Business – izrada web-stranice' ? { ...item, price: 550 } : item) }
    expect(await deterministicHash(base)).not.toBe(await deterministicHash(changed))
    expect(canonicalize(base)).not.toContain(base.updatedAt)
  })

  it('escapes CSV values with commas, quotes and Croatian characters', () => {
    const csv = renderCsv({ ...base, items: [{ name: 'Čista, "usluga"', category: 'Ž', price: 20 }] })
    expect(csv).toContain('"Čista, ""usluga"""')
    expect(csv).toContain('Ž')
  })

  it('escapes XML values', () => {
    const xml = renderXml({ ...base, tenant: { ...base.tenant, name: 'A & <B>' }, items: [{ name: 'A & <B> "test"', category: "O'&", price: 20 }] })
    expect(xml).toContain('A &amp; &lt;B&gt;')
    expect(xml).toContain('A &amp; &lt;B&gt; &quot;test&quot;')
    expect(xml).not.toContain('<B>')
  })

  it('round-trips XML through the shared normalized model', () => {
    const source = { ...base, items: [{ ...base.items[0], anchorPrice: 65, salePrice: 35, specialSaleApplied: true, specialSaleName: 'Ljetna ponuda' }] }
    const parsed = parseXmlPriceList(renderXml(source), source.tenant)
    expect(parsed.items[0]).toMatchObject({ name: source.items[0].name, price: source.items[0].price, anchorPrice: 65, salePrice: 35, specialSaleApplied: true, specialSaleName: 'Ljetna ponuda' })
  })

  it('rejects malformed XML without relying on browser DOM APIs', () => {
    expect(() => parseXmlPriceList('<priceList><item><name>Usluga</name></priceList>')).toThrow('XML nije ispravan')
  })

  it('does not duplicate unchanged snapshots and records a changed snapshot', async () => {
    const engine = new SnapshotEngine()
    expect((await engine.save(base)).changed).toBe(true)
    expect((await engine.save(base)).changed).toBe(false)
    const changed = { ...base, items: base.items.map((item) => item.name === 'Web Business – izrada web-stranice' ? { ...item, price: 550 } : item) }
    const saved = await engine.save(changed)
    expect(saved.changed).toBe(true)
    expect(saved.snapshot?.changedItems[0]).toMatchObject({ name: 'Web Business – izrada web-stranice', before: 500, after: 550 })
    expect(engine.all()).toHaveLength(2)
  })
})
