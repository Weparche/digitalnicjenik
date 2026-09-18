import { hmacIp } from './_lead'
import type { D1DatabaseLike, RuntimeEnv } from './_repository'

export type WriteOperation = 'import' | 'draft_get' | 'draft_patch' | 'publish' | 'simulate'

export type ResolvedTenant = { id: string; slug: string; name: string }

export class AccessDeniedError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'AccessDeniedError'
    this.status = status
    this.code = code
  }
}

const DEMO_WRITE_LIMIT_PER_HOUR = 30
const HOUR_MS = 3_600_000

function demoTenantSlug(env: RuntimeEnv) {
  return env.DEMO_WRITE_TENANT || 'nepar'
}

function timingSafeEqual(left: string, right: string) {
  const encoder = new TextEncoder()
  const a = encoder.encode(left)
  const b = encoder.encode(right)
  if (a.byteLength !== b.byteLength) return false
  let diff = 0
  for (let index = 0; index < a.byteLength; index += 1) diff |= a[index] ^ b[index]
  return diff === 0
}

function bearerToken(request: Request) {
  const header = request.headers.get('authorization') || ''
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match?.[1]?.trim() || ''
}

function clientIp(request: Request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0'
}

function windowStartIso(now = Date.now()) {
  return new Date(Math.floor(now / HOUR_MS) * HOUR_MS).toISOString()
}

export async function resolveTenantBySlug(env: RuntimeEnv, slug: string): Promise<ResolvedTenant | null> {
  if (!env.DB) return null
  return env.DB.prepare('SELECT id, slug, name FROM tenants WHERE slug = ?').bind(slug).first<ResolvedTenant>()
}

async function assertNotCustomerPublicationHost(env: RuntimeEnv, request: Request) {
  if (!env.DB) return
  const hostname = new URL(request.url).hostname.toLowerCase()
  const demoHost = (env.DEMO_PUBLIC_HOSTNAME || '').toLowerCase()
  if (!hostname || hostname === demoHost) return
  const target = await env.DB.prepare(
    "SELECT tenant_id FROM publication_targets WHERE lower(hostname) = lower(?) AND status = 'active' LIMIT 1",
  ).bind(hostname).first<{ tenant_id: string }>()
  if (target) {
    throw new AccessDeniedError(403, 'customer_host_denied', 'Mutation nije dozvoljena preko customer publication hostnamea.')
  }
}

async function consumeDemoWriteBudget(env: RuntimeEnv, request: Request) {
  if (!env.DB) throw new AccessDeniedError(503, 'db_unavailable', 'D1 binding DB nije konfiguriran.')
  const secret = env.DEMO_WRITE_RATE_LIMIT_SECRET || env.LEAD_RATE_LIMIT_SECRET
  if (!secret) throw new AccessDeniedError(503, 'rate_limit_misconfigured', 'Demo rate-limit secret nije konfiguriran.')
  const ipHash = await hmacIp(clientIp(request), secret)
  const windowStart = windowStartIso()
  const existing = await env.DB.prepare(
    'SELECT attempt_count FROM demo_write_rate_buckets WHERE ip_hash = ? AND window_start = ?',
  ).bind(ipHash, windowStart).first<{ attempt_count: number }>()
  if ((existing?.attempt_count ?? 0) >= DEMO_WRITE_LIMIT_PER_HOUR) {
    throw new AccessDeniedError(429, 'rate_limited', 'Demo write rate limit je prekoračen. Pokušajte kasnije.')
  }
  await env.DB.prepare(
    `INSERT INTO demo_write_rate_buckets (ip_hash, window_start, attempt_count, updated_at)
     VALUES (?, ?, 1, ?)
     ON CONFLICT(ip_hash, window_start) DO UPDATE SET
       attempt_count = attempt_count + 1,
       updated_at = excluded.updated_at
     WHERE attempt_count < ?`,
  ).bind(ipHash, windowStart, new Date().toISOString(), DEMO_WRITE_LIMIT_PER_HOUR).run()
  const after = await env.DB.prepare(
    'SELECT attempt_count FROM demo_write_rate_buckets WHERE ip_hash = ? AND window_start = ?',
  ).bind(ipHash, windowStart).first<{ attempt_count: number }>()
  if (!after || after.attempt_count > DEMO_WRITE_LIMIT_PER_HOUR) {
    throw new AccessDeniedError(429, 'rate_limited', 'Demo write rate limit je prekoračen. Pokušajte kasnije.')
  }
}

function requireOperatorKey(env: RuntimeEnv, request: Request) {
  const key = env.OPERATOR_WRITE_KEY
  if (!key) throw new AccessDeniedError(503, 'operator_key_missing', 'OPERATOR_WRITE_KEY nije konfiguriran.')
  const token = bearerToken(request)
  if (!token || !timingSafeEqual(token, key)) {
    throw new AccessDeniedError(401, 'unauthorized', 'Operator autentikacija je obavezna.')
  }
}

export async function requireTenantAccess(options: {
  request: Request
  env: RuntimeEnv
  slug: string
  operation: WriteOperation
}): Promise<ResolvedTenant> {
  const { request, env, slug, operation } = options
  await assertNotCustomerPublicationHost(env, request)

  const isDemo = slug === demoTenantSlug(env)
  const isMutation = operation !== 'draft_get'

  if (isDemo) {
    if (isMutation) await consumeDemoWriteBudget(env, request)
  } else {
    requireOperatorKey(env, request)
  }

  if (!env.DB) throw new AccessDeniedError(503, 'db_unavailable', 'D1 binding DB nije konfiguriran.')

  let tenant = await resolveTenantBySlug(env, slug)
  if (!tenant && isDemo) {
    // Demo tenant may not exist until first bootstrap/import; allow path slug as provisional identity.
    // createDraft/ensureTenant will persist the canonical row.
    tenant = { id: slug, slug, name: slug === 'nepar' ? 'NEPAR' : slug }
  }
  if (!tenant) throw new AccessDeniedError(404, 'tenant_not_found', 'Tenant nije pronađen.')
  return tenant
}

export function accessErrorResponse(error: unknown) {
  if (error instanceof AccessDeniedError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status })
  }
  return null
}

export type WriteAuthEnv = RuntimeEnv & {
  OPERATOR_WRITE_KEY?: string
  DEMO_WRITE_RATE_LIMIT_SECRET?: string
  LEAD_RATE_LIMIT_SECRET?: string
}

// Keep D1 type imported for potential future shared helpers.
export type { D1DatabaseLike }
