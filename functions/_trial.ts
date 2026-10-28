import {
  createSessionForUser,
  ensureTenantOwner,
  normalizeEmail,
  sha256Hex,
  validEmail,
  type AuthEnv,
} from './_auth'
import { emailConfigured, sendTransactionalEmail } from './_email'
import { escapeHtml, hmacIp, verifyTurnstile } from './_lead'
import { entitlementCanPublish } from './_public-access'
import { createDraft, publishDraft, readEntitlement, resolveTenant, type D1DatabaseLike, type RuntimeEnv } from './_repository'
import { slugifyBusinessName, suggestSlugAlternatives, validSlug } from './_slug'
import { implementationIntentLabel, selfServiceIntentLabel } from './_pricing'
import { AccessDeniedError } from './_write-auth'
import { sanitizeAttribution } from '../shared/acquisition'
import { recordAttribution } from './_acquisition'
import type { NormalizedPriceList, ValidationIssue } from '../src/price-engine/types'
import { mergeValidationIssues, validatePriceList } from '../src/price-engine/validate'
import { parsePublicationDetails, type PublicationDetails } from '../shared/publication-details'
import { usesProductStructure } from '../src/price-engine/profile'
import { freePublicationEnd } from '../shared/payment'

export const DRAFT_TTL_MS = 24 * 60 * 60_000
export const TRIAL_CLAIM_TTL_MS = 30 * 60_000
const HOUR_MS = 3_600_000
const TRIAL_CLAIM_LIMIT_PER_HOUR = 5

