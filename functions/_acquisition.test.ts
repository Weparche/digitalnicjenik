import { beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { acquisitionFunnel, recordAttribution } from './_acquisition'

const touch = {
  attribution_id: '11111111-1111-4111-8111-111111111111',
  utm_source: 'kpdinfo.com',
  utm_medium: 'owned_context',
  utm_campaign: 'nepar_digitalni_cjenik',
  utm_content: 'after-result',
  referrer_host: 'https://kpdinfo.com/tajni-path?q=1',
  landing_path: '/objava-digitalnog-cjenika/',
  first_seen: '2026-10-26T12:00:00.000Z',
}

describe('acquisition attributions', () => {
  beforeEach(async () => {
    await env.DB.prepare('DELETE FROM acquisition_attributions').run()
    await env.DB.prepare("DELETE FROM entitlements WHERE id = 'ent-1'").run()
    await env.DB.prepare("DELETE FROM tenants WHERE id = 'tenant-1'").run()
  })

  it('ignores a second write of the same attribution, kind and subject', async () => {
    await recordAttribution(env.DB, 'lead', 'attempt-1', touch)
    await recordAttribution(env.DB, 'lead', 'attempt-1', { ...touch, utm_source: 'vremenskaprognoza.hr' })
    const rows = await env.DB.prepare('SELECT utm_source, referrer_host FROM acquisition_attributions').all<{ utm_source: string; referrer_host: string }>()
    expect(rows.results).toEqual([{ utm_source: 'kpdinfo.com', referrer_host: 'kpdinfo.com' }])
    expect(JSON.stringify(rows.results)).not.toContain('tajni-path')
  })

  it('skips an invalid id and still returns', async () => {
    await recordAttribution(env.DB, 'lead', 'attempt-1', { ...touch, attribution_id: 'nope' })
    const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM acquisition_attributions').first<{ count: number }>()
    expect(count?.count).toBe(0)
  })

  it('aggregates the funnel and labels plan value separately from revenue', async () => {
    const iso = '2026-10-26T12:00:00.000Z'
    await env.DB.prepare("INSERT INTO tenants (id, slug, name, currency, created_at, updated_at) VALUES ('tenant-1', 'salon', 'Salon', 'EUR', ?, ?)").bind(iso, iso).run()
    await env.DB.prepare("INSERT INTO entitlements (id, tenant_id, plan, status, period_start, period_end, created_at, updated_at) VALUES ('ent-1', 'tenant-1', 'publisher_self_service', 'active', ?, '2027-10-26T12:00:00.000Z', ?, ?)").bind(iso, iso, iso).run()
    await recordAttribution(env.DB, 'lead', 'lead-1', touch)
    await recordAttribution(env.DB, 'lead', 'lead-2', touch)
    await recordAttribution(env.DB, 'signup', 'user-1', touch)
    await recordAttribution(env.DB, 'trial', 'tenant-1', touch)
    await recordAttribution(env.DB, 'upgrade', 'upgrade-1', touch)
    const weather = { ...touch, attribution_id: '33333333-3333-4333-8333-333333333333', utm_source: 'vremenskaprognoza.hr', utm_medium: 'house_ad' }
    await recordAttribution(env.DB, 'lead', 'lead-3', weather)

    const rows = await acquisitionFunnel(env.DB)
    expect(rows).toEqual([
      { source: 'kpdinfo.com', leads: 2, signups: 1, trials: 1, upgrades: 1, active: 1, activated_plan_value: 49.9 },
      { source: 'vremenskaprognoza.hr', leads: 1, signups: 0, trials: 0, upgrades: 0, active: 0, activated_plan_value: 0 },
    ])
    expect(JSON.stringify(rows)).not.toContain('revenue')
  })
})
