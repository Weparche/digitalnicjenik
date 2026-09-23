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
const HRT_SUSNJAR_2026 =
  'https://vijesti.hrt.hr/gospodarstvo/ante-susnjar-dnevnik-htv-a-12918686'
const MINGO_CLARIFICATION_2026 =
  'https://mingo.gov.hr/vijesti/pojasnjenja-za-primjenu-dodatne-cijene-i-objavu-cjenika-od-1-listopada/10440'
const RRIF_CLARIFICATION_2026 =
  'https://www.rrif.hr/pojasnjenje_ministarstva_gospodarstva_u_vezi_istic-2531-vijest/'

const terminologyNote = `<p class="news-lead-note">U službenoj Odluci koristi se izraz „dodatna cijena”. U javnoj komunikaciji HOK-a i drugih institucija često se koristi naziv „sidrena cijena”. U ovom tekstu koristimo oba izraza radi lakšeg razumijevanja.</p>`

export const SERVICE_CSV_EXAMPLE = `Naziv usluge;Maloprodajna cijena;Poseban oblik prodaje (DA/NE);Naziv posebnog oblika prodaje;Sidrena cijena 10.9.2026.
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
    slug: 'primjeri-digitalnih-cjenika-hrvatska-2026',
    title: 'Javni digitalni cjenici već su online: 5 primjera iz Hrvatske',
    seoTitle: 'Primjeri digitalnog cjenika u Hrvatskoj 2026. | NEPAR',
    description:
      'Pogledali smo pet javno dostupnih digitalnih cjenika u Hrvatskoj, počevši od NEPAR referentne implementacije za Auto Gubić. Evo kako su riješeni CSV/XML, arhiva i javni prikaz.',
    excerpt:
      'Prije 1. listopada već se pojavljuju stvarne implementacije digitalnih cjenika. Prvi primjer je NEPAR implementacija za Auto Gubić, a zatim četiri neovisna tržišna primjera.',
    readingTimeMinutes: 7,
    publishedAt: '2026-09-23T22:25:00+02:00',
    updatedAt: '2026-09-23T22:35:00+02:00',
    author: { name: 'NEPAR Publisher', url: 'https://nepar.hr/' },
    tags: ['digitalni cjenik', 'primjeri', 'CSV', 'XML', 'arhiva', 'Hrvatska'],
    kicker: 'Praksa · primjeri',
    widgetEyebrow: 'NOVO · PRIMJERI IZ PRAKSE',
    widgetHeadline: 'Digitalni cjenici već su online',
    widgetSub: 'NEPAR referentni primjer + četiri tržišne implementacije CSV/XML cjenika',
    schemaSection: 'Praksa',
    image: {
      src: '/og/vijesti-digitalni-cjenik-2026.png',
      alt: 'Primjeri javno objavljenih digitalnih cjenika u Hrvatskoj 2026.',
      width: 1200,
      height: 630,
    },
    cta: { label: 'Provjeri svoj web', href: '/' },
    secondaryCta: {
      label: 'Pogledaj primjer CSV cjenika',
      href: '/vijesti/primjer-csv-digitalnog-cjenika-usluge-2026/',
    },
    sources: [
      {
        title: 'Auto Gubić — NEPAR referentna implementacija digitalnog cjenika',
        url: 'https://autogubic.hr/cjenik',
        type: 'secondary',
      },
      {
        title: 'KNOFEK — javni digitalni cjenik',
        url: 'https://www.knofek.hr/digitalni-cjenik/',
        type: 'secondary',
      },
      {
        title: 'Optika VISUAL — javni digitalni cjenik',
        url: 'https://optikavisual.com/cjenik/',
        type: 'secondary',
      },
      {
        title: 'Modus Design Shop — javni digitalni cjenik',
        url: 'https://modusdesignshop.hr/cjenik/',
        type: 'secondary',
      },
      {
        title: 'Web Studio Šime — javni digitalni cjenik',
        url: 'https://webstudiosime.hr/digitalni-cjenik/',
        type: 'secondary',
      },
      {
        title: 'NN 101/2026-1213 — Odluka o objavi cjenika proizvoda i usluga',
        url: NN_1213,
        type: 'primary',
      },
    ],
    sections: [
      {
        heading: 'Što smo pronašli 23. rujna',
        level: 2,
        html: `<p>Nekoliko dana prije početka primjene novih pravila već su javno dostupne stvarne implementacije digitalnih cjenika. Pregledali smo pet primjera koji se mogu otvoriti bez prijave i koji javno prikazuju strojno čitljive datoteke ili arhivu. Prvi je <strong>NEPAR-ova referentna implementacija za Auto Gubić</strong>, a nakon nje četiri neovisna tržišna primjera.</p>
