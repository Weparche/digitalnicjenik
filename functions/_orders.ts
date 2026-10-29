import { lifecycleStatement } from '../shared/lifecycle'
import { normalizeEmail, validEmail } from './_auth'
import { readEntitlement, type D1DatabaseLike, type RuntimeEnv } from './_repository'
import { AccessDeniedError } from './_write-auth'
import type { TrialEnv } from './_trial'
import {
  PAYEE,
  formatCents,
  hub3Payload,
  orderAmountCents,
  orderDescription,
  orderReference,
  upgradeAvailable,
  validOib,
  type CustomerType,
  type OrderKind,
} from '../shared/payment'

export type OrderRow = {
  number: number
  reference: string | null
  tenant_id: string
  kind: OrderKind
  payment_reported_at: string | null
  confirmed_period_end: string | null
  confirmed_plan: string | null
  installation: number
  amount_cents: number
  customer_type: CustomerType
  billing_name: string
  oib: string | null
  address: string
  postal_city: string
  email: string
  status: 'pending' | 'paid' | 'cancelled'
  created_at: string
  updated_at: string
  paid_at: string | null
  grace_granted_at: string | null
}

export type OrderInput = {
  kind?: unknown
  installation?: unknown
  customerType?: unknown
  billingName?: unknown
  oib?: unknown
  address?: unknown
  postalCity?: unknown
  email?: unknown
}

type OrderTenant = { id: string; slug: string; name: string }

const ORDER_COLUMNS = `number, reference, tenant_id, kind, installation, amount_cents, customer_type, billing_name, oib, address, postal_city, email, status, created_at, updated_at, paid_at, grace_granted_at, payment_reported_at, confirmed_period_end, confirmed_plan`

function requireDb(env: RuntimeEnv): D1DatabaseLike {
  if (!env.DB) throw new AccessDeniedError(503, 'db_unavailable', 'D1 binding DB nije konfiguriran.')
  return env.DB
}

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')

