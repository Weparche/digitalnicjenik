import { TECHNICAL_CHECKS, type TechnicalStatus, type WebsiteCheckResult } from '../../../../shared/website-check'
import type { D1DatabaseLike } from '../../../_repository'

type Env = { DB?: D1DatabaseLike }
type CheckerRow = {
  id: string; checked_at: string; url: string; status: WebsiteCheckResult['status']; checks_json: string
}
const VALID_STATUSES: TechnicalStatus[] = ['pass', 'missing', 'warning', 'fail', 'unknown', 'not_applicable']
const NO_STORE = { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' }

/**
 * A report can be opened only by its random, unguessable checker-run UUID.
 * No access to attribution, email, lead, IP, private publisher state, or downloaded source files.
 * It is a saved snapshot, not a fresh compliance determination.
 */
export const onRequestGet = async ({ params, env }: { params: { id?: string | string[] }; env: Env }) => {
  const id = params.id
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return Response.json({ error: 'Neispravna poveznica rezultata.' }, { status: 400, headers: NO_STORE })
  }
  if (!env.DB) return Response.json({ error: 'Dijeljeni rezultat nije trenutačno dostupan.' }, { status: 503, headers: NO_STORE })
  try {
    const row = await env.DB.prepare('SELECT id, checked_at, url, status, checks_json FROM checker_runs WHERE id = ? LIMIT 1').bind(id).first<CheckerRow>()
    if (!row) return Response.json({ error: 'Rezultat nije pronađen.' }, { status: 404, headers: NO_STORE })
    const parsed: unknown = JSON.parse(row.checks_json)
    if (!Array.isArray(parsed)) throw new Error('invalid_checks')
    const checks = TECHNICAL_CHECKS.map(({ id: checkId }) => {
      const item = parsed.find(entry => entry && typeof entry === 'object' && entry.id === checkId)
      return {
        id: checkId,
        status: VALID_STATUSES.includes(item?.status) ? item.status as TechnicalStatus : 'unknown' as TechnicalStatus,
        evidence: typeof item?.evidence === 'string' ? item.evidence.slice(0, 500) : 'Nema pohranjenog dokaza.',
      }
    })
    return Response.json({
      checkerRunId: row.id,
      status: row.status,
      website: row.url,
      savedReport: { checkedAt: row.checked_at, checks },
      details: { reachable: true },
      message: 'Ovo je spremljeni sažetak provjere. Podaci se od tada mogu promijeniti; ponovite provjeru za trenutačno stanje.',
    } satisfies WebsiteCheckResult, { headers: NO_STORE })
  } catch {
    return Response.json({ error: 'Dijeljeni rezultat nije moguće učitati.' }, { status: 503, headers: NO_STORE })
  }
}
