import { describe, expect, it } from 'vitest'
import { onRequestGet } from './varijanta/[variant]'

describe('legacy variant routes', () => {
  it('redirects public legacy variants to the app root', () => {
    const response = onRequestGet({
      request: new Request('https://digitalnicjenik.nepar.hr/varijanta/2'),
      params: { variant: '2' },
    })

    expect(response.status).toBe(301)
    expect(response.headers.get('location')).toBe('https://digitalnicjenik.nepar.hr/')
  })

  it('does not expose arbitrary variant routes', () => {
    const response = onRequestGet({
      request: new Request('https://digitalnicjenik.nepar.hr/varijanta/other'),
      params: { variant: 'other' },
    })

    expect(response.status).toBe(404)
  })
})
