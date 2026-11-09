import { describe, expect, it } from 'vitest'
import { identifyWebsitePlatform, robotsRestrictionHint } from './check'

describe('checker advisory signals', () => {
  it('identifies CMS platforms from HTML hints without guessing', () => {
    expect(identifyWebsitePlatform('<script src="/wp-content/themes/site/app.js"></script>')).toBe('wordpress')
    expect(identifyWebsitePlatform('<link href="https://cdn.shopify.com/theme.css">')).toBe('shopify')
    expect(identifyWebsitePlatform('<script src="https://static.wixstatic.com/build.js"></script>')).toBe('wix')
    expect(identifyWebsitePlatform('<html><body>Cjenik</body></html>')).toBe('unknown')
  })
  it('treats robots restrictions as hints only when the wildcard group applies', () => {
    expect(robotsRestrictionHint('User-agent: *\nDisallow: /')).toMatch(/Disallow: \//)
    expect(robotsRestrictionHint('User-agent: *\nDisallow: /cjenik/')).toMatch(/cjenik/)
    expect(robotsRestrictionHint('User-agent: Googlebot\nDisallow: /\nUser-agent: *\nAllow: /')).toBeNull()
    expect(robotsRestrictionHint('User-agent: *\nDisallow: /admin/')).toBeNull()
  })
})
