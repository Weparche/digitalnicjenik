import {it,expect} from 'vitest'
import {parseHistoryImport,calculateImportedHistory,historyImportTemplate} from './imported-price-history'
const item={name:'Kava',type:'Proizvod',externalId:'A1',price:8,specialSaleApplied:true}
const csv='Ključ stavke;Vrijedi od;Vrijedi do;Maloprodajna cijena\np:code:A1;2026-10-18T11:00;2026-10-25T11:00;100\np:code:A1;2026-10-25T11:00;2026-11-01T11:00;90\np:code:A1;2026-11-01T11:00;2026-11-17T11:00;120'
it('computes the minimum from complete imported intervals and rejects gaps',()=>{
 const rows=parseHistoryImport(csv)
 expect(historyImportTemplate([item])).toContain('p:code:A1')
 expect(calculateImportedHistory([item],rows,'2026-11-17T10:00:00Z').results[0]).toMatchObject({status:'complete',lowest:90})
 expect(calculateImportedHistory([item],rows.slice(1),'2026-11-17T10:00:00Z').results[0].status).toBe('partial')
 expect(calculateImportedHistory([item],[...rows,rows[0]],'2026-11-17T10:00:00Z').results[0].status).toBe('ambiguous')
})
it('rejects invalid dates and non-numeric prices',()=>{expect(()=>parseHistoryImport(csv.replace('100','abc'))).toThrow();expect(()=>parseHistoryImport(csv.replace('2026-10-18T11:00','bad'))).toThrow()})
