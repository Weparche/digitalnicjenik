import { selfServicePriceLabel } from '../publisherPricing'
import { SitePageLayout } from './PageLayout'
import { getSitePage } from './registry'

type Cell = { text: string; tone: 'yes' | 'partial' | 'no' }
const yes = (text = 'Da'): Cell => ({ text, tone: 'yes' })
const partial = (text: string): Cell => ({ text, tone: 'partial' })
const no = (text = 'Ne'): Cell => ({ text, tone: 'no' })

type Row = { feature: string; why: string; cells: [Cell, Cell, Cell, Cell] }

export const COMPARE_COLUMNS = ['NEPAR Publisher', 'Besplatni publisher', 'WooCommerce / WordPress dodatak', 'Ručna objava'] as const

export const COMPARE_ROWS: Row[] = [
  { feature: 'CSV/XML objava', why: 'Osnovna obveza: strojno čitljiv cjenik na webu.', cells: [yes(), yes(), yes(), yes('Da, ručno')] },
  { feature: 'Stabilni javni URL za dohvat', why: 'Poveznica se ne mijenja pri svakoj promjeni cijena.', cells: [yes(), yes(), yes(), partial('Ovisi o vama')] },
  { feature: 'Radi bez WordPressa i WooCommercea', why: 'Cjenik ne ovisi o tome na čemu je web napravljen.', cells: [yes(), yes(), no(), yes()] },
  { feature: 'Automatska provjera objave', why: 'Netko provjerava da je datoteka stvarno dostupna i ispravna.', cells: [yes('Da, svaki dan'), partial('Djelomično'), partial('Ovisi o dodatku'), no('Ne, provjeravate sami')] },
  { feature: 'Alarm e-mailom kad nešto nije u redu', why: 'Saznajete za grešku prije inspekcije ili kupca.', cells: [yes(), partial('Ovisi o alatu'), partial('Ovisi o dodatku'), no()] },
  { feature: 'Usporedba objavljene datoteke s izvornim podacima', why: 'Hvata slučaj kad je datoteka dostupna, ali s pogrešnim ili nepotpunim sadržajem.', cells: [yes(), no('Nije javno dokumentirano'), no('Nije javno dokumentirano'), no()] },
  { feature: 'Verzionirana pravila (spremno za novi pravilnik)', why: 'Pravila se mijenjaju; provjera se prilagođava bez prepravljanja cijelog sustava.', cells: [yes(), no('Nije javno dokumentirano'), no('Nije javno dokumentirano'), no()] },
  { feature: 'Arhiva prethodnih objava (30 dana)', why: 'Propis traži dostupnost prethodnih cjenika najmanje 30 dana.', cells: [yes(), partial('Ovisi o alatu'), partial('Ovisi o dodatku'), partial('Ručno')] },
  { feature: 'QR kod i ispis na A4', why: 'Isti podaci za ispis u poslovnici i na webu.', cells: [yes(), partial('Ovisi o alatu'), no(), partial('Ručno')] },
  { feature: 'Ugradnja cjenika u postojeći web (embed)', why: 'Cjenik se prikazuje na vašoj stranici bez prepisivanja.', cells: [yes(), partial('Ovisi o alatu'), partial('Ovisi o dodatku'), partial('Ručno')] },
  { feature: 'Uvoz iz Excela ili CSV-a', why: 'Ne morate cijene unositi dvaput.', cells: [yes(), partial('Ovisi o alatu'), partial('Izvoz iz WooCommercea'), no('Ručni unos')] },
  { feature: 'Cijena', why: 'Ukupni trošak, bez vašeg vremena.', cells: [yes(selfServicePriceLabel()), partial('Najčešće 0 €'), partial('Od 0 € do plaćenih licenci'), partial('0 € + vaše vrijeme')] },
]

const MARK = { yes: '✓', partial: '◐', no: '—' } as const

function CellView({ cell }: { cell: Cell }) {
  return (
    <td className={`site-cell site-cell-${cell.tone}`}>
      <span aria-hidden="true">{MARK[cell.tone]}</span> {cell.text}
    </td>
  )
}

