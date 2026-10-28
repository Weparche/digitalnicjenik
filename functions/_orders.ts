import { normalizeEmail, validEmail } from './_auth'
import { emailConfigured, sendTransactionalEmail } from './_email'
import { escapeHtml } from './_lead'
import { readEntitlement, type D1DatabaseLike, type RuntimeEnv } from './_repository'
import { AccessDeniedError } from './_write-auth'
import type { TrialEnv } from './_trial'
import {
  PAYEE,
  formatCents,
  graceEnd,
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

const ORDER_COLUMNS = `number, reference, tenant_id, kind, installation, amount_cents, customer_type, billing_name, oib, address, postal_city, email, status, created_at, updated_at, paid_at, grace_granted_at`

function requireDb(env: RuntimeEnv): D1DatabaseLike {
  if (!env.DB) throw new AccessDeniedError(503, 'db_unavailable', 'D1 binding DB nije konfiguriran.')
  return env.DB
}

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')

export function formatZagreb(iso: string) {
  return new Intl.DateTimeFormat('hr-HR', { timeZone: 'Europe/Zagreb', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

export function parseOrderInput(input: OrderInput) {
  const kind: OrderKind | null = input.kind === 'publisher_upgrade' ? 'publisher_upgrade' : input.kind === 'web_link' ? 'web_link' : null
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
    installation: kind === 'web_link' && input.installation === true,
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
  // AUTOINCREMENT assigns the number inside SQLite, so concurrent orders can never share it.
  const inserted = await db.prepare(
    `INSERT INTO payment_orders
      (tenant_id, kind, installation, amount_cents, customer_type, billing_name, oib, address, postal_city, email, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
     RETURNING number`,
  ).bind(tenantId, fields.kind, fields.installation ? 1 : 0, amountCents, fields.customerType, fields.billingName, fields.oib, fields.address, fields.postalCity, fields.email, stamp, stamp)
    .first<{ number: number }>()
  if (!inserted) throw new Error('order_insert_failed')
  await db.prepare('UPDATE payment_orders SET reference = ? WHERE number = ?').bind(orderReference(inserted.number, stamp), inserted.number).run()
}

async function updateOrder(db: D1DatabaseLike, number: number, fields: ReturnType<typeof parseOrderInput>, amountCents: number, stamp: string) {
  await db.prepare(
    `UPDATE payment_orders SET installation = ?, amount_cents = ?, customer_type = ?, billing_name = ?, oib = ?, address = ?, postal_city = ?, email = ?, updated_at = ?
     WHERE number = ? AND status = 'pending'`,
  ).bind(fields.installation ? 1 : 0, amountCents, fields.customerType, fields.billingName, fields.oib, fields.address, fields.postalCity, fields.email, stamp, number).run()
}

/**
 * Creates or refreshes the tenant's pending order (one per kind; the reference never changes).
 * The first order of a free publication extends it once to MAX(period_end, now + 48 h).
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
  if (!order) throw new Error('order_missing')

  let activeUntil = entitlement?.periodEnd ?? null
  if (entitlement?.status === 'trial') {
    const granted = await db.prepare('SELECT 1 AS granted FROM payment_orders WHERE tenant_id = ? AND grace_granted_at IS NOT NULL LIMIT 1')
      .bind(tenant.id).first<{ granted: number }>()
    if (!granted) {
      activeUntil = graceEnd(entitlement.periodEnd, now.getTime())
      await db.batch([
        db.prepare(`UPDATE entitlements SET period_end = ?, updated_at = ? WHERE id = ? AND status = 'trial'`).bind(activeUntil, stamp, entitlement.id),
        db.prepare('UPDATE payment_orders SET grace_granted_at = ? WHERE number = ?').bind(stamp, order.number),
      ])
    }
  }
  return { order, activeUntil, created: !existing }
}

export async function sendOrderEmails(env: TrialEnv, tenant: OrderTenant, payment: PaymentView, activeUntil: string | null, origin: string, fetcher: typeof fetch = fetch) {
  if (!emailConfigured(env)) return
  const what = payment.kind === 'publisher_upgrade' ? 'Nadogradnja na Publisher' : `Web Link${payment.installation ? ' + pomoć s ugradnjom' : ''}`
  const until = activeUntil ? formatZagreb(activeUntil) : null
  const details = [
    `Primatelj: ${payment.payee.name}`,
    `IBAN: ${payment.payee.iban}`,
    `Iznos: ${payment.amountLabel}`,
    `Model i poziv na broj: ${payment.payee.model} ${payment.reference}`,
    `Opis plaćanja: ${payment.description}`,
  ]
  const customerText = [
    `${what} — ${payment.amountLabel}`,
    '',
    ...details,
    '',
    until && payment.kind === 'web_link' ? `Vaš link ${origin}/c/${tenant.slug} ostaje aktivan do ${until}. Nakon evidentirane uplate isti link ostaje aktivan godinu dana.` : 'Nakon evidentirane uplate aktiviramo nadogradnju i javimo vam e-mailom.',
    '',
    `2D barkod i podatke za uplatu uvijek imate na ${origin}/app`,
  ].join('\n')
  const customerHtml = `<html lang="hr"><body style="font-family:Arial,sans-serif;color:#0f172a"><p><strong>${escapeHtml(what)} — ${escapeHtml(payment.amountLabel)}</strong></p><p>${details.map(escapeHtml).join('<br>')}</p>${until && payment.kind === 'web_link' ? `<p>Vaš link <strong>${escapeHtml(origin)}/c/${escapeHtml(tenant.slug)}</strong> ostaje aktivan do <strong>${escapeHtml(until)}</strong>. Nakon evidentirane uplate isti link ostaje aktivan godinu dana.</p>` : ''}<p><a href="${escapeHtml(origin)}/app">Otvori 2D barkod za uplatu</a></p></body></html>`
  const opsText = [
    `Nova narudžba ${payment.reference} — ${what}`,
    '',
    `Iznos: ${payment.amountLabel}`,
    `Tenant: ${tenant.slug} (${tenant.name})`,
    `Link aktivan do: ${until ?? '—'}`,
    '',
    'Podaci za račun:',
    `${payment.customerType === 'company' ? 'Tvrtka/obrt' : 'Fizička osoba'}: ${payment.billingName}`,
    `OIB: ${payment.oib ?? '—'}`,
    `Adresa: ${payment.address}, ${payment.postalCity}`,
    `E-mail: ${payment.email}`,
    `Pomoć s ugradnjom: ${payment.installation ? 'DA' : 'ne'}`,
    '',
    `Aktivacija nakon uplate: ${origin}/admin`,
  ].join('\n')
  const sends: Promise<unknown>[] = [
    sendTransactionalEmail(env, { to: payment.email, subject: `Podaci za uplatu ${payment.reference} — NEPAR digitalni cjenik`, text: customerText, html: customerHtml }, fetcher),
  ]
  if (env.EMAIL_TO) sends.push(sendTransactionalEmail(env, { to: env.EMAIL_TO, subject: `Narudžba ${payment.reference} — ${tenant.slug} — ${payment.amountLabel}`, text: opsText, replyTo: { email: payment.email, name: payment.billingName } }, fetcher))
  await Promise.allSettled(sends)
}

export async function sendPaymentConfirmedEmail(env: TrialEnv, input: { email: string; slug: string; plan: string; periodEnd: string; origin: string }, fetcher: typeof fetch = fetch) {
  if (!emailConfigured(env)) return
  const until = formatZagreb(input.periodEnd)
  const publisher = input.plan === 'publisher_self_service'
  const subject = publisher ? 'Uplata je zaprimljena — Publisher je aktivan' : 'Uplata je zaprimljena — digitalni cjenik je aktivan'
  const body = publisher
    ? `Publisher je aktivan do ${until}. Uređivanje stavki, svakodnevni nadzor i upozorenja uključeni su u dashboardu: ${input.origin}/app`
    : `Vaš digitalni cjenik ${input.origin}/c/${input.slug} aktivan je do ${until}. Link ostaje isti.`
  await sendTransactionalEmail(env, { to: input.email, subject, text: `${subject}\n\n${body}` }, fetcher).catch(() => undefined)
}
