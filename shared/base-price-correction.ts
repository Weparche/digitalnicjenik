import type {NormalizedPriceItem,NormalizedPriceList} from '../src/price-engine/types'

/** Stable ID first, then exact normalized name for CSVs that have no ID.
 * Protects existing matched items, not an assertion of identity for a renamed new item.
 */
export function basePriceChanges(previous:NormalizedPriceList|undefined,next:NormalizedPriceList) {
  const normalize=(s:string)=>s.trim().normalize('NFC').toLocaleLowerCase('hr-HR').replace(/\s+/g,' ')
  const byId=new Map<string,NormalizedPriceItem>()
  const byName=new Map<string,NormalizedPriceItem[]>()
  for(const item of previous?.items??[]){
    if(item.externalId)byId.set(item.externalId,item)
    const k=normalize(item.name)
    byName.set(k,[...(byName.get(k)??[]),item])
  }
  return next.items.flatMap(item=>{
    const candidates=byName.get(normalize(item.name))??[]
    const old=(item.externalId?byId.get(item.externalId):undefined)??(candidates.length===1?candidates[0]:undefined)
    if(!old||old.anchorPrice==null)return []
    const before={price:old.anchorPrice,date:old.anchorReferenceDate??null}
    const after={price:item.anchorPrice??null,date:item.anchorReferenceDate??null}
    return before.price===after.price&&before.date===after.date?[]:[{name:item.name,externalId:item.externalId??null,before,after}]
  })
}
export function requireBaseCorrection(changes:ReturnType<typeof basePriceChanges>,reason:unknown,expected:string|undefined,current:string|undefined){
  if(!changes.length)return null
  if(!current||expected!==current)throw new Error('Bazne cijene su promijenjene. Osvježite cjenik i ponovno potvrdite ispravak.')
  if(typeof reason!=='string'||reason.trim().length<10||reason.trim().length>500)throw new Error('Za promjenu evidentirane bazne cijene navedite obrazloženje (10–500 znakova).')
  return reason.trim()
}
