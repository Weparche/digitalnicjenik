export type CatalogMonitor={enabled:boolean;overall:'ok'|'warn'|'fail'|'skipped'|null;checkedAt:string|null;alertOpen:boolean;jobStatus:string|null;jobUpdatedAt:string|null;currentVersion:boolean}
export type CatalogMonitorState='unavailable'|'inactive'|'pending'|'failed'|'unchecked'|'outdated'|'ok'|'warn'|'fail'|'skipped'
export function catalogMonitorState(monitor:CatalogMonitor|null|undefined):CatalogMonitorState{
  if(!monitor)return 'unavailable'
  if(!monitor.enabled)return 'inactive'
  if(['queued','running','notifying'].includes(monitor.jobStatus??''))return 'pending'
  if(monitor.jobStatus==='failed'&&(!monitor.checkedAt||!monitor.jobUpdatedAt||Date.parse(monitor.jobUpdatedAt)>=Date.parse(monitor.checkedAt)))return 'failed'
  if(!monitor.checkedAt||!monitor.overall)return 'unchecked'
  if(!monitor.currentVersion)return 'outdated'
  return monitor.overall
}
export const monitorLabels:Record<CatalogMonitorState,string>={unavailable:'Nije uključen u paket',inactive:'Nadzor neaktivan',pending:'Provjera u tijeku',failed:'Provjera nije dovršena',unchecked:'Još nije provjeren',outdated:'Nova verzija čeka provjeru',ok:'Provjera u redu',warn:'Upozorenje',fail:'Greška',skipped:'Provjera preskočena'}
export const needsMonitorAttention=(m:CatalogMonitor|null|undefined)=>Boolean(m?.enabled&&(m.alertOpen||['failed','unchecked','outdated','warn','fail','skipped'].includes(catalogMonitorState(m))))
