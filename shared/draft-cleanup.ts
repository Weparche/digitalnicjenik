import type { D1DatabaseLike } from './db'

export type DraftCleanupEnv = { DB: D1DatabaseLike; DRAFTS?: { delete(key: string): Promise<void> } }

/** Remove expired private uploads, preserving any claim that is still being processed. */
export async function cleanupExpiredDrafts(env: DraftCleanupEnv, now = new Date()) {
  if (!env.DRAFTS) return 0
  const stamp = now.toISOString()
  const rows = await env.DB.prepare(`SELECT d.id, d.payload_location FROM publisher_drafts d
    WHERE d.expires_at <= ? AND NOT EXISTS (
      SELECT 1 FROM pending_trial_claims c WHERE c.draft_id = d.id AND c.status = 'provisioning' AND c.expires_at > ?
    ) ORDER BY d.expires_at LIMIT 100`).bind(stamp, stamp).all<{ id: string; payload_location: string }>()
  let deleted = 0
  for (const row of rows.results) {
    await env.DRAFTS.delete(row.payload_location)
    const result = await env.DB.prepare('DELETE FROM publisher_drafts WHERE id = ? AND expires_at <= ?').bind(row.id, stamp).run()
    deleted += result.meta?.changes ?? 0
  }
  return deleted
}
