import { SITE_URL } from '../news/site'

export type SitePageKind = 'hub' | 'pricing' | 'faq' | 'compare' | 'spec' | 'guide'

export type SitePageMeta = {
  path: string
  kind: SitePageKind
  /** Breadcrumb / nav label. */
  label: string
  title: string
  seoTitle: string
  description: string
  updatedAt: string
  /** Parent in the breadcrumb (path). */
  parent?: string
  /** Guides that are step-by-step procedures (HowTo schema). */
  howTo?: { name: string; steps: Array<{ name: string; text: string }> }
}

const UPDATED = '2026-10-18T10:00:00+02:00'

export const SITE_PAGES: SitePageMeta[] = [
  {
    path: '/cijene/',
    kind: 'pricing',
    label: 'Cijene',
    title: 'Cijene: digitalni cjenik s nadzorom za 39,90 € godišnje',
    seoTitle: 'Cijene digitalnog cjenika (CSV/XML) | NEPAR Publisher',
    description:
      'NEPAR Publisher: besplatna provjera i 7-dnevni probni rok, zatim 39,90 €/god. (akcija) odnosno 49,90 €/god. Uključuje CSV/XML, arhivu, nadzor usklađenosti, QR i ispis.',
    updatedAt: UPDATED,
  },
  {
    path: '/faq/',
    kind: 'faq',
    label: 'Česta pitanja',
    title: 'Digitalni cjenik i sidrena cijena: česta pitanja',
    seoTitle: 'Digitalni cjenik i sidrena cijena: česta pitanja | NEPAR',
    description:
      'Odgovori na najčešća pitanja o digitalnom cjeniku: tko mora objaviti CSV/XML, rok 17.11.2026., sidrena cijena, arhiva 30 dana, naziv datoteke, više poslovnica i web shop.',
    updatedAt: UPDATED,
  },
  {
    path: '/usporedba/',
    kind: 'compare',
    label: 'Usporedba',
    title: 'Usporedba: kako objaviti digitalni cjenik (alat, dodatak ili ručno)',
    seoTitle: 'Usporedba načina objave digitalnog cjenika | NEPAR',
    description:
      'Usporedba NEPAR Publishera, besplatnih publishera, WooCommerce dodataka i ručne objave: provjera, alarm, usporedba datoteke s izvorom, verzije pravila, arhiva i QR.',
    updatedAt: UPDATED,
  },
  {
    path: '/specifikacija-csv-xml/',
    kind: 'spec',
    label: 'Specifikacija CSV/XML',
    title: 'Specifikacija CSV/XML digitalnog cjenika: polja, naziv datoteke, primjeri',
    seoTitle: 'Specifikacija CSV/XML digitalnog cjenika (NN 101/2026) | NEPAR',
    description:
      'Polje po polje: što Odluka NN 101/2026 traži, kako izgleda NEPAR CSV i XML, kakav je naziv datoteke, što provjeravamo i primjeri za preuzimanje.',
    updatedAt: UPDATED,
  },
  {
    path: '/vodici/',
    kind: 'hub',
    label: 'Vodiči',
    title: 'Vodiči: objava digitalnog cjenika korak po korak',
    seoTitle: 'Vodiči za digitalni cjenik: Excel, WooCommerce, MIKROeRAČUN | NEPAR',
    description:
      'Praktični vodiči za objavu digitalnog cjenika: iz Excela ili CSV-a, za WooCommerce i WordPress te uz MIKROeRAČUN.',
    updatedAt: UPDATED,
  },
  {
    path: '/vodici/excel-csv-digitalni-cjenik/',
    kind: 'guide',
    parent: '/vodici/',
    label: 'Excel i CSV',
    title: 'Kako od Excela napraviti digitalni cjenik (CSV/XML) i objaviti ga na webu',
    seoTitle: 'Excel u CSV/XML digitalni cjenik: vodič korak po korak | NEPAR',
    description:
      'Od Excel tablice do javnog CSV/XML cjenika: stupci, spremanje u CSV, provjera sidrene cijene, objava na stabilnom URL-u i nadzor.',
    updatedAt: UPDATED,
    howTo: {
      name: 'Kako od Excela napraviti digitalni cjenik u CSV/XML obliku',
      steps: [
        { name: 'Pripremite tablicu', text: 'Jedan redak po usluzi ili proizvodu, sa stupcima za naziv, cijenu, poseban oblik prodaje i sidrenu cijenu.' },
        { name: 'Učitajte datoteku u validator', text: 'Otvorite NEPAR Publisher i učitajte .xlsx ili .csv; prepoznata zaglavlja bit će mapirana automatski.' },
        { name: 'Ispravite upozorenja', text: 'Dopunite nedostajuće sidrene cijene i potvrdite posebne oblike prodaje prema popisu problema.' },
        { name: 'Objavite probno', text: 'Pokrenite 7-dnevni probni javni cjenik i provjerite CSV, XML i arhivu.' },
        { name: 'Povežite s webom', text: 'Postavite poveznicu ili ugradnju na svoju stranicu i aktivirajte Publisher.' },
      ],
    },
  },
  {
    path: '/vodici/woocommerce-wordpress-digitalni-cjenik/',
    kind: 'guide',
    parent: '/vodici/',
    label: 'WooCommerce i WordPress',
    title: 'Digitalni cjenik za WooCommerce i WordPress: dodatak, izvoz ili Publisher',
    seoTitle: 'Digitalni cjenik za WooCommerce i WordPress | NEPAR',
    description:
      'Tri načina da WooCommerce ili WordPress stranica ispuni obvezu digitalnog cjenika: besplatni dodatak, izvoz proizvoda u CSV ili NEPAR Publisher. Kada koji ima smisla.',
    updatedAt: UPDATED,
  },
  {
    path: '/vodici/mikroeracun-digitalni-cjenik/',
    kind: 'guide',
    parent: '/vodici/',
    label: 'MIKROeRAČUN',
    title: 'MIKROeRAČUN i digitalni cjenik: dvije različite obveze',
    seoTitle: 'MIKROeRAČUN i digitalni cjenik na webu: razlika | NEPAR',
    description:
      'MIKROeRAČUN rješava eRačune, ne objavu cjenika na webu. Što radi MIKROeRAČUN, što radi digitalni cjenik i kako ih uskladiti bez dvostrukog unosa.',
    updatedAt: UPDATED,
  },
]

export function pageUrl(page: Pick<SitePageMeta, 'path'>) {
  return `${SITE_URL}${page.path}`
}

export function findSitePage(pathname: string): SitePageMeta | undefined {
  const normalized = pathname.endsWith('/') ? pathname : `${pathname}/`
  return SITE_PAGES.find((page) => page.path === normalized)
}

export function getSitePage(path: string): SitePageMeta {
  const page = SITE_PAGES.find((candidate) => candidate.path === path)
  if (!page) throw new Error(`unknown_site_page:${path}`)
  return page
}

export const NAV_LINKS: Array<{ href: string; label: string }> = [
  { href: '/cijene/', label: 'Cijene' },
  { href: '/usporedba/', label: 'Usporedba' },
  { href: '/specifikacija-csv-xml/', label: 'Specifikacija' },
  { href: '/faq/', label: 'Česta pitanja' },
  { href: '/vodici/', label: 'Vodiči' },
  { href: '/vijesti/', label: 'Vijesti' },
]