<p class="news-lead-note"><strong>Važno:</strong> ovo je tehnički pregled onoga što je javno vidljivo na webu, a ne potvrda da je pojedina stranica pravno potpuno usklađena s Odlukom ili svim kasnijim pojašnjenjima.</p>`,
      },
      {
        heading: 'NEPAR referentna implementacija: Auto Gubić',
        level: 2,
        html: `<p>Prvi primjer je naš vlastiti: <strong>Auto Gubić</strong>, za koji je NEPAR izradio web i digitalni cjenik. Na javnoj stranici <code>/cjenik</code> prikazan je važeći cjenik usluga, aktualna i sidrena cijena, vrijeme zadnjeg ažuriranja te broj pohrane.</p>
<p>CSV i XML dostupni su bez prijave i bez izvršavanja JavaScripta, a stabilne poveznice vode na aktualnu verziju. Taj pristup je referentni NEPAR obrazac: <strong>jedan javni prikaz za korisnika + strojno čitljiv CSV/XML + verzioniranje objava</strong>.</p>
<p>Ovaj primjer navodimo odvojeno od ostalih jer je riječ o našoj implementaciji, a ne neovisnom tržišnom primjeru.</p>
<p><a href="https://autogubic.hr/cjenik" target="_blank" rel="noopener noreferrer">Pogledaj Auto Gubić digitalni cjenik ↗</a></p>`,
      },
      {
        heading: 'KNOFEK: jednostavan javni prikaz + CSV/XML arhiva',
        level: 2,
        html: `<p>Na stranici KNOFEK-a 23. rujna vidljiv je javni digitalni cjenik s datumom i vremenom ažuriranja, brojem pohrane te tablicom proizvoda. Uz aktualnu cijenu prikazuje se referentna cijena na 10.9.2026., a kod proizvoda su vidljivi i podaci poput marke, dostupnosti i jedinice.</p>
<p>Na dnu stranice dostupna je arhiva dnevnih cjenika s poveznicama na <strong>CSV i XML</strong>. To je vrlo jasan obrazac: ljudski čitljiv prikaz na webu + strojno čitljive datoteke + verzioniranje.</p>
<p><a href="https://www.knofek.hr/digitalni-cjenik/" target="_blank" rel="noopener noreferrer">Pogledaj KNOFEK digitalni cjenik ↗</a></p>`,
      },
      {
        heading: 'Optika VISUAL: stotine artikala, CSV/XML i dnevna arhiva',
        level: 2,
        html: `<p>Optika VISUAL ima javni cjenik s više od 300 artikala. Stranica prikazuje aktualnu cijenu, cijenu na 10.9.2026. i dostupnost artikla, a u zaglavlju navodi strojno čitljive formate <strong>CSV, XML i JSON</strong>.</p>
<p>U arhivi se vide odvojene CSV i XML datoteke s vremenom objave i brojem artikala. To pokazuje kako digitalni cjenik može biti koristan i korisniku i softverskom dohvaćanju bez potrebe da posjetitelj otvara samu datoteku.</p>
<p><a href="https://optikavisual.com/cjenik/" target="_blank" rel="noopener noreferrer">Pogledaj Optika VISUAL cjenik ↗</a></p>`,
      },
      {
        heading: 'Modus Design Shop: više od 3.000 artikala',
        level: 2,
        html: `<p>Modus Design Shop je zanimljiv primjer zbog opsega. Javni cjenik prikazuje više od <strong>3.000 artikala</strong>, pretraživanje, aktualnu cijenu, referentnu cijenu i polje za najnižu cijenu prije sniženja.</p>
<p>Stranica navodi CSV, XML i JSON kao strojno čitljive izlaze, a arhiva objavljenih cjenika prikazuje datoteke i broj artikala. To je dobar primjer da isti princip može raditi i na katalogu koji nije malen.</p>
<p><a href="https://modusdesignshop.hr/cjenik/" target="_blank" rel="noopener noreferrer">Pogledaj Modus Design Shop cjenik ↗</a></p>`,
      },
      {
        heading: 'Web Studio Šime: primjer za usluge i API dohvat',
        level: 2,
        html: `<p>Web Studio Šime koristi isti koncept za <strong>usluge</strong>. Javni cjenik grupira usluge i uz aktualnu cijenu prikazuje sidrenu odnosno referentnu cijenu na 10.9.2026.</p>
<p>Uz arhivirane CSV/XML verzije stranica javno navodi i aktualne live CSV/XML adrese, JSON API i manifest. Na dan pregleda bilo je vidljivo više arhiviranih pohrana. To ide dalje od minimuma javne datoteke i pokazuje kako se cjenik može pretvoriti u podatkovni servis.</p>
<p><a href="https://webstudiosime.hr/digitalni-cjenik/" target="_blank" rel="noopener noreferrer">Pogledaj Web Studio Šime cjenik ↗</a></p>`,
      },
      {
        heading: 'Što se ponavlja u dobrim implementacijama',
        level: 2,
        html: `<p>U pregledanim primjerima ponavlja se vrlo sličan tehnički obrazac:</p>
