import {
  NEWS_POSTS as EXISTING_NEWS_POSTS,
  type NewsPost,
  formatNewsDate,
  newsArticlePath,
  newsArticleUrl,
} from './posts'

const MINGO_DRAFT_RULES_2026 =
  'https://mingo.gov.hr/vijesti/ministar-susnjar-kroz-dijalog-s-gospodarstvenicima-do-provedivih-pravila-i-vece-zastite-potrosaca/10461'
const ESAVJETOVANJE_PRICE_LIST_2026 = 'https://esavjetovanja.gov.hr/Econ/10332'
const ESAVJETOVANJE_BASE_PRICE_2026 = 'https://esavjetovanja.gov.hr/Econ/10333'
const HOK_DRAFT_RULES_2026 =
  'https://www.hok.hr/novosti-iz-hok/dio-prijedloga-hok-uvazen-u-nacrtima-pravilnika-nastavljaju-se-razgovori-o-ugostiteljstvu-i-objavi'
const HOK_CONSULTATION_2026 =
  'https://www.hok.hr/novosti-iz-hok/bazne-cijene-i-cjenici-poziv-obrtnicama-i-obrtnicima-na-e-savjetovanje'

export const DRAFT_RULES_POST: NewsPost = {
  slug: 'nacrti-pravilnika-digitalni-cjenik-bazna-cijena-2026',
  title: 'Nacrti pravilnika za digitalne cjenike i bazne cijene na e-Savjetovanju',
  seoTitle: 'Nacrti pravilnika za digitalni cjenik 2026. | NEPAR',
  description:
    'Ministarstvo je objavilo nacrte pravilnika za bazne cijene i digitalne cjenike. Savjetovanje traje do 13.11.2026.; donosimo što se predlaže i što još nije konačno.',
  excerpt:
    'Dva pravilnika su od 14.10. na e-Savjetovanju. Nacrti mijenjaju ritam ažuriranja cjenika, predviđaju iznimke i zadržavaju strojno čitljive podatke, ali konačni tekst još nije donesen.',
  readingTimeMinutes: 5,
  publishedAt: '2026-10-15T15:00:00+02:00',
  updatedAt: '2026-10-17T15:00:00+02:00',
  author: { name: 'NEPAR Publisher', url: 'https://nepar.hr/' },
  tags: ['digitalni cjenik', 'bazna cijena', 'sidrena cijena', 'pravilnik', 'e-Savjetovanje', '17. studenoga'],
  kicker: 'Nacrti pravilnika · e-Savjetovanje',
  widgetEyebrow: 'NOVO · E-SAVJETOVANJE',
  widgetHeadline: 'Objavljeni nacrti pravilnika za cjenike i bazne cijene',
  widgetSub: 'Savjetovanje traje do 13.11.; predložena pravila još nisu konačno donesena',
  schemaSection: 'Regulativa',
  image: {
    src: '/og/vijesti-digitalni-cjenik-2026.png',
    alt: 'Nacrti pravilnika za digitalne cjenike i bazne cijene u listopadu 2026.',
    width: 1200,
    height: 630,
  },
  cta: { label: 'Provjeri svoj web', href: '/' },
  secondaryCta: {
    label: 'Pogledaj prethodnu odgodu',
    href: '/vijesti/odgoda-digitalnih-cjenika-sidrenih-cijena-2026/',
  },
  sources: [
    {
      title: 'e-Savjetovanje — Prijedlog pravilnika o sadržaju i načinu objave cjenika proizvoda',
      url: ESAVJETOVANJE_PRICE_LIST_2026,
      type: 'primary',
    },
    {
      title: 'e-Savjetovanje — Prijedlog pravilnika o načinu isticanja bazne cijene proizvoda',
      url: ESAVJETOVANJE_BASE_PRICE_2026,
      type: 'primary',
    },
    {
      title: 'Ministarstvo gospodarstva, 15.10.2026. — predstavljanje pravilnika i prijelaz na trajni sustav',
      url: MINGO_DRAFT_RULES_2026,
      type: 'primary',
    },
    {
      title: 'HOK, 15.10.2026. — dio prijedloga uvažen, razgovori se nastavljaju',
      url: HOK_DRAFT_RULES_2026,
      type: 'secondary',
    },
    {
      title: 'HOK, 14.10.2026. — poziv obrtnicima na e-Savjetovanje',
      url: HOK_CONSULTATION_2026,
      type: 'secondary',
    },
  ],
  sections: [
    {
      heading: 'Što je službeno objavljeno 14. i 15. listopada',
      level: 2,
      html: `<p>Ministarstvo gospodarstva objavilo je <strong>dva prijedloga pravilnika</strong>: o načinu isticanja bazne cijene proizvoda te o sadržaju i načinu objave cjenika proizvoda. Oba su na e-Savjetovanju od <strong>14. listopada do 13. studenoga 2026. u ponoć</strong>.</p>
<p class="news-lead-note"><strong>Važno:</strong> riječ je o nacrtima u javnom savjetovanju, a ne o konačno donesenim pravilnicima. Pojedine odredbe mogu se promijeniti prije objave konačnog teksta.</p>`,
    },
    {
      heading: 'Planirani početak je 17. studenoga, ali konačni tekst još čekamo',
      level: 2,
      html: `<p>Ministarstvo je 15. listopada objavilo da je planirano stupanje pravilnika na snagu <strong>17. studenoga 2026.</strong>. Prema istoj službenoj objavi, tada bi privremene odluke Vlade trebale prestati važiti, za što će se donijeti odgovarajuće odluke Vlade.</p>
<p>Referentni datumi koje Ministarstvo navodi ostaju <strong>2. svibnja 2025.</strong> za ranije obuhvaćene skupine proizvoda i <strong>10. rujna 2026.</strong> za ostale robe i usluge.</p>`,
    },
    {
      heading: 'Digitalni cjenik: predloženo ažuriranje nakon stvarne promjene',
      level: 2,
      html: `<p>Prema objavljenom nacrtu i HOK-ovu sažetku, više se ne predlaže svakodnevno ponovno objavljivanje nepromijenjenog cjenika. Promjena cjenika evidentirala bi se <strong>sljedećeg radnog dana najkasnije do 11 sati</strong>.</p>
<p>Nacrt i dalje predviđa strojno čitljive podatke u <strong>CSV/XML</strong> formatu, mogućnost automatiziranog prikupljanja podataka te dostupnost prethodno objavljenih cjenika na mrežnim stranicama <strong>30 dana od zadnje objave</strong>. HOK se dijelu tih zahtjeva i dalje protivi, pa ih do konačnog pravilnika treba tretirati kao predložena, a ne konačna pravila.</p>`,
    },
    {
      heading: 'Što se mijenja u podacima cjenika',
      level: 2,
      html: `<p>HOK navodi da je u nacrtu dio ranijih zahtjeva ublažen. Među ostalim, šifre, neto količina i barkod navode se gdje su primjenjivi, dok se obveze trebaju čitati prema samom tekstu nacrta i konačnog pravilnika kada bude donesen.</p>
<p>Za postojeće implementacije zato nije preporučljivo unaprijed brisati polja ili mijenjati format samo na temelju sažetaka. NEPAR će tehnički profil validatora uskladiti s konačno donesenim tekstom.</p>`,
    },
    {
      heading: 'Bazna cijena: nacrt predviđa određene iznimke',
      level: 2,
      html: `<p>Ministarstvo navodi da pravilnici ne primjenjuju isto rješenje na sve djelatnosti. Predviđene su iznimke za robu i usluge čije je određivanje cijene uređeno posebnim propisima te za određene <strong>personalizirane i dinamičke cijene usluga</strong>, kao i cijene na posredničkim platformama i drugim posredničkim kanalima.</p>
<p>HOK kao primjere personaliziranih cijena navodi izradu kuhinje po mjeri ili buketa prema posebnim zahtjevima kupca, a kod dinamičkih cijena dio turističkih usluga. To ne treba širiti na druge situacije bez provjere konačnog teksta.</p>`,
    },
    {
      heading: 'HOK-ovi zahtjevi nisu isto što i donesene iznimke',
      level: 2,
      html: `<p>HOK navodi da je dio njegovih prijedloga prihvaćen, ali nastavlja tražiti izmjene vezane uz ugostiteljstvo, prezentacijske mrežne stranice, strojno čitljive formate, automatizirano preuzimanje i 30-dnevnu dostupnost cjenika.</p>
<p>Ti zahtjevi predstavljaju <strong>institucionalno stajalište HOK-a u savjetovanju</strong>. Dok pravilnici ne budu konačno doneseni, ne treba ih predstavljati kao važeća izuzeća.</p>`,
    },
    {
      heading: 'Što sada napraviti ako već imate CSV/XML',
      level: 2,
      html: `<p>Ako ste već pripremili digitalni cjenik, zasad ga nemojte rušiti niti izrađivati ispočetka. Sačuvajte izvorne podatke, CSV/XML i arhivu te pratite konačni tekst nakon završetka savjetovanja.</p>
<p>Za kontekst pogledajte <a href="/vijesti/odgoda-digitalnih-cjenika-sidrenih-cijena-2026/">odgodu primjene do 17. studenoga</a>, <a href="/vijesti/ministarstvo-pojasnjenja-digitalni-cjenik-sidrene-cijene-2026/">ranija pojašnjenja Ministarstva</a> i <a href="/vijesti/primjeri-digitalnih-cjenika-hrvatska-2026/">primjere postojećih digitalnih cjenika</a>.</p>`,
    },
  ],
}

export const NEWS_POSTS: NewsPost[] = [DRAFT_RULES_POST, ...EXISTING_NEWS_POSTS]

export function getPostBySlug(slug: string): NewsPost | undefined {
  return NEWS_POSTS.find((post) => post.slug === slug)
}

export function getLatestPosts(limit = 3): NewsPost[] {
  return [...NEWS_POSTS]
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, limit)
}

export function getLatestPost(): NewsPost {
  const latest = getLatestPosts(1)[0]
  if (!latest) throw new Error('news_posts_empty')
  return latest
}

export function getAllNewsPaths(): { slug: string }[] {
  return NEWS_POSTS.map((post) => ({ slug: post.slug }))
}

export { formatNewsDate, newsArticlePath, newsArticleUrl }
