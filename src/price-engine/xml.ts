import type { NormalizedPriceList } from './types'

const xml = (value: unknown) => String(value ?? '').replace(/[<>&'\"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character] ?? character)

export function renderXml(priceList: NormalizedPriceList): string {
  const items = priceList.items.map((item) => `    <item>\n      <category>${xml(item.category)}</category>\n      <name>${xml(item.name)}</name>\n      <type>${xml(item.type)}</type>\n      <price currency="EUR">${item.price.toFixed(2)}</price>${item.salePrice == null ? '' : `\n      <salePrice currency="EUR">${item.salePrice.toFixed(2)}</salePrice>`}\n      <specialSaleApplied>${item.specialSaleApplied == null ? '' : item.specialSaleApplied}</specialSaleApplied>\n      <specialSaleName>${xml(item.specialSaleName)}</specialSaleName>\n      <anchorPrice currency="EUR">${item.anchorPrice == null ? '' : item.anchorPrice.toFixed(2)}</anchorPrice>\n    </item>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<priceList>\n  <business>\n    <name>${xml(priceList.tenant.name)}</name>\n  </business>\n  <source>${xml(priceList.source)}</source>\n  <updatedAt>${xml(priceList.updatedAt)}</updatedAt>\n  <items>\n${items}\n  </items>\n</priceList>\n`
}