<ul class="news-bullets">
<li><strong>normalna web stranica</strong> na kojoj čovjek može pretraživati i čitati cijene,</li>
<li><strong>javni CSV i/ili XML</strong> koji se može otvoriti bez prijave,</li>
<li><strong>datum i vrijeme objave</strong> odnosno broj pohrane,</li>
<li><strong>arhiva prethodnih verzija</strong>,</li>
<li>kod proizvoda dodatna polja kao što su šifra, marka i dostupnost,</li>
<li>referentna odnosno dodatna cijena prikazana uz aktualnu cijenu.</li>
</ul>
<p>To se dobro poklapa s osnovnom logikom NN 101/2026-1213 i službenim pojašnjenjima Ministarstva: datoteka mora biti strojno čitljiva i javno dostupna, a prethodno objavljene verzije moraju ostati dostupne najmanje 30 dana.</p>`,
      },
      {
        heading: 'Što iz ovoga znači za vlasnika običnog weba',
        level: 2,
        html: `<p>Najvažniji zaključak nije da trebate kopirati tuđi dizajn. Bitno je da <strong>podaci o cijenama imaju jedan pouzdan izvor</strong>, a iz njega se generiraju javni prikaz, CSV/XML i arhiva.</p>
<p>Ako danas imate samo HTML cjenik, PDF ili tablicu koju ručno uređujete, najveći rizik nije izgled nego održavanje više kopija istih cijena. Zato NEPAR Publisher polazi od Excela/CSV-a i iz istih podataka generira objavu i verzije.</p>
<p>Na vrhu ovog članka možete odmah provjeriti nalazi li se na vašoj domeni javno dostupan CSV/XML cjenik. Za strukturu usluga pogledajte i <a href="/vijesti/primjer-csv-digitalnog-cjenika-usluge-2026/">primjer CSV digitalnog cjenika</a>, a za zadnja službena pojašnjenja <a href="/vijesti/ministarstvo-pojasnjenja-digitalni-cjenik-sidrene-cijene-2026/">pojašnjenja Ministarstva od 22. rujna</a>.</p>`,
      },
    ],
  },
  {
    slug: 'ministarstvo-pojasnjenja-digitalni-cjenik-sidrene-cijene-2026',
    title: 'Ministarstvo objavilo detaljna pojašnjenja za digitalni cjenik i sidrene cijene',
    seoTitle: 'Ministarstvo: pojašnjenja za digitalni cjenik 2026. | NEPAR',
    description:
      'Ministarstvo gospodarstva objavilo je detaljna pojašnjenja: informativni web ulazi u obvezu, svaka poslovnica i web shop trebaju zaseban CSV/XML, a pojašnjena su i pravila sidrene cijene.',
    excerpt:
      'Nova pisana pojašnjenja Ministarstva donose konkretna pravila za informativne webove, više poslovnica, web shopove, CSV/XML objavu i dodatnu odnosno sidrenu cijenu.',
    readingTimeMinutes: 7,
    publishedAt: '2026-09-22T22:45:00+02:00',
    updatedAt: '2026-09-22T22:45:00+02:00',
    author: { name: 'NEPAR Publisher', url: 'https://nepar.hr/' },
    tags: ['Ministarstvo gospodarstva', 'digitalni cjenik', 'sidrena cijena', 'CSV', 'XML', 'web shop', 'poslovnice'],
    kicker: 'Aktualno · Ministarstvo',
    widgetEyebrow: 'NOVO · SLUŽBENO POJAŠNJENJE',
    widgetHeadline: 'Ministarstvo objavilo detaljna pravila za digitalni cjenik',
    widgetSub: 'Informativni web, više poslovnica, web shop i sidrene cijene — što je sada pojašnjeno',
    schemaSection: 'Aktualno',
    image: {
      src: '/og/vijesti-digitalni-cjenik-2026.png',
      alt: 'Pojašnjenja Ministarstva gospodarstva za digitalni cjenik i sidrene cijene',
      width: 1200,
      height: 630,
    },
    cta: { label: 'Provjeri svoj web', href: '/' },
    secondaryCta: {
      label: 'Učitaj Excel ili CSV',
      href: '/#csv-validator',
    },
    sources: [
      {
        title: 'Ministarstvo gospodarstva, 22.9.2026. — Pojašnjenja za primjenu dodatne cijene i objavu cjenika',
        url: MINGO_CLARIFICATION_2026,
        type: 'primary',
      },
      {
        title: 'NN 101/2026-1213 — Odluka o objavi cjenika proizvoda i usluga',
        url: NN_1213,
        type: 'primary',
      },
      {
        title: 'NN 101/2026-1212 — Odluka o isticanju dodatne cijene',
        url: NN_1212,
        type: 'primary',
      },
      {
        title: 'RRiF, 22.9.2026. — preneseno pojašnjenje Ministarstva',
        url: RRIF_CLARIFICATION_2026,
        type: 'secondary',
      },
    ],
    sections: [
      {
        heading: 'Najvažnije: što je Ministarstvo sada pojasnilo',
        level: 2,
        html: `<p>Ministarstvo gospodarstva objavilo je 22. rujna 2026. detaljna pojašnjenja primjene odluka o dodatnoj cijeni i objavi digitalnog cjenika koje se primjenjuju od <strong>1. listopada 2026.</strong></p>
