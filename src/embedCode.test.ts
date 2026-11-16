import { describe, expect, it } from 'vitest'
import { embedIframeSnippet, embedScriptSnippet, printUrl, publicInstallationLinks, publicInstallationSnippet } from './embedCode'

describe('embed snippets', () => {
  it('builds the script and iframe variants for a tenant slug', () => {
    expect(embedScriptSnippet('https://digitalnicjenik.nepar.hr', 'autogubic')).toBe('<script src="https://digitalnicjenik.nepar.hr/embed.js" data-cjenik="autogubic"></script>')
    expect(embedIframeSnippet('https://digitalnicjenik.nepar.hr', 'autogubic')).toContain('src="https://digitalnicjenik.nepar.hr/c/autogubic?embed=1"')
    expect(printUrl('https://digitalnicjenik.nepar.hr', 'autogubic')).toBe('https://digitalnicjenik.nepar.hr/c/autogubic?print=1')
  })
})

it('provides stable publicly accessible installation targets',()=>{
 const origin='https://digitalnicjenik.nepar.hr';const slug='salon'
 expect(publicInstallationLinks(origin,slug).map(l=>l.url)).toEqual([origin+'/c/salon',origin+'/c/salon/cjenik.csv',origin+'/c/salon/cjenik.xml',origin+'/c/salon/arhiva'])
 expect(publicInstallationSnippet(origin,slug)).toContain('<a href="'+origin+'/c/salon/arhiva">Arhiva cjenika</a>')
})
