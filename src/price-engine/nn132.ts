import {isServiceItem} from './profile'
import type {NormalizedPriceList,NormalizedPriceItem} from './types'
export const NN132_FORMAT = 'nn-132-2026' as const
export const NN132_SOURCE = 'https://narodne-novine.nn.hr/eli/sluzbeni/2026/132/pdf'
export const NN132_EFFECTIVE = '2026-11-17'
export const nn132ServiceHeaders = ['Naziv usluge','Maloprodajna cijena','Poseban oblik prodaje','Bazna cijena'] as const
export const nn132GoodsHeaders = ['Naziv robe','Šifra robe','Marka robe','Neto količina','Jedinica mjere','Maloprodajna cijena','Poseban oblik prodaje','Cijena za jedinicu mjere','Barkod robe','EAN barkod robe','Bazna cijena'] as const
export function nn132Kind(list: Pick<NormalizedPriceList,'items'>){
 const service=list.items.some(isServiceItem),goods=list.items.some(i=>!isServiceItem(i))
 return service&&goods?'mixed':service?'services':'products'
}
export function retailPrice(i:NormalizedPriceItem){return i.specialSaleApplied===true&&i.salePrice!=null?i.salePrice:i.price}
const money=(v:number|null|undefined)=>v==null?'':v.toFixed(2)
export function nn132Rows(list:NormalizedPriceList){
 const kind=nn132Kind(list)
 if(kind==='mixed')throw new Error('Za novi pravilnik odvojite robu i usluge u zasebne cjenike.')
 const fields=list.items.map(i=>{const flag=i.specialSaleApplied===true?'DA':i.specialSaleApplied===false?'NE':''
  return kind==='services'?[i.name,money(retailPrice(i)),flag,money(i.anchorPrice)]:[i.name,i.externalId??'',i.brand??'',i.netQuantity??'',i.unit??'',money(retailPrice(i)),flag,money(i.unitPrice),i.barcode??'',i.eanBarcode??'',money(i.anchorPrice)]
 })
 return {kind,headers:kind==='services'?nn132ServiceHeaders:nn132GoodsHeaders,fields}
}
const escape=(v:unknown,protect:boolean)=>{let s=String(v??'');if(protect&&/^[=+\-@\t\r\n]/.test(s))s="'"+s;return /[;"\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s}
export function renderNn132Csv(list:NormalizedPriceList){
 const {kind,headers,fields}=nn132Rows(list)
 const numeric=new Set(kind==='services'?[1,3]:[3,5,7,10])
 return [headers,...fields].map(r=>r.map((v,i)=>escape(v,!numeric.has(i))).join(';')).join('\r\n')+'\r\n'
}
const xml=(v:unknown)=>String(v??'').replace(/[<>&'"]/g,ch=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[ch]??ch))
export function renderNn132Xml(list:NormalizedPriceList){
 const {kind,fields}=nn132Rows(list)
 const tags=kind==='services'?['naziv_usluge','maloprodajna_cijena','poseban_oblik_prodaje','bazna_cijena']:['naziv_robe','sifra_robe','marka_robe','neto_kolicina','jedinica_mjere','maloprodajna_cijena','poseban_oblik_prodaje','cijena_za_jedinicu_mjere','barkod_robe','ean_barkod_robe','bazna_cijena']
 const item=kind==='services'?'usluga':'roba'
 return '<?xml version="1.0" encoding="UTF-8"?>\n<cjenik format="nn-132-2026">\n'+fields.map(row=>'  <'+item+'>\n'+row.map((v,i)=>'    <'+tags[i]+'>'+xml(v)+'</'+tags[i]+'>').join('\n')+'\n  </'+item+'>').join('\n')+'\n</cjenik>\n'
}
