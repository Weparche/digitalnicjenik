import { newsArticleUrl } from './site'

export type NewsSection = {
  heading: string
  level: 2 | 3
  html: string
}

export type NewsPost = {
  slug: string
  title: string
  seoTitle: string
  description: string
  excerpt: string
  readingTimeMinutes: number
  publishedAt: string
  updatedAt: string
  author: { name: string; url: string }
  tags: string[]
  sections: NewsSection[]
  sources: {
    title: string
    url: string
    type: 'primary' | 'secondary'
  }[]
  cta?: { label: string; href: string }
  secondaryCta?: { label: string; href: string }
  kicker?: string
  widgetEyebrow?: string
  widgetHeadline?: string
  widgetSub?: string
  schemaSection?: string
  formatExample?: {
    csvText: string
    xmlText: string
    csvDownloadHref: string
  }
  image: {
    src: string
    alt: string
    width: number
    height: number
  }
}

const NN_1212 = 'https://narodne-novine.nn.hr/clanci/sluzbeni/2026_09_101_1212.html'
const NN_1213 = 'https://narodne-novine.nn.hr/clanci/sluzbeni/2026_09_101_1213.html'
const HOK_2026 =
  'https://www.hok.hr/novosti-iz-hok/dodatna-cijena-i-objava-cjenika-od-1-listopada-2026-najvaznije-informacije'

const terminologyNote = `<p class="news-lead-note">U službenoj Odluci koristi se izraz „dodatna cijena”. U javnoj komunikaciji HOK-a i drugih institucija često se koristi naziv „sidrena cijena”. U ovom tekstu koristimo oba izraza radi lakšeg razumijevanja.</p>`

export const SERVICE_CSV_EXAMPLE = `naziv_usluge;maloprodajna_cijena;posebni_oblik_prodaje;naziv_posebnog_oblika;sidrena_cijena
Muško šišanje;15.00;NE;;15.00
Žensko šišanje;21.00;NE;;18.00
Bojanje kose;45.00;DA;Akcija;40.00`

export const SERVICE_XML_EXAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<cjenik_usluga verzija="1">
  <usluga>
    <naziv_usluge>Muško šišanje</naziv_usluge>
    <maloprodajna_cijena>15.00</maloprodajna_cijena>
    <posebni_oblik_prodaje>NE</posebni_oblik_prodaje>
    <naziv_posebnog_oblika></naziv_posebnog_oblika>
    <sidrena_cijena>15.00</sidrena_cijena>
  </usluga>
  <usluga>
    <naziv_usluge>Žensko šišanje</naziv_usluge>
    <maloprodajna_cijena>21.00</maloprodajna_cijena>
    <posebni_oblik_prodaje>NE</posebni_oblik_prodaje>
    <naziv_posebnog_oblika></naziv_posebnog_oblika>
    <sidrena_cijena>18.00</sidrena_cijena>
  </usluga>
  <usluga>
    <naziv_usluge>Bojanje kose</naziv_usluge>
    <maloprodajna_cijena>45.00</maloprodajna_cijena>
    <posebni_oblik_prodaje>DA</posebni_oblik_prodaje>
    <naziv_posebnog_oblika>Akcija</naziv_posebnog_oblika>
    <sidrena_cijena>40.00</sidrena_cijena>
  </usluga>
