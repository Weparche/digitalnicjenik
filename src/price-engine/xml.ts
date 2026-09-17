import { normalizeNumber } from './normalize'
import type { NormalizedPriceList } from './types'

const xml = (value: unknown) => String(value ?? '').replace(/[<>&'\"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character] ?? character)

export function renderXml(priceList: NormalizedPriceList): string {
  const items = priceList.items.map((item) => `    <item>\n      <category>${xml(item.category)}</category>\n      <name>${xml(item.name)}</name>\n      <type>${xml(item.type)}</type>\n      <price currency="EUR">${item.price.toFixed(2)}</price>${item.salePrice == null ? '' : `\n      <salePrice currency="EUR">${item.salePrice.toFixed(2)}</salePrice>`}\n      <specialSaleApplied>${item.specialSaleApplied == null ? '' : item.specialSaleApplied}</specialSaleApplied>\n      <specialSaleName>${xml(item.specialSaleName)}</specialSaleName>\n      <anchorPrice currency="EUR">${item.anchorPrice == null ? '' : item.anchorPrice.toFixed(2)}</anchorPrice>\n    </item>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<priceList>\n  <business>\n    <name>${xml(priceList.tenant.name)}</name>\n  </business>\n  <source>${xml(priceList.source)}</source>\n  <updatedAt>${xml(priceList.updatedAt)}</updatedAt>\n  <items>\n${items}\n  </items>\n</priceList>\n`
}

const textOf = (parent: Element, name: string) => parent.querySelector(name)?.textContent?.trim() ?? ''

export function parseXmlPriceListBrowser(xmlText: string, tenant = { id: 'nepar', slug: 'nepar', name: 'NEPAR' }): NormalizedPriceList {
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

type XmlTree = { name: string; text: string; children: XmlTree[] }

const localXmlName = (name: string) => name.split(':').pop()?.toLowerCase() ?? name.toLowerCase()
const decodeXmlText = (value: string) => value.replace(/&(?:lt|gt|amp|quot|apos|#\d+|#x[\da-f]+);/gi, (entity) => {
  const key = entity.toLowerCase()
  if (key === '&lt;') return '<'
  if (key === '&gt;') return '>'
  if (key === '&amp;') return '&'
  if (key === '&quot;') return '"'
  if (key === '&apos;') return "'"
  const code = key.startsWith('&#x') ? Number.parseInt(key.slice(3, -1), 16) : Number.parseInt(key.slice(2, -1), 10)
  return Number.isSafeInteger(code) ? String.fromCodePoint(code) : entity
})

function parseXmlTree(xmlText: string): XmlTree {
  const source = xmlText.trim()
  if (!source || /<!doctype|<!entity/i.test(source)) throw new Error('XML nije ispravan. Provjerite datoteku i pokušajte ponovno.')
  const tokens = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<\/?[A-Za-z_][\w:.-]*(?:\s[^<>]*?)?\/?\s*>|[^<]+/g
  const stack: XmlTree[] = []
  let root: XmlTree | null = null
  let cursor = 0
  let match: RegExpExecArray | null
  while ((match = tokens.exec(source))) {
    if (match.index !== cursor) throw new Error('XML nije ispravan. Provjerite datoteku i pokušajte ponovno.')
    cursor = tokens.lastIndex
    const token = match[0]
    if (token.startsWith('<!--') || token.startsWith('<?')) continue
    if (!token.startsWith('<')) {
      if (stack.length) stack[stack.length - 1].text += decodeXmlText(token)
      else if (token.trim()) throw new Error('XML mora imati samo jedan korijenski element.')
      continue
    }
    if (token.startsWith('</')) {
      const name = token.slice(2, -1).trim()
      const current = stack.pop()
      if (!current || current.name !== name) throw new Error('XML nije ispravan. Provjerite datoteku i pokušajte ponovno.')
      continue
    }
    const selfClosing = /\/\s*>$/.test(token)
    const name = token.slice(1, token.length - (selfClosing ? 2 : 1)).trim().split(/\s+/, 1)[0]
    if (!name || /["']/.test(name)) throw new Error('XML nije ispravan. Provjerite datoteku i pokušajte ponovno.')
    const node: XmlTree = { name, text: '', children: [] }
    if (stack.length) stack[stack.length - 1].children.push(node)
    else if (root) throw new Error('XML mora imati samo jedan korijenski element.')
    else root = node
    if (!selfClosing) stack.push(node)
  }
  if (cursor !== source.length || !root || stack.length) throw new Error('XML nije ispravan. Provjerite datoteku i pokušajte ponovno.')
  return root
}

function findXmlNode(parent: XmlTree, name: string): XmlTree | undefined {
  const expected = name.toLowerCase()
  return parent.children.find((child) => localXmlName(child.name) === expected)
    ?? parent.children.reduce<XmlTree | undefined>((found, child) => found ?? findXmlNode(child, name), undefined)
}

const xmlTextOf = (parent: XmlTree, name: string) => findXmlNode(parent, name)?.text.trim() ?? ''

/** Shared parser for browser and Pages Functions runtimes. It intentionally accepts the simple NEPAR XML shape only. */
export function parseXmlPriceList(xmlText: string, tenant = { id: 'nepar', slug: 'nepar', name: 'NEPAR' }): NormalizedPriceList {
  const root = parseXmlTree(xmlText)
  const nodes: XmlTree[] = []
  const collectItems = (node: XmlTree) => {
    if (localXmlName(node.name) === 'item') nodes.push(node)
    node.children.forEach(collectItems)
  }
  collectItems(root)
  if (!nodes.length) throw new Error('XML ne sadrži prepoznate stavke cjenika.')
  const items = nodes.flatMap((node) => {
    const name = xmlTextOf(node, 'name')
    const price = normalizeNumber(xmlTextOf(node, 'price'))
    if (!name || price == null) return []
    const sale = xmlTextOf(node, 'salePrice')
    const anchor = xmlTextOf(node, 'anchorPrice')
    const applied = xmlTextOf(node, 'specialSaleApplied').toLocaleLowerCase('hr-HR')
    return [{
      externalId: xmlTextOf(node, 'externalId') || undefined,
      category: xmlTextOf(node, 'category') || undefined,
      name,
      type: xmlTextOf(node, 'type') || undefined,
      description: xmlTextOf(node, 'description') || undefined,
      price,
      salePrice: sale ? normalizeNumber(sale) : null,
      anchorPrice: anchor ? normalizeNumber(anchor) : null,
      unit: xmlTextOf(node, 'unit') || null,
      specialSaleApplied: applied === 'true' || applied === 'da' ? true : applied === 'false' || applied === 'ne' ? false : null,
      specialSaleName: xmlTextOf(node, 'specialSaleName') || null,
      isNewSinceReferenceDate: xmlTextOf(node, 'isNewSinceReferenceDate').toLocaleLowerCase('hr-HR') === 'true',
    }]
  })
  if (!items.length) throw new Error('XML nema nijednu valjanu stavku s nazivom i cijenom.')
  return { tenant, source: 'nepar', currency: 'EUR', updatedAt: new Date().toISOString(), items }
}
