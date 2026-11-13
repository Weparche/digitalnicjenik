import { afterEach, describe, expect, it, vi } from 'vitest'
import { readZipDirectory, readZipMember, zipCrc, type FetchRange } from './zip-inspection'
import { runDigitalPriceListCheck } from './check'

const enc=new TextEncoder()
const csv='Naziv;Vrsta;Cijena;Sidrena cijena;Poseban oblik prodaje\nŠišanje;Usluga;15;15;NE'
function makeZip(entries:Array<{name:string;text:string;badCrc?:boolean}>){
 const parts:Uint8Array[]=[],central:Uint8Array[]=[];let offset=0
 for(const entry of entries){
   const name=enc.encode(entry.name),body=enc.encode(entry.text),crc=zipCrc(body)+(entry.badCrc?1:0)
   const local=new Uint8Array(30+name.length+body.length),lv=new DataView(local.buffer)
   lv.setUint32(0,0x04034b50,true);lv.setUint16(6,0x800,true);lv.setUint32(14,crc,true);lv.setUint32(18,body.length,true);lv.setUint32(22,body.length,true);lv.setUint16(26,name.length,true);local.set(name,30);local.set(body,30+name.length)
   const c=new Uint8Array(46+name.length),v=new DataView(c.buffer)
   v.setUint32(0,0x02014b50,true);v.setUint16(8,0x800,true);v.setUint32(16,crc,true);v.setUint32(20,body.length,true);v.setUint32(24,body.length,true);v.setUint16(28,name.length,true);v.setUint32(42,offset,true);c.set(name,46)
   parts.push(local);central.push(c);offset+=local.length
 }
 const size=central.reduce((n,c)=>n+c.length,0),e=new Uint8Array(22),ev=new DataView(e.buffer)
 ev.setUint32(0,0x06054b50,true);ev.setUint16(8,entries.length,true);ev.setUint16(10,entries.length,true);ev.setUint32(12,size,true);ev.setUint32(16,offset,true)
 const bytes=new Uint8Array(offset+size+22);let p=0
 for(const chunk of [...parts,...central,e]){bytes.set(chunk,p);p+=chunk.length}return bytes
}
const fetcher=(bytes:Uint8Array):FetchRange=>async range=>{
 const tail=/^bytes=-(\d+)$/.exec(range),part=/^bytes=(\d+)-(\d+)$/.exec(range)
 const start=tail?Math.max(0,bytes.length-Number(tail[1])):Number(part![1]),end=tail?bytes.length-1:Number(part![2])
 return{bytes:bytes.subarray(start,end+1),start,total:bytes.length,validator:'"snapshot"'}
}
afterEach(()=>vi.unstubAllGlobals())
describe('bounded ZIP inspection',()=>{
 it('lists only safe price files, validates CRC and reads selected member',async()=>{
  const bytes=makeZip([{name:'store_a.csv',text:csv},{name:'../bad.csv',text:csv},{name:'store_b.xml',text:'<cjenik/>'},{name:'invoice.pdf',text:'PDF'}])
  const dir=await readZipDirectory(fetcher(bytes))
  expect(dir.entries.map(x=>x.name)).toEqual(['store_a.csv','store_b.xml'])
  expect(await readZipMember(dir,dir.entries[0])).toBe(csv)
 })
 it('rejects corrupted member CRC',async()=>{
  const d=await readZipDirectory(fetcher(makeZip([{name:'a.csv',text:csv,badCrc:true}])))
  await expect(readZipMember(d,d.entries[0])).rejects.toThrow()
 })
 it('reads a small ZIP when range is unsupported and exposes a selectable member',async()=>{
  const bytes=makeZip([{name:'store_a.csv',text:csv},{name:'store_b.csv',text:csv.replace('Šišanje','Bojanje')}])
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>new URL(String(input)).pathname==='/stores.zip'?new Response(bytes,{headers:{'content-type':'application/zip'}}):new Response('missing',{status:404})))
  const result=await runDigitalPriceListCheck('https://example.hr/stores.zip',{zipEntry:'store_b.csv',DIGITAL_PRICE_LIST_DNS_RESOLVER:{resolve4:async()=>['93.184.216.34'],resolve6:async()=>[]}})
  expect(result.status).toBe('yellow')
  expect(result.details.csvAnalysis).toMatchObject({archiveEntry:'store_b.csv',itemCount:1,structureRecognized:true})
  expect(result.details.documentChoices).toHaveLength(2)
 })
 it('rejects unsupported multi-volume ZIP directory',async()=>{
  const bytes=makeZip([{name:'a.csv',text:csv}])
  new DataView(bytes.buffer).setUint16(bytes.length-22+4,1,true)
  await expect(readZipDirectory(fetcher(bytes))).rejects.toThrow()
 })
})
