import { describe, expect, it } from 'vitest'
import { fold, formatCents, hub3Payload, orderAmountCents, orderDescription, orderReference, upgradeAvailable, validOib } from './payment'

const DAY = 86_400_000

describe('payment amounts', () => {
  it('prices Web Link, installation and the Publisher upgrade from shared/pricing', () => {
    expect(orderAmountCents('web_link')).toBe(1990)
    expect(orderAmountCents('web_link', true)).toBe(4980)
    expect(orderAmountCents('publisher_upgrade')).toBe(3000)
    expect(orderAmountCents('publisher_upgrade', true)).toBe(3000)
    expect(formatCents(4980)).toBe('49,80 €')
  })
})

describe('HUB-3 payload', () => {
  it('writes the 14 HRVHUB30 lines with padded amount, folded diacritics and field limits', () => {
    const payload = hub3Payload({
      amountCents: 1990,
      payerName: 'OBRT ZA USLUGE ĆEVAPČIĆI ĐURĐEVAC ŽUPANIJA d.o.o.',
      payerAddress: 'Zagrebačka 123',
      payerPostalCity: '10000 Zagreb',
      reference: '2026-1042',
      description: orderDescription('web_link', 'auto-gubic'),
    })
    expect(payload.split('\n')).toEqual([
      'HRVHUB30',
      'EUR',
      '000000000001990',
      'OBRT ZA USLUGE CEVAPCICI DURDE',
      'Zagrebacka 123',
      '10000 Zagreb',
      'Nepar, vl. Ivan Gorupic',
      'Koprivnicka ulica 52',
      '10000 Zagreb',
      'HR0623600001103276807',
      'HR00',
      '2026-1042',
      'OTHR',
      'Digitalni cjenik auto-gubic',
    ])
  })

  it('keeps the description within 35 characters', () => {
    expect(orderDescription('web_link', 'a'.repeat(60))).toHaveLength(35)
    expect(orderDescription('publisher_upgrade', 'salon')).toBe('Publisher salon')
  })

  it('folds Croatian letters to ASCII', () => {
    expect(fold('Čačak Đuro Šiljo Žarko ćup đak')).toBe('Cacak Duro Siljo Zarko cup dak')
  })
})

describe('order reference', () => {
  it('derives the reference from the DB number and the order year', () => {
    expect(orderReference(1042, '2026-10-28T13:00:00Z')).toBe('2026-1042')
  })
})

describe('Publisher upgrade window', () => {
  const start = '2026-10-01T10:00:00Z'
  const active = { plan: 'web_link', status: 'active', periodStart: start, periodEnd: '2027-10-01T10:00:00Z' }
  it('is open for 30 days after the paid activation only', () => {
    expect(upgradeAvailable(active, Date.parse(start) + 29 * DAY)).toBe(true)
    expect(upgradeAvailable(active, Date.parse(start) + 31 * DAY)).toBe(false)
  })
  it('is closed for the free publication, Publisher and expired licences', () => {
    const now = Date.parse(start) + DAY
    expect(upgradeAvailable({ ...active, status: 'trial' }, now)).toBe(false)
    expect(upgradeAvailable({ ...active, plan: 'publisher_self_service' }, now)).toBe(false)
    expect(upgradeAvailable({ ...active, periodEnd: '2026-10-01T12:00:00Z' }, now)).toBe(false)
    expect(upgradeAvailable(null, now)).toBe(false)
  })
})

describe('OIB', () => {
  it('accepts a valid ISO 7064 MOD 11,10 check digit', () => {
    expect(validOib('69435151530')).toBe(true)
    expect(validOib('69435151531')).toBe(false)
    expect(validOib('1234567890')).toBe(false)
    expect(validOib('abcdefghijk')).toBe(false)
  })
})
