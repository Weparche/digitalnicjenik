import { escapeHtml, hmacIp } from './_lead'
import type { D1DatabaseLike, RuntimeEnv } from './_repository'
import { AccessDeniedError } from './_write-auth'

export const SESSION_COOKIE = 'nepar_session'
export const MAGIC_LINK_TTL_MS = 15 * 60_000
export const SESSION_TTL_MS = 30 * 24 * 60 * 60_000
const MAGIC_LINK_LIMIT_PER_HOUR = 5
const HOUR_MS = 3_600_000

export type AuthEnv = RuntimeEnv & {
  CF_ACCOUNT_ID?: string
  CF_EMAIL_API_TOKEN?: string
  EMAIL_FROM?: string
  LEAD_RATE_LIMIT_SECRET?: string
  AUTH_RATE_LIMIT_SECRET?: string
}

export type AuthUser = { id: string; email: string }
export type AuthTenant = { id: string; slug: string; name: string; role: 'owner' }
export type AuthSession = { id: string; user: AuthUser; tenants: AuthTenant[] }

function nowIso() {
  return new Date().toISOString()
}

function windowStartIso(now = Date.now()) {
  return new Date(Math.floor(now / HOUR_MS) * HOUR_MS).toISOString()
}

export function normalizeEmail(value: string) {
  return value.trim().toLocaleLowerCase('en-US').slice(0, 254)
}

export function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function clientIp(request: Request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0'
}

export function readSessionToken(request: Request) {
  const cookie = request.headers.get('cookie') || ''
  const match = /(?:^|;\s*)nepar_session=([^;]+)/i.exec(cookie)
  if (!match) return ''
  try {
    return decodeURIComponent(match[1].trim())
  } catch {
    return match[1].trim()
  }
}

export function sessionCookieHeader(token: string, maxAgeSeconds: number, secure = true) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure ? '; Secure' : ''}`
}

export function clearSessionCookieHeader(secure = true) {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`
}

async function consumeMagicLinkBudget(env: AuthEnv, request: Request, email: string) {
  if (!env.DB) throw new AccessDeniedError(503, 'db_unavailable', 'D1 binding DB nije konfiguriran.')
  const secret = env.AUTH_RATE_LIMIT_SECRET || env.LEAD_RATE_LIMIT_SECRET
  if (!secret) throw new AccessDeniedError(503, 'rate_limit_misconfigured', 'Auth rate-limit secret nije konfiguriran.')
  const ipHash = await hmacIp(clientIp(request), secret)
  const emailHash = await hmacIp(email, secret)
  const windowStart = windowStartIso()
  for (const keyHash of [ipHash, emailHash]) {
    const existing = await env.DB.prepare(
      'SELECT attempt_count FROM magic_link_rate_buckets WHERE key_hash = ? AND window_start = ?',
    ).bind(keyHash, windowStart).first<{ attempt_count: number }>()
    if ((existing?.attempt_count ?? 0) >= MAGIC_LINK_LIMIT_PER_HOUR) {
      throw new AccessDeniedError(429, 'rate_limited', 'Previše pokušaja prijave. Pokušajte ponovno za sat vremena.')
    }
    await env.DB.prepare(
      `INSERT INTO magic_link_rate_buckets (key_hash, window_start, attempt_count, updated_at)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(key_hash, window_start) DO UPDATE SET
         attempt_count = attempt_count + 1,
         updated_at = excluded.updated_at
       WHERE attempt_count < ?`,
    ).bind(keyHash, windowStart, nowIso(), MAGIC_LINK_LIMIT_PER_HOUR).run()
  }
}

async function loadMemberships(db: D1DatabaseLike, userId: string): Promise<AuthTenant[]> {
  const rows = await db.prepare(
    `SELECT t.id, t.slug, t.name, m.role
     FROM tenant_members m
     JOIN tenants t ON t.id = m.tenant_id
     WHERE m.user_id = ?
     ORDER BY t.name COLLATE NOCASE`,
  ).bind(userId).all<{ id: string; slug: string; name: string; role: 'owner' }>()
  return rows.results
}

export async function resolveSession(env: AuthEnv, request: Request): Promise<AuthSession | null> {
  if (!env.DB) return null
  const token = readSessionToken(request)
  if (!token) return null
  const tokenHash = await sha256Hex(token)
  const row = await env.DB.prepare(
    `SELECT s.id AS session_id, s.expires_at, u.id AS user_id, u.email
     FROM auth_sessions s
     JOIN auth_users u ON u.id = s.user_id
     WHERE s.token_hash = ?`,
  ).bind(tokenHash).first<{ session_id: string; expires_at: string; user_id: string; email: string }>()
  if (!row) return null
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await env.DB.prepare('DELETE FROM auth_sessions WHERE id = ?').bind(row.session_id).run()
    return null
  }
  await env.DB.prepare('UPDATE auth_sessions SET last_seen_at = ? WHERE id = ?').bind(nowIso(), row.session_id).run()
  const tenants = await loadMemberships(env.DB, row.user_id)
  return { id: row.session_id, user: { id: row.user_id, email: row.email }, tenants }
}

export async function userHasTenantMembership(env: AuthEnv, userId: string, tenantId: string) {
  if (!env.DB) return false
  const row = await env.DB.prepare(
    'SELECT id FROM tenant_members WHERE user_id = ? AND tenant_id = ? LIMIT 1',
  ).bind(userId, tenantId).first<{ id: string }>()
  return Boolean(row)
}