<ul class="news-bullets">
<li><strong>I informativna ili prezentacijska web stranica ulazi u obvezu.</strong> Nije potrebno imati web shop niti online prodaju.</li>
<li><strong>Profil na društvenoj mreži nije mrežna stranica</strong> za ovu obvezu.</li>
<li>Ako imate <strong>više poslovnica ili uslužnih objekata</strong>, za svaku lokaciju objavljujete zasebnu CSV/XML datoteku, čak i ako su cijene jednake.</li>
<li>Ako imate <strong>web shop</strong>, za njega se objavljuje zasebna CSV/XML datoteka.</li>
<li>Za lanac ili mrežu objekata tehnička struktura datoteka mora biti <strong>jedinstvena</strong> za sve objekte.</li>
<li>Ministarstvo navodi da se obveza omogućavanja automatiziranog dohvaćanja u praksi ispunjava već <strong>javnom objavom CSV/XML cjenika na mrežnoj stranici</strong>.</li>
</ul>
<p class="news-lead-note">Ovo je službeno pojašnjenje primjene postojećih Odluka. Ne mijenja datum početka primjene: i dalje je 1. listopada 2026.</p>`,
      },
      {
        heading: 'Informativni web također znači obvezu CSV/XML cjenika',
        level: 2,
        html: `<p>Jedna od važnijih nejasnoća sada je izričito razriješena. Ministarstvo navodi da se obveza odnosi na trgovce na malo i pružatelje usluga koji imaju uspostavljenu mrežnu stranicu, <strong>uključujući web stranice koje služe samo u informativne ili prezentacijske svrhe</strong>.</p>
<p>Drugim riječima, nije potrebno prodavati online. Ako imate klasičan poslovni web s informacijama o tvrtki, uslugama, kontaktom i cijenama, sama činjenica da web nije web shop ne izuzima ga iz obveze.</p>
<p>S druge strane, profil na Facebooku, Instagramu, TikToku ili drugoj društvenoj mreži Ministarstvo ne smatra uspostavljenom mrežnom stranicom. Više o subjektima bez weba pročitajte u vodiču <a href="/vijesti/digitalni-cjenik-bez-web-stranice-drustvene-mreze/">Digitalni cjenik bez web stranice i društvene mreže</a>.</p>`,
      },
      {
        heading: 'Više poslovnica: zaseban cjenik za svaku lokaciju',
        level: 2,
        html: `<p>Poslovni subjekti s više prodajnih ili uslužnih mjesta moraju objaviti <strong>zasebnu CSV/XML datoteku za svaku pojedinu lokaciju</strong>. Ministarstvo navodi da to vrijedi i kada sve poslovnice imaju isti asortiman i identične cijene.</p>
<p>Razlog je što se datoteka veže uz konkretni objekt i njegovu adresu, oznaku i broj pohrane, a kod proizvoda se raspoloživost prati po pojedinom prodajnom mjestu.</p>
<p>Za lance i mreže datoteke trebaju imati jedinstvenu tehničku strukturu, ali svaki objekt i dalje ima svoju objavu.</p>`,
      },
      {
        heading: 'Web shop treba zaseban CSV ili XML',
        level: 2,
        html: `<p>Ako subjekt ima internetsku trgovinu, Ministarstvo pojašnjava da je za <strong>web shop potrebno generirati i objaviti zasebnu CSV/XML datoteku</strong>, neovisno o tome što su svi proizvodi i cijene već prikazani na samim stranicama trgovine.</p>
<p>U nazivu datoteke kao oblik objekta može se navesti, primjerice, <code>webshop</code>. To znači da fizička poslovnica i web shop nisu jedna te ista objava digitalnog cjenika.</p>`,
      },
      {
        heading: 'Automatizirani dohvat: što pojašnjenje mijenja u praksi',
        level: 2,
        html: `<p>Odluka NN 101/2026-1213 propisuje da trgovac ili pružatelj usluge mora omogućiti uporabu softverskih alata i automatiziranih programa za dohvat podataka o cijenama.</p>
<p>Ministarstvo sada dodatno pojašnjava da se ta obveza <strong>u praksi ispunjava već objavljivanjem cjenika u CSV ili XML obliku na mrežnoj stranici subjekta</strong>. To je važna operativna informacija: za osnovnu usklađenost nije nužno graditi zaseban kompleksan API ako je datoteka javno i strojno dohvatljiva.</p>
<p>I dalje ostaju druge obveze: pravilan sadržaj datoteke, naziv i identifikacija objekta, ažuriranje, javna dostupnost aktualne verzije te najmanje 30 dana dostupnosti prethodno objavljenih cjenika.</p>`,
      },
      {
        heading: 'Sidrena cijena: isto mjesto, isti cjenik i može biti jednaka aktualnoj',
        level: 2,
        html: `<p>Za dodatnu odnosno sidrenu cijenu Ministarstvo pojašnjava da mora biti prikazana <strong>na istom mjestu na kojem je prikazana aktualna cijena</strong>. Kod cjenika usluga to znači na istom cjeniku; nije predviđen zaseban cjenik samo sa sidrenim cijenama.</p>
