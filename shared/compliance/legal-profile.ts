/**
 * Regulatory profile for the public checker: which rule is a legal defect, which needs verification and
 * which is only a NEPAR recommendation.
 *
 * Binding sources: Odluka NN 101/2026-1213 as amended by NN 110/2026 (service data: naziv usluge,
 * maloprodajna cijena, posebni oblik prodaje i njegov naziv, sidrena/dodatna cijena; CSV ili XML pogodan za
 * automatsku obradu; naziv datoteke s podacima o objektu, brojem pohrane i vremenskom oznakom; dostupnost
 * 30 dana). Official clarification: MINGO (nova stavka nakon 10. 9. 2026. → cijena s datuma prvog uvrštenja
 * uz jasno naveden datum).
 *
 * Neither the Odluka nor the Ministry prescribes CSV column names, XML element names, a delimiter or an
 * archive URL. NEPAR's own field names are the "NEPAR preporučena shema, usklađena s podacima iz Odluke i HOK
 * predloškom" — a recommendation, never a legal requirement.
 *
 * TODO(regulativa): the price-list regulation published for consultation in October 2026 is a draft and must
 * not produce errors. When the final text is published (expected around 17. 11. 2026.), add a new profile
 * instead of editing the binding rules in place.
 */
export type RuleSource = 'binding' | 'official-clarification' | 'draft' | 'recommendation'
export type FindingLevel = 'error' | 'warning' | 'info'
/** effectiveFrom: Zagreb calendar day the obligation starts to apply; before it an error is shown as a warning. */
export type RuleDefinition = { level: FindingLevel; source: RuleSource; basis: string; effectiveFrom?: string }

const ODLUKA = 'Odluka NN 101/2026-1213 (izmjena NN 110/2026)'
const MINGO = 'Službeno pojašnjenje Ministarstva gospodarstva'

export const CURRENT_PROFILE_ID = 'nn-101-2026+nn-110-2026'

/**
 * NN 110/2026 postponed the start of NN 101/2026 to 17. 11. 2026. Data elements that exist only in the new
 * Odluka (special-sale flag and name, product availability, the service price list as such) are therefore
 * not yet an obligation. Data that retail already owed under NN 75/2025 (naziv, šifra, marka, MPC, barkod,
 * dodatna cijena) keeps its level.
 */
export const NN_101_2026_EFFECTIVE_FROM = '2026-11-17'
const NEW_IN_2026 = { effectiveFrom: NN_101_2026_EFFECTIVE_FROM }

