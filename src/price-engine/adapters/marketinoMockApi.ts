import { NeparAdapter } from './nepar'
import type { PriceSourceAdapter } from '../types'

export class MarketinoMockApiAdapter implements PriceSourceAdapter {
  id = 'marketino-api' as const
  name = 'Marketino API (mock)'
  constructor(private readonly fixture: string) {}
  async load() {
    // Replace mock source with the official Marketino read-only API once API credentials/specification are available.
    const list = await new NeparAdapter(this.fixture).load()
    return { ...list, source: 'marketino-api' as const, tenant: { id: 'marketino-api-demo', slug: 'marketino-api-demo', name: 'Marketino API demo' } }
  }
}
