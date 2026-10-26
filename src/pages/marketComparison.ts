import { PLANS, formatEur } from '../publisherPricing'

export const MARKET_SNAPSHOT_DATE = '2026-10-26'
export const MARKET_SNAPSHOT_LABEL = '26. listopada 2026.'

export type MarketOption = {
  id: 'nepar-link' | 'ecjenik-mali' | 'digitalnicjenik-start'
  provider: string
  plan: string
  priceLabel: string
  annualPriceEur: number
  scope: string
  bestFor: string
  sourceUrl: string
}

/**
 * Snapshot javno objavljenih početnih ponuda. Konkurentske cijene nisu runtime podatak:
 * uz svaku je naveden datum provjere i izvor kako se zastarjeli podatak ne bi predstavljao kao aktualan.
 */
export const MARKET_OPTIONS: MarketOption[] = [
  {
    id: 'nepar-link',
    provider: 'NEPAR',
    plan: 'Link',
    priceLabel: formatEur(PLANS[0].price, true),
    annualPriceEur: PLANS[0].price,
    scope: 'Pripremljeni CSV, stalni javni URL, CSV/XML izlaz i arhiva prethodnih verzija 30 dana uz aktivnu pretplatu.',
    bestFor: 'Postojeći web i mali godišnji trošak kada vam ne treba dashboard ni automatski nadzor.',
    sourceUrl: 'https://digitalnicjenik.nepar.hr/objava-digitalnog-cjenika/',
  },
  {
    id: 'ecjenik-mali',
    provider: 'eCjenik',
    plan: 'Mali',
    priceLabel: '0 €',
    annualPriceEur: 0,
    scope: '1 poslovnica, 1 cjenik i do 30 stavki; javna stranica i ispis nose oznaku alata.',
    bestFor: 'Vrlo mali cjenik kada je cijena glavni kriterij i ne smeta oznaka alata.',
    sourceUrl: 'https://www.ecjenik.hr/cijene',
  },
  {
    id: 'digitalnicjenik-start',
    provider: 'digitalnicjenik.hr',
    plan: 'Start',
    priceLabel: '90 €/god',
    annualPriceEur: 90,
    scope: '1 poslovni prostor, do 50 stavki, stalna stranica, povijest cijena i arhiva; 30 dana probe.',
    bestFor: 'Korisnik kojem odgovara vođeni editor i paket stalne stranice do 50 stavki.',
    sourceUrl: 'https://digitalnicjenik.hr/',
  },
]

export const MARKET_RECOMMENDATIONS = [
  {
    need: 'Već imate web i pripremljeni CSV',
    choice: 'NEPAR Link',
    reason: `${formatEur(PLANS[0].price, true)} za stalni URL, CSV/XML i 30-dnevnu arhivu.`,
  },
  {
    need: 'Imate do 30 stavki i želite 0 €',
    choice: 'eCjenik Mali',
    reason: 'Besplatni paket je racionalniji ako vam odgovaraju njegovi limiti i oznaka alata.',
  },
  {
    need: 'Želite da sustav svaki dan provjerava objavu i šalje alarm',
    choice: 'NEPAR Publisher',
    reason: `${formatEur(PLANS[1].price, true)} uz detaljnu validaciju, dashboard, nadzor i e-mail upozorenja.`,
  },
  {
    need: 'Trebate više poslovnica ili izravni API/ERP tijek',
    choice: 'Usporedite druge pakete',
    reason: 'NEPAR trenutačno nije najbolji univerzalni izbor za taj scenarij; provjerite višelokacijske i API opcije konkurenata.',
  },
] as const
