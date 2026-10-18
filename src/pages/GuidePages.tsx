import { SitePageLayout } from './PageLayout'
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
        <p>Jedan redak po usluzi ili proizvodu. Za usluge su vam potrebni naziv, maloprodajna cijena, podatak o posebnom obliku prodaje i sidrena cijena. Najlakši početak je HOK predložak za usluge: NEPAR prepoznaje njegova zaglavlja.</p>
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
        <h2 id="step4">4. Objavite probno 7 dana</h2>
        <p>Nakon provjere otvara se stvarni javni cjenik na <code>/c/vaš-slug</code> s CSV-om, XML-om i arhivom. Provjerite ih u pregledniku ili otvorite <a href="/specifikacija-csv-xml/">specifikaciju</a> i usporedite polja. Naziv datoteke generira se automatski.</p>
      </section>

      <section className="site-section" aria-labelledby="step5">
        <h2 id="step5">5. Povežite s webom i aktivirajte</h2>
        <p>Na svoju stranicu stavite poveznicu na cjenik ili ugradite cjenik jednom linijom koda (dobivate je u nadzornoj ploči, zajedno s QR kodom i prikazom za ispis). Ako ne aktivirate Publisher u 7 dana, javni URL se gasi, a podaci ostaju.</p>
        <p>Kad se cijene promijene, učitajte novu verziju: stari cjenik ostaje u arhivi, a nadzor svaki dan provjerava da je objava ispravna.</p>
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
                <td>Izvoz iz WooCommercea ima druga imena stupaca; preimenujte ih prema tablici ispod.</td>
              </tr>
              <tr>
                <th scope="row">NEPAR Publisher</th>
                <td>Želite objavu neovisnu o WordPressu, svakodnevnu provjeru i e-mail kad nešto nije u redu.</td>
                <td>Zasad održavamo jedan objekt po računu, a format još ne nosi marku, barkod i dostupnost proizvoda.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="site-section" aria-labelledby="izvoz">
        <h2 id="izvoz">Izvoz iz WooCommercea u NEPAR validator</h2>
        <p>U WooCommerceu otvorite <em>Proizvodi → Izvezi</em> i preuzmite CSV. Prije učitavanja preimenujte stupce:</p>
        <div className="site-table-wrap" role="region" aria-label="Mapiranje stupaca" tabIndex={0}>
          <table className="site-table">
            <caption className="sr-only">Mapiranje stupaca iz WooCommercea</caption>
            <thead><tr><th scope="col">WooCommerce stupac</th><th scope="col">NEPAR stupac</th></tr></thead>
            <tbody>
              <tr><td><code>Name</code></td><td><code>Naziv</code></td></tr>
              <tr><td><code>Regular price</code></td><td><code>Cijena</code></td></tr>
              <tr><td><code>Sale price</code></td><td><code>Akcijska cijena</code> (prepoznaje se i engleski naziv)</td></tr>
              <tr><td><code>SKU</code></td><td><code>Interna šifra</code></td></tr>
              <tr><td><code>Categories</code></td><td><code>Grupa</code></td></tr>
              <tr><td>(nema)</td><td><code>Sidrena cijena</code>: dodajte stupac s cijenom iz propisanog datuma</td></tr>
            </tbody>
          </table>
        </div>
        <p>WooCommerce nema polje za sidrenu cijenu: morate je dodati sami (iz povijesti cijena na referentni datum) jer se ne može izračunati iz trenutne cijene. Zatim učitajte datoteku u <a href="/#csv-validator">validator</a>.</p>
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
