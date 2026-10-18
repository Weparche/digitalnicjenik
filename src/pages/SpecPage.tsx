import { renderCsv } from '../price-engine/csv'
import { renderXml } from '../price-engine/xml'
import { NEPAR_FORMAT_EXAMPLE, NEPAR_PRODUCT_FORMAT_EXAMPLE } from './formatExample'
import { OFFICIAL_SOURCES, SitePageLayout, SourceList } from './PageLayout'
import { getSitePage } from './registry'

export const CSV_COLUMNS = [
  { column: 'Grupa', required: 'Ne', odluka: 'Grupiranje stavki', example: 'Šišanje', note: 'Kategorija ili skupina usluge/proizvoda.' },
  { column: 'Naziv', required: 'Da', odluka: 'Naziv usluge / proizvoda', example: 'Muško šišanje', note: 'Obavezno polje.' },
  { column: 'Vrsta', required: 'Da (inače ručni pregled)', odluka: 'Razlikovanje proizvoda i usluge', example: 'Usluga', note: 'Određuje koja se pravila primjenjuju (usluga ili proizvod).' },
  { column: 'Interna šifra', required: 'Ne (preporučeno)', odluka: 'Šifra (proizvodi)', example: 'FR-001', note: 'Vaša šifra stavke.' },
  { column: 'Cijena', required: 'Da', odluka: 'Maloprodajna cijena', example: '15.00', note: 'Dvije decimale, točka kao decimalni separator, EUR.' },
  { column: 'Akcijska cijena', required: 'Ne', odluka: 'Cijena u posebnom obliku prodaje', example: '12.00', note: 'Prazno ako nema akcije.' },
  { column: 'Poseban oblik prodaje', required: 'Kad ima akcijsku cijenu', odluka: 'Podatak o posebnom obliku prodaje', example: 'NE', note: 'DA ili NE.' },
  { column: 'Naziv posebnog oblika prodaje', required: 'Ako je DA', odluka: 'Naziv posebnog oblika prodaje', example: 'Jesenska akcija', note: 'Obavezno kad je oblik prodaje DA.' },
  { column: 'Sidrena cijena', required: 'Da za usluge', odluka: 'Dodatna (sidrena) cijena', example: '15.00', note: 'Referentna cijena iz propisanog datuma; može biti jednaka aktualnoj.' },
  { column: 'Jedinica', required: 'Ne', odluka: 'Jedinica mjere (proizvodi)', example: 'kom', note: 'Za proizvode gdje se primjenjuje.' },
]

export const PRODUCT_CSV_COLUMNS = [
  { column: 'Marka', required: 'Da (može „bez marke”)', odluka: 'Marka', example: 'Primjer mljekara', note: 'Upišite „bez marke” ako je proizvod nema.' },
  { column: 'Barkod', required: 'Upozorenje ako nedostaje ili nije valjan', odluka: 'Barkod robe', example: '4006381333931', note: 'EAN-8, UPC-A, EAN-13 ili GTIN-14 s ispravnom kontrolnom znamenkom, bez razmaka.' },
  { column: 'Cijena za jedinicu mjere', required: 'Upozorenje ako je jedinica navedena, a cijena nije', odluka: 'Cijena za jedinicu mjere (gdje je primjenjivo)', example: '1.98', note: 'Uz stupac Jedinica (primjerice kg ili l).' },
  { column: 'Dostupnost', required: 'Da', odluka: 'Dostupno / nedostupno', example: 'dostupno', note: 'Vrijednosti: dostupno ili nedostupno.' },
]

export const XML_ELEMENTS = [
  { element: 'priceList / business / name', meaning: 'Naziv poslovnog subjekta', example: 'Primjer frizerski salon' },
  { element: 'priceList / source, updatedAt', meaning: 'Izvor podataka i vrijeme objave', example: 'nepar, 2026-11-17T05:30:00.000Z' },
  { element: 'item / category', meaning: 'Grupa', example: 'Šišanje' },
  { element: 'item / name', meaning: 'Naziv usluge ili proizvoda', example: 'Muško šišanje' },
  { element: 'item / type', meaning: 'Vrsta (usluga ili proizvod)', example: 'Usluga' },
  { element: 'item / price (currency="EUR")', meaning: 'Maloprodajna cijena', example: '15.00' },
  { element: 'item / salePrice (currency="EUR")', meaning: 'Cijena u posebnom obliku prodaje (ako postoji)', example: '12.00' },
  { element: 'item / specialSaleApplied', meaning: 'Je li primijenjen poseban oblik prodaje', example: 'true' },
  { element: 'item / specialSaleName', meaning: 'Naziv posebnog oblika prodaje', example: 'Jesenska akcija' },
  { element: 'item / anchorPrice (currency="EUR")', meaning: 'Dodatna (sidrena) cijena', example: '15.00' },
]

