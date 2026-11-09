import { describe, expect, it } from 'vitest'
import { onRequestGet } from './[id]'
import { TECHNICAL_CHECKS } from '../../../../shared/website-check'
import type { D1DatabaseLike } from '../../../_repository'

const id = '123e4567-e89b-42d3-a456-426614174000'
function mockDb(record: unknown): D1DatabaseLike {
  return {
    prepare: () => ({
      bind: () => ({ first: async () => record }),
    }),
  } as unknown as D1DatabaseLike
}

describe('shareable checker report', () => {
  it('rejects guessed or malformed identifiers without querying storage', async () => {
    const response = await onRequestGet({ params: { id: '../../admin' }, env: {} })
    expect(response.status).toBe(400)
  })
  it('returns not found without exposing other checker records', async () => {
    const response = await onRequestGet({ params: { id }, env: { DB: mockDb(null) } })
    expect(response.status).toBe(404)
  })
  it('serves a redacted snapshot with no attribution or email', async () => {
    const row = {
      id, checked_at: '2026-11-09T12:00:00.000Z', url: 'https://example.com/',
      status: 'yellow', attribution_json: '{"email":"private@example.com"}', email: 'private@example.com',
      checks_json: JSON.stringify(TECHNICAL_CHECKS.map((check) => ({
        id: check.id, status: check.id === 'link' ? 'warning' : 'pass', evidence: 'Public evidence',
      }))),
    }
    const response = await onRequestGet({ params: { id }, env: { DB: mockDb(row) } })
    const body = await response.json() as Record<string, unknown>
    expect(response.status).toBe(200)
    expect(response.headers.get('x-robots-tag')).toContain('noindex')
    expect(body.website).toBe(row.url)
    expect((body.savedReport as { checks: unknown[] }).checks).toHaveLength(9)
    expect(JSON.stringify(body)).not.toContain('private@example.com')
  })
})