export type R2ObjectLike = { text(): Promise<string> }
export type R2BucketLike = {
  put(key: string, value: string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>
  get(key: string): Promise<R2ObjectLike | null>
  delete?(key: string): Promise<void>
}

export type TrialEnv = AuthEnv & RuntimeEnv & {
  DRAFTS?: R2BucketLike
  EMAIL_TO?: string
  TURNSTILE_SECRET_KEY?: string
}

type DraftRow = {
  id: string
  payload_location: string
  original_filename: string
  content_type: string
  created_at: string
  expires_at: string
  claimed_at: string | null
  claimed_by_tenant_id: string | null
  status: 'temporary' | 'claimed' | 'expired'
}

type ClaimRow = {
  id: string
  draft_id: string
  email: string
  business_name: string
  requested_slug: string
  token_hash: string
  expires_at: string
  verified_at: string | null
  status: 'pending' | 'provisioning' | 'completed' | 'expired'
  tenant_id: string | null
  created_at: string
}

type DraftPayload = {
  list: NormalizedPriceList
  validationIssues: ValidationIssue[]
  sourceType: string
  publicationDetails?: PublicationDetails
}

function nowIso() {
  return new Date().toISOString()
}

function windowStartIso(now = Date.now()) {
  return new Date(Math.floor(now / HOUR_MS) * HOUR_MS).toISOString()
}

function clientIp(request: Request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0'
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function requireDb(env: TrialEnv): D1DatabaseLike {
  if (!env.DB) throw new AccessDeniedError(503, 'db_unavailable', 'D1 binding DB nije konfiguriran.')
  return env.DB
}

function requireDrafts(env: TrialEnv): R2BucketLike {
  if (!env.DRAFTS) throw new AccessDeniedError(503, 'drafts_unavailable', 'R2 binding DRAFTS nije konfiguriran.')
  return env.DRAFTS
}

export function nextPeriodEnd(periodEnd: string | null | undefined, now = new Date()) {
  const base = Math.max(now.getTime(), periodEnd ? new Date(periodEnd).getTime() : 0)
  return new Date(base + 365 * 86400000).toISOString()
}

/**
 * Ops confirms a bank transfer. The tenant's pending order decides what is activated:
 * - `web_link` (or no order): one year from now after the free publication, otherwise MAX(now, period_end) + 1 year;
 * - `publisher_upgrade`: the plan becomes Publisher for the period already paid (no extension).
 * The same URL stays live throughout; the order is marked paid in the same batch.
 */
export async function renewEntitlement(env: RuntimeEnv, tenantId: string, now = new Date()) {
  if (!env.DB) throw new Error('db_unavailable')
  const row = await env.DB.prepare(
    'SELECT id, plan, status, period_start, period_end FROM entitlements WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1',
  ).bind(tenantId).first<{ id: string; plan: string; status: string; period_start: string | null; period_end: string | null }>()
  if (!row) throw new Error('entitlement_missing')
  const order = await env.DB.prepare(
    `SELECT number, reference, kind, email FROM payment_orders WHERE tenant_id = ? AND status = 'pending' ORDER BY created_at ASC LIMIT 1`,
  ).bind(tenantId).first<{ number: number; reference: string | null; kind: 'web_link' | 'publisher_upgrade'; email: string }>()
  const stamp = now.toISOString()
  const upgrade = order?.kind === 'publisher_upgrade'
  const plan = upgrade ? 'publisher_self_service' : order ? 'web_link' : row.plan
  const periodStart = upgrade ? row.period_start : stamp
  const periodEnd = upgrade && row.period_end ? row.period_end : nextPeriodEnd(row.status === 'trial' ? null : row.period_end, now)
  const statements = [
    env.DB.prepare(`UPDATE entitlements SET plan = ?, status = 'active', period_start = ?, period_end = ?, updated_at = ? WHERE id = ?`).bind(plan, periodStart, periodEnd, stamp, row.id),
    env.DB.prepare(`UPDATE upgrade_requests SET status = 'done', handled_at = ? WHERE tenant_id = ? AND status = 'open'`).bind(stamp, tenantId),
  ]
  if (order) statements.push(env.DB.prepare(`UPDATE payment_orders SET status = 'paid', paid_at = ?, updated_at = ? WHERE number = ? AND status = 'pending'`).bind(stamp, stamp, order.number))
  await env.DB.batch(statements)
  return { periodEnd, plan, order: order ?? null }
}

/** Keeps at most one open request per tenant+intent; a repeated click refreshes it instead of duplicating. */
export async function recordUpgradeRequest(
  env: RuntimeEnv,
  input: { tenantId: string; intent: 'self_service' | 'implementation' | 'consultation'; email: string; message?: string },
) {
  if (!env.DB) throw new Error('db_unavailable')
  await env.DB.prepare(
    `INSERT INTO upgrade_requests (id, tenant_id, intent, requester_email, message, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?)
     ON CONFLICT(tenant_id, intent) WHERE status = 'open'
     DO UPDATE SET requester_email = excluded.requester_email, message = excluded.message, created_at = excluded.created_at`,
  ).bind(crypto.randomUUID(), input.tenantId, input.intent, input.email, input.message?.slice(0, 2000) ?? null, nowIso()).run()
}

async function consumeTrialClaimBudget(env: TrialEnv, request: Request, email: string) {
  const db = requireDb(env)
  const secret = env.AUTH_RATE_LIMIT_SECRET || env.LEAD_RATE_LIMIT_SECRET
  if (!secret) throw new AccessDeniedError(503, 'rate_limit_misconfigured', 'Auth rate-limit secret nije konfiguriran.')
  const ipHash = await hmacIp(clientIp(request), secret)
  const emailHash = await hmacIp(email, secret)
  const windowStart = windowStartIso()
  for (const keyHash of [ipHash, emailHash]) {
    const existing = await db.prepare(
      'SELECT attempt_count FROM magic_link_rate_buckets WHERE key_hash = ? AND window_start = ?',
    ).bind(keyHash, windowStart).first<{ attempt_count: number }>()
    if ((existing?.attempt_count ?? 0) >= TRIAL_CLAIM_LIMIT_PER_HOUR) {
      throw new AccessDeniedError(429, 'rate_limited', 'Previše pokušaja. Pokušajte ponovno za sat vremena.')
    }
    await db.prepare(
      `INSERT INTO magic_link_rate_buckets (key_hash, window_start, attempt_count, updated_at)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(key_hash, window_start) DO UPDATE SET
         attempt_count = attempt_count + 1,
         updated_at = excluded.updated_at
       WHERE attempt_count < ?`,
    ).bind(keyHash, windowStart, nowIso(), TRIAL_CLAIM_LIMIT_PER_HOUR).run()
  }
}

export async function createPrivateDraft(
  env: TrialEnv,
  list: NormalizedPriceList,
  sourceFilename: string,
  sourceType: string,
  extraIssues: ValidationIssue[] = [],
  publicationDetails?: PublicationDetails,
) {
  const db = requireDb(env)
  const drafts = requireDrafts(env)
  const validation = mergeValidationIssues(validatePriceList(list), extraIssues)
  const draftId = crypto.randomUUID()
  const location = `drafts/${draftId}.json`
  const stamp = nowIso()
  const expiresAt = new Date(Date.now() + DRAFT_TTL_MS).toISOString()
  const payload: DraftPayload = {
    list,
    validationIssues: validation.issues,
    sourceType,
    ...(publicationDetails ? { publicationDetails: parsePublicationDetails(publicationDetails) } : {}),
  }
  await drafts.put(location, JSON.stringify(payload), { httpMetadata: { contentType: 'application/json' } })
  await db.prepare(
    `INSERT INTO publisher_drafts
      (id, payload_location, original_filename, content_type, created_at, expires_at, claimed_at, claimed_by_tenant_id, status)
     VALUES (?, ?, ?, 'application/json', ?, ?, NULL, NULL, 'temporary')`,
  ).bind(draftId, location, sourceFilename.slice(0, 200), stamp, expiresAt).run()
  return {
    draftId,
    expiresAt,
    validation,
    itemCount: list.items.length,
  }
}

export async function readPrivateDraft(env: TrialEnv, draftId: string) {
  const db = requireDb(env)
  const drafts = requireDrafts(env)
  const row = await db.prepare(
    `SELECT id, payload_location, original_filename, content_type, created_at, expires_at, claimed_at, claimed_by_tenant_id, status
     FROM publisher_drafts WHERE id = ?`,
  ).bind(draftId).first<DraftRow>()
  if (!row) return null
  if (row.status === 'expired' || new Date(row.expires_at).getTime() <= Date.now()) {
    if (row.status === 'temporary') {
      await db.prepare(`UPDATE publisher_drafts SET status = 'expired' WHERE id = ? AND status = 'temporary'`).bind(draftId).run()
    }
    return null
  }
  const object = await drafts.get(row.payload_location)
  if (!object) return null
  const payload = JSON.parse(await object.text()) as DraftPayload
  return { row, payload }
}

export async function checkSlugAvailability(env: TrialEnv, slugRaw: string) {
  const slug = slugRaw.trim().toLocaleLowerCase('en-US')
  if (!validSlug(slug)) return { available: false as const, slug, suggestions: suggestSlugAlternatives(slugifyBusinessName(slug), new Set()) }
  const db = requireDb(env)
  const tenant = await resolveTenant(env, slug)
  const reserved = await db.prepare(
    `SELECT slug FROM slug_reservations WHERE slug = ? AND expires_at > ?`,
  ).bind(slug, nowIso()).first<{ slug: string }>()
  if (tenant || reserved) {
    const taken = new Set<string>([slug])
    const suggestions = suggestSlugAlternatives(slug, taken)
    return { available: false as const, slug, suggestions }
  }
  return { available: true as const, slug, suggestions: [slug] }
}

export function previewSlugFromBusinessName(businessName: string) {
  return slugifyBusinessName(businessName)
}

export async function startTrialClaim(
  request: Request,
  env: TrialEnv,
  input: { draftId: string; email: string; businessName: string; slug: string; turnstileToken?: string; attribution?: unknown },
  fetcher: typeof fetch = fetch,
) {
  const db = requireDb(env)
  if (!emailConfigured(env)) {
    throw new AccessDeniedError(503, 'email_misconfigured', 'Email Sending nije konfiguriran.')
  }
  if (!env.TURNSTILE_SECRET_KEY) {
    throw new AccessDeniedError(503, 'turnstile_misconfigured', 'Turnstile nije konfiguriran.')
  }
  const email = normalizeEmail(input.email)
  if (!validEmail(email)) throw new AccessDeniedError(400, 'invalid_input', 'Unesite valjanu e-mail adresu.')
  const businessName = input.businessName.trim().slice(0, 120)
  if (businessName.length < 2) throw new AccessDeniedError(400, 'invalid_input', 'Unesite naziv poslovanja.')
  const slug = input.slug.trim().toLocaleLowerCase('en-US')
  if (!validSlug(slug)) throw new AccessDeniedError(400, 'invalid_slug', 'Slug nije valjan.')

  const turnstileOk = await verifyTurnstile(
    input.turnstileToken || '',
    clientIp(request),
    new URL(request.url),
    env.TURNSTILE_SECRET_KEY,
    fetcher,
  )
  if (!turnstileOk) throw new AccessDeniedError(403, 'turnstile_failed', 'Sigurnosna provjera nije uspjela.')

  const availability = await checkSlugAvailability(env, slug)
  if (!availability.available) throw new AccessDeniedError(409, 'slug_taken', 'Odabrani slug nije dostupan.')

  const draft = await readPrivateDraft(env, input.draftId)
  if (!draft || draft.row.status !== 'temporary') {
    throw new AccessDeniedError(400, 'draft_expired', 'Privremeni draft je istekao. Učitajte datoteku ponovno.')
  }

  if (mergeValidationIssues(validatePriceList(draft.payload.list), draft.payload.validationIssues).blockingCount) {
    throw new AccessDeniedError(422, 'draft_not_ready', 'Dopunite označene podatke prije javne objave.')
  }
  try { parsePublicationDetails(draft.payload.publicationDetails) }
  catch (error) { throw new AccessDeniedError(400, 'publication_details_required', (error as Error).message) }

  await consumeTrialClaimBudget(env, request, email)

  const claimId = crypto.randomUUID()
  const rawToken = randomToken()
  const tokenHash = await sha256Hex(rawToken)
  const stamp = nowIso()
  const expiresAt = new Date(Date.now() + TRIAL_CLAIM_TTL_MS).toISOString()

  await db.batch([
    db.prepare(
      `INSERT INTO pending_trial_claims
        (id, draft_id, email, business_name, requested_slug, token_hash, expires_at, verified_at, status, tenant_id, created_at, attribution_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'pending', NULL, ?, ?)`,
    ).bind(claimId, input.draftId, email, businessName, slug, tokenHash, expiresAt, stamp, JSON.stringify(sanitizeAttribution(input.attribution))),
    db.prepare(
      `INSERT INTO slug_reservations (slug, claim_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
    ).bind(slug, claimId, expiresAt, stamp),
  ])

  const origin = new URL(request.url).origin
  const link = `${origin}/api/trials/callback?token=${encodeURIComponent(rawToken)}`
  const text = `Potvrdite e-mail i objavite cjenik na ${origin}/c/${slug}. Objava je besplatna 24 sata:\n\n${link}\n\nLink vrijedi 30 minuta i može se iskoristiti jednom.`
  const html = `<html lang="hr"><body style="font-family:Arial,sans-serif;color:#0f172a"><p>Potvrdite e-mail i objavite svoj digitalni cjenik. Objava je besplatna 24 sata.</p><p>Vaš cjenik bit će na <strong>${escapeHtml(origin)}/c/${escapeHtml(slug)}</strong>.</p><p><a href="${escapeHtml(link)}">Potvrdi i objavi</a></p><p style="color:#64748b;font-size:13px">Link vrijedi 30 minuta.</p></body></html>`

  try {
    await sendTransactionalEmail(env, {
      to: email,
      subject: 'Potvrdite e-mail — besplatna objava cjenika 24 sata',
      text,
      html,
    }, fetcher)
  } catch {
    throw new AccessDeniedError(502, 'send_failed', 'Potvrdni link trenutačno nije moguće poslati.')
  }

  return { claimId, slug, email, expiresAt }
}

async function recordTrialAttribution(env: TrialEnv, claimId: string, tenantId: string, userId: string) {
  if (!env.DB) return
  const row = await env.DB.prepare('SELECT attribution_json FROM pending_trial_claims WHERE id = ?').bind(claimId).first<{ attribution_json: string | null }>()
  let parsed: unknown = null
  if (row?.attribution_json) {
    try { parsed = JSON.parse(row.attribution_json) } catch { parsed = null }
  }
  await recordAttribution(env.DB, 'trial', tenantId, parsed)
  await recordAttribution(env.DB, 'signup', userId, parsed)
}

async function waitForCompletedClaim(db: D1DatabaseLike, claimId: string, attempts = 8) {
  for (let i = 0; i < attempts; i += 1) {
    const row = await db.prepare(
      `SELECT id, draft_id, email, business_name, requested_slug, token_hash, expires_at, verified_at, status, tenant_id, created_at
       FROM pending_trial_claims WHERE id = ?`,
    ).bind(claimId).first<ClaimRow>()
    if (!row) return null
    if (row.status === 'completed') return row
    if (row.status === 'expired') return row
    await new Promise((resolve) => setTimeout(resolve, 50 * (i + 1)))
  }
  return db.prepare(
    `SELECT id, draft_id, email, business_name, requested_slug, token_hash, expires_at, verified_at, status, tenant_id, created_at
     FROM pending_trial_claims WHERE id = ?`,
  ).bind(claimId).first<ClaimRow>()
}

async function insertTenantWithSlug(env: TrialEnv, preferredSlug: string, businessName: string, details: PublicationDetails, products: boolean) {
  const db = requireDb(env)
  const stamp = nowIso()
  let slug = preferredSlug
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const tenantId = crypto.randomUUID()
    const hostname = `${slug}.digitalnicjenik.nepar.hr`
    try {
      await db.batch([
        db.prepare(
          `INSERT INTO tenants (id, slug, name, currency, created_at, updated_at, slug_locked_at)
           VALUES (?, ?, ?, 'EUR', ?, ?, NULL)`,
        ).bind(tenantId, slug, businessName, stamp, stamp),
        db.prepare(
          `INSERT INTO publication_metadata
            (tenant_id, object_type, object_address, object_code, next_publication_sequence, timezone, created_at, updated_at, compliance_profile, working_days_json, closed_dates_json)
           VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`,
        ).bind(tenantId, details.objectType, details.objectAddress, details.objectCode, env.DEFAULT_PUBLICATION_TIMEZONE || 'Europe/Zagreb', stamp, stamp, products ? 'products' : 'services', JSON.stringify(details.workingDays ?? [1,2,3,4,5]), JSON.stringify(details.closedDates ?? [])),
        db.prepare(
          `INSERT INTO publication_targets (id, tenant_id, hostname, status, created_at, updated_at)
           VALUES (?, ?, ?, 'active', ?, ?)`,
        ).bind(`target-${tenantId}`, tenantId, hostname, stamp, stamp),
      ])
      return { tenantId, slug }
    } catch {
      const next = suggestSlugAlternatives(preferredSlug, new Set([slug]))[0]
      if (!next || next === slug) throw new AccessDeniedError(409, 'slug_taken', 'Slug više nije dostupan. Zatražite novi link.')
      slug = next
    }
  }
  throw new AccessDeniedError(409, 'slug_taken', 'Slug više nije dostupan. Zatražite novi link.')
}

export async function provisionTrialFromToken(env: TrialEnv, rawToken: string) {
  const db = requireDb(env)
  if (!rawToken || rawToken.length > 128) throw new AccessDeniedError(400, 'invalid_token', 'Link nije valjan.')
  const tokenHash = await sha256Hex(rawToken)
  const claim = await db.prepare(
    `SELECT id, draft_id, email, business_name, requested_slug, token_hash, expires_at, verified_at, status, tenant_id, created_at
     FROM pending_trial_claims WHERE token_hash = ?`,
  ).bind(tokenHash).first<ClaimRow>()
  if (!claim) throw new AccessDeniedError(400, 'invalid_token', 'Link nije valjan.')

  if (claim.status === 'completed' && claim.tenant_id) {
    const owner = await ensureTenantOwner(env, claim.tenant_id, claim.email)
    await recordTrialAttribution(env, claim.id, claim.tenant_id, owner.userId)
    const session = await createSessionForUser(env, owner.userId)
    const tenant = await resolveTenant(env, claim.requested_slug)
    return {
      alreadyCompleted: true as const,
      session,
      slug: tenant?.slug || claim.requested_slug,
      businessName: claim.business_name,
      trialEndsAt: (await readEntitlement(env, tenant?.slug || claim.requested_slug))?.periodEnd || null,
    }
  }

  if (claim.status === 'expired' || new Date(claim.expires_at).getTime() <= Date.now()) {
    await db.prepare(`UPDATE pending_trial_claims SET status = 'expired' WHERE id = ? AND status IN ('pending', 'provisioning')`).bind(claim.id).run()
    throw new AccessDeniedError(400, 'expired_token', 'Link je istekao. Zatražite novi.')
  }

  if (claim.status === 'provisioning') {
    const finished = await waitForCompletedClaim(db, claim.id)
    if (finished?.status === 'completed' && finished.tenant_id) {
      const owner = await ensureTenantOwner(env, finished.tenant_id, finished.email)
      await recordTrialAttribution(env, finished.id, finished.tenant_id, owner.userId)
      const session = await createSessionForUser(env, owner.userId)
      return {
        alreadyCompleted: true as const,
        session,
        slug: finished.requested_slug,
        businessName: finished.business_name,
        trialEndsAt: (await readEntitlement(env, finished.requested_slug))?.periodEnd || null,
      }
    }
    throw new AccessDeniedError(409, 'provisioning', 'Objava je u tijeku. Osvježite za trenutak.')
  }

  const claimed = await db.prepare(
    `UPDATE pending_trial_claims SET status = 'provisioning', verified_at = ?
     WHERE id = ? AND status = 'pending'`,
  ).bind(nowIso(), claim.id).run()
  if (!(claimed.meta?.changes ?? 0)) {
    const finished = await waitForCompletedClaim(db, claim.id)
    if (finished?.status === 'completed' && finished.tenant_id) {
      const owner = await ensureTenantOwner(env, finished.tenant_id, finished.email)
      await recordTrialAttribution(env, finished.id, finished.tenant_id, owner.userId)
      const session = await createSessionForUser(env, owner.userId)
      return {
        alreadyCompleted: true as const,
        session,
        slug: finished.requested_slug,
        businessName: finished.business_name,
        trialEndsAt: (await readEntitlement(env, finished.requested_slug))?.periodEnd || null,
      }
    }
    throw new AccessDeniedError(409, 'provisioning', 'Objava je u tijeku. Osvježite za trenutak.')
  }

  try {
    const draft = await readPrivateDraft(env, claim.draft_id)
    if (!draft || draft.row.status !== 'temporary') {
      throw new AccessDeniedError(400, 'draft_expired', 'Privremeni draft je istekao.')
    }

    const details = parsePublicationDetails(draft.payload.publicationDetails)
    const validation = mergeValidationIssues(validatePriceList(draft.payload.list), draft.payload.validationIssues)
    if (validation.blockingCount) throw new AccessDeniedError(422, 'draft_not_ready', 'Cjenik nije spreman za javnu objavu.')
    const { tenantId, slug } = await insertTenantWithSlug(env, claim.requested_slug, claim.business_name, details, usesProductStructure(draft.payload.list))
    const stamp = nowIso()
    const periodEnd = freePublicationEnd(stamp)

    // The free 24 h publication is a Web Link: link, CSV/XML and archive, without monitoring.
    await db.prepare(
      `INSERT INTO entitlements (id, tenant_id, plan, status, period_start, period_end, created_at, updated_at)
       VALUES (?, ?, 'web_link', 'trial', ?, ?, ?, ?)`,
    ).bind(`entitlement-${tenantId}`, tenantId, stamp, periodEnd, stamp, stamp).run()

    await ensureTenantOwner(env, tenantId, claim.email)

    const list: NormalizedPriceList = {
      ...draft.payload.list,
      tenant: { id: tenantId, slug, name: claim.business_name },
      updatedAt: stamp,
    }
    const created = await createDraft(
      env,
      slug,
      list,
      draft.row.original_filename,
      draft.payload.sourceType,
      null,
      draft.payload.validationIssues,
    )
    if (!created.draft) throw new Error('Draft nije spremljen.')

    const published = await publishDraft(env, slug, created.draft.id, false)
    const publicationId = published.publication?.id ?? null

    await db.batch([
      db.prepare(
        `UPDATE publisher_drafts SET status = 'claimed', claimed_at = ?, claimed_by_tenant_id = ? WHERE id = ? AND status = 'temporary'`,
      ).bind(stamp, tenantId, claim.draft_id),
      db.prepare(
        `UPDATE tenants SET slug_locked_at = ? WHERE id = ? AND slug_locked_at IS NULL`,
      ).bind(stamp, tenantId),
      db.prepare(
        `UPDATE pending_trial_claims SET status = 'completed', tenant_id = ?, requested_slug = ? WHERE id = ?`,
      ).bind(tenantId, slug, claim.id),
      db.prepare(`DELETE FROM slug_reservations WHERE claim_id = ?`).bind(claim.id),
    ])

    const owner = await ensureTenantOwner(env, tenantId, claim.email)
    await recordTrialAttribution(env, claim.id, tenantId, owner.userId)
    const session = await createSessionForUser(env, owner.userId)
    return {
      alreadyCompleted: false as const,
      session,
      slug,
      businessName: claim.business_name,
      trialEndsAt: periodEnd,
      publicationId,
      draftId: created.draft.id,
    }
  } catch (error) {
    await db.prepare(
      `UPDATE pending_trial_claims SET status = 'pending' WHERE id = ? AND status = 'provisioning'`,
    ).bind(claim.id).run()
    throw error
  }
}

export async function sendPublisherUpgradeRequest(
  env: TrialEnv,
  input: {
    intent: 'self_service' | 'implementation' | 'consultation'
    email: string
    businessName: string
    tenantSlug: string
    publicUrl: string
    csvUrl: string
    xmlUrl: string
    trialEndsAt: string | null
    lastPublicationId: string | null
    message?: string
  },
  fetcher: typeof fetch = fetch,
) {
  if (!emailConfigured(env) || !env.EMAIL_TO) {
    throw new AccessDeniedError(503, 'email_misconfigured', 'Email Sending nije konfiguriran.')
  }
  const intentLabel =
    input.intent === 'self_service'
      ? selfServiceIntentLabel()
      : input.intent === 'implementation'
        ? implementationIntentLabel()
        : 'Konzultacija / pomoć'
  const text = [
    'Novi Publisher upit',
    '',
    `Tvrtka: ${input.businessName}`,
    `E-mail: ${input.email}`,
    `Tenant: ${input.tenantSlug}`,
    `Trial ističe: ${input.trialEndsAt || '—'}`,
    '',
    `Cjenik: ${input.publicUrl}`,
    `CSV: ${input.csvUrl}`,
    `XML: ${input.xmlUrl}`,
    `Publikacija: ${input.lastPublicationId || '—'}`,
    '',
    `Odabrano: ${intentLabel}`,
    input.message ? `\nPoruka:\n${input.message}` : '',
  ].join('\n')

  try {
    await sendTransactionalEmail(env, {
      to: env.EMAIL_TO,
      subject: `Publisher upit — ${input.tenantSlug} — ${intentLabel}`,
      text,
      replyTo: { email: input.email, name: input.businessName },
    }, fetcher)
  } catch {
    throw new AccessDeniedError(502, 'send_failed', 'Upit trenutačno nije moguće poslati.')
  }
  return { ok: true as const }
}

export { entitlementCanPublish }