<p>Nije potrebno uz iznos pisati naziv „sidrena cijena” ili „dodatna cijena”. Ministarstvo preporučuje jednostavnu oznaku poput <strong>„Cijena na 10.9.2026.”</strong>.</p>
<p>Dodatna cijena mora biti prikazana i ako je potpuno jednaka aktualnoj cijeni. Ako se cijena od 10. rujna nije mijenjala, obje će vrijednosti biti jednake.</p>`,
      },
      {
        heading: 'Akcije, nove usluge i cijene po narudžbi',
        level: 2,
        html: `<ul class="news-bullets">
<li>Ako je proizvod ili usluga 10. rujna bila na akciji ili popustu, dodatna cijena nije akcijska cijena nego <strong>prethodna redovna cijena</strong>.</li>
<li>Za proizvod ili uslugu prvi put uvedenu nakon 10. rujna, dodatna cijena je <strong>cijena prvog uvrštenja</strong>, uz datum kada je primijenjena.</li>
<li>Kod proizvoda i usluga po narudžbi, gdje konačna cijena nije unaprijed određena, iskazuju se <strong>elementi od kojih se cijena formira</strong> i njihove dodatne cijene.</li>
<li>Kod dinamičkih usluga, gdje cijena ovisi o potražnji, relaciji, algoritmu ili sličnom, dodatna cijena također se veže uz <strong>pojedinačne elemente konačne cijene</strong>.</li>
</ul>`,
      },
      {
        heading: 'Na akciji mogu biti istaknute tri cijene',
        level: 2,
        html: `<p>Obveza dodatne cijene ne ukida postojeće pravilo o najnižoj cijeni u prethodnih 30 dana tijekom akcije ili drugog posebnog oblika prodaje.</p>
<p>Zato kod sniženja proizvod može imati istaknute <strong>tri cijene</strong>: trenutačnu sniženu cijenu, najnižu cijenu u zadnjih 30 dana i dodatnu odnosno sidrenu cijenu.</p>`,
      },
      {
        heading: 'Što sada napraviti ako imate web',
        level: 2,
        html: `<p>Praktičan redoslijed je sada jasniji:</p>
<ol class="news-bullets">
<li>utvrdite koje prodajne i uslužne lokacije te web shopove imate,</li>
<li>za svaki objekt pripremite zasebnu CSV/XML datoteku gdje je potrebno,</li>
<li>provjerite sadržaj i dodatnu cijenu za svaku stavku,</li>
<li>objavite datoteke javno na webu,</li>
<li>osigurajte ažuriranje i 30-dnevnu dostupnost prethodnih verzija.</li>
</ol>
<p>Na vrhu ovog članka možete odmah provjeriti nalazi li naš checker javno dostupan CSV/XML na vašoj domeni. Ako krećete iz Excela, možete koristiti i <a href="/vijesti/hok-excel-predlosci-digitalni-cjenik-2026/">HOK Excel predložak</a> ili pogledati <a href="/vijesti/primjer-csv-digitalnog-cjenika-usluge-2026/">primjer CSV cjenika za usluge</a>.</p>`,
      },
    ],
  },
  {
    slug: 'digitalni-cjenik-bez-web-stranice-drustvene-mreze',
    title: 'Nemate web stranicu? Ministar pojasnio tko ne mora imati digitalni cjenik',
    seoTitle: 'Morate li imati digitalni cjenik bez web stranice? | NEPAR',
    description:
      'Ministar gospodarstva pojasnio je da oni bez web stranice ne moraju izrađivati web radi digitalnog cjenika te da se društvene mreže ne smatraju web stranicom.',
    excerpt:
      'Pojašnjenje za obrtnike i pružatelje usluga: vlastita web stranica, samo Facebook/Instagram ili bez online prisutnosti — kada se primjenjuje obveza CSV/XML cjenika.',
    readingTimeMinutes: 4,
    publishedAt: '2026-09-22T16:10:00+02:00',
    updatedAt: '2026-09-22T22:45:00+02:00',
    author: { name: 'NEPAR Publisher', url: 'https://nepar.hr/' },
    tags: ['digitalni cjenik', 'web stranica', 'društvene mreže', 'CSV', 'XML', 'regulativa'],
    kicker: 'Aktualno · pojašnjenje',
    widgetEyebrow: 'NOVO · POJAŠNJENJE',
    widgetHeadline: 'Nemate web? Ne morate ga izrađivati zbog digitalnog cjenika',
    widgetSub: 'Ministar pojasnio i status Facebooka, Instagrama i drugih društvenih mreža',
    schemaSection: 'Aktualno',
    image: {
      src: '/og/vijesti-digitalni-cjenik-2026.png',
      alt: 'Digitalni cjenik bez web stranice i pojašnjenje za društvene mreže',
      width: 1200,
      height: 630,
    },
    cta: { label: 'Provjeri svoj web', href: '/' },
    secondaryCta: {
      label: 'Pročitaj glavni vodič za digitalni cjenik',
      href: '/vijesti/digitalni-cjenik-sidrena-cijena-2026/',
    },
    sources: [
      {
        title: 'HRT, 21.9.2026. — razgovor s ministrom gospodarstva Antom Šušnjarom',
        url: HRT_SUSNJAR_2026,
        type: 'secondary',
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
        heading: 'Što je novo pojašnjeno',
        level: 2,
        html: `<p>U Dnevniku HTV-a 21. rujna 2026. ministar gospodarstva Ante Šušnjar govorio je o novim pravilima koja se primjenjuju od 1. listopada. HRT prenosi njegovo pojašnjenje da oni koji <strong>nemaju web stranicu neće biti obvezni uvoditi je niti zbog toga izrađivati digitalni cjenik</strong>.</p>
