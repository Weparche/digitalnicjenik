import {
  formatEur,
  IMPLEMENTATION_FIRST_YEAR_EUR,
  LAUNCH_ACTIVATED_SUBSCRIPTIONS_CAP,
  LAUNCH_ACTIVE,
  LAUNCH_SELF_SERVICE_EUR,
  REGULAR_SELF_SERVICE_EUR,
} from '../publisherPricing'
import { SitePageLayout } from './PageLayout'
import { getSitePage } from './registry'

export const PRICING_INCLUDED = [
  'Validator Excel, CSV i XML cjenika usluga i proizvoda s popisom što nedostaje (za proizvode i šifra, marka, barkod, dostupnost)',
  'Javni cjenik na stabilnom URL-u, CSV i XML s propisanim nazivom datoteke',
  'Arhiva prethodnih objava (najmanje 30 dana od zamjene)',
  'Svakodnevni nadzor usklađenosti i e-mail upozorenje kad nešto nije u redu',
  'QR kod, prikaz za ispis na A4 (spremanje u PDF iz preglednika) i skripta za ugradnju na vaš web',
  'Pravila verzionirana prema važećem propisu, pa se prilagođavaju novom pravilniku',
]

export function PricingPage() {
  const page = getSitePage('/cijene/')
  const launch = formatEur(LAUNCH_SELF_SERVICE_EUR, true)
  const regular = formatEur(REGULAR_SELF_SERVICE_EUR, true)
  const setup = formatEur(IMPLEMENTATION_FIRST_YEAR_EUR)
  return (
    <SitePageLayout
      page={page}
      lead={
        <>
          Provjera i validacija su besplatne. Javni cjenik s nadzorom košta {LAUNCH_ACTIVE ? <><strong>{launch}</strong> (akcija za prvih {LAUNCH_ACTIVATED_SUBSCRIPTIONS_CAP} aktiviranih pretplata), zatim {regular}</> : <strong>{regular}</strong>}. Bez mjesečne pretplate.
        </>
      }
      related={[
        { href: '/usporedba/', label: 'Usporedba s besplatnim alatima i dodacima' },
        { href: '/faq/', label: 'Česta pitanja' },
        { href: '/specifikacija-csv-xml/', label: 'Specifikacija CSV/XML' },
      ]}
    >
      <section className="site-section" aria-labelledby="plans-title">
        <h2 id="plans-title">Paketi</h2>
        <div className="site-table-wrap">
          <table className="site-table">
            <caption className="sr-only">Paketi i cijene NEPAR Publishera</caption>
            <thead>
              <tr>
                <th scope="col">Paket</th>
                <th scope="col">Cijena</th>
                <th scope="col">Što dobivate</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Provjera i validator</th>
                <td><strong>0 €</strong></td>
                <td>Provjera postoji li CSV/XML na vašem webu, validacija Excela, CSV-a i XML-a, pretvorba Excela u CSV/XML. Ništa se ne objavljuje javno.</td>
              </tr>
              <tr>
                <th scope="row">Probni rok 7 dana</th>
                <td><strong>0 €</strong></td>
                <td>Stvarni javni cjenik na vašem URL-u (<code>/c/vaš-slug</code>) s CSV/XML-om i nadzornom pločom. Nakon 7 dana URL se gasi ako ne aktivirate Publisher; podaci ostaju.</td>
              </tr>
              <tr>
                <th scope="row">Publisher self-service</th>
                <td>
                  <strong>{LAUNCH_ACTIVE ? launch : regular}</strong>
                  {LAUNCH_ACTIVE && <small>akcija za prvih {LAUNCH_ACTIVATED_SUBSCRIPTIONS_CAP} aktiviranih pretplata, zatim {regular}</small>}
                </td>
                <td>Sve iz popisa ispod. Cjenik održavate sami: učitate novu verziju kad se cijene promijene.</td>
              </tr>
              <tr>
                <th scope="row">Publisher + postavljanje</th>
                <td>
                  <strong>{setup}</strong>
                  <small>prva godina, zatim {regular}</small>
                </td>
                <td>NEPAR ugrađuje cjenik na vašu web stranicu i povezuje ga s izvorom podataka. Prva godina Publishera uključena.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="site-section" aria-labelledby="included-title">
        <h2 id="included-title">Što uključuje Publisher</h2>
        <ul className="news-bullets">
          {PRICING_INCLUDED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>
          Besplatni alati i dodaci objavljuju datoteku; Publisher je namijenjen onima koji žele i provjeru da je objava ispravna.
          Razliku detaljno razlažemo na stranici <a href="/usporedba/">usporedba</a>.
        </p>
      </section>

      <section className="site-section" aria-labelledby="payment-title">
        <h2 id="payment-title">Kako se plaća i što je s licencom</h2>
        <ul className="news-bullets">
          <li><strong>Po ponudi, uplatom na račun.</strong> Nema automatske naplate ni obnove kartice.</li>
          <li>Licenca se aktivira nakon što uplata bude evidentirana i vrijedi <strong>godinu dana</strong> od aktivacije.</li>
          <li>Isti javni URL ostaje nakon aktivacije, pa se poveznice na vašem webu ne mijenjaju.</li>
          <li>Ako ne produljite licencu, javni URL se gasi, a podaci ostaju spremljeni.</li>
        </ul>
        <p>
          Cijene su godišnje i ne uključuju mjesečnu pretplatu. NEPAR pruža tehničku provjeru objave cjenika, ne pravni savjet ni jamstvo usklađenosti.
        </p>
      </section>
    </SitePageLayout>
  )
}
