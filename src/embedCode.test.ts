import { describe, expect, it } from 'vitest'
import { embedIframeSnippet, embedScriptSnippet, printUrl } from './embedCode'

describe('embed snippets', () => {
  it('builds the script and iframe variants for a tenant slug', () => {
    expect(embedScriptSnippet('https://digitalnicjenik.nepar.hr', 'autogubic')).toBe('<script src="https://digitalnicjenik.nepar.hr/embed.js" data-cjenik="autogubic"></script>')
    expect(embedIframeSnippet('https://digitalnicjenik.nepar.hr', 'autogubic')).toContain('src="https://digitalnicjenik.nepar.hr/c/autogubic?embed=1"')
    expect(printUrl('https://digitalnicjenik.nepar.hr', 'autogubic')).toBe('https://digitalnicjenik.nepar.hr/c/autogubic?print=1')
  })
})
