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

export const NEWS_POSTS: NewsPost[] = [
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
    updatedAt: '2026-09-21T08:00:00+02:00',
    author: { name: 'NEPAR Publisher', url: 'https://nepar.hr/' },
    tags: ['regulativa', 'digitalni cjenik', 'sidrena cijena', 'CSV', 'XML'],
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
        html: `<p>Odluka propisuje sadržaj cjenika proizvoda odnosno usluga (identifikacija, cijene, jedinice, PDV status i ostala polja prema vrsti djelatnosti). Točan popis polja i format treba uskladiti s tekstom NN 101/2026-1213 i prilagoditi vrsti poslovanja (roba naspram usluge).</p>
<p>NEPAR Publisher pri uploadu provjerava strukturu i obavezna polja prema našem validacijskom profilu — to je <strong>tehnička provjera spremnosti</strong>, ne zamjena za čitanje Odluke ni pravni savjet.</p>`,
      },
      {
        heading: 'Zašto PDF nije dovoljan: CSV ili XML',
        level: 2,
        html: `<p>Digitalni cjenik mora biti u obliku pogodnom za <strong>automatsku obradu</strong>. Službeni tekst predviđa objavu u <strong>.csv</strong> ili <strong>.xml</strong> formatu, s propisanim podacima i načinom objave na mrežnoj stranici.</p>
<p>PDF, skenirana slika ili samo HTML tablica bez strojno čitljive datoteke obično ne zadovoljavaju zahtjev za automatizirani dohvat — i zato mnogi vlasnici weba moraju dodati stabilan link na CSV/XML datoteku ili API endpoint.</p>`,
      },
      {
        heading: 'Koliko dugo prethodni cjenici moraju ostati dostupni?',
        level: 2,
        html: `<p>Odluka o digitalnom cjeniku propisuje da prethodno objavljeni cjenici moraju ostati dostupni potrošačima i nadležnim tijelima <strong>najmanje 30 dana</strong> nakon objave novog cjenika. To praktično znači arhivu verzija, a ne prepisivanje jedne datoteke bez povijesti.</p>`,
      },
      {
        heading: 'Što znači automatizirani dohvat podataka?',
        level: 2,
        html: `<p>Pod automatiziranim dohvatom podrazumijeva se da cjenik na mrežnoj stranici mora biti dostupan na način koji omogućuje <strong>strojno preuzimanje i obradu</strong> bez ručnog prepisivanja — tipično stabilan URL na CSV/XML datoteku ili servis koji vraća iste podatke u propisanom formatu.</p>
<p>NEPAR Publisher objavljuje javne feedove (CSV/XML) i verzioniranje objava kako link ne bi „pucao” pri svakoj promjeni cijena — to je tehnički sloj između vašeg Excela ili CSV-a i weba.</p>`,
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
<p><a href="/#csv-validator">Učitajte cjenik za besplatnu provjeru →</a> · <a href="/">Provjera postojeće stranice →</a></p>`,
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
