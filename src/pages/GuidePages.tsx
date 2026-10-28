import { OFFICIAL_SOURCES, SitePageLayout, SourceList } from './PageLayout'
import { anchorGuide } from './anchorGuide'
import { getSitePage, SITE_PAGES } from './registry'

export function ExcelGuidePage() {
  const page = getSitePage('/vodici/excel-csv-digitalni-cjenik/')
  return (
    <SitePageLayout
      page={page}
      lead="Excel je dobar za pripremu cijena, ali ne i za objavu na webu: Odluka traži CSV ili XML na stabilnom URL-u. Ovo je put od tablice do ispravnog javnog cjenika u pet koraka."
      related={[
        { href: '/specifikacija-csv-xml/', label: 'Specifikacija CSV/XML polje po polje' },
        { href: '/vijesti/hok-excel-predlosci-digitalni-cjenik-2026/', label: 'HOK Excel predlošci: što rješavaju' },
        { href: '/faq/', label: 'Česta pitanja' },
      ]}
    >
      <section className="site-section" aria-labelledby="step1">
        <h2 id="step1">1. Pripremite tablicu</h2>
        <p>Jedan redak po usluzi ili proizvodu. Za usluge su vam potrebni naziv, maloprodajna cijena, podatak o posebnom obliku prodaje i sidrena cijena. Najlakši početak je HOK predložak za usluge: NEPAR prepoznaje njegova zaglavlja. Nazivi stupaca nisu propisani, pa prepoznajemo i druga uobičajena zaglavlja istog značenja.</p>
        <div className="site-table-wrap" role="region" aria-label="Primjer tablice" tabIndex={0}>
          <table className="site-table">
            <caption className="sr-only">Primjer stupaca u Excelu</caption>
            <thead><tr><th scope="col">Naziv usluge</th><th scope="col">Maloprodajna cijena</th><th scope="col">Poseban oblik prodaje (DA/NE)</th><th scope="col">Naziv posebnog oblika prodaje</th><th scope="col">Sidrena cijena 10.9.2026.</th></tr></thead>
            <tbody>
              <tr><td>Muško šišanje</td><td>15.00</td><td>NE</td><td></td><td>15.00</td></tr>
              <tr><td>Bojanje kose</td><td>45.00</td><td>DA</td><td>Akcija</td><td>40.00</td></tr>
            </tbody>
          </table>
        </div>
        <p>Sidrena cijena je referentna cijena iz propisanog datuma (10.9.2026.) i smije biti jednaka aktualnoj. Ako je ne znate, ne izmišljajte je: ostavite prazno pa ćete je dopuniti u validatoru.</p>
        <h3>Za cjenik proizvoda</h3>
        <p>Uz naziv, cijene i sidrenu cijenu dodajte stupce <code>Interna šifra</code>, <code>Marka</code> (ili „bez marke”), <code>Barkod</code>, <code>Jedinica</code> i <code>Cijena za jedinicu mjere</code> (gdje je primjenjivo) te <code>Dostupnost</code> (dostupno ili nedostupno). Barkod upišite kao tekst da se ne izgube početne nule. Cijeli popis stupaca je u <a href="/specifikacija-csv-xml/">specifikaciji</a>, a primjer možete preuzeti kao <a href="/examples/nepar-format-primjer-proizvodi.csv" download>CSV za proizvode</a>.</p>
      </section>

      <section className="site-section" aria-labelledby="step2">
        <h2 id="step2">2. Učitajte datoteku u validator</h2>
        <p>Otvorite <a href="/#csv-validator">validator</a> i učitajte <code>.xlsx</code> ili <code>.csv</code>. Možete i spremiti tablicu kao „CSV UTF-8” ako to radije radite sami; prepoznajemo zarez i točku-zarez kao separator. Standardna zaglavlja bit će mapirana automatski, a za ostala birate odgovarajući stupac.</p>
      </section>

      <section className="site-section" aria-labelledby="step3">
        <h2 id="step3">3. Ispravite upozorenja</h2>
        <p>Validator pokazuje što nedostaje, po retku: prazna sidrena cijena, akcijska cijena bez oznake posebnog oblika prodaje, nejasna vrsta stavke. Redak koji ne možemo uvesti (primjerice bez naziva ili cijene) označen je i blokira objavu dok ga ne ispravite, tako da nikad ne objavite tihi gubitak podataka.</p>
      </section>

      <section className="site-section" aria-labelledby="step4">
        <h2 id="step4">4. Objavite besplatno na 24 sata</h2>
        <p>Nakon provjere otvara se stvarni javni cjenik na <code>/c/vaš-slug</code> s CSV-om, XML-om i arhivom. Provjerite ih u pregledniku ili otvorite <a href="/specifikacija-csv-xml/">specifikaciju</a> i usporedite polja. Naziv datoteke generira se automatski.</p>
      </section>

      <section className="site-section" aria-labelledby="step5">
        <h2 id="step5">5. Povežite s webom i aktivirajte</h2>
        <p>Na svoju stranicu stavite poveznicu na cjenik ili ugradite cjenik jednom linijom koda (dobivate je u nadzornoj ploči, zajedno s QR kodom i prikazom za ispis). Isti link zadržite za 19,90 €/god uplatom putem 2D barkoda; bez uplate se javni URL gasi, a podaci ostaju.</p>
        <p>Kad se cijene promijene, učitajte novu verziju: stari cjenik ostaje u arhivi. S paketom Publisher nadzor svaki dan provjerava da je objava ispravna.</p>
        <p><a className="app-button app-button-primary" href="/#csv-validator">Učitaj Excel ili CSV →</a></p>
      </section>
    </SitePageLayout>
  )
}