export function formatZagreb(iso: string) {
  return new Intl.DateTimeFormat('hr-HR', { timeZone: 'Europe/Zagreb', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

export function parseOrderInput(input: OrderInput) {
  const kind: OrderKind | null = input.kind === 'publisher_upgrade' ? 'publisher_upgrade' : input.kind === 'web_link' ? 'web_link' : input.kind === 'publisher' ? 'publisher' : null
  if (!kind) throw new AccessDeniedError(400, 'invalid_input', 'Odaberite paket.')
  const customerType: CustomerType = input.customerType === 'person' ? 'person' : 'company'
  const billingName = text(input.billingName, 120)
  if (billingName.length < 2) throw new AccessDeniedError(400, 'invalid_input', customerType === 'company' ? 'Unesite naziv tvrtke ili obrta.' : 'Unesite ime i prezime.')
  const oib = text(input.oib, 20).replace(/\s+/g, '')
  if (customerType === 'company' && !validOib(oib)) throw new AccessDeniedError(400, 'invalid_oib', 'OIB nije ispravan.')
  if (customerType === 'person' && oib && !validOib(oib)) throw new AccessDeniedError(400, 'invalid_oib', 'OIB nije ispravan.')
  const address = text(input.address, 120)
  if (address.length < 3) throw new AccessDeniedError(400, 'invalid_input', 'Unesite adresu.')
  const postalCity = text(input.postalCity, 80)
  if (postalCity.length < 3) throw new AccessDeniedError(400, 'invalid_input', 'Unesite poštanski broj i grad.')
  const email = normalizeEmail(text(input.email, 254))
  if (!validEmail(email)) throw new AccessDeniedError(400, 'invalid_input', 'Unesite valjanu e-mail adresu.')
  return {
    kind,
    installation: (kind === 'web_link' || kind === 'publisher') && input.installation === true,
    customerType,
    billingName,
    oib: oib || null,
    address,
    postalCity,
    email,
  }
}

export async function readPendingOrder(env: RuntimeEnv, tenantId: string, kind?: OrderKind) {
  const db = requireDb(env)
  const filter = kind ? ' AND kind = ?' : ''
  const bindings = kind ? [tenantId, kind] : [tenantId]
  return db.prepare(`SELECT ${ORDER_COLUMNS} FROM payment_orders WHERE tenant_id = ? AND status = 'pending'${filter} ORDER BY created_at ASC LIMIT 1`)
    .bind(...bindings).first<OrderRow>()
}

/** What the customer needs to pay: plain details plus the HUB-3 payload for the 2D barcode. */
export function paymentView(order: OrderRow, slug: string) {
  const description = orderDescription(order.kind, slug)
  const reference = order.reference ?? orderReference(order.number, order.created_at)
  return {
    reference,
    kind: order.kind,
    paymentReportedAt: order.payment_reported_at,
    status: order.status,
    installation: order.installation === 1,
    amountCents: order.amount_cents,
    amountLabel: formatCents(order.amount_cents),
    customerType: order.customer_type,
    billingName: order.billing_name,
    oib: order.oib,
    address: order.address,
    postalCity: order.postal_city,
    email: order.email,
    createdAt: order.created_at,
    description,
    payee: { name: PAYEE.name, street: PAYEE.street, postalCity: PAYEE.postalCity, iban: PAYEE.iban, model: PAYEE.model },
    hub3: hub3Payload({
      amountCents: order.amount_cents,
      payerName: order.billing_name,
      payerAddress: order.address,
      payerPostalCity: order.postal_city,
      reference,
      description,
    }),
  }
}

export type PaymentView = ReturnType<typeof paymentView>

async function insertOrder(db: D1DatabaseLike, tenantId: string, fields: ReturnType<typeof parseOrderInput>, amountCents: number, stamp: string) {
  await db.batch([
    db.prepare(`INSERT INTO payment_orders (tenant_id,kind,installation,amount_cents,customer_type,billing_name,oib,address,postal_city,email,status,created_at,updated_at)
      SELECT ?,?,?,?,?,?,?,?,?,?,'pending',?,? WHERE NOT EXISTS (SELECT 1 FROM payment_orders WHERE tenant_id=? AND status='pending' AND kind!='installation')`).bind(tenantId,fields.kind,fields.installation?1:0,amountCents,fields.customerType,fields.billingName,fields.oib,fields.address,fields.postalCity,fields.email,stamp,stamp,tenantId),
    db.prepare("UPDATE payment_orders SET reference=strftime('%Y',created_at)||'-'||number WHERE tenant_id=? AND kind=? AND reference IS NULL").bind(tenantId,fields.kind),
    db.prepare("INSERT OR IGNORE INTO lifecycle_events(id,tenant_id,event_type,entity_id,audience,payload_json,scheduled_at,created_at,updated_at) SELECT 'order:'||reference||':received',tenant_id,'order_received',reference,'owner','{}',?,?,? FROM payment_orders WHERE tenant_id=? AND kind=? AND status='pending'").bind(stamp,stamp,stamp,tenantId,fields.kind),
  ])
}

async function updateOrder(db: D1DatabaseLike, number: number, fields: ReturnType<typeof parseOrderInput>, amountCents: number, stamp: string) {
  await db.prepare(
    `UPDATE payment_orders SET installation = ?, amount_cents = ?, customer_type = ?, billing_name = ?, oib = ?, address = ?, postal_city = ?, email = ?, updated_at = ?
     WHERE number = ? AND status = 'pending'`,
  ).bind(fields.installation ? 1 : 0, amountCents, fields.customerType, fields.billingName, fields.oib, fields.address, fields.postalCity, fields.email, stamp, number).run()
}

/**
 * Creates or refreshes the tenant's pending order (one per kind; the reference never changes).
 * Ordering and reporting a payment never extend access.
 */
export async function placeOrder(env: RuntimeEnv, tenant: OrderTenant, input: OrderInput, now = new Date()) {
  const db = requireDb(env)
  const fields = parseOrderInput(input)
  const entitlement = await readEntitlement(env, tenant.slug)
  if (fields.kind === 'publisher_upgrade' && !upgradeAvailable(entitlement, now.getTime())) {
    throw new AccessDeniedError(409, 'upgrade_window_closed', 'Publisher možete odabrati kod obnove.')
  }
  const amountCents = orderAmountCents(fields.kind, fields.installation)
  const stamp = now.toISOString()
  const existing = await readPendingOrder(env, tenant.id, fields.kind)
  if (existing?.payment_reported_at) return {order:existing,activeUntil:entitlement?.periodEnd??null,created:false}
  if (existing) await updateOrder(db, existing.number, fields, amountCents, stamp)
  else {
    try {
      await insertOrder(db, tenant.id, fields, amountCents, stamp)
    } catch (error) {
      // A parallel submit won the one-pending-order index: update that order instead.
      const raced = await readPendingOrder(env, tenant.id, fields.kind)
      if (!raced) throw error
      await updateOrder(db, raced.number, fields, amountCents, stamp)
    }
  }
  const order = await readPendingOrder(env, tenant.id, fields.kind)
  if (!order) throw new AccessDeniedError(409,'pending_order_conflict','Već imate otvorenu narudžbu za drugi paket. Najprije je razriješite s NEPAR-om.')

  const activeUntil = entitlement?.periodEnd ?? null
  await lifecycleStatement(db, { id: `order:${order.reference}:received`, tenantId: tenant.id, type: 'order_received', entityId: order.reference }).run()

  return { order, activeUntil, created: !existing }
}

export async function sendOrderEmails(_env: TrialEnv, _tenant: OrderTenant, _payment: PaymentView, _activeUntil: string | null, _origin: string, _fetcher: typeof fetch = fetch) {
  // Kept for legacy callers. placeOrder records the durable event; no direct send.
}

export async function sendPaymentConfirmedEmail(_env: TrialEnv, _input: { email: string; slug: string; plan: string; periodEnd: string; origin: string }, _fetcher: typeof fetch = fetch) {
  // Confirmation is enqueued atomically with its concrete order in _operations.ts.
}