</cjenik_usluga>`

export const NEWS_POSTS: NewsPost[] = [
  {
    slug: 'primjer-csv-digitalnog-cjenika-usluge-2026',
    title: 'Primjer CSV digitalnog cjenika za pružatelje usluga',
    seoTitle: 'Primjer CSV digitalnog cjenika za usluge 2026. | NEPAR',
    description:
      'Pogledajte praktičan primjer CSV digitalnog cjenika za usluge prema NN 101/2026-1213: obvezni podaci, sidrena cijena, CSV struktura i provjera datoteke.',
    excerpt:
      'Praktičan primjer CSV/XML cjenika usluga — obvezni podaci, sidrena cijena, preuzimanje i provjera prije objave.',
    readingTimeMinutes: 5,
    publishedAt: '2026-09-22T09:00:00+02:00',
    updatedAt: '2026-09-22T09:00:00+02:00',
    author: { name: 'NEPAR Publisher', url: 'https://nepar.hr/' },
    tags: ['primjer', 'CSV', 'usluge', 'digitalni cjenik'],
    kicker: 'Praktični vodič',
    widgetEyebrow: 'NOVO · PRIMJER',
    widgetHeadline: 'Primjer CSV digitalnog cjenika za usluge',
    widgetSub: 'Preuzmite primjer, provjerite datoteku i objavite probno',
    schemaSection: 'Vodič',
    formatExample: {
      csvText: SERVICE_CSV_EXAMPLE,
      xmlText: SERVICE_XML_EXAMPLE,
      csvDownloadHref: '/examples/primjer-digitalni-cjenik-usluge-2026.csv',
    },
    image: {
      src: '/og/vijesti-digitalni-cjenik-2026.png',
      alt: 'Primjer CSV digitalnog cjenika za pružatelje usluga',
      width: 1200,
      height: 630,
    },
    cta: { label: 'Provjeri svoj CSV', href: '/#csv-validator' },
    secondaryCta: { label: 'Objavi probno 7 dana', href: '/#csv-validator' },
    sources: [
      {
        title: 'NN 101/2026-1213 — Odluka o objavi cjenika proizvoda i usluga',
        url: NN_1213,
        type: 'primary',
      },
      {
        title: 'NEPAR — XML/CSV format i zahtjevi',
        url: 'https://nepar.hr/digitalni-cjenik/xml-csv',
        type: 'secondary',
      },
    ],
    sections: [
      {
        heading: 'Za koga je ovaj primjer',
        level: 2,
        html: `<p>Vodič je namijenjen <strong>pružateljima registriranih usluga</strong> koji imaju mrežnu stranicu i trebaju objaviti digitalni cjenik u CSV ili XML obliku — npr. frizerski i kozmetički saloni, servisi, obrti i druge uslužne djelatnosti.</p>
<p>Opći pregled obveze i datuma početka (1. listopada 2026.) nalazi se u vodiču <a href="/vijesti/digitalni-cjenik-sidrena-cijena-2026">Digitalni cjenik i sidrena cijena</a>.</p>`,
      },
      {
        heading: 'Koje podatke cjenik usluga mora sadržavati',
        level: 2,
        html: `<p class="news-lead-note">Odluka propisuje <strong>podatke</strong> koje digitalni cjenik mora sadržavati, ali <strong>ne propisuje konkretne nazive CSV stupaca</strong>, delimiter niti encoding. Sljedeća struktura je praktičan primjer koji te podatke organizira u strojno čitljivom obliku.</p>
<p>Prema NN 101/2026-1213, cjenik usluga mora uključivati, između ostalog:</p>
<ul class="news-bullets">
<li><strong>naziv usluge</strong>,</li>
<li><strong>maloprodajnu cijenu</strong> i informaciju o <strong>posebnom obliku prodaje</strong> (uključujući naziv posebnog oblika prodaje, ako postoji),</li>
<li><strong>sidrenu odnosno dodatnu cijenu</strong>.</li>
</ul>
<p>NEPAR Publisher pri uploadu provjerava usklađenost s validacijskim profilom — to je tehnička pomoć, ne zamjena za službeni tekst Odluke.</p>`,
      },
      {
        heading: 'Primjer strukture CSV i XML',
        level: 2,
        html: `<p>U primjeru koristimo točku-zarez (<code>;</code>) kao separator — u praksi je čest u HR Excel izvozima. Možete koristiti i zarez ako je cijeli cjenik konzistentan i strojno čitljiv.</p>
<p>Polja <code>posebni_oblik_prodaje</code> i <code>naziv_posebnog_oblika</code> u primjeru mapiraju obvezu Odluke da se uz cijenu vidi je li usluga u posebnom obliku prodaje i pod kojim nazivom.</p>`,
      },
      {
        heading: 'Naziv datoteke nije isto što i stupci CSV-a',
        level: 2,
        html: `<p>Odluka zasebno propisuje <strong>naziv datoteke</strong> objavljenog cjenika — ne miješajte to sa strukturom stupaca unutra. Naziv datoteke treba uključivati oblik prodajnog odnosno uslužnog objekta, adresu, oznaku objekta, broj pohrane i vremensku oznaku, prema tekstu NN 101/2026-1213.</p>