export function WooGuidePage() {
  const page = getSitePage('/vodici/woocommerce-wordpress-digitalni-cjenik/')
  return (
    <SitePageLayout
      page={page}
      lead="Ako imate WooCommerce ili običan WordPress, postoje tri razumna puta do digitalnog cjenika. Besplatni dodatak je često dovoljan; evo kada nije."
      related={[
        { href: '/digitalni-cjenik-za-wordpress-webshop/', label: 'Web Link: digitalni cjenik za WordPress i webshop bez plugina' },
        { href: '/usporedba/', label: 'Usporedba načina objave' },
        { href: '/vodici/excel-csv-digitalni-cjenik/', label: 'Vodič: od Excela do CSV/XML-a' },
        { href: '/cijene/', label: 'Cijene' },
      ]}
    >
      <section className="site-section" aria-labelledby="opcije">
        <h2 id="opcije">Tri načina</h2>
        <div className="site-table-wrap" role="region" aria-label="Tri načina objave za WooCommerce" tabIndex={0}>
          <table className="site-table">
            <caption className="sr-only">Načini objave digitalnog cjenika za WooCommerce i WordPress</caption>
            <thead><tr><th scope="col">Način</th><th scope="col">Kada ima smisla</th><th scope="col">Na što paziti</th></tr></thead>
            <tbody>
              <tr>
                <th scope="row">Besplatni WooCommerce dodatak</th>
                <td>Web shop s mnogo proizvoda, cijene se već vode u WooCommerceu, a vi povremeno sami provjeravate izvoz.</td>
                <td>Provjerite zna li dodatak čuvati sidrenu cijenu zasebno, generira li CSV/XML i arhivu te javlja li greške. Mogućnosti se razlikuju među dodacima.</td>
              </tr>
              <tr>
                <th scope="row">Izvoz proizvoda u CSV pa validator</th>
                <td>Mali asortiman ili usluge, jednokratni ili povremeni unos, bez dodatka na stranici.</td>
                <td>Izvoz iz WooCommercea prepoznajemo bez preimenovanja stupaca; dopunite samo ono što WooCommerce nema (sidrena cijena, često marka).</td>
              </tr>
              <tr>
                <th scope="row">NEPAR Web Link ili Publisher</th>
                <td>Želite objavu neovisnu o WordPressu, bez dodatka na stranici: dobivate poveznicu za izbornik ili gumb. Publisher dodaje svakodnevnu provjeru i e-mail kad nešto nije u redu. <a href="/digitalni-cjenik-za-wordpress-webshop/">Kako to izgleda na postojećem webu</a>.</td>
                <td>Zasad održavamo jedan objekt po računu i uvoz je iz datoteke (Excel, CSV ili XML do 5 000 stavki), ne izravno iz WooCommercea.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="site-section" aria-labelledby="izvoz">
        <h2 id="izvoz">Izvoz iz WooCommercea u NEPAR validator</h2>
        <p>U WooCommerceu otvorite <em>Proizvodi → Izvezi</em> i preuzmite CSV. Učitajte ga u <a href="/#csv-validator">validator</a>: standardna zaglavlja prepoznajemo sami.</p>
        <div className="site-table-wrap" role="region" aria-label="Mapiranje stupaca" tabIndex={0}>
          <table className="site-table">
            <caption className="sr-only">Kako se stupci izvoza iz WooCommercea mapiraju u NEPAR</caption>
            <thead><tr><th scope="col">WooCommerce stupac</th><th scope="col">NEPAR polje</th></tr></thead>
            <tbody>
              <tr><td><code>Name</code></td><td>Naziv</td></tr>
              <tr><td><code>Regular price</code></td><td>Maloprodajna cijena</td></tr>
              <tr><td><code>Sale price</code></td><td>Akcijska cijena (potvrdite je li riječ o posebnom obliku prodaje)</td></tr>
              <tr><td><code>SKU</code></td><td>Šifra</td></tr>
              <tr><td><code>GTIN, UPC, EAN, or ISBN</code></td><td>Barkod (ako je polje popunjeno)</td></tr>
              <tr><td><code>In stock?</code></td><td>Dostupnost (1 = dostupno, 0 = nedostupno)</td></tr>
              <tr><td><code>Categories</code></td><td>Grupa</td></tr>
              <tr><td><code>Brands</code></td><td>Marka (ako je u izvozu)</td></tr>
              <tr><td><code>Type</code> (simple, variable…)</td><td>Vrsta: stavka se tretira kao proizvod</td></tr>
              <tr><td>(WooCommerce nema)</td><td><strong>Sidrena cijena</strong>: dodajte stupac <code>Sidrena cijena</code> s cijenom iz propisanog datuma</td></tr>
            </tbody>
          </table>
        </div>
        <p>WooCommerce nema polje za sidrenu cijenu i ne možete je izračunati iz trenutne cijene: upišite cijenu koja je vrijedila na referentni datum. Ako izvoz nema marku, validator će tražiti da je dopunite (ili upišete „bez marke”). Varijabilni proizvodi izvoze se kao zasebni redci po varijanti; provjerite da svaka ima cijenu.</p>
      </section>

      <section className="site-section" aria-labelledby="wp">
        <h2 id="wp">Prikaz cjenika na WordPress stranici</h2>
        <p>Nakon objave dobivate skriptu za ugradnju. U WordPressu dodajte blok <em>Prilagođeni HTML</em> na stranicu cjenika i zalijepite:</p>
        <pre className="news-code-sample"><code>{'<script src="https://digitalnicjenik.nepar.hr/embed.js" data-cjenik="vas-slug"></script>'}</code></pre>
        <p>Cjenik se prikazuje u okviru koji se sam prilagođava visini. Alternativa je obična poveznica na javni cjenik ili iframe. Ako tema blokira skripte u uređivaču, upotrijebite iframe koji također dobivate u nadzornoj ploči.</p>
      </section>
    </SitePageLayout>
  )
}