export const RULES: Record<string, RuleDefinition> = {
  'document.unreadable': { level: 'error', source: 'binding', basis: `${ODLUKA}: CSV ili XML pogodan za automatsku obradu` },
  'list.empty': { level: 'error', source: 'binding', basis: ODLUKA },
  'item.row.unreadable': { level: 'error', source: 'binding', basis: `${ODLUKA}: podaci moraju biti strojno čitljivi` },
  'item.name.missing': { level: 'error', source: 'binding', basis: `${ODLUKA}: naziv usluge ili proizvoda` },
  'item.price.invalid': { level: 'error', source: 'binding', basis: `${ODLUKA}: maloprodajna cijena` },
  // The Odluka prescribes the data (final price, including special sales), not a column. A valid price in the
  // special-sale column with MPC left empty is a format deviation to verify, not a proven missing price.
  'item.price.alternative-column': { level: 'warning', source: 'binding', basis: `${ODLUKA}: maloprodajna cijena kao konačna cijena, uključivo posebne oblike prodaje` },
  'service.anchor.missing': { level: 'error', source: 'binding', basis: `${ODLUKA}: sidrena (dodatna) cijena`, ...NEW_IN_2026 },
  'service.anchor.invalid': { level: 'error', source: 'binding', basis: `${ODLUKA}: sidrena (dodatna) cijena`, ...NEW_IN_2026 },
  'product.anchor.missing': { level: 'error', source: 'binding', basis: `${ODLUKA}: sidrena (dodatna) cijena` },
  'sale.flag.missing': { level: 'error', source: 'binding', basis: `${ODLUKA}: podatak o posebnom obliku prodaje`, ...NEW_IN_2026 },
  'sale.name.missing': { level: 'error', source: 'binding', basis: `${ODLUKA}: naziv posebnog oblika prodaje`, ...NEW_IN_2026 },
  'sale.price.invalid': { level: 'error', source: 'binding', basis: ODLUKA },
  'product.unitPrice.invalid': { level: 'error', source: 'binding', basis: ODLUKA },
  'product.externalId.missing': { level: 'error', source: 'binding', basis: `${ODLUKA}: podaci o proizvodu` },
  'product.brand.missing': { level: 'error', source: 'binding', basis: `${ODLUKA}: podaci o proizvodu` },
  'product.barcode.missing': { level: 'error', source: 'binding', basis: `${ODLUKA}: podaci o proizvodu` },
  'product.availability.missing': { level: 'error', source: 'binding', basis: `${ODLUKA}: podaci o proizvodu`, ...NEW_IN_2026 },
  'product.unit.missing': { level: 'warning', source: 'binding', basis: `${ODLUKA}: jedinica mjere gdje je primjenjivo` },
  'product.unitPrice.missing': { level: 'warning', source: 'binding', basis: `${ODLUKA}: cijena za jedinicu mjere gdje je primjenjivo` },
  'product.barcode.invalid': { level: 'warning', source: 'binding', basis: ODLUKA },
  'product.anchor.date.missing': { level: 'warning', source: 'official-clarification', basis: MINGO },
  'anchor.date.new-without-date': { level: 'warning', source: 'official-clarification', basis: `${MINGO}: jasno naveden datum prvog uvrštenja` },
  'anchor.date.new-before-reference': { level: 'warning', source: 'official-clarification', basis: MINGO },
  'anchor.date.before-reference': { level: 'warning', source: 'official-clarification', basis: MINGO },
  'anchor.date.future': { level: 'warning', source: 'official-clarification', basis: MINGO },
  'anchor.date.invalid': { level: 'warning', source: 'official-clarification', basis: MINGO },
  'item.type.unclear': { level: 'warning', source: 'recommendation', basis: 'Vrsta stavke određuje koja se obvezna polja provjeravaju.' },
  'sale.price.not-lower': { level: 'warning', source: 'binding', basis: ODLUKA },
  'sale.flag.inconsistent': { level: 'warning', source: 'binding', basis: ODLUKA },
  'sale.lowest30.missing': { level: 'warning', source: 'binding', basis: 'Pravila o isticanju sniženja (najniža cijena u 30 dana)' },
  'sale.lowest30.invalid': { level: 'warning', source: 'binding', basis: 'Pravila o isticanju sniženja' },
  'sale.lowest30.not-lower': { level: 'warning', source: 'binding', basis: 'Pravila o isticanju sniženja' },
  'publication.filename.unverified': { level: 'warning', source: 'binding', basis: `${ODLUKA}: naziv datoteke s podacima o objektu, brojem pohrane i vremenskom oznakom` },
  'publication.archive.unverified': { level: 'warning', source: 'binding', basis: `${ODLUKA}: objave dostupne 30 dana` },
  'publication.chain.uniform': { level: 'info', source: 'binding', basis: `${ODLUKA}: jedinstvena struktura unutar lanca` },
  'schema.alias': { level: 'info', source: 'recommendation', basis: 'NEPAR preporučena shema, usklađena s podacima iz Odluke i HOK predloškom' },
  'publication.single-format': { level: 'info', source: 'recommendation', basis: 'Odluka traži CSV ili XML; oba formata su NEPAR preporuka.' },
}

const UNKNOWN_RULE: RuleDefinition = { level: 'warning', source: 'recommendation', basis: 'Potrebna je ručna provjera.' }

const zagrebDay = (now: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zagreb', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)

/** "17. 11. 2026." */
export const formatHrDay = (day: string) => { const [y, m, d] = day.split('-'); return `${Number(d)}. ${Number(m)}. ${y}.` }

/**
 * Only binding law and official clarifications may produce an error; a draft is at most information, and a
 * binding rule is an error only from the day it applies (`deferredUntil` marks a not-yet-applicable error).
 */
export function ruleFor(rule: string | undefined, profile: Record<string, RuleDefinition> = RULES, now: Date = new Date()): RuleDefinition & { deferredUntil?: string } {
  const definition = (rule && profile[rule]) || UNKNOWN_RULE
  if (definition.source === 'draft') return { ...definition, level: 'info' }
  if (definition.level === 'error' && definition.source === 'recommendation') return { ...definition, level: 'warning' }
  if (definition.level === 'error' && definition.effectiveFrom && zagrebDay(now) < definition.effectiveFrom) return { ...definition, level: 'warning', deferredUntil: definition.effectiveFrom }
  return definition
}

/** Note appended to a finding whose obligation has not started yet. */
export const deferredNote = (day: string) => ` Obveza se primjenjuje od ${formatHrDay(day)}`
