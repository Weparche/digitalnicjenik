import {
  createSessionForUser,
  ensureTenantOwner,
  normalizeEmail,
  sha256Hex,
  validEmail,
  type AuthEnv,
} from './_auth'
import { escapeHtml, hmacIp } from './_lead'
import { entitlementCanPublish } from './_public-access'
import { createDraft, publishDraft, readEntitlement, resolveTenant, type D1DatabaseLike, type RuntimeEnv } from './_repository'
import { slugifyBusinessName, suggestSlugAlternatives, validSlug } from './_slug'
import { AccessDeniedError } from './_write-auth'
import type { NormalizedPriceList, ValidationIssue } from '../src/price-engine/types'
import { mergeValidationIssues, validatePriceList } from '../src/price-engine/validate'

export const DRAFT_TTL_MS = 24 * 60 * 60_000
export const TRIAL_CLAIM_TTL_MS = 30 * 60_000
export const TRIAL_DAYS = 7
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
}

function nowIso() {
  return new Date().toISOString()
}

function addDays(iso: string, days: number) {
  return new Date(new Date(iso).getTime() + days * 86400000).toISOString()
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

export async function renewEntitlement(env: RuntimeEnv, tenantId: string) {
  if (!env.DB) throw new Error('db_unavailable')
  const row = await env.DB.prepare(
    'SELECT id, period_end FROM entitlements WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1',
  ).bind(tenantId).first<{ id: string; period_end: string | null }>()
  if (!row) throw new Error('entitlement_missing')
  const stamp = nowIso()
  const periodEnd = nextPeriodEnd(row.period_end, new Date(stamp))
  await env.DB.prepare(
    `UPDATE entitlements SET status = 'active', period_end = ?, updated_at = ? WHERE id = ?`,
  ).bind(periodEnd, stamp, row.id).run()
  return { periodEnd }
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
  input: { draftId: string; email: string; businessName: string; slug: string },
  fetcher: typeof fetch = fetch,
) {
  const db = requireDb(env)
  if (!env.CF_ACCOUNT_ID || !env.CF_EMAIL_API_TOKEN || !env.EMAIL_FROM) {
    throw new AccessDeniedError(503, 'email_misconfigured', 'Email Sending nije konfiguriran.')
  }
  const email = normalizeEmail(input.email)
  if (!validEmail(email)) throw new AccessDeniedError(400, 'invalid_input', 'Unesite valjanu e-mail adresu.')
  const businessName = input.businessName.trim().slice(0, 120)
  if (businessName.length < 2) throw new AccessDeniedError(400, 'invalid_input', 'Unesite naziv poslovanja.')
  const slug = input.slug.trim().toLocaleLowerCase('en-US')
  if (!validSlug(slug)) throw new AccessDeniedError(400, 'invalid_slug', 'Slug nije valjan.')

  const availability = await checkSlugAvailability(env, slug)
  if (!availability.available) throw new AccessDeniedError(409, 'slug_taken', 'Odabrani slug nije dostupan.')

  const draft = await readPrivateDraft(env, input.draftId)
  if (!draft || draft.row.status !== 'temporary') {
    throw new AccessDeniedError(400, 'draft_expired', 'Privremeni draft je istekao. Učitajte datoteku ponovno.')
  }

  await consumeTrialClaimBudget(env, request, email)

  const claimId = crypto.randomUUID()
  const rawToken = randomToken()
  const tokenHash = await sha256Hex(rawToken)
  const stamp = nowIso()
  const expiresAt = new Date(Date.now() + TRIAL_CLAIM_TTL_MS).toISOString()

  await db.batch([
    db.prepare(
      `INSERT INTO pending_trial_claims
        (id, draft_id, email, business_name, requested_slug, token_hash, expires_at, verified_at, status, tenant_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'pending', NULL, ?)`,
    ).bind(claimId, input.draftId, email, businessName, slug, tokenHash, expiresAt, stamp),
    db.prepare(
      `INSERT INTO slug_reservations (slug, claim_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
    ).bind(slug, claimId, expiresAt, stamp),
  ])

  const origin = new URL(request.url).origin
  const link = `${origin}/api/trials/callback?token=${encodeURIComponent(rawToken)}`
  const text = `Potvrdite e-mail i objavite probni cjenik na ${origin}/c/${slug}:\n\n${link}\n\nLink vrijedi 30 minuta i može se iskoristiti jednom.`
  const html = `<html lang="hr"><body style="font-family:Arial,sans-serif;color:#0f172a"><p>Potvrdite e-mail za probni NEPAR Publisher.</p><p>Vaš cjenik bit će na <strong>${escapeHtml(origin)}/c/${escapeHtml(slug)}</strong>.</p><p><a href="${escapeHtml(link)}">Potvrdi i objavi probno</a></p><p style="color:#64748b;font-size:13px">Link vrijedi 30 minuta.</p></body></html>`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetcher(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CF_ACCOUNT_ID)}/email/sending/send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.CF_EMAIL_API_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        to: email,
        from: { address: env.EMAIL_FROM, name: 'NEPAR Publisher' },
        subject: 'Potvrda probnog cjenika — NEPAR Publisher',
        text,
        html,
      }),
      signal: controller.signal,
    })
    if (!response.ok) throw new AccessDeniedError(502, 'send_failed', 'Potvrdni link trenutačno nije moguće poslati.')
  } finally {
    clearTimeout(timeout)
  }

  return { claimId, slug, email, expiresAt }
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

async function insertTenantWithSlug(env: TrialEnv, preferredSlug: string, businessName: string) {
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
            (tenant_id, object_type, object_address, object_code, next_publication_sequence, timezone, created_at, updated_at)
           VALUES (?, 'usluzni-objekt', ?, ?, 1, ?, ?, ?)`,
        ).bind(tenantId, businessName.slice(0, 80), slug, env.DEFAULT_PUBLICATION_TIMEZONE || 'Europe/Zagreb', stamp, stamp),
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

    const { tenantId, slug } = await insertTenantWithSlug(env, claim.requested_slug, claim.business_name)
    const stamp = nowIso()
    const periodEnd = addDays(stamp, TRIAL_DAYS)

    await db.prepare(
      `INSERT INTO entitlements (id, tenant_id, plan, status, period_start, period_end, created_at, updated_at)
       VALUES (?, ?, 'publisher_self_service', 'trial', ?, ?, ?, ?)`,
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

    // First trial publish may still be manual_review — allow internal path only when ready.
    let publicationId: string | null = null
    if (created.draft.status === 'ready_to_publish' || created.validation.status === 'ready_to_publish') {
      const published = await publishDraft(env, slug, created.draft.id, false)
      publicationId = published.publication?.id ?? null
    } else {
      // Force publish for trial so public URL exists; regulatory gaps stay visible in dashboard.
      const published = await publishDraft(env, slug, created.draft.id, true)
      publicationId = published.publication?.id ?? null
    }

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
  if (!env.CF_ACCOUNT_ID || !env.CF_EMAIL_API_TOKEN || !env.EMAIL_FROM || !env.EMAIL_TO) {
    throw new AccessDeniedError(503, 'email_misconfigured', 'Email Sending nije konfiguriran.')
  }
  const intentLabel =
    input.intent === 'self_service'
      ? 'Self-service — 49,90 €/god'
      : input.intent === 'implementation'
        ? 'Implementacija — 89,90 € prva godina'
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

  const response = await fetcher(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CF_ACCOUNT_ID)}/email/sending/send`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.CF_EMAIL_API_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      to: env.EMAIL_TO,
      from: { address: env.EMAIL_FROM, name: 'NEPAR Publisher' },
      subject: `Publisher upit — ${input.tenantSlug} — ${intentLabel}`,
      text,
    }),
  })
  if (!response.ok) throw new AccessDeniedError(502, 'send_failed', 'Upit trenutačno nije moguće poslati.')
  return { ok: true as const }
}

export { entitlementCanPublish }
