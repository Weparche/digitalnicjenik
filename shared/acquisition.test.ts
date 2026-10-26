import { describe, expect, it } from 'vitest'
import {
  FIRST_TOUCH_MS,
  referrerHost,
  resolveFirstTouch,
  sanitizeAttribution,
  touchFromSearch,
  urlWithoutCampaignParams,
} from './acquisition'

const NOW = Date.parse('2026-10-26T12:00:00.000Z')
const touch = {
  attribution_id: '11111111-1111-4111-8111-111111111111',
  utm_source: 'kpdinfo.com',
  utm_medium: 'owned_context',
  utm_campaign: 'nepar_digitalni_cjenik',
  utm_content: 'after-result',
  referrer_host: 'kpdinfo.com',
  landing_path: '/objava-digitalnog-cjenika/',
  first_seen: '2026-10-26T12:00:00.000Z',
}

describe('acquisition touch', () => {
  it('keeps the first source for 90 days and drops a later campaign', () => {
    const later = { ...touch, attribution_id: '22222222-2222-4222-8222-222222222222', utm_source: 'vremenskaprognoza.hr', first_seen: '2026-11-02T12:00:00.000Z' }
    const decision = resolveFirstTouch(touch, later, NOW + 7 * 24 * 60 * 60 * 1000)
    expect(decision.touch?.utm_source).toBe('kpdinfo.com')
    expect(decision.touch?.attribution_id).toBe(touch.attribution_id)
    expect(decision.strip).toBe(true)
  })

  it('accepts a new first touch only after 90 days', () => {
    const later = { ...touch, attribution_id: '22222222-2222-4222-8222-222222222222', utm_source: 'vremenskaprognoza.hr', first_seen: new Date(NOW + FIRST_TOUCH_MS + 1000).toISOString() }
    const decision = resolveFirstTouch(touch, later, NOW + FIRST_TOUCH_MS + 1000)
    expect(decision.touch?.utm_source).toBe('vremenskaprognoza.hr')
    expect(decision.strip).toBe(true)
  })

  it('rejects unsafe campaign fields without keeping a partial touch', () => {
    expect(sanitizeAttribution({ ...touch, attribution_id: 'not-a-uuid' })).toBeNull()
    expect(sanitizeAttribution({ ...touch, utm_source: 'kpdinfo.com/path?x=1' })).toBeNull()
    expect(sanitizeAttribution({ ...touch, utm_medium: 'house ad' })?.utm_medium).toBeNull()
    expect(sanitizeAttribution({ ...touch, landing_path: '/cijene/?utm_source=x' })?.landing_path).toBeNull()
    expect(referrerHost('https://kpdinfo.com/cjenik?q=1')).toBe('kpdinfo.com')
    expect(referrerHost('kpdinfo.com/tajna')).toBeNull()
  })

  it('removes only campaign parameters from the address bar', () => {
    expect(urlWithoutCampaignParams('/cijene/?plan=link&utm_source=bezstruje.hr&utm_medium=house_ad&utm_campaign=nepar_digitalni_cjenik&utm_content=after-main#paketi'))
      .toBe('/cijene/?plan=link#paketi')
    expect(urlWithoutCampaignParams('/?utm_source=nepar.hr')).toBe('/')
  })

  it('builds a touch from the query string and keeps only the referrer host', () => {
    const parsed = touchFromSearch({
      search: '?utm_source=vidimose.hr&utm_medium=house_ad&utm_campaign=nepar_digitalni_cjenik&utm_content=after-cta&plan=link',
      referrer: 'https://vidimose.hr/rođendan?token=secret',
      pathname: '/',
      nowIso: touch.first_seen,
      attributionId: touch.attribution_id,
    })
    expect(parsed?.utm_source).toBe('vidimose.hr')
    expect(parsed?.referrer_host).toBe('vidimose.hr')
    expect(JSON.stringify(parsed)).not.toContain('token')
  })
})