export async function requestMagicLink(
  request: Request,
  env: AuthEnv,
  emailRaw: string,
  fetcher: typeof fetch = fetch,
) {
  if (!env.DB) throw new AccessDeniedError(503, 'db_unavailable', 'D1 binding DB nije konfiguriran.')
  if (!env.CF_ACCOUNT_ID || !env.CF_EMAIL_API_TOKEN || !env.EMAIL_FROM) {
    throw new AccessDeniedError(503, 'email_misconfigured', 'Email Sending nije konfiguriran.')
  }
  const email = normalizeEmail(emailRaw)
  if (!validEmail(email)) throw new AccessDeniedError(400, 'invalid_input', 'Unesite valjanu e-mail adresu.')

  await consumeMagicLinkBudget(env, request, email)

  const user = await env.DB.prepare('SELECT id, email FROM auth_users WHERE email = ?').bind(email).first<AuthUser>()
  const memberships = user ? await loadMemberships(env.DB, user.id) : []
  // Always return success to the client; only send mail when a membership exists.
  if (!user || memberships.length === 0) {
    return { sent: false as const }
  }

  const rawToken = randomToken()
  const tokenHash = await sha256Hex(rawToken)
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS).toISOString()
  const secret = env.AUTH_RATE_LIMIT_SECRET || env.LEAD_RATE_LIMIT_SECRET || 'auth'
  const ipHash = await hmacIp(clientIp(request), secret)
  await env.DB.prepare(
    'INSERT INTO magic_link_tokens (id, user_id, token_hash, expires_at, used_at, created_at, ip_hash) VALUES (?, ?, ?, ?, NULL, ?, ?)',
  ).bind(crypto.randomUUID(), user.id, tokenHash, expiresAt, nowIso(), ipHash).run()

  const origin = new URL(request.url).origin
  const link = `${origin}/api/auth/callback?token=${encodeURIComponent(rawToken)}`
  const text = `Prijavite se u NEPAR Publisher:\n\n${link}\n\nLink vrijedi 15 minuta i može se iskoristiti jednom.\nAko niste zatražili prijavu, zanemarite ovu poruku.`
  const html = `<html lang="hr"><body style="font-family:Arial,sans-serif;color:#0f172a"><p>Prijavite se u NEPAR Publisher.</p><p><a href="${escapeHtml(link)}">Otvori prijavu</a></p><p style="color:#64748b;font-size:13px">Link vrijedi 15 minuta i može se iskoristiti jednom.</p></body></html>`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetcher(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CF_ACCOUNT_ID)}/email/sending/send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.CF_EMAIL_API_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        to: email,
        from: { address: env.EMAIL_FROM, name: 'NEPAR Publisher' },
        subject: 'Prijava u NEPAR Publisher',
        text,
        html,
      }),
      signal: controller.signal,
    })
    if (!response.ok) throw new AccessDeniedError(502, 'send_failed', 'Prijavni link trenutačno nije moguće poslati.')
  } finally {
    clearTimeout(timeout)
  }

  return { sent: true as const }
}

export async function consumeMagicLink(env: AuthEnv, rawToken: string) {
  if (!env.DB) throw new AccessDeniedError(503, 'db_unavailable', 'D1 binding DB nije konfiguriran.')
  if (!rawToken || rawToken.length > 128) throw new AccessDeniedError(400, 'invalid_token', 'Prijavni link nije valjan.')
  const tokenHash = await sha256Hex(rawToken)
  const row = await env.DB.prepare(
    `SELECT id, user_id, expires_at, used_at FROM magic_link_tokens WHERE token_hash = ?`,
  ).bind(tokenHash).first<{ id: string; user_id: string; expires_at: string; used_at: string | null }>()
  if (!row || row.used_at) throw new AccessDeniedError(400, 'invalid_token', 'Prijavni link nije valjan ili je već iskorišten.')
  if (new Date(row.expires_at).getTime() <= Date.now()) throw new AccessDeniedError(400, 'expired_token', 'Prijavni link je istekao. Zatražite novi.')

  await env.DB.prepare('UPDATE magic_link_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL').bind(nowIso(), row.id).run()
  const sessionToken = randomToken()
  const sessionHash = await sha256Hex(sessionToken)
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()
  await env.DB.prepare(
    'INSERT INTO auth_sessions (id, user_id, token_hash, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(crypto.randomUUID(), row.user_id, sessionHash, expiresAt, nowIso(), nowIso()).run()

  return { sessionToken, maxAgeSeconds: Math.floor(SESSION_TTL_MS / 1000) }
}

export async function destroySession(env: AuthEnv, request: Request) {
  if (!env.DB) return
  const token = readSessionToken(request)
  if (!token) return
  await env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run()
}

/** Ops helper: ensure auth user + owner membership for an existing tenant. */
export async function ensureTenantOwner(env: AuthEnv, tenantId: string, emailRaw: string) {
  if (!env.DB) throw new Error('db_unavailable')
  const email = normalizeEmail(emailRaw)
  if (!validEmail(email)) throw new Error('invalid_email')
  const existing = await env.DB.prepare('SELECT id FROM auth_users WHERE email = ?').bind(email).first<{ id: string }>()
  const userId = existing?.id || crypto.randomUUID()
  const stamp = nowIso()
  if (!existing) {
    await env.DB.prepare('INSERT INTO auth_users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)').bind(userId, email, stamp, stamp).run()
  }
  await env.DB.prepare(
    `INSERT INTO tenant_members (id, tenant_id, user_id, role, created_at)
     VALUES (?, ?, ?, 'owner', ?)
     ON CONFLICT(tenant_id, user_id) DO NOTHING`,
  ).bind(crypto.randomUUID(), tenantId, userId, stamp).run()
  return { userId, email }
}