<p>Primjer CSV/XML u ovom članku služi za sadržaj; stvarni naziv datoteke prilagodite svom objektu i verziji cjenika.</p>`,
      },
      {
        heading: 'Imate svoj Excel ili CSV?',
        level: 2,
        html: `<p><a href="/#csv-validator"><strong>Učitajte datoteku i provjerite podatke →</strong></a></p>
<p>Validator provjerava strukturu, obavezna polja i sidrenu cijenu prije nego objavite cjenik na webu.</p>`,
      },
      {
        heading: 'Želite ga odmah objaviti na webu?',
        level: 2,
        html: `<p>Nakon provjere možete pokrenuti <strong>7-dnevni probni</strong> javni cjenik na vlastitom URL-u — isti Publisher flow kao na početnoj stranici.</p>
<p><a href="/#csv-validator"><strong>Objavi probno 7 dana →</strong></a></p>`,
      },
    ],
  },
  {
    slug: 'digitalni-cjenik-sidrena-cijena-2026',
    title: 'Digitalni cjenik od 1. listopada 2026.: što se mijenja za vlasnike web stranica',
    seoTitle: 'Digitalni cjenik od 1.10.2026.: CSV/XML i sidrena cijena | NEPAR',
    description:
      'Što od 1.10.2026. donose nova pravila: CSV/XML cjenik, dodatna odnosno sidrena cijena, 30-dnevna dostupnost i automatizirani dohvat podataka.',
    excerpt:
      'Digitalni cjenik od 1. listopada 2026. — što vlasnici web stranica trebaju pripremiti: dodatna (sidrena) cijena, CSV/XML objava, arhiva i automatizirani dohvat.',
    readingTimeMinutes: 6,
    publishedAt: '2026-09-21T08:00:00+02:00',
    updatedAt: '2026-09-21T16:15:00+02:00',
    author: { name: 'NEPAR Publisher', url: 'https://nepar.hr/' },
    tags: ['regulativa', 'digitalni cjenik', 'sidrena cijena', 'CSV', 'XML'],
    kicker: 'Regulativa',
    widgetEyebrow: 'REGULATIVA',
    widgetHeadline: 'Digitalni cjenik od 1. listopada 2026.',
    widgetSub: 'Što vlasnici web stranica trebaju pripremiti',
    schemaSection: 'Regulativa',
    image: {
      src: '/og/vijesti-digitalni-cjenik-2026.png',
      alt: 'Digitalni cjenik od 1.10.2026. — CSV/XML, sidrena cijena, 30 dana arhive',
      width: 1200,
      height: 630,
    },
    cta: { label: 'Provjerite CSV/XML besplatno', href: '/#csv-validator' },
    sources: [
      {
        title: 'NN 101/2026-1212 — Odluka o isticanju dodatne cijene',
        url: NN_1212,
        type: 'primary',
      },
      {
        title: 'NN 101/2026-1213 — Odluka o objavi cjenika proizvoda i usluga',
        url: NN_1213,
        type: 'primary',
      },
      {
        title: 'HOK, 18.9.2026. — Dodatna cijena i objava cjenika od 1. listopada 2026.',
        url: HOK_2026,
        type: 'secondary',
      },
    ],
    sections: [
      {
        heading: 'Ukratko',
        level: 2,
        html: `${terminologyNote}