export const PRODUCT_XML_ELEMENTS = [
  { element: 'item / externalId', meaning: 'Šifra proizvoda', example: 'MLI-001' },
  { element: 'item / brand', meaning: 'Marka', example: 'Primjer mljekara' },
  { element: 'item / barcode', meaning: 'Barkod robe', example: '4006381333931' },
  { element: 'item / unit', meaning: 'Jedinica mjere', example: 'l' },
  { element: 'item / unitPrice (currency="EUR")', meaning: 'Cijena za jedinicu mjere', example: '1.19' },
  { element: 'item / availability', meaning: 'Dostupno ili nedostupno', example: 'dostupno' },
]

export const CHECKS = [
  { check: 'Dostupnost', detail: 'CSV i XML vraćaju HTTP 200 na stabilnom URL-u.' },
  { check: 'Broj stavki', detail: 'Broj redaka u CSV-u i XML-u jednak je broju stavki u objavljenom cjeniku.' },
  { check: 'Sadržaj', detail: 'Naziv i cijena u datotekama podudaraju se s objavljenim cjenikom.' },
  { check: 'Naziv datoteke', detail: 'Odgovara trenutnoj objavi i propisanom obliku (dva zasebna signala).' },
  { check: 'Obvezna polja', detail: 'Po profilu (proizvodi ili usluge), s brojem stavki kojima polje nedostaje.' },
  { check: 'Arhiva', detail: 'Sve objave iz zadnjih 30 dana su dostupne; provjerava se najnovija i najstarija arhivirana datoteka.' },
  { check: 'Aktualnost', detail: 'Za proizvode: postoji li objava za zadnji radni dan (upozorenje, ne greška). Za usluge se ne očekuje dnevna objava.' },
]

const exampleCsv = renderCsv(NEPAR_FORMAT_EXAMPLE).replace(/^﻿/, '')
const exampleXml = renderXml(NEPAR_FORMAT_EXAMPLE)
const exampleProductCsv = renderCsv(NEPAR_PRODUCT_FORMAT_EXAMPLE).replace(/^\uFEFF/, '')