<p>HRT također prenosi njegovu izjavu da se <strong>društvene mreže ne smatraju web stranicama</strong> pružatelja usluga ili proizvoda.</p>
<p class="news-lead-note">Ministarstvo je 22. rujna objavilo i detaljno pisano pojašnjenje: obveza vrijedi i za web stranice koje služe samo u informativne ili prezentacijske svrhe, dok se profil na društvenoj mreži ne smatra uspostavljenom mrežnom stranicom. <a href="/vijesti/ministarstvo-pojasnjenja-digitalni-cjenik-sidrene-cijene-2026/">Pročitajte nova službena pojašnjenja →</a></p>`,
      },
      {
        heading: 'Imam samo Facebook ili Instagram — što to znači?',
        level: 2,
        html: `<p>Prema navedenom pojašnjenju ministra koje prenosi HRT, sama prisutnost na Facebooku, Instagramu, TikToku ili drugoj društvenoj mreži <strong>ne znači da imate mrežnu stranicu za potrebe ove obveze</strong>.</p>
<p>Drugim riječima, ako nemate vlastitu web stranicu i poslujete samo preko društvenih mreža, ovo pojašnjenje ide u smjeru da ne morate izrađivati novu web stranicu samo zato da biste na njoj objavili CSV/XML cjenik.</p>
<p>I dalje ostaje zasebna obveza isticanja dodatne odnosno sidrene cijene iz NN 101/2026-1212 gdje se ona primjenjuje — nemojte miješati tu obvezu s obvezom objave digitalnog cjenika na webu.</p>`,
      },
      {
        heading: 'Brzi pregled: trebam li digitalni cjenik na webu?',
        level: 2,
        html: `<ul class="news-bullets">
<li><strong>Imate vlastitu web stranicu:</strong> provjerite primjenjuje li se na vas NN 101/2026-1213 i je li na webu objavljen odgovarajući CSV/XML cjenik.</li>
<li><strong>Imate samo Facebook/Instagram ili drugu društvenu mrežu:</strong> prema pojašnjenju ministra koje prenosi HRT, društvene mreže se ne smatraju web stranicom.</li>
<li><strong>Nemate web ni društvene mreže:</strong> Odluka ne propisuje da morate izrađivati novu web stranicu samo radi digitalnog cjenika.</li>
<li><strong>Imate web i na njemu objavljujete cijene:</strong> obvezu digitalnog cjenika treba provjeriti prema službenoj Odluci; CSV/XML objava je zasebna od običnog prikaza cijena u HTML-u ili PDF-u.</li>
</ul>`,
      },
      {
        heading: 'Što službena Odluka kaže',
        level: 2,
        html: `<p>Točka V. NN 101/2026-1213 propisuje da se obveza objave cjenika primjenjuje na trgovce odnosno pružatelje usluga koji imaju <strong>uspostavljene mrežne stranice</strong>.</p>
<p>Za one na koje se obveza primjenjuje Odluka dalje traži objavu važećeg cjenika u <strong>.csv ili .xml</strong> formatu pogodnom za automatsku obradu, dostupnost prethodnih verzija 30 dana i tehničko rješenje za automatizirani dohvat podataka.</p>
<p>Za detaljan pregled pročitajte <a href="/vijesti/digitalni-cjenik-sidrena-cijena-2026/"><strong>glavni vodič za digitalni cjenik od 1. listopada 2026.</strong></a></p>`,
      },
      {
        heading: 'Imate web? Provjerite ga prije 1. listopada',
        level: 2,
        html: `<p>Ako imate vlastitu mrežnu stranicu, najbrže je prvo provjeriti postoji li na njoj javno dostupan CSV/XML cjenik. Automatska provjera na ovoj stranici provjerava tehničke signale, a zatim možete učitati Excel, CSV ili HOK predložak za detaljniju provjeru i objavu.</p>
