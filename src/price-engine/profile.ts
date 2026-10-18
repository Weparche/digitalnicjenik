import type { NormalizedPriceList } from './types'

const servicePattern = /uslug|service/i

export function isServiceItem(item: NormalizedPriceList['items'][number]) {
  return servicePattern.test(item.type ?? '')
}

/**
 * A list uses the product file structure (extra columns/elements for šifra, marka, barkod, jedinica,
 * cijena po jedinici i dostupnost) as soon as it contains any non-service item. Pure service lists keep
 * the compact structure, so existing service feeds do not change. The Odluka requires one uniform
 * structure per list, which this guarantees because the decision is made on the whole list.
 */
export function usesProductStructure(priceList: Pick<NormalizedPriceList, 'items'>) {
  return priceList.items.some((item) => !isServiceItem(item))
}
