import { describe, expect, it } from 'vitest'
import { decoratePublicationShell, resolvePublicationSeo } from './_public-seo'

const SHELL = `<!doctype html><html><head><meta name="robots" content="noindex,nofollow" /><title>NEPAR Publisher</title><meta name="description" content="Stari opis" /></head><body><div id="root"></div></body></html>`

describe('publication HTML seo', () => {
  it('keeps trials and unknown shells noindex', async () => {
    const page = await resolvePublicationSeo({}, 'salon', 'current')
    expect(page.index).toBe(false)
    const html = decoratePublicationShell(SHELL, page)
    expect(html).toContain('content="noindex,nofollow"')
    expect(html).not.toContain('rel="canonical"')
  })

  it('gives the public demo a unique indexable document', async () => {
    const page = await resolvePublicationSeo({}, 'nepar', 'current')
    expect(page.index).toBe(true)
    expect(page.canonical).toBe('https://digitalnicjenik.nepar.hr/c/nepar')
    const html = decoratePublicationShell(SHELL, page)
    expect(html).toContain('index,follow,max-image-preview:large')
    expect(html).toContain('<link rel="canonical" href="https://digitalnicjenik.nepar.hr/c/nepar" />')
    expect(html).toContain('<h1>NEPAR demo</h1>')
    expect(html).toContain('href="/c/nepar/cjenik.csv"')
    expect(html).toContain('href="/c/nepar/cjenik.xml"')
    expect(html).not.toContain('noindex')
  })
})