<p>Za praktičnu pripremu podataka pogledajte i <a href="/vijesti/hok-excel-predlosci-digitalni-cjenik-2026/">HOK Excel predloške</a> te <a href="/vijesti/primjer-csv-digitalnog-cjenika-usluge-2026/">primjer CSV cjenika za usluge</a>.</p>`,
      },
    ],
  },
  {
    slug: 'hok-excel-predlosci-digitalni-cjenik-2026',
    title: 'HOK objavio Excel predloške za digitalni cjenik: što obrtnici trebaju napraviti do 1. listopada',
    seoTitle: 'HOK Excel predlošci za digitalni cjenik 2026. | NEPAR',
    description:
      'HOK je objavio Excel predloške cjenika proizvoda i usluga, upute i webinar za obveze od 1.10.2026. Pogledajte što još treba objaviti na webu.',
    excerpt:
      'HOK je objavio Excel predloške, upute i webinar. Excel pomaže pripremiti podatke, ali web obveza i dalje traži CSV/XML i automatizirani dohvat.',
    readingTimeMinutes: 5,
    publishedAt: '2026-09-21T17:00:00+02:00',
    updatedAt: '2026-09-21T17:00:00+02:00',
    author: { name: 'NEPAR Publisher', url: 'https://nepar.hr/' },
    tags: ['HOK', 'Excel', 'digitalni cjenik', 'obrtnici', 'CSV', 'XML'],
    kicker: 'Aktualno · HOK',
    widgetEyebrow: 'NOVO · HOK',
    widgetHeadline: 'HOK objavio Excel predloške za digitalni cjenik',
    widgetSub: 'Što predložak rješava — i što još treba objaviti na webu',
    schemaSection: 'Aktualno',
    image: {
      src: '/og/vijesti-digitalni-cjenik-2026.png',
      alt: 'HOK Excel predlošci za digitalni cjenik i obveze od 1. listopada 2026.',
      width: 1200,
      height: 630,
    },
    cta: { label: 'Učitaj HOK Excel predložak usluga', href: '/#csv-validator' },
    secondaryCta: {
      label: 'Pogledaj primjer CSV cjenika za usluge',
      href: '/vijesti/primjer-csv-digitalnog-cjenika-usluge-2026/',
    },
    sources: [
      {
        title: 'HOK, 18.9.2026. — Dodatna cijena i objava cjenika: upute i Excel predlošci',
        url: HOK_2026,
        type: 'secondary',
      },
      {
        title: 'NN 101/2026-1213 — Odluka o objavi cjenika proizvoda i usluga',
        url: NN_1213,
        type: 'primary',
      },
      {
        title: 'NN 101/2026-1212 — Odluka o isticanju dodatne cijene',
        url: NN_1212,
        type: 'primary',
      },
    ],
    sections: [
      {
        heading: 'Što je HOK objavio',
        level: 2,
        html: `<p>Hrvatska obrtnička komora objavila je 18. rujna 2026. objedinjene upute za nove obveze od 1. listopada, snimku webinara te <strong>dva Excel predloška cjenika</strong> — jedan za proizvode i jedan za usluge.</p>
<p>Predlošci su praktična pomoć za pripremu podataka. Uz njih HOK na istoj stranici objavljuje prezentaciju, detaljne upute i tekstove odluka, pa je to koristan operativni početak za obrtnike koji tek slažu svoj cjenik.</p>`,
      },
      {
        heading: 'Excel predložak nije završna objava na webu',
        level: 2,
        html: `<p>Ovdje je važna razlika: <strong>Excel služi za pripremu podataka</strong>. HOK u svojim uputama navodi da se digitalni cjenik na mrežnoj stranici objavljuje u <strong>.csv ili .xml formatu</strong> pogodnom za automatsku obradu te da PDF, Word i Excel nisu formati koje Odluka navodi za tu web-obvezu.</p>
<p>Zato nije dovoljno samo popuniti <code>.xlsx</code> i spremiti ga na web. Potrebno je iz podataka napraviti odgovarajući CSV/XML, objaviti ga na mrežnoj stranici i osigurati tehnički način automatiziranog dohvaćanja.</p>`,
      },
      {
        heading: 'Kako HOK Excel predložak usluga koristiti u NEPAR Publisheru',
        level: 2,
        html: `<p>NEPAR sada prepoznaje standardna zaglavlja <strong>HOK predloška cjenika usluga</strong>, uključujući naziv usluge, maloprodajnu cijenu, poseban oblik prodaje, njegov naziv i sidrenu/dodatnu cijenu.</p>