export function SpecPage() {
  const page = getSitePage('/specifikacija-csv-xml/')
  return (
    <SitePageLayout
      page={page}
      lead={
        <>
          Odluka NN 101/2026 propisuje <strong>podatke</strong> koje cjenik mora sadržavati, ali ne nazive stupaca, separator ni kodiranje.
          Ovdje je točno kako izgleda NEPAR CSV i XML, kako se zove datoteka i što provjeravamo svaki dan.
        </>
      }
      related={[
        { href: '/faq/', label: 'Česta pitanja o obvezi' },
        { href: '/vodici/excel-csv-digitalni-cjenik/', label: 'Vodič: od Excela do CSV/XML-a' },
        { href: '/usporedba/', label: 'Usporedba načina objave' },
        { href: '/vijesti/primjer-csv-digitalnog-cjenika-usluge-2026/', label: 'Primjer CSV-a za usluge (HOK stil)' },
      ]}
    >
      <section className="site-section" aria-labelledby="odluka-title">
        <h2 id="odluka-title">Što propisuje Odluka</h2>
        <ul className="news-bullets">
          <li><strong>Format:</strong> važeći cjenik na mrežnoj stranici u <code>.csv</code> ili <code>.xml</code> obliku, uz mogućnost automatiziranog dohvata.</li>
          <li><strong>Usluge:</strong> naziv usluge, maloprodajna cijena, podatak o posebnom obliku prodaje (i njegov naziv) te sidrena odnosno dodatna cijena.</li>
          <li><strong>Proizvodi:</strong> među ostalim naziv, šifra, marka, maloprodajna i sidrena cijena, posebni oblik prodaje, barkod i dostupnost.</li>
          <li><strong>Naziv datoteke:</strong> oblik prodajnog odnosno uslužnog objekta, adresa, oznaka objekta, broj pohrane i vremenska oznaka.</li>
          <li><strong>Arhiva:</strong> prethodno objavljeni cjenici dostupni su najmanje 30 dana.</li>
          <li><strong>Rok primjene:</strong> 17. studenoga 2026. Referentni datum sidrene cijene je 10. rujna 2026. (za ranije obuhvaćene skupine proizvoda 2. svibnja 2025.).</li>
        </ul>
        <p className="news-lead-note">
          Ovo je sažetak, ne zamjena za službeni tekst. Dva nacrta pravilnika su na e-Savjetovanju do 13.11.2026.; NEPAR će profil provjere uskladiti s konačnim tekstom.
        </p>
      </section>

      <section className="site-section" aria-labelledby="csv-title">
        <h2 id="csv-title">NEPAR CSV: stupci</h2>
        <p>Kodiranje UTF-8 (s BOM-om), separator zarez, kraj retka CRLF, decimalna točka. Pri uvozu prepoznajemo i točku-zarez te uobičajena zaglavlja (uključujući HOK predložak za usluge).</p>
        <div className="site-table-wrap" role="region" aria-label="Stupci CSV-a" tabIndex={0}>
          <table className="site-table">
            <caption className="sr-only">Stupci NEPAR CSV formata</caption>
            <thead>
              <tr><th scope="col">Stupac</th><th scope="col">Validator traži</th><th scope="col">Polje iz Odluke</th><th scope="col">Primjer</th><th scope="col">Napomena</th></tr>
            </thead>
            <tbody>
              {CSV_COLUMNS.map((row) => (
                <tr key={row.column}>
                  <th scope="row"><code>{row.column}</code></th>
                  <td>{row.required}</td>
                  <td>{row.odluka}</td>
                  <td><code>{row.example}</code></td>
                  <td>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3>Primjer CSV-a za usluge</h3>
        <pre className="news-code-sample"><code>{exampleCsv}</code></pre>
        <h3>Dodatni stupci za cjenik proizvoda</h3>
        <p>Čim cjenik sadrži barem jednu stavku koja nije usluga, CSV i XML dobivaju prošireni oblik s ovim stupcima. Cjenik koji sadrži samo usluge ostaje u kompaktnom obliku. Odluka traži jedinstvenu strukturu, pa se oblik odabire za cijeli cjenik.</p>
        <div className="site-table-wrap" role="region" aria-label="Stupci za cjenik proizvoda" tabIndex={0}>
          <table className="site-table">
            <caption className="sr-only">Dodatni stupci NEPAR CSV formata za proizvode</caption>
            <thead>
              <tr><th scope="col">Stupac</th><th scope="col">Validator traži</th><th scope="col">Polje iz Odluke</th><th scope="col">Primjer</th><th scope="col">Napomena</th></tr>
            </thead>
            <tbody>
              {PRODUCT_CSV_COLUMNS.map((row) => (
                <tr key={row.column}>
                  <th scope="row"><code>{row.column}</code></th>
                  <td>{row.required}</td>
                  <td>{row.odluka}</td>
                  <td><code>{row.example}</code></td>
                  <td>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>Za proizvode su uz to obavezni i šifra (<code>Interna šifra</code>) te sidrena cijena. Nedostajuća šifra, marka, dostupnost ili sidrena cijena zaustavljaju objavu dok se ne dopune.</p>
        <h3>Primjer CSV-a za proizvode</h3>
        <pre className="news-code-sample"><code>{exampleProductCsv}</code></pre>
      </section>

      <section className="site-section" aria-labelledby="xml-title">
        <h2 id="xml-title">NEPAR XML: elementi</h2>
        <div className="site-table-wrap" role="region" aria-label="Elementi XML-a" tabIndex={0}>
          <table className="site-table">
            <caption className="sr-only">Elementi NEPAR XML formata</caption>
            <thead>
              <tr><th scope="col">Element</th><th scope="col">Značenje</th><th scope="col">Primjer</th></tr>
            </thead>
            <tbody>
              {XML_ELEMENTS.map((row) => (
                <tr key={row.element}>
                  <th scope="row"><code>{row.element}</code></th>
                  <td>{row.meaning}</td>
                  <td><code>{row.example}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3>Dodatni elementi za cjenik proizvoda</h3>
        <div className="site-table-wrap" role="region" aria-label="Elementi XML-a za proizvode" tabIndex={0}>
          <table className="site-table">
            <caption className="sr-only">Dodatni elementi NEPAR XML formata za proizvode</caption>
            <thead>
              <tr><th scope="col">Element</th><th scope="col">Značenje</th><th scope="col">Primjer</th></tr>
            </thead>
            <tbody>
              {PRODUCT_XML_ELEMENTS.map((row) => (
                <tr key={row.element}>
                  <th scope="row"><code>{row.element}</code></th>
                  <td>{row.meaning}</td>
                  <td><code>{row.example}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>Isto vrijedi i za XML: cjenik koji sadrži proizvode dobiva ove elemente, a čisti cjenik usluga ostaje kompaktan.</p>
        <h3>Primjer XML-a za usluge</h3>
        <pre className="news-code-sample"><code>{exampleXml}</code></pre>
      </section>

      <section className="site-section" aria-labelledby="filename-title">
        <h2 id="filename-title">Naziv datoteke</h2>
        <p>Naziv se generira automatski iz podataka o objektu i broja objave, malim slovima bez dijakritika:</p>
        <pre className="news-code-sample"><code>{'<oblik-objekta>_<adresa>_<oznaka-objekta>_<broj-objave>_<GGGGMMDD-HHMMSS>.csv'}</code></pre>
        <p>Primjer: <code>usluzni-objekt_ulica-1_p-01_8_20261117-064500.csv</code>. Stabilni URL (<code>/cjenik.csv</code>) uvijek poslužuje trenutačnu objavu, a naziv datoteke šalje u zaglavlju odgovora; prethodne objave ostaju na vlastitim URL-ovima u arhivi.</p>
      </section>

      <section id="pokrivenost" className="site-section" aria-labelledby="coverage-title">
        <h2 id="coverage-title">Što NEPAR podržava: usluge i proizvodi</h2>
        <div className="site-table-wrap" role="region" aria-label="Podrška po vrsti cjenika" tabIndex={0}>
          <table className="site-table">
            <caption className="sr-only">Podrška obveznim poljima po vrsti cjenika</caption>
            <thead>
              <tr><th scope="col">Vrsta cjenika</th><th scope="col">Podrška</th><th scope="col">Detalji</th></tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Usluge (čl. IV)</th>
                <td><span aria-hidden="true">✓</span> Puna podrška</td>
                <td>Naziv usluge, maloprodajna cijena, poseban oblik prodaje (i naziv) i sidrena cijena, uz provjeru i dnevni nadzor.</td>
              </tr>
              <tr>
                <th scope="row">Proizvodi (čl. III)</th>
                <td><span aria-hidden="true">✓</span> Podržana polja iz Odluke</td>
                <td>Naziv, šifra, marka, jedinica mjere i cijena za jedinicu mjere (gdje je primjenjivo), maloprodajna cijena s posebnim oblikom prodaje, sidrena cijena, barkod i dostupnost. Uvoz iz Excela, CSV-a ili XML-a, do 5 000 stavki po cjeniku.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>Podatke učitavate iz Excela, CSV-a ili XML-a (prepoznajemo i izvoz iz WooCommercea). Automatski uvoz izravno iz ERP-a ili blagajne zasad nemamo.</p>
      </section>

      <section className="site-section" aria-labelledby="checks-title">
        <h2 id="checks-title">Što provjeravamo svaki dan</h2>
        <p>Nadzor se pokreće svaki dan rano ujutro, uz ponovnu provjeru prije 8:00 za sve što nije bilo u redu. Svaka provjera bilježi koja je verzija pravila korištena (trenutačno <code>nn-101-2026</code>).</p>
        <div className="site-table-wrap" role="region" aria-label="Provjere nadzora" tabIndex={0}>
          <table className="site-table">
            <caption className="sr-only">Provjere koje nadzor izvodi</caption>
            <thead><tr><th scope="col">Provjera</th><th scope="col">Što znači</th></tr></thead>
            <tbody>
              {CHECKS.map((row) => (
                <tr key={row.check}><th scope="row">{row.check}</th><td>{row.detail}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>Kritične greške (nedostupna datoteka, krivi broj stavki ili sadržaj, nedostupna arhiva) šalju e-mail; ostalo vidite u nadzornoj ploči. Ovo je tehnička evidencija objave, ne pravni dokaz usklađenosti.</p>
      </section>

      <section className="site-section" aria-labelledby="download-title">
        <h2 id="download-title">Preuzmite primjere</h2>
        <ul className="news-bullets">
          <li><a href="/examples/nepar-format-primjer-usluge.csv" download>NEPAR format — CSV za usluge</a></li>
          <li><a href="/examples/nepar-format-primjer-usluge.xml" download>NEPAR format — XML za usluge</a></li>
          <li><a href="/examples/nepar-format-primjer-proizvodi.csv" download>NEPAR format — CSV za proizvode</a></li>
          <li><a href="/examples/nepar-format-primjer-proizvodi.xml" download>NEPAR format — XML za proizvode</a></li>
          <li><a href="/examples/primjer-digitalni-cjenik-usluge-2026.csv" download>HOK stil — CSV za usluge (točka-zarez)</a></li>
          <li><a href="/examples/primjer-digitalni-cjenik-usluge-2026.xml" download>HOK stil — XML za usluge</a></li>
        </ul>
        <p><a href="/#csv-validator"><strong>Provjerite svoju datoteku →</strong></a></p>
      </section>

      <SourceList sources={OFFICIAL_SOURCES} />
    </SitePageLayout>
  )
}
