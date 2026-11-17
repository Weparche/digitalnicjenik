import type { RuntimeEnv } from './_repository'
import { hmacIp } from './_lead'
import { zagrebTime } from '../shared/zagreb-time'

export const CHECKER_DAILY_LIMIT = 3
export const CHECKER_LIMIT_MESSAGE = 'Iskoristili ste 3 besplatne provjere za danas. Nove provjere dostupne su sutra od 00:00. Trebate pomoć? Kontaktirajte nas.'
export type CheckerQuota = { remaining: number; resetAt: string }

export class CheckerRateLimitError extends Error {
  constructor(public readonly resetAt: string) { super('rate_limited') }
}

export function checkerDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Zagreb', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const part = (type: string) => parts.find(p => p.type === type)?.value
  const day = part('year') + '-' + part('month') + '-' + part('day')
  const next = new Date(Date.parse(day + 'T00:00:00Z') + 86_400_000).toISOString().slice(0, 10)
  return { start: zagrebTime(day, 0), resetAt: zagrebTime(next, 0) }
}

export async function consumeCheckerBudget(request: Request, env: RuntimeEnv): Promise<CheckerQuota> {
  const secret = env.CHECKER_RATE_LIMIT_SECRET || env.LEAD_RATE_LIMIT_SECRET
  if (!env.DB || !secret) throw new Error('rate_limit_misconfigured')
  // Cloudflare supplies this header; never trust a caller-controlled X-Forwarded-For.
  const ip = request.headers.get('cf-connecting-ip') || 'unknown'
  const key = await hmacIp('checker-daily:' + ip, secret)
  const now = new Date()
  const { start, resetAt } = checkerDay(now)
  // One guarded atomic write; a zero-change result means the quota was exhausted,
  // including concurrent requests. The daily namespace does not reuse hourly buckets.
  const update = await env.DB.prepare(
    `INSERT INTO checker_rate_buckets (ip_hash, window_start, attempt_count, updated_at)
     VALUES (?, ?, 1, ?)
     ON CONFLICT(ip_hash, window_start) DO UPDATE SET
       attempt_count = attempt_count + 1, updated_at = excluded.updated_at
     WHERE attempt_count < ?`
  ).bind(key, start, now.toISOString(), CHECKER_DAILY_LIMIT).run()
  if (update.meta?.changes === 0) throw new CheckerRateLimitError(resetAt)
  if (update.meta?.changes !== 1) throw new Error('rate_limit_write_failed')
  const row = await env.DB.prepare('SELECT attempt_count FROM checker_rate_buckets WHERE ip_hash = ? AND window_start = ?').bind(key, start).first<{attempt_count:number}>()
  if (!row) throw new Error('rate_limit_read_failed')
  return { remaining: Math.max(0, CHECKER_DAILY_LIMIT - row.attempt_count), resetAt }
}

export function checkerQuotaHeaders(quota: CheckerQuota) {
  return { 'cache-control': 'no-store', 'x-checker-remaining': String(quota.remaining), 'x-checker-reset': quota.resetAt }
}

export function checkerLimitHeaders(error: CheckerRateLimitError) {
  return { ...checkerQuotaHeaders({ remaining: 0, resetAt: error.resetAt }), 'retry-after': String(Math.max(1, Math.ceil((Date.parse(error.resetAt) - Date.now()) / 1000))) }
}
