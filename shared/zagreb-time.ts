/** Date-only admin input means the end of that calendar day in Zagreb, not host time. */
export function zagrebEndOfDay(day:string) {
  return zagrebTime(day,23,59,59,999)
}
export function zagrebTime(day:string,hour=9,minute=0,second=0,millisecond=0) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||new Date(day).toISOString().slice(0,10)!==day) throw new Error('Nevaljan datum.')
  const base=Date.parse(`${day}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:${String(second).padStart(2,'0')}.${String(millisecond).padStart(3,'0')}Z`)
  let value=base
  for(let i=0;i<2;i++) {
    const name=new Intl.DateTimeFormat('en',{timeZone:'Europe/Zagreb',timeZoneName:'longOffset'}).formatToParts(new Date(value)).find(part=>part.type==='timeZoneName')?.value??'GMT+01:00'
    const offset=/GMT([+-])(\d{2}):(\d{2})/.exec(name)
    value=base-(offset?(offset[1]==='-'?-1:1)*(Number(offset[2])*60+Number(offset[3]))*60_000:0)
  }
  return new Date(value).toISOString()
}