<ul class="news-bullets">
<li>Nova pravila stupaju na snagu <strong>1. listopada 2026.</strong></li>
<li><strong>Dodatna (sidrena) cijena</strong> — zasebna obveza (NN 101/2026-1212).</li>
<li><strong>Digitalni cjenik</strong> na webu u <strong>CSV ili XML</strong> formatu (NN 101/2026-1213).</li>
<li>Prethodno objavljeni cjenici moraju ostati dostupni <strong>30 dana</strong>.</li>
<li>Potrebno je <strong>tehničko rješenje za automatizirani dohvat</strong> podataka.</li>
</ul>`,
      },
      {
        heading: 'Dodatna ili „sidrena” cijena — što to znači?',
        level: 2,
        html: `<p>Odluka o isticanju dodatne cijene (NN 101/2026-1212) određuje da se uz aktualnu maloprodajnu cijenu mora jasno, vidljivo i čitljivo istaknuti i <strong>dodatna cijena</strong> — referentna cijena iz propisanog datuma, bez posebnih oblika prodaje.</p>
<p>Obveza se odnosi na trgovce na malo i pružatelje registriranih usluga koji posluju s potrošačima (B2C). Isticanje vrijedi na prodajnom odnosno uslužnom mjestu, u oglašavanju i na <strong>mrežnim stranicama</strong>, ne samo u fizičkom prostoru.</p>
<p>Za određene kategorije proizvoda (hrana, piće, kozmetika, sredstva za čišćenje, toaletne potrepštine i proizvodi za kućanstvo) koji su već bili u režimu iz 2025., referentna cijena i dalje može biti ona iz ranijeg propisanog datuma — provjerite tekst Odluke i HOK upute za svoj asortiman.</p>
<p>Dodatna cijena <em>nije</em> nova prodajna cijena niti automatsko ograničenje budućih promjena; to je referenca uz aktualnu cijenu radi informiranja potrošača.</p>`,
      },
      {
        heading: 'Tko mora objaviti digitalni cjenik na webu?',
        level: 2,
        html: `<p>Odluka o objavi cjenika (NN 101/2026-1213) propisuje obvezu objave <strong>važećih cjenika proizvoda i usluga na mrežnim stranicama</strong> trgovca odnosno pružatelja usluge.</p>
<p>Obveza se primjenjuje ako imate <strong>uspostavljenu mrežnu stranicu</strong> — ne na sve subjekte bez weba. Cilj je da potrošači i nadležna tijela mogu pouzdano doći do strojno čitljivog cjenika, ne samo do PDF-a ili slike.</p>`,
      },
      {
        heading: 'Koji podaci moraju biti u cjeniku?',
        level: 2,
        html: `<p>Odluka propisuje različita obvezna polja za proizvode i usluge. Za proizvode to uključuje, među ostalim, naziv, šifru, marku, maloprodajnu i sidrenu cijenu, podatke o posebnom obliku prodaje, barkod i dostupnost; za usluge naziv usluge, maloprodajnu cijenu, podatke o posebnom obliku prodaje i sidrenu cijenu.</p>
<p>NEPAR Publisher pri uploadu provjerava strukturu i obavezna polja prema našem validacijskom profilu — to je <strong>tehnička provjera spremnosti</strong>, ne zamjena za čitanje Odluke ni pravni savjet.</p>`,
      },
      {
        heading: 'Zašto PDF nije dovoljan: CSV ili XML',
        level: 2,
        html: `<p>Digitalni cjenik mora biti u obliku pogodnom za <strong>automatsku obradu</strong>. Službeni tekst predviđa objavu u <strong>.csv</strong> ili <strong>.xml</strong> formatu, s propisanim podacima i načinom objave na mrežnoj stranici.</p>
<p>PDF, skenirana slika ili samo HTML tablica bez strojno čitljive datoteke obično ne zadovoljavaju zahtjev za automatizirani dohvat — i zato mnogi vlasnici weba moraju objaviti <strong>javno dostupan CSV/XML cjenik na stabilnom URL-u</strong>, uz tehničko rješenje koje omogućuje automatizirani dohvat podataka.</p>`,
      },
      {
        heading: 'Koliko dugo prethodni cjenici moraju ostati dostupni?',
        level: 2,
        html: `<p>Odluka o digitalnom cjeniku propisuje da prethodno objavljeni cjenici moraju ostati dostupni potrošačima i nadležnim tijelima <strong>najmanje 30 dana</strong> nakon objave novog cjenika. To praktično znači arhivu verzija, a ne prepisivanje jedne datoteke bez povijesti.</p>`,
      },
      {
        heading: 'Što znači automatizirani dohvat podataka?',
        level: 2,
        html: `<p>Odluka zahtijeva objavu važećeg cjenika u <strong>.csv</strong> ili <strong>.xml</strong> formatu te da trgovac odnosno pružatelj usluge na mrežnoj stranici omogući softverske alate odnosno automatizirane programe za <strong>dohvat podataka u realnom vremenu</strong> — bez ručnog prepisivanja.</p>
