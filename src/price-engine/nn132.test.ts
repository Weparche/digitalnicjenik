import {describe,it,expect} from 'vitest'
import {renderCsv} from './csv'
import {renderXml,parseXmlPriceList} from './xml'
import {parseMarketinoCsv} from './adapters/marketinoCsv'
import {validatePriceList} from './validate'
import type {NormalizedPriceList} from './types'
const service:NormalizedPriceList={tenant:{id:'x',slug:'x',name:'X'},source:'nepar',currency:'EUR',updatedAt:'2026-11-17T08:00:00Z',formatVersion:'nn-132-2026',items:[{name:'Šišanje; i pranje',type:'Usluga',price:20,salePrice:15,specialSaleApplied:true,anchorPrice:18,lowest30DayPrice:20}]}
describe('NN 132/2026 formats',()=>{
 it('outputs the prescribed order and actual retail price; old output remains unchanged',()=>{
  const csv=renderCsv(service)
  expect(csv).toBe('Naziv usluge;Maloprodajna cijena;Poseban oblik prodaje;Bazna cijena\r\n"Šišanje; i pranje";15.00;DA;18.00\r\n')
  expect(parseMarketinoCsv(csv).priceList.items[0]).toMatchObject({price:15,anchorPrice:18,specialSaleApplied:true,type:'Usluga'})
  expect(parseXmlPriceList(renderXml(service)).items[0]).toMatchObject({price:15,anchorPrice:18,specialSaleApplied:true})
  expect(renderCsv({...service,formatVersion:undefined})).toContain('Grupa,Naziv,Vrsta')
  expect(validatePriceList(service).issues.some(i=>i.rule==='sale.name.missing')).toBe(false)
 })
 it('separates EAN and net quantity and preserves their values',()=>{
 const list={...service,items:[{name:'Roba',type:'Proizvod',price:3,anchorPrice:2,netQuantity:0.5,unit:'kg',unitPrice:6,barcode:'X123',eanBarcode:'4006381333931',specialSaleApplied:false}]}
 const csv=renderCsv(list);expect(csv.split('\r\n')[0]).toBe('Naziv robe;Šifra robe;Marka robe;Neto količina;Jedinica mjere;Maloprodajna cijena;Poseban oblik prodaje;Cijena za jedinicu mjere;Barkod robe;EAN barkod robe;Bazna cijena')
 expect(parseMarketinoCsv(csv).priceList.items[0]).toMatchObject({netQuantity:0.5,eanBarcode:'4006381333931',barcode:'X123',type:'Proizvod'})
 expect(parseXmlPriceList(renderXml(list)).items[0]).toMatchObject({netQuantity:0.5,eanBarcode:'4006381333931',barcode:'X123',type:'Proizvod'})
 })
})

import {parseCsvFeed,parseXmlFeed,compareFeedToPayload} from '../../shared/compliance/document-parser'
it('monitor compares all new-format fields including effective sale price',()=>{
 expect(compareFeedToPayload(service.items,parseCsvFeed(renderCsv(service)))).toEqual({missing:0,unexpected:0})
 expect(compareFeedToPayload(service.items,parseXmlFeed(renderXml(service)))).toEqual({missing:0,unexpected:0})
})
