import { INSTALLATION, PLANS } from './pricing'

/** Bank-transfer payee printed in the HUB-3 2D barcode and the plain payment details. */
export const PAYEE = {
  name: 'Nepar, vl. Ivan Gorupić',
  street: 'Koprivnička ulica 52',
  postalCity: '10000 Zagreb',
  iban: 'HR0623600001103276807',
  model: 'HR00',
  purpose: 'OTHR',
} as const

export type OrderKind = 'web_link' | 'publisher' | 'publisher_upgrade' | 'web_publisher' | 'installation'
export type CustomerType = 'company' | 'person'

/** Free public link after e-mail confirmation, then extra time once the customer orders. */
export const FREE_PUBLICATION_HOURS = 24
/** The +30 € Publisher upgrade is offered only right after buying Web Link, never for a few remaining months. */
export const UPGRADE_WINDOW_DAYS = 30

const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000
const cents = (eur: number) => Math.round(eur * 100)

export function orderAmountCents(kind: OrderKind, installation = false) {
  const webLink = PLANS.find((plan) => plan.id === 'link')!.price
  const publisher = PLANS.find((plan) => plan.id === 'publisher')!.price
  if (kind === 'publisher_upgrade') return cents(publisher) - cents(webLink)
  if (kind === 'installation') return cents(INSTALLATION.price)
  if (kind === 'web_publisher') return cents(PLANS[2].price)
  if (kind === 'publisher') return cents(publisher) + (installation ? cents(INSTALLATION.price) : 0)
  return cents(webLink) + (installation ? cents(INSTALLATION.price) : 0)
}

export function formatCents(amountCents: number) {
  return `${(amountCents / 100).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

export function orderReference(number: number, createdAt: string) {
  return `${new Date(createdAt).getUTCFullYear()}-${number}`
}

export function orderDescription(kind: OrderKind, slug: string) {
  return fold(`${kind === 'installation' ? 'Ugradnja' : kind === 'web_publisher' ? 'Web i Publisher' : kind === 'publisher_upgrade' || kind === 'publisher' ? 'Publisher' : 'Digitalni cjenik'} ${slug}`).slice(0, 35)
}

export function planForOrder(kind: OrderKind) {
  return kind === 'web_link' ? 'web_link' : kind === 'web_publisher' ? 'managed' : kind === 'installation' ? null : 'publisher_self_service'
}
export function orderLabel(kind: OrderKind) {
  return kind === 'installation' ? INSTALLATION.name : kind === 'publisher_upgrade' ? 'Nadogradnja na Publisher' : kind === 'web_publisher' ? PLANS[2].name : kind === 'publisher' ? PLANS[1].name : PLANS[0].name
}

export function freePublicationEnd(start: string) {
  return new Date(new Date(start).getTime() + FREE_PUBLICATION_HOURS * HOUR_MS).toISOString()
}

type EntitlementLike = { plan: string; status: string; periodStart: string | null; periodEnd: string | null }

export function upgradeAvailable(entitlement: EntitlementLike | null | undefined, now = Date.now()) {
  if (!entitlement || entitlement.plan !== 'web_link' || entitlement.status !== 'active') return false
  if (!entitlement.periodStart || !entitlement.periodEnd || new Date(entitlement.periodEnd).getTime() < now) return false
  return now - new Date(entitlement.periodStart).getTime() <= UPGRADE_WINDOW_DAYS * DAY_MS
}

/** ISO 7064 MOD 11,10 check digit used by the Croatian OIB. */
export function validOib(value: string) {
  if (!/^\d{11}$/.test(value)) return false
  let a = 10
  for (let i = 0; i < 10; i += 1) {
    a = (a + Number(value[i])) % 10
    if (a === 0) a = 10
    a = (a * 2) % 11
  }
  const check = 11 - a === 10 ? 0 : 11 - a
  return check === Number(value[10])
}

/** Banking apps differ in ISO-8859-2 support; plain ASCII scans everywhere. */
export function fold(value: string) {
  return value.replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '').trim()
}

export type Hub3Input = {
  amountCents: number
  payerName: string
  payerAddress: string
  payerPostalCity: string
  reference: string
  description: string
}

/** HUB-3 (HRVHUB30) payload for the PDF417 barcode, with the field limits of the HUB standard. */
export function hub3Payload(input: Hub3Input) {
  const field = (value: string, max: number) => fold(value).slice(0, max)
  return [
    'HRVHUB30',
    'EUR',
    String(input.amountCents).padStart(15, '0'),
    field(input.payerName, 30),
    field(input.payerAddress, 27),
    field(input.payerPostalCity, 27),
    field(PAYEE.name, 25),
    field(PAYEE.street, 25),
    field(PAYEE.postalCity, 27),
    PAYEE.iban,
    PAYEE.model,
    field(input.reference, 22),
    PAYEE.purpose,
    field(input.description, 35),
  ].join('\n')
}