<ol class="news-bullets">
<li>Preuzmite HOK predložak za usluge i unesite svoje podatke.</li>
<li>Na NEPAR Publisheru otvorite dio <strong>Učitajte Excel ili CSV</strong>.</li>
<li>Učitajte <code>.xlsx</code>; standardna HOK polja bit će predložena za mapiranje.</li>
<li>Provjerite vrijednosti i rezultate validacije.</li>
<li>Nakon provjere nastavite prema CSV/XML objavi i probnom javnom URL-u.</li>
</ol>
<p><strong>Važno:</strong> automatsko prepoznavanje u ovom flowu odnosi se na HOK predložak za <strong>usluge</strong>. Za proizvode Odluka traži širi skup podataka pa ih treba provjeriti prema HOK predlošku i službenom tekstu Odluke.</p>`,
      },
      {
        heading: 'HOK traži ukidanje odluka — znači li to da je rok odgođen?',
        level: 2,
        html: `<p>Ne treba to tako tumačiti. HOK na svojoj stranici navodi da <strong>traži ukidanje odluka</strong> o dodatnim cijenama i objavi cjenika na internetu. To je zahtjev Komore prema nadležnim tijelima, a ne samo po sebi promjena važećih pravila.</p>
<p>Na istoj aktualnoj HOK objavi i dalje se kao početak primjene navodi <strong>1. listopada 2026.</strong> Ako Vlada ili drugo nadležno tijelo službeno promijeni datum ili sadržaj obveze, ovaj ćemo vodič ažurirati.</p>`,
      },
      {
        heading: 'Što napraviti sada',
        level: 2,
        html: `<p>Ako pružate usluge i imate mrežnu stranicu, praktičan redoslijed je:</p>
<ul class="news-bullets">
<li>utvrdite aktualnu i dodatnu/sidrenu cijenu za svaku uslugu,</li>
<li>popunite HOK Excel predložak usluga,</li>
<li>provjerite podatke i pretvorite ih u strojno čitljiv CSV/XML,</li>
<li>objavite datoteku na webu i osigurajte automatizirani dohvat,</li>
<li>kod promjene cijena ažurirajte objavu u roku koji se odnosi na usluge i čuvajte prethodne verzije najmanje 30 dana.</li>
</ul>
<p><a href="/#csv-validator"><strong>Imate HOK Excel predložak? Učitajte ga za provjeru →</strong></a></p>`,
      },
      {
        heading: 'Želite vidjeti kako izgleda CSV nakon Excela?',
        level: 2,
        html: `<p>Pripremili smo i praktičan <a href="/vijesti/primjer-csv-digitalnog-cjenika-usluge-2026/"><strong>primjer CSV digitalnog cjenika za pružatelje usluga</strong></a>, s HOK-nazivima stupaca, primjerima vrijednosti i XML varijantom.</p>`,
      },
    ],
  },
  {
    slug: 'primjer-csv-digitalnog-cjenika-usluge-2026',
    title: 'Primjer CSV digitalnog cjenika za pružatelje usluga',
    seoTitle: 'Primjer CSV digitalnog cjenika za usluge 2026. | NEPAR',
    description:
      'Pogledajte praktičan primjer CSV digitalnog cjenika za usluge prema NN 101/2026-1213: obvezni podaci, sidrena cijena, CSV struktura i provjera datoteke.',
    excerpt:
      'Praktičan primjer CSV/XML cjenika usluga — obvezni podaci, sidrena cijena, preuzimanje i provjera prije objave.',
    readingTimeMinutes: 5,
    publishedAt: '2026-09-21T16:50:00+02:00',
    updatedAt: '2026-09-21T17:00:00+02:00',
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
        title: 'HOK, 18.9.2026. — upute i Excel predlošci cjenika',
        url: HOK_2026,
        type: 'secondary',
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
<p>Ako krećete iz HOK-ova Excel predloška, pogledajte i <a href="/vijesti/hok-excel-predlosci-digitalni-cjenik-2026/">što HOK predložak rješava, a što još treba objaviti na webu</a>. Opći pregled obveze i datuma početka (1. listopada 2026.) nalazi se u vodiču <a href="/vijesti/digitalni-cjenik-sidrena-cijena-2026/">Digitalni cjenik i sidrena cijena</a>.</p>`,
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
<p>Stupci <code>Poseban oblik prodaje (DA/NE)</code> i <code>Naziv posebnog oblika prodaje</code> mapiraju obvezu Odluke da se uz cijenu vidi je li usluga u posebnom obliku prodaje i pod kojim nazivom. Nazivi u ovom primjeru prate HOK predložak za usluge.</p>`,
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
<p>Obveza se primjenjuje ako imate <strong>uspostavljenu mrežnu stranicu</strong> — ne na sve subjekte bez weba. Ministar gospodarstva dodatno je javno pojasnio da oni bez web stranice ne moraju izrađivati novu te da se društvene mreže ne smatraju web stranicom; više u tekstu <a href="/vijesti/digitalni-cjenik-bez-web-stranice-drustvene-mreze/">Digitalni cjenik bez web stranice i društvene mreže</a>. Cilj je da potrošači i nadležna tijela mogu pouzdano doći do strojno čitljivog cjenika, ne samo do PDF-a ili slike.</p>`,
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
<p>Za praktičan primjer CSV/XML za usluge pogledajte <a href="/vijesti/primjer-csv-digitalnog-cjenika-usluge-2026/">Primjer CSV digitalnog cjenika za pružatelje usluga</a>.</p>`,
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
  return `/vijesti/${slug}/`
}

export { newsArticleUrl }
