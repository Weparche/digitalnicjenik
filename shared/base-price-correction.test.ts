import {describe,it,expect} from 'vitest'
import {basePriceChanges,requireBaseCorrection} from './base-price-correction'
import type {NormalizedPriceList} from '../src/price-engine/types'
const list=(price:number,anchor:number|null,date='2026-09-10',name='Šišanje',externalId?:string):NormalizedPriceList=>({tenant:{id:'x',slug:'x',name:'X'},currency:'EUR',source:'nepar',updatedAt:'2026-11-17',items:[{name,externalId,price,anchorPrice:anchor,anchorReferenceDate:date}]})
describe('base price correction',()=>{
 it('allows current price changes without reason',()=>expect(basePriceChanges(list(15,14),list(20,14))).toEqual([]))
 it('protects a published base including zero',()=>expect(basePriceChanges(list(0,0),list(1,1))).toHaveLength(1))
 it('matches by stable ID across a rename and by name across CSV uploads',()=>{expect(basePriceChanges(list(15,14,'2026-09-10','Old','1'),list(15,16,'2026-09-10','New','1'))).toHaveLength(1);expect(basePriceChanges(list(15,14),list(15,16,'2026-09-10',' šišanje '))).toHaveLength(1)})
 it('detects reference date change and removal',()=>{expect(basePriceChanges(list(15,14),list(15,14,'2026-10-01'))).toHaveLength(1);expect(basePriceChanges(list(15,14),list(15,null))).toHaveLength(1)})
 it('allows initial entry or new service',()=>{expect(basePriceChanges(list(15,null),list(15,14))).toEqual([]);expect(basePriceChanges(list(15,14),list(15,20,'2026-10-01','New service'))).toEqual([])})
 it('requires explanation and correct version',()=>{const changes=basePriceChanges(list(15,14),list(15,16));expect(()=>requireBaseCorrection(changes,'Račun potvrđuje povijesnu cijenu','stale','current')).toThrow();expect(()=>requireBaseCorrection(changes,'','current','current')).toThrow();expect(requireBaseCorrection(changes,'Račun potvrđuje povijesnu cijenu','current','current')).toBe('Račun potvrđuje povijesnu cijenu')})
})