<p>NEPAR Publisher objavljuje javne CSV/XML feedove na stabilnom URL-u i verzioniranje objava kako link ne bi „pucao” pri svakoj promjeni cijena — to je tehnički sloj između vašeg Excela ili CSV-a i weba.</p>`,
      },
      {
        heading: 'Koliko često se cjenik mora ažurirati?',
        level: 2,
        html: `<p>Frekvencija ovisi o vrsti poslovanja:</p>
<ul class="news-bullets">
<li><strong>Trgovci na malo:</strong> cjenik se ažurira <strong>jednom dnevno</strong>, najkasnije do <strong>8:00</strong> sati za tekući radni dan.</li>
<li><strong>Pružatelji usluga:</strong> cjenik se ažurira <strong>nakon promjene</strong> cijene usluge, najkasnije do <strong>8:00</strong> sati na dan objave izmjene.</li>
</ul>
<p>Ako istodobno imate obvezu isticanja dodatne cijene, planirajte objavu cjenika i istaknute cijene u istom ritmu promjena — detalje za svoj sektor provjerite u Odlukama i HOK sažetku.</p>`,
      },
      {
        heading: 'MIKROeRAČUN i cjenik na webu nisu ista stvar',
        level: 2,
        html: `<p><strong>MIKROeRAČUN</strong> (besplatno rješenje Porezne uprave) odnosi se na <strong>eRačune</strong> u propisanom sustavu fiskalizacije — ne na objavu javnog cjenika na vašem webu u CSV/XML obliku.</p>
<p>Možete koristiti MIKROeRAČUN za eRačune i paralelno imati cijene u Excelu ili CSV-u, ali <strong>web i dalje mora objaviti digitalni cjenik</strong> ako imate mrežnu stranicu i padate pod Odluku. NEPAR Publisher je publishing sloj za taj javni cjenik, ne zamjena za MIKROeRAČUN.</p>`,
      },
      {
        heading: 'Kako provjeriti je li vaš cjenik spreman?',
        level: 2,
        html: `<p>Na početnoj stranici NEPAR Publishera možete:</p>
<ul class="news-bullets">
<li>provjeriti postoji li već javni CSV/XML na vašem webu (readiness checker),</li>
<li>učitati Excel ili CSV i proći <strong>validaciju strukture</strong> (uključujući dodatnu/sidrenu cijenu gdje je potrebna),</li>
<li>pokrenuti <strong>7-dnevni probni</strong> javni cjenik na vlastitom URL-u prije aktivacije Publishera.</li>
</ul>
<p><a href="/#csv-validator">Učitajte cjenik za besplatnu provjeru →</a> · <a href="/">Provjera postojeće stranice →</a></p>
<p>Za praktičan primjer CSV/XML za usluge pogledajte <a href="/vijesti/primjer-csv-digitalnog-cjenika-usluge-2026">Primjer CSV digitalnog cjenika za pružatelje usluga</a>.</p>`,
      },
    ],
  },
]

export function getPostBySlug(slug: string): NewsPost | undefined {
  return NEWS_POSTS.find((post) => post.slug === slug)
}

export function getLatestPost(): NewsPost {
  const sorted = [...NEWS_POSTS].sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  )
  const latest = sorted[0]
  if (!latest) throw new Error('news_posts_empty')
  return latest
}

export function getAllNewsPaths(): { slug: string }[] {
  return NEWS_POSTS.map((post) => ({ slug: post.slug }))
}

export function formatNewsDate(iso: string) {
  return new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Zagreb',
  }).format(new Date(iso))
}

export function newsArticlePath(slug: string) {
  return `/vijesti/${slug}`
}

export { newsArticleUrl }
