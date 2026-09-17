import { MarketinoCsvAdapter } from './marketinoCsv'
import type { PriceSourceAdapter } from '../types'

export class NeparAdapter implements PriceSourceAdapter {
  id = 'nepar' as const
  name = 'NEPAR demo'
  constructor(private readonly sourceCsv: string) {}
  async load() {
    const list = await new MarketinoCsvAdapter(this.sourceCsv).load()
    return { ...list, source: 'nepar' as const, tenant: { id: 'nepar', slug: 'nepar', name: 'NEPAR' } }
  }
}