export function MikroGuidePage() {
  const page = getSitePage('/vodici/mikroeracun-digitalni-cjenik/')
  return (
    <SitePageLayout
      page={page}
      lead="MIKROeRAČUN i digitalni cjenik često se miješaju, a nisu povezani. Jedan je za račune, drugi za cjenik na vašem webu. Evo razlike i kako ih voditi bez dvostrukog posla."
      related={[
        { href: '/faq/', label: 'Česta pitanja' },
        { href: '/vodici/excel-csv-digitalni-cjenik/', label: 'Vodič: od Excela do CSV/XML-a' },
        { href: '/cijene/', label: 'Cijene' },
      ]}
    >
      <section className="site-section" aria-labelledby="razlika">
        <h2 id="razlika">Dvije različite obveze</h2>
        <div className="site-table-wrap" role="region" aria-label="MIKROeRAČUN i digitalni cjenik" tabIndex={0}>
          <table className="site-table">
            <caption className="sr-only">Razlika MIKROeRAČUNA i digitalnog cjenika</caption>
            <thead><tr><th scope="col"></th><th scope="col">MIKROeRAČUN</th><th scope="col">Digitalni cjenik</th></tr></thead>
            <tbody>
              <tr><th scope="row">Čemu služi</th><td>eRačuni u propisanom sustavu fiskalizacije</td><td>Javni cjenik na vašoj mrežnoj stranici u CSV/XML obliku</td></tr>
              <tr><th scope="row">Tko ga pruža</th><td>Porezna uprava (besplatno uz ispunjene uvjete)</td><td>Vi, putem alata ili dodatka</td></tr>
              <tr><th scope="row">Što se objavljuje</th><td>Računi se šalju kupcima i sustavu</td><td>Cijene javno, na webu, uz arhivu 30 dana</td></tr>
              <tr><th scope="row">Treba li vam ako imate web</th><td>Za eRačune, ovisno o vašem poslovanju</td><td>Da, ako imate mrežnu stranicu i spadate pod Odluku</td></tr>
            </tbody>
          </table>
        </div>
        <p>MIKROeRAČUN danas primarno omogućuje zaprimanje eRačuna, a izdavanje se planira od 1. 1. 2027. Ne zamjenjuje objavu cjenika.</p>
      </section>

      <section className="site-section" aria-labelledby="praksa">
        <h2 id="praksa">Kako to složiti u praksi</h2>
        <ol className="news-bullets">
          <li>Cijene držite na jednom mjestu, najčešće u Excelu ili CSV-u.</li>
          <li>Račune izdajete i primate kako vam odgovara (MIKROeRAČUN ili drugi program).</li>
          <li>Isti Excel učitate u <a href="/#csv-validator">NEPAR validator</a> i objavite kao javni CSV/XML na webu.</li>
          <li>Kad se cijene promijene, učitate novu verziju; nadzor svaki dan provjerava da je objava ispravna.</li>
        </ol>
        <p>Ako vaš poslovni program (primjerice Marketino, Minimax ili Pantheon) već objavljuje cjenik, provjerite to kod pružatelja prije nego platite drugi alat.</p>
      </section>
    </SitePageLayout>
  )
}

