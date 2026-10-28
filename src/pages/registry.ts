import { PLANS, formatEur, type PlanId } from '../publisherPricing'
import { SITE_URL } from '../news/site'

export type SitePageKind = 'hub' | 'pricing' | 'faq' | 'compare' | 'spec' | 'guide' | 'service' | 'reference'

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
  /** faqData group rendered on the page and emitted as its FAQPage JSON-LD. */
  faqGroupId?: string
  /** Service JSON-LD with offers for these plans. */
  service?: { name: string; serviceType: string; planIds: PlanId[] }
}

const UPDATED = '2026-10-18T10:00:00+02:00'
const OFFER_UPDATED = '2026-10-27T18:00:00+01:00'

export const EXISTING_WEB_PATH = '/digitalni-cjenik-za-wordpress-webshop/'

export const SITE_PAGES: SitePageMeta[] = [
  {
    path: EXISTING_WEB_PATH,
    kind: 'service',
    label: 'WordPress i webshop',
    title: 'Digitalni cjenik za WordPress, webshop i bilo koji postojeći web',
    seoTitle: 'Digitalni cjenik za WordPress i webshop, bez plugina | NEPAR',
    description: `Digitalni cjenik za WordPress, WooCommerce, Shopify, Wix ili vlastiti web od ${formatEur(PLANS[0].price, true)}: bez plugina, s CSV/XML objavom i 30 dana arhive.`,
    updatedAt: OFFER_UPDATED,
    faqGroupId: 'postojeci-web',
    service: { name: 'Web Link — digitalni cjenik za postojeći web', serviceType: 'Objava digitalnog cjenika', planIds: ['link', 'publisher'] },
  },
  { path: '/vodici/sidrena-cijena/', kind: 'guide', parent: '/vodici/', label: 'Sidrena cijena', title: 'Sidrena cijena 2026: značenje, datumi i prikaz', seoTitle: 'Sidrena cijena 2026: što znači i kako se ističe | NEPAR', description: 'Sidrena odnosno dodatna cijena: referentni datumi, odnos prema digitalnom CSV/XML cjeniku i prikaz uz aktualnu cijenu. Vodič sa službenim izvorima.', updatedAt: '2026-10-27T12:00:00+01:00' },
  { path: '/vodici/automatizacija-digitalnog-cjenika/', kind: 'guide', parent: '/vodici/', label: 'Automatizacija cjenika', title: 'Automatizacija digitalnog cjenika: objava, integracija i nadzor', seoTitle: 'Automatizacija digitalnog cjenika: što radi Publisher | NEPAR', description: 'Što NEPAR Publisher generira nakon objave, što traži vaš izvor podataka i integraciju te što periodični nadzor provjerava. Bez obećanja automatske sinkronizacije.', updatedAt: '2026-10-27T12:00:00+01:00' },
  {
    path: '/objava-digitalnog-cjenika/',
    kind: 'service',
    label: 'Objava i ugradnja',
    title: 'Objava i ugradnja digitalnog cjenika na web',
    seoTitle: 'Objava digitalnog cjenika na web: CSV/XML i ugradnja | NEPAR',
    description: `Objavite digitalni cjenik od ${formatEur(PLANS[0].price, true)} i povežite ga s postojećim webom. Usporedite pakete i pogledajte stvarnu NEPAR implementaciju.`,
    updatedAt: OFFER_UPDATED,
  },
  {
    path: '/reference/auto-gubic/',
    kind: 'reference',
    label: 'Auto Gubić',
    title: 'Auto Gubić: digitalni cjenik na web stranici autoservisa',
    seoTitle: 'Auto Gubić: primjer digitalnog CSV/XML cjenika | NEPAR',
    description: 'NEPAR referentna implementacija za Auto Gubić: javni prikaz usluge, aktualna i sidrena cijena, CSV/XML poveznice te podaci o objavi. Pogledajte primjer.',
    updatedAt: OFFER_UPDATED,
  },
  {
    path: '/cijene/',
    kind: 'pricing',
    label: 'Cijene',
    title: 'Cijene i godišnji paketi za digitalni cjenik',
    seoTitle: 'Cijene digitalnog cjenika (CSV/XML) | NEPAR Publisher',
    description:
      `Besplatna provjera weba i validator. Godišnji paketi: ${PLANS.map(p => `${p.name} ${formatEur(p.price, true)}`).join(', ')}. Objavite digitalni cjenik na svojoj web stranici.`,
    updatedAt: OFFER_UPDATED,
  },
  {
    path: '/faq/',
    kind: 'faq',
    label: 'Česta pitanja',
    title: 'Digitalni cjenik i sidrena cijena: česta pitanja',
    seoTitle: 'Digitalni cjenik i sidrena cijena: česta pitanja | NEPAR',
    description:
      'Odgovori na najčešća pitanja o digitalnom cjeniku: tko mora objaviti CSV/XML, rok 17.11.2026., sidrena cijena, arhiva 30 dana, naziv datoteke, više poslovnica i web shop.',
    updatedAt: OFFER_UPDATED,
  },
  {
    path: '/usporedba/',
    kind: 'compare',
    label: 'Usporedba',
    title: 'Usporedba digitalnih cjenika 2026: NEPAR, eCjenik i digitalnicjenik.hr',
    seoTitle: 'Digitalni cjenik: usporedba NEPAR, eCjenik i digitalnicjenik.hr',
    description:
      'Javno provjerene cijene i mogućnosti NEPAR-a, eCjenika i digitalnicjenik.hr na 26.10.2026., uz iskrenu preporuku prema veličini cjenika, nadzoru, lokacijama i API potrebama.',
    updatedAt: OFFER_UPDATED,
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
        { name: 'Objavite besplatno na 24 sata', text: 'Objavite javni cjenik i provjerite CSV, XML i arhivu; isti link zadržite uplatom.' },
        { name: 'Povežite s webom', text: 'Postavite poveznicu ili ugradnju na svoju stranicu i zadržite link uz Web Link.' },
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
  { href: EXISTING_WEB_PATH, label: 'Postojeći web' },
  { href: '/objava-digitalnog-cjenika/', label: 'Objava i ugradnja' },
  { href: '/cijene/', label: 'Cijene' },
  { href: '/usporedba/', label: 'Usporedba' },
  { href: '/specifikacija-csv-xml/', label: 'Specifikacija' },
  { href: '/faq/', label: 'Česta pitanja' },
  { href: '/vodici/', label: 'Vodiči' },
  { href: '/vijesti/', label: 'Vijesti' },
]
