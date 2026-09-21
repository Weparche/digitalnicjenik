import { beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from 'cloudflare:test'
import {
  consumeMagicLink,
  ensureTenantOwner,
  normalizeEmail,
  requestMagicLink,
  resolveSession,
  sessionCookieHeader,
  sha256Hex,
  type AuthEnv,
} from '../../_auth'
import { requireTenantAccess } from '../../_write-auth'
import { createDraft, type RuntimeEnv } from '../../_repository'
import { onRequestPost as importTenant } from '../tenants/[slug]/import'
import { onRequestPost as magicLink } from './magic-link'
import { onRequestGet as authMe } from './me'
import fixture from '../../../marketino-artikli?raw'
import { parseMarketinoCsv } from '../../../src/price-engine/adapters/marketinoCsv'

const operatorKey = 'test-operator-write-key'

function authEnv(base: typeof env, overrides: Partial<AuthEnv> = {}): AuthEnv {
  return {
    ...base,
    OPERATOR_WRITE_KEY: operatorKey,
    DEMO_WRITE_RATE_LIMIT_SECRET: 'demo-rate-secret',
    LEAD_RATE_LIMIT_SECRET: 'demo-rate-secret',
    AUTH_RATE_LIMIT_SECRET: 'auth-rate-secret',
    DEMO_WRITE_TENANT: 'nepar',
    DEMO_PUBLIC_HOSTNAME: 'digitalnicjenik.nepar.hr',
    CF_ACCOUNT_ID: 'account-id',
    CF_EMAIL_API_TOKEN: 'email-token',
    EMAIL_FROM: 'publisher@nepar.hr',
    ...overrides,
  }
}

async function seedAcme(runtime: RuntimeEnv) {
  const list = parseMarketinoCsv(fixture, { id: 'acme', slug: 'acme', name: 'Acme' }).priceList
  const completed = {
    ...list,
    items: list.items.slice(0, 1).map((item) => ({ ...item, type: 'Usluga', anchorPrice: item.price, specialSaleApplied: false, isNewSinceReferenceDate: false })),
  }
  await createDraft(runtime, 'acme', completed, 'acme.csv', 'marketino-csv')
  return completed
}

describe('magic-link auth', () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM sync_logs'),
      env.DB.prepare('DELETE FROM price_publications'),
      env.DB.prepare('DELETE FROM price_list_versions'),
      env.DB.prepare('DELETE FROM price_uploads'),
      env.DB.prepare('DELETE FROM publication_targets'),
      env.DB.prepare('DELETE FROM publication_metadata'),
      env.DB.prepare('DELETE FROM entitlements'),
      env.DB.prepare('DELETE FROM integrations'),
      env.DB.prepare('DELETE FROM price_lists'),
      env.DB.prepare('DELETE FROM magic_link_tokens'),
      env.DB.prepare('DELETE FROM auth_sessions'),
      env.DB.prepare('DELETE FROM tenant_members'),
      env.DB.prepare('DELETE FROM auth_users'),
      env.DB.prepare('DELETE FROM magic_link_rate_buckets'),
      env.DB.prepare('DELETE FROM tenants'),
      env.DB.prepare('DELETE FROM demo_write_rate_buckets'),
      env.DB.prepare('DELETE FROM checker_rate_buckets'),
    ])
  })

  it('sends magic link only for members and allows session writes', async () => {
    const runtime = authEnv(env)
    await seedAcme(runtime)
    await ensureTenantOwner(runtime, 'acme', 'vlasnik@example.hr')

    const fetcher = vi.fn(async () => Response.json({ success: true, result: { delivered: ['vlasnik@example.hr'], queued: [], permanent_bounces: [] } })) as unknown as typeof fetch
    const unknown = await requestMagicLink(
      new Request('https://digitalnicjenik.nepar.hr/api/auth/magic-link', { method: 'POST', headers: { origin: 'https://digitalnicjenik.nepar.hr', 'cf-connecting-ip': '203.0.113.9' }, body: '{}' }),
      runtime,
      'nepoznat@example.hr',
      fetcher,
    )
    expect(unknown.sent).toBe(false)
    expect(fetcher).not.toHaveBeenCalled()

    let capturedToken = ''
    const mailFetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { text: string }
      const match = /token=([a-f0-9]+)/i.exec(body.text)
      capturedToken = match?.[1] || ''
      return Response.json({ success: true, result: { delivered: ['vlasnik@example.hr'], queued: [], permanent_bounces: [] } })
    }) as unknown as typeof fetch

    const sent = await requestMagicLink(
      new Request('https://digitalnicjenik.nepar.hr/api/auth/magic-link', { method: 'POST', headers: { origin: 'https://digitalnicjenik.nepar.hr', 'cf-connecting-ip': '203.0.113.10' } }),
      runtime,
      'Vlasnik@Example.hr',
      mailFetcher,
    )
    expect(sent.sent).toBe(true)
    expect(capturedToken).toHaveLength(64)
    expect(normalizeEmail('Vlasnik@Example.hr')).toBe('vlasnik@example.hr')

    const session = await consumeMagicLink(runtime, capturedToken)
    const cookie = sessionCookieHeader(session.sessionToken, session.maxAgeSeconds)
    const me = await authMe({
      request: new Request('https://digitalnicjenik.nepar.hr/api/auth/me', { headers: { cookie: `nepar_session=${session.sessionToken}` } }),
      env: runtime,
    })
    expect(me.status).toBe(200)
    const meBody = await me.json() as { authenticated: boolean; tenants: Array<{ slug: string }> }
    expect(meBody).toMatchObject({ authenticated: true, tenants: [{ slug: 'acme' }] })

    const imported = await importTenant({
      request: new Request('https://digitalnicjenik.nepar.hr/api/tenants/acme/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: `nepar_session=${encodeURIComponent(session.sessionToken)}` },
        body: JSON.stringify({
          priceList: {
            items: [{ name: 'Šišanje', price: 20, type: 'Usluga', unit: 'kom', isNewSinceReferenceDate: false, anchorPrice: 18, specialSaleApplied: false }],
            currency: 'EUR',
          },
          sourceFilename: 'member.csv',
        }),
      }),
      params: { slug: 'acme' },
      env: runtime,
    })
    expect(imported.status).toBe(200)
    expect(cookie).toContain('HttpOnly')

    const resolved = await resolveSession(runtime, new Request('https://digitalnicjenik.nepar.hr/api/auth/me', {
      headers: { cookie: `nepar_session=${session.sessionToken}` },
    }))
    expect(resolved?.user.email).toBe('vlasnik@example.hr')
    expect(await sha256Hex(capturedToken)).toHaveLength(64)
  })

  it('rejects magic-link for cross-origin and rate-limits requests', async () => {
    const runtime = authEnv(env)
    await seedAcme(runtime)
    await ensureTenantOwner(runtime, 'acme', 'vlasnik@example.hr')
    const cross = await magicLink({
      request: new Request('https://digitalnicjenik.nepar.hr/api/auth/magic-link', {
        method: 'POST',
        headers: { origin: 'https://attacker.example', 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'vlasnik@example.hr' }),
      }),
      env: runtime,
    })
    expect(cross.status).toBe(403)

    const fetcher = vi.fn(async () => Response.json({ success: true, result: { delivered: ['vlasnik@example.hr'], queued: [], permanent_bounces: [] } })) as unknown as typeof fetch
    for (let index = 0; index < 5; index += 1) {
      await requestMagicLink(
        new Request('https://digitalnicjenik.nepar.hr/api/auth/magic-link', { method: 'POST', headers: { origin: 'https://digitalnicjenik.nepar.hr', 'cf-connecting-ip': '198.51.100.77' } }),
        runtime,
        'vlasnik@example.hr',
        fetcher,
      )
    }
    await expect(requestMagicLink(
      new Request('https://digitalnicjenik.nepar.hr/api/auth/magic-link', { method: 'POST', headers: { origin: 'https://digitalnicjenik.nepar.hr', 'cf-connecting-ip': '198.51.100.77' } }),
      runtime,
      'vlasnik@example.hr',
      fetcher,
    )).rejects.toMatchObject({ status: 429 })
  })

  it('keeps operator bearer access for non-demo tenants', async () => {
    const runtime = authEnv(env)
    await seedAcme(runtime)
    const tenant = await requireTenantAccess({
      request: new Request('https://demo.test/api/tenants/acme/import', { headers: { authorization: `Bearer ${operatorKey}` } }),
      env: runtime,
      slug: 'acme',
      operation: 'import',
    })
    expect(tenant.slug).toBe('acme')
  })
})