export function GuidesHubPage() {
  const page = getSitePage('/vodici/')
  const guides = SITE_PAGES.filter((candidate) => candidate.parent === '/vodici/')
  return (
    <SitePageLayout
      page={page}
      lead="Praktični vodiči za objavu digitalnog cjenika: odaberite izvor svojih cijena."
      related={[
        { href: '/specifikacija-csv-xml/', label: 'Specifikacija CSV/XML' },
        { href: '/faq/', label: 'Česta pitanja' },
        { href: '/vijesti/', label: 'Vijesti o regulativi' },
      ]}
    >
      <section className="site-section" aria-labelledby="popis">
        <h2 id="popis">Vodiči</h2>
        <ul className="site-card-list">
          {guides.map((guide) => (
            <li key={guide.path}>
              <a href={guide.path}><strong>{guide.title}</strong></a>
              <span>{guide.description}</span>
            </li>
          ))}
        </ul>
      </section>
    </SitePageLayout>
  )
}

export function AnchorGuidePage() {
  return <SitePageLayout page={getSitePage('/vodici/sidrena-cijena/')} lead={anchorGuide.lead} related={[
    { href: '/specifikacija-csv-xml/', label: 'Specifikacija CSV/XML' },
    { href: '/vodici/automatizacija-digitalnog-cjenika/', label: 'Automatizacija i nadzor' },
    { href: '/vodici/', label: 'Svi vodiči' },
  ]}>
    {anchorGuide.sections.map((section, index) => <section className="site-section" key={section.heading} aria-labelledby={`anchor-${index}`}><h2 id={`anchor-${index}`}>{section.heading}</h2>{section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</section>)}
    <section className="site-section" aria-labelledby="anchor-faq"><h2 id="anchor-faq">Česta pitanja o sidrenoj cijeni</h2><div className="site-faq">{anchorGuide.faq.map(([question, answer]) => <div className="site-faq-item" key={question}><h3>{question}</h3><p>{answer}</p></div>)}</div></section>
    <SourceList sources={OFFICIAL_SOURCES}/>
  </SitePageLayout>
}

export function AutomationGuidePage() {
  return <SitePageLayout page={getSitePage('/vodici/automatizacija-digitalnog-cjenika/')} lead="Automatizacija digitalnog cjenika povezuje izvor cijena, objavu i provjeru dostupnosti. NEPAR Publisher danas automatizira izradu izlaznih datoteka nakon vaše objave; preuzimanje promjena iz poslovnog programa zahtijeva zaseban izvor podataka i integraciju." related={[
    { href: '/vodici/excel-csv-digitalni-cjenik/', label: 'Priprema i uvoz datoteke' },
    { href: '/vodici/sidrena-cijena/', label: 'Sidrena cijena i referentni datumi' },
    { href: '/objava-digitalnog-cjenika/', label: 'Objava na postojećem webu' },
  ]}>
    <section className="site-section" aria-labelledby="publisher-flow"><h2 id="publisher-flow">Što Publisher već automatizira</h2><p>Učitajte Excel, CSV ili XML, pregledajte nalaze i dopunite potrebne podatke. Spremanje drafta nije javna objava: objavu pokrećete zasebnom potvrdom kada su blokade riješene.</p><p>Iz iste objavljene verzije nastaju javni web prikaz, CSV i XML. Stabilne poveznice vode na aktualnu objavu, a prethodne verzije ostaju u arhivi. Publisher generira naziv datoteke iz podataka objekta, rednog broja i vremena objave.</p><p>Promjenu cijene zasad unosite ili uvozite i ponovno objavljujete. AutoSync nije dostupan kao postojeća funkcija proizvoda.</p></section>
    <section className="site-section" aria-labelledby="source-flow"><h2 id="source-flow">Vaš izvor podataka i integracija</h2><p>ERP, POS, webshop, poslovni program ili Excel mogu biti izvor cijena. Najprije provjerite može li sustav izvesti potrebne podatke, uključujući stvarne referentne cijene. Trenutna cijena i napomena nisu zamjena za povijesnu evidenciju.</p><p>Automatsko preuzimanje putem API-ja, webhooka ili raspoređenog izvoza ovisi o mogućnostima vašeg sustava i zasebno dogovorenoj integraciji. Publisher nema univerzalni priključak koji sam prati svaki ERP ili WooCommerce.</p></section>
    <section className="site-section" aria-labelledby="monitor-flow"><h2 id="monitor-flow">Što periodični nadzor provjerava</h2><p>Nadzor provjerava objavljene podatke, dostupnost feedova, podudaranje datoteka i arhivu te bilježi rezultate i upozorenja. Provjera se može pokrenuti i ručno u nadzornoj ploči.</p><p>Nadzor ne preuzima nove cijene iz vašeg poslovnog programa i ne objavljuje promjene umjesto vas. Tehnički uredan rezultat ne potvrđuje da su unesene cijene stvarno primjenjive niti daje pravnu potvrdu usklađenosti.</p></section>
    <section className="site-section" aria-labelledby="web-flow"><h2 id="web-flow">WordPress, Wix, React i drugi webovi</h2><p>Postojeći web može prikazivati javni cjenik poveznicom ili ugradnjom. Sustav u kojem vodite cijene i web stranica mogu ostati odvojeni. Prije povezivanja provjerite izvor podataka, potrebne pristupe i učestalost promjena.</p><p>Stvarni NEPAR cjenik ostaje na <a href="https://nepar.hr/cjenik">nepar.hr/cjenik</a>. Primjeri Publishera ne zamjenjuju taj cjenik.</p></section>
    <SourceList sources={OFFICIAL_SOURCES}/>
  </SitePageLayout>
}
