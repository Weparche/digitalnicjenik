/** Read one bounded member of a ZIP without downloading the complete archive.
 * Supports standard single-volume ZIP (stored/deflate); never extracts to a filesystem.
 * Range requests must be made by the checker's SSRF-safe fetcher.
 */
const MAX_TAIL = 65_557
const MAX_DIRECTORY = 2_000_000
const MAX_ENTRIES = 2_000
const MAX_MEMBER = 5 * 1024 * 1024
const MAX_ARCHIVE = 2_000_000_000
export type RangeBlock = { bytes: Uint8Array; start: number; total: number; validator?: string }
export type FetchRange = (range: string, validator?: string) => Promise<RangeBlock>
export type ZipEntry = { name: string; method: number; flags: number; compressed: number; size: number; crc: number; offset: number }
const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
function requireZip(ok: unknown): asserts ok { if (!ok) throw new Error('unsupported_zip') }
function u16(v:DataView,i:number){return v.getUint16(i,true)}
function u32(v:DataView,i:number){return v.getUint32(i,true)}
function decodeName(bytes:Uint8Array, flags:number){
  return new TextDecoder(flags & 0x800 ? 'utf-8' : 'windows-1250').decode(bytes)
}
function safeName(name:string){return !!name && name.length<=512 && !/[\x00-\x1f\\]/.test(name) && !name.startsWith('/') && !/^[a-z]:/i.test(name) && !name.split('/').includes('..')}
function parseDirectory(bytes:Uint8Array,count:number):ZipEntry[]{
  const v=view(bytes),out:ZipEntry[]=[];let offset=0
  const names=new Set<string>()
  for(let i=0;i<count;i++){
    requireZip(offset+46<=bytes.length && u32(v,offset)===0x02014b50)
    const flags=u16(v,offset+8),method=u16(v,offset+10),crc=u32(v,offset+16),compressed=u32(v,offset+20),size=u32(v,offset+24)
    const nameLen=u16(v,offset+28),extraLen=u16(v,offset+30),commentLen=u16(v,offset+32),disk=u16(v,offset+34),localOffset=u32(v,offset+42)
    const end=offset+46+nameLen+extraLen+commentLen
    requireZip(end<=bytes.length && disk===0 && compressed!==0xffffffff && size!==0xffffffff && localOffset!==0xffffffff)
    const name=decodeName(bytes.subarray(offset+46,offset+46+nameLen),flags)
    requireZip(!names.has(name)); names.add(name)
    if(safeName(name)&&/\.(csv|xml)$/i.test(name)&&!(flags&1)&&[0,8].includes(method)&&size>0&&size<=MAX_MEMBER&&compressed>0&&compressed<=MAX_MEMBER)out.push({name,flags,method,crc,compressed,size,offset:localOffset})
    offset=end
  }
  requireZip(offset<=bytes.length)
  return out
}
export async function readZipDirectory(fetchRange:FetchRange){
  const tail=await fetchRange('bytes=-'+MAX_TAIL)
  requireZip(tail.total<=MAX_ARCHIVE&&tail.bytes.length<=MAX_TAIL&&tail.start+tail.bytes.length===tail.total)
  const v=view(tail.bytes)
  let end=-1
  for(let i=tail.bytes.length-22;i>=0;i--){if(u32(v,i)===0x06054b50&&i+22+u16(v,i+20)===tail.bytes.length){end=i;break}}
  requireZip(end>=0&&u16(v,end+4)===0&&u16(v,end+6)===0)
  const count=u16(v,end+10),size=u32(v,end+12),start=u32(v,end+16)
  requireZip(count===u16(v,end+8)&&count>0&&count<=MAX_ENTRIES&&size>0&&size<=MAX_DIRECTORY&&start+size<=tail.start+end)
  // Use the same archive snapshot for all later reads. A changed response aborts inspection.
  const get=async(start:number,length:number)=>{
    requireZip(length>0&&start>=0&&start+length<=tail.total)
    if(start>=tail.start&&start+length<=tail.start+tail.bytes.length)return tail.bytes.subarray(start-tail.start,start-tail.start+length)
    const part=await fetchRange('bytes='+start+'-'+(start+length-1),tail.validator)
    requireZip(part.start===start&&part.total===tail.total&&part.bytes.length===length&&(!tail.validator||part.validator===tail.validator))
    return part.bytes
  }
  const entries=parseDirectory(await get(start,size),count)
  return {entries,totalEntries:count,bytes:tail.total,get,directoryStart:start}
}
const CRC_TABLE = Array.from({length:256},(_,i)=>{let c=i;for(let b=0;b<8;b++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0})
export function zipCrc(bytes:Uint8Array){let crc=0xffffffff;for(const b of bytes)crc=CRC_TABLE[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0}
export async function readZipMember(directory:Awaited<ReturnType<typeof readZipDirectory>>,entry:ZipEntry){
  const header=await directory.get(entry.offset,30),v=view(header)
  requireZip(u32(v,0)===0x04034b50&&u16(v,6)===entry.flags&&u16(v,8)===entry.method)
  const nameLength=u16(v,26),extraLength=u16(v,28)
  requireZip(nameLength>0&&nameLength<=1024&&entry.offset+30+nameLength+extraLength+entry.compressed<=directory.directoryStart)
  const name=decodeName(await directory.get(entry.offset+30,nameLength),entry.flags)
  requireZip(name===entry.name)
  const compressed=await directory.get(entry.offset+30+nameLength+extraLength,entry.compressed)
  let bytes:Uint8Array
  if(entry.method===0){requireZip(entry.compressed===entry.size);bytes=compressed}
  else{
    // Enforce the declared size as a hard streaming output cap, not just a metadata check.
    const stream=new Blob([new Uint8Array(compressed)]).stream().pipeThrough(new DecompressionStream('deflate-raw' as CompressionFormat))
    const reader=stream.getReader(),out=new Uint8Array(entry.size);let pos=0
    try{while(true){const part=await reader.read();if(part.done)break;if(pos+part.value.length>out.length){await reader.cancel();throw new Error('zip_member_limit')}out.set(part.value,pos);pos+=part.value.length}}
    finally{reader.releaseLock()}
    requireZip(pos===entry.size);bytes=out
  }
  requireZip(bytes.length===entry.size&&zipCrc(bytes)===entry.crc)
  let body=new TextDecoder().decode(bytes)
  if(body.includes('\uFFFD'))body=new TextDecoder('windows-1250').decode(bytes)
  return body
}
