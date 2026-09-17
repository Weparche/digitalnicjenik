import { normalizeNumber } from './normalize'
import type { NormalizedPriceList } from './types'

const xml = (value: unknown) => String(value ?? '').replace(/[<>&'\"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character] ?? character)

export function renderXml(priceList: NormalizedPriceList): string {
  const items = priceList.items.map((item) => `    <item>\n      <category>${xml(item.category)}</category>\n      <name>${xml(item.name)}</name>\n      <type>${xml(item.type)}</type>\n      <price currency="EUR">${item.price.toFixed(2)}</price>${item.salePrice == null ? '' : `\n      <salePrice currency="EUR">${item.salePrice.toFixed(2)}</salePrice>`}\n      <specialSaleApplied>${item.specialSaleApplied == null ? '' : item.specialSaleApplied}</specialSaleApplied>\n      <specialSaleName>${xml(item.specialSaleName)}</specialSaleName>\n      <anchorPrice currency="EUR">${item.anchorPrice == null ? '' : item.anchorPrice.toFixed(2)}</anchorPrice>\n    </item>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<priceList>\n  <business>\n    <name>${xml(priceList.tenant.name)}</name>\n  </business>\n  <source>${xml(priceList.source)}</source>\n  <updatedAt>${xml(priceList.updatedAt)}</updatedAt>\n  <items>\n${items}\n  </items>\n</priceList>\n`
}

const textOf = (parent: Element, name: string) => parent.querySelector(name)?.textContent?.trim() ?? ''

export function parseXmlPriceList(xmlText: string, tenant = { id: 'nepar', slug: 'nepar', name: 'NEPAR' }): NormalizedPriceList {
  if (!xmlText.trim() || typeof DOMParser === 'undefined') throw new Error('XML se ne može provjeriti u ovom pregledniku.')
  const document = new DOMParser().parseFromString(xmlText, 'application/xml')
  if (!document.documentElement || document.getElementsByTagName('parsererror').length > 0) throw new Error('XML nije ispravan. Provjerite datoteku i pokušajte ponovno.')
  const nodes = Array.from(document.querySelectorAll('item'))
  if (!nodes.length) throw new Error('XML ne sadrži prepoznate stavke cjenika.')
  const items = nodes.flatMap((node) => {
    const name = textOf(node, 'name')
    const price = normalizeNumber(textOf(node, 'price'))
    if (!name || price == null) return []
    const sale = textOf(node, 'salePrice')
    const anchor = textOf(node, 'anchorPrice')
    const applied = textOf(node, 'specialSaleApplied').toLocaleLowerCase('hr-HR')
    return [{
      externalId: textOf(node, 'externalId') || undefined,
      category: textOf(node, 'category') || undefined,
      name,
      type: textOf(node, 'type') || undefined,
      description: textOf(node, 'description') || undefined,
      price,
      salePrice: sale ? normalizeNumber(sale) : null,
      anchorPrice: anchor ? normalizeNumber(anchor) : null,
      unit: textOf(node, 'unit') || null,
      specialSaleApplied: applied === 'true' || applied === 'da' ? true : applied === 'false' || applied === 'ne' ? false : null,
      specialSaleName: textOf(node, 'specialSaleName') || null,
      isNewSinceReferenceDate: textOf(node, 'isNewSinceReferenceDate').toLocaleLowerCase('hr-HR') === 'true',
    }]
  })
  if (!items.length) throw new Error('XML nema nijednu valjanu stavku s nazivom i cijenom.')
  return { tenant, source: 'nepar', currency: 'EUR', updatedAt: new Date().toISOString(), items }
}
