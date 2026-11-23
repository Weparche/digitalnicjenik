import { describe, expect, it } from 'vitest'
import { detectVisiblePrices, summarizeVisiblePrices } from './visible-prices'

const url = 'https://skolagitare.com.hr/'
describe('Checker v4: advisory HTML-visible prices', () => {
  it('associates one fixed course price and its explicitly dated base price', () => {
    const rows = detectVisiblePrices('<h2>Grupna nastava</h2><p>65 € mjesečno</p><p>Bazna cijena na dan 10. 9. 2026.: 65,00 €</p>', url)
    expect(rows).toMatchObject([{ name: 'Grupna nastava', currentPrice: 65, basePrice: 65, referenceDate: '2026-09-10', status: 'paired' }])
    expect(summarizeVisiblePrices(rows, 1).status).toBe('found')
  })
  it('detects sidrena and abbreviated EUR with named offer', () => {
    const rows = detectVisiblePrices('<h3>Individualna nastava</h3><p>30 EUR</p><p>Sidrena cijena 30,00 EUR — 10.09.2026.</p>', url)
    expect(rows[0]).toMatchObject({ name: 'Individualna nastava', basePrice: 30, status: 'paired' })
  })
  it('recognizes a simple one-line price card without tables', () => {
    const rows = detectVisiblePrices('<div class="card"><p>Grupna nastava – 65 €</p><p>Cijena na 10.9.2026. 65 €</p></div>', url)
    expect(rows[0]).toMatchObject({name:'Grupna nastava',currentPrice:65,basePrice:65,status:'paired'})
  })
  it('keeps two independently named services separate and does not borrow another base price', () => {
    const rows = detectVisiblePrices('<h3>Grupna nastava</h3><p>65 €</p><p>Bazna cijena 65 € na dan 10.9.2026.</p><h3>Online nastava</h3><p>25 €</p>', url)
    expect(rows).toHaveLength(2)
    expect(rows[0].status).toBe('paired')
    expect(rows[1]).toMatchObject({name:'Online nastava',currentPrice:25,basePrice:null,status:'current_only'})
  })
  it('does not treat a historical amount without a named current offer as a matched price', () => {
    expect(detectVisiblePrices('<div><p>Bazna cijena 65 € na 10.9.2026.</p></div>',url)).toHaveLength(0)
  })
  it('requires the reference date for fully paired signal', () => {
    const rows = detectVisiblePrices('<h3>Grupna nastava</h3><p>65 €</p><p>Bazna cijena 65 €</p>',url)
    expect(rows[0]).toMatchObject({basePrice:65,referenceDate:null,status:'needs_review'})
  })
  it('does not parse javascript, navigation, hidden markup or cookies', () => {
    const html = '<script>const p="Grupna nastava 65 € Bazna cijena 65 €"</script><nav><a>Grupna nastava 65 €</a></nav><h2>Kontakt</h2><p>Nazovite 099 666 6666</p>'
    expect(detectVisiblePrices(html,url)).toHaveLength(0)
  })
  it('does not convert an old strikethrough price into a confirmed base price', () => {
    const rows = detectVisiblePrices('<h3>Grupna nastava</h3><p><del>100 €</del> 65 €</p>',url)
    expect(rows.every(row=>row.status!=='paired')).toBe(true)
  })
  it('counts no visible evidence as unknown, not a legal failure', () => {
    expect(summarizeVisiblePrices([], 1)).toMatchObject({status:'not_found',rows:[]})
    expect(summarizeVisiblePrices([], 0, true)).toMatchObject({status:'unavailable',rows:[]})
  })
  it('parses Croatian grouping in euro amounts and HTML entities', () => {
    const rows = detectVisiblePrices('<h3>Godišnji paket</h3><p>1.299,00 &euro;</p><p>Bazna cijena 1.299,00 € na 10.9.2026.</p>',url)
    expect(rows[0]).toMatchObject({currentPrice:1299,basePrice:1299,status:'paired'})
  })
})
