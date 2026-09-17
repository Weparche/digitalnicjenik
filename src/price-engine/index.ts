import marketinoFixture from '../../marketino-artikli?raw'
import { MarketinoCsvAdapter } from './adapters/marketinoCsv'
import { MarketinoMockApiAdapter } from './adapters/marketinoMockApi'
import { NeparAdapter } from './adapters/nepar'

export const adapters = { nepar: new NeparAdapter(marketinoFixture), marketino: new MarketinoCsvAdapter(marketinoFixture), api: new MarketinoMockApiAdapter(marketinoFixture) }
export { marketinoFixture }
export * from './types'
export * from './normalize'
export * from './validate'
export * from './hash'
export * from './csv'
export * from './xml'
export * from './adapters/marketinoCsv'
