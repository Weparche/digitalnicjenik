import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { normalizeBarcode, normalizeNumber, normalizeReferenceDate, parseAvailability } from './normalize'
import { usesProductStructure } from './profile'
import type { NormalizedPriceList } from './types'

const xml = (value: unknown) => String(value ?? '').replace(/[<>&'\"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character] ?? character)

export function renderXml(priceList: NormalizedPriceList): string {
  const products = usesProductStructure(priceList)
  const items = priceList.items.map((item) => {
    const historyFields = [
      ['anchorReferenceDate', item.anchorReferenceDate ?? ''],
      ['lowest30DayPrice', item.lowest30DayPrice == null ? '' : item.lowest30DayPrice.toFixed(2)],
      ['isNewSinceReferenceDate', item.isNewSinceReferenceDate ? 'true' : ''],
      ['unitPricingExemption', item.unitPricingExemption ?? ''],
    ].filter(([, value]) => value !== '').map(([field, value]) => '\n      <' + field + '>' + xml(value) + '</' + field + '>').join('')
    const productFields = products
      ? `\n      <externalId>${xml(item.externalId)}</externalId>\n      <brand>${xml(item.brand)}</brand>\n      <barcode>${xml(item.barcode)}</barcode>\n      <unit>${xml(item.unit)}</unit>${item.unitPrice == null ? '' : `\n      <unitPrice currency="EUR">${item.unitPrice.toFixed(2)}</unitPrice>`}\n      <availability>${xml(item.availability)}</availability>`
      : ''
    return `    <item>\n      <category>${xml(item.category)}</category>\n      <name>${xml(item.name)}</name>\n      <type>${xml(item.type)}</type>${productFields}\n      <price currency="EUR">${item.price.toFixed(2)}</price>${item.salePrice == null ? '' : `\n      <salePrice currency="EUR">${item.salePrice.toFixed(2)}</salePrice>`}\n      <specialSaleApplied>${item.specialSaleApplied == null ? '' : item.specialSaleApplied}</specialSaleApplied>\n      <specialSaleName>${xml(item.specialSaleName)}</specialSaleName>\n      <anchorPrice currency="EUR">${item.anchorPrice == null ? '' : item.anchorPrice.toFixed(2)}</anchorPrice>${historyFields}\n    </item>`
  }).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<priceList>\n  <business>\n    <name>${xml(priceList.tenant.name)}</name>\n  </business>\n  <source>${xml(priceList.source)}</source>\n  <updatedAt>${xml(priceList.updatedAt)}</updatedAt>\n  <items>\n${items}\n  </items>\n</priceList>\n`
}

/** Both runtimes use identical row validation and supported schemas. */
export function parseXmlPriceListBrowser(xmlText: string, tenant = { id: 'nepar', slug: 'nepar', name: 'NEPAR' }): NormalizedPriceList {
  return parseXmlPriceList(xmlText, tenant)
}

type XmlTree = { name: string; text: string; children: XmlTree[] }

const localXmlName = (name: string) => name.split(':').pop()?.toLowerCase() ?? name.toLowerCase()
/** Syntax and decoding are identical in browsers and Workers. Never expand custom entities. */
function parseXmlTree(xmlText: string): XmlTree {
  const source = xmlText.trim()
  const invalid = () => new Error('XML nije ispravan. Provjerite datoteku i pokušajte ponovno.')
  const markup = source.replace(/<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>/g, '')
  if (!source || /<!doctype|<!entity/i.test(markup) || /&(?!(?:amp|lt|gt|quot|apos);|#(?:[0-9]+|x[0-9a-fA-F]+);)/.test(markup) || XMLValidator.validate(source) !== true) throw invalid()
  // Numeric references require htmlEntities in this version; the guard above permits only XML entities.
  const parser = new XMLParser({ preserveOrder: true, ignoreAttributes: true, parseTagValue: false, trimValues: false, processEntities: true, htmlEntities: true })
  const ordered = parser.parse(source) as Array<Record<string, unknown>>
  const convert = (entries: Array<Record<string, unknown>>, depth: number): XmlTree[] => {
    if (depth > 64) throw invalid()
    const result: XmlTree[] = []
    for (const entry of entries) {
      for (const [name, value] of Object.entries(entry)) {
        if (name.startsWith('?') || name.startsWith('#') || name === ':@') continue
        if (!Array.isArray(value)) throw invalid()
        const children = value as Array<Record<string, unknown>>
        result.push({ name, text: children.map(child => typeof child['#text'] === 'string' ? child['#text'] : '').join(''), children: convert(children, depth + 1) })
      }
    }
    return result
  }
  const roots = convert(ordered, 0)
  if (roots.length !== 1) throw invalid()
  return roots[0]
}

function findXmlNode(parent: XmlTree, name: string): XmlTree | undefined {
  const expected = name.toLowerCase()
  return parent.children.find((child) => localXmlName(child.name) === expected)
    ?? parent.children.reduce<XmlTree | undefined>((found, child) => found ?? findXmlNode(child, name), undefined)
}

const xmlTextOf = (parent: XmlTree, name: string) => findXmlNode(parent, name)?.text.trim() ?? ''

/** Shared parser for NEPAR and the published HOK-style service examples. Invalid rows fail the whole import. */
export function parseXmlPriceList(xmlText: string, tenant = { id: 'nepar', slug: 'nepar', name: 'NEPAR' }): NormalizedPriceList {
  const root = parseXmlTree(xmlText)
  const nodes: XmlTree[] = []
  const collectItems = (node: XmlTree) => {
    if (['item', 'usluga'].includes(localXmlName(node.name))) { nodes.push(node); return }
    node.children.forEach(collectItems)
  }
  collectItems(root)
  if (!nodes.length) throw new Error('XML ne sadrži prepoznate stavke cjenika.')
  const items = nodes.map((node, index) => {
    const service = localXmlName(node.name) === 'usluga'
    const field = (nepar: string, hok?: string) => xmlTextOf(node, nepar) || (hok ? xmlTextOf(node, hok) : '')
    const name = field('name', 'naziv_usluge')
    const price = normalizeNumber(field('price', 'maloprodajna_cijena'))
    if (!name || price == null) throw new Error(`XML stavka ${index + 1}: ${!name ? 'nedostaje naziv' : 'cijena nije broj'}. Nijedna stavka nije uvezena.`)
    const sale = xmlTextOf(node, 'salePrice')
    const anchor = field('anchorPrice', 'sidrena_cijena')
    const unitPrice = xmlTextOf(node, 'unitPrice')
    const applied = field('specialSaleApplied', 'posebni_oblik_prodaje').toLocaleLowerCase('hr-HR')
    const dateRaw = field('anchorReferenceDate', 'datum_referentne_cijene')
    const referenceDate = normalizeReferenceDate(dateRaw)
    if (dateRaw && !referenceDate) throw new Error('XML stavka ' + (index + 1) + ': referentni datum nije valjan.')
    const lowestRaw = field('lowest30DayPrice', 'najniza_cijena_30_dana')
    const lowest = normalizeNumber(lowestRaw)
    if (lowestRaw && lowest == null) throw new Error('XML stavka ' + (index + 1) + ': najniža cijena nije broj.')
    for (const [label, value] of [['akcijska cijena', sale], ['sidrena cijena', anchor], ['cijena za jedinicu mjere', unitPrice]] as const) {
      if (value && normalizeNumber(value) == null) throw new Error(`XML stavka ${index + 1}: ${label} nije broj.`)
    }
    return {
      externalId: xmlTextOf(node, 'externalId') || undefined,
      category: xmlTextOf(node, 'category') || undefined,
      name,
      type: xmlTextOf(node, 'type') || (service ? 'Usluga' : undefined),
      description: xmlTextOf(node, 'description') || undefined,
      price,
      salePrice: sale ? normalizeNumber(sale) : null,
      anchorPrice: anchor ? normalizeNumber(anchor) : null,
      ...(referenceDate ? { anchorReferenceDate: referenceDate } : {}),
      ...(lowest != null ? { lowest30DayPrice: lowest } : {}),
      ...(xmlTextOf(node, 'unitPricingExemption') ? { unitPricingExemption: xmlTextOf(node, 'unitPricingExemption') } : {}),
      unit: xmlTextOf(node, 'unit') || null,
      unitPrice: normalizeNumber(unitPrice),
      brand: xmlTextOf(node, 'brand') || null,
      barcode: normalizeBarcode(xmlTextOf(node, 'barcode')) || null,
      availability: parseAvailability(xmlTextOf(node, 'availability')),
      specialSaleApplied: applied === 'true' || applied === 'da' ? true : applied === 'false' || applied === 'ne' ? false : null,
      specialSaleName: field('specialSaleName', 'naziv_posebnog_oblika') || null,
      isNewSinceReferenceDate: xmlTextOf(node, 'isNewSinceReferenceDate').toLocaleLowerCase('hr-HR') === 'true',
    }
  })
  if (!items.length) throw new Error('XML nema nijednu valjanu stavku s nazivom i cijenom.')
  return { tenant, source: 'nepar', currency: 'EUR', updatedAt: new Date().toISOString(), items }
}

/** Raw per-item field map (lowercased child names → trimmed text) for compliance checks; unlike parseXmlPriceList it keeps items that lack a name or price. */
export function parseXmlItemRecords(xmlText: string): Array<Record<string, string>> {
  const root = parseXmlTree(xmlText)
  const records: Array<Record<string, string>> = []
  const collect = (node: XmlTree) => {
    if (['item', 'usluga'].includes(localXmlName(node.name))) {
      records.push(Object.fromEntries(node.children.map((child) => [localXmlName(child.name), child.text.trim()])))
      return
    }
    node.children.forEach(collect)
  }
  collect(root)
  return records
}
