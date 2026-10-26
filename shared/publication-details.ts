export type PublicationDetails = { objectType: string; objectAddress: string; objectCode: string; workingDays?: number[]; closedDates?: string[] }

export function parsePublicationCalendar(value: { workingDays?: unknown; closedDates?: unknown } = {}) {
  const workingDays = value.workingDays === undefined ? [1, 2, 3, 4, 5] : value.workingDays
  if (!Array.isArray(workingDays) || !workingDays.length || workingDays.length > 7 || workingDays.some(day => !Number.isInteger(day) || day < 0 || day > 6)) throw new Error('Odaberite barem jedan valjan radni dan objekta.')
  const closedDates = value.closedDates ?? []
  if (!Array.isArray(closedDates) || closedDates.length > 366 || closedDates.some(date => typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) throw new Error('Neradni datumi moraju biti valjani datumi u obliku GGGG-MM-DD.')
  return { workingDays: [...new Set(workingDays)] as number[], closedDates: [...new Set(closedDates)] as string[] }
}

/** Real publication metadata is supplied by the owner, not derived from a business name. */
export function parsePublicationDetails(value: unknown): PublicationDetails {
  if (!value || typeof value !== 'object') throw new Error('Unesite vrstu, adresu i oznaku objekta prije objave.')
  const data = value as Record<string, unknown>
  const read = (key: string, max: number) => typeof data[key] === 'string' ? data[key].trim().slice(0, max) : ''
  const details = { objectType: read('objectType', 80), objectAddress: read('objectAddress', 240), objectCode: read('objectCode', 80) }
  if (details.objectType.length < 2 || details.objectAddress.length < 5 || !details.objectCode) throw new Error('Unesite stvarnu vrstu, punu adresu i oznaku objekta.')
  return { ...details, ...parsePublicationCalendar(data) }
}