export function ComparePage() {
  const page = getSitePage('/usporedba/')
  return (
    <SitePageLayout
      page={page}
      lead="Većina alata i dodataka objavi CSV/XML. NEPAR prati objavu i pravila nakon što je datoteka generirana, umjesto da služi samo za jednokratno stvaranje CSV/XML-a. Ovdje je, bez naziva konkurenata, što pokriva koji način."
      related={[
        { href: '/cijene/', label: 'Cijene' },
        { href: '/specifikacija-csv-xml/', label: 'Što točno provjeravamo (specifikacija)' },
        { href: '/vodici/woocommerce-wordpress-digitalni-cjenik/', label: 'Vodič za WooCommerce i WordPress' },
        { href: '/faq/', label: 'Česta pitanja' },
      ]}
    >
      <section className="site-section" aria-labelledby="matrix-title">
        <h2 id="matrix-title">Usporedna tablica</h2>
        <div className="site-table-wrap" role="region" aria-label="Usporedna tablica, pomaknite vodoravno na malim zaslonima" tabIndex={0}>
          <table className="site-table site-compare">
            <caption className="sr-only">Usporedba načina objave digitalnog cjenika</caption>
            <thead>
              <tr>
                <th scope="col">Funkcija</th>
                {COMPARE_COLUMNS.map((column) => (
                  <th key={column} scope="col" className={column === 'NEPAR Publisher' ? 'site-col-primary' : undefined}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row) => (
                <tr key={row.feature}>
                  <th scope="row">{row.feature}<small>{row.why}</small></th>
                  {row.cells.map((cell, index) => <CellView key={COMPARE_COLUMNS[index]} cell={cell} />)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="site-note">
          ✓ da · ◐ djelomično ili ovisi o konkretnom alatu · — ne. „Nije javno dokumentirano” znači da tu mogućnost ne nalazimo u javnim opisima, ne da je alat nema. „Besplatni publisher” i „dodatak” su kategorije, ne pojedinačni proizvodi: mogućnosti se razlikuju i mijenjaju, pa prije odluke provjerite konkretan alat. Stupci o drugim načinima temelje se na javno dostupnim opisima u listopadu 2026.
        </p>
      </section>

      <section className="site-section" aria-labelledby="why-title">
        <h2 id="why-title">Zašto bi netko platio kad postoje besplatni alati?</h2>
        <p>
          Zato što objaviti datoteku nije isto što i imati ispravan cjenik svaki dan. Datoteka može biti dostupna, a imati pogrešan broj stavki, krivi naziv, praznu sidrenu cijenu ili arhivu koja je prestala raditi.
          Besplatni alat vam daje datoteku. Publisher dodaje svakodnevnu provjeru te e-mail čim nešto nije u redu, uz arhivu, QR i ugradnju na web.
        </p>
        <p>
          Ako vam je dovoljan jednostavan alat i sami ćete povremeno otvoriti svoj URL, to je potpuno prihvatljiv izbor.
          Ako ne želite saznati za grešku od kupca ili nadzora, nadzor je ono što plaćate.
        </p>
      </section>

      <section className="site-section" aria-labelledby="fit-title">
        <h2 id="fit-title">Kada vam NEPAR nije najbolji izbor</h2>
        <ul className="news-bullets">
          <li><strong>Imate WooCommerce i dovoljan vam je besplatni dodatak.</strong> Ako je dodatak pouzdan i sami provjeravate izvoz, ne trebate nas.</li>
          <li><strong>Vaš ERP ili blagajna već objavljuje cjenik.</strong> Provjerite kod pružatelja prije kupnje; mi smo sloj za one kojima to nitko ne radi.</li>
          <li><strong>Imate lanac s mnogo poslovnica.</strong> Zasad održavamo jedan objekt po računu. Višelokacijski rad još nemamo; javite se ako vam je presudan.</li>
          <li><strong>Imate izravnu vezu s ERP-om ili blagajnom.</strong> Zasad učitavate Excel, CSV ili XML (do 5 000 stavki po cjeniku); automatski uvoz iz sustava još nemamo. Podržana polja za usluge i proizvode opisana su u <a href="/specifikacija-csv-xml/#pokrivenost">specifikaciji</a>.</li>
        </ul>
      </section>
    </SitePageLayout>
  )
}
