import { PlanCards } from '../PlanCards'
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
  return (
    <SitePageLayout
      page={page}
      lead={
        <>
          Provjera i validacija su besplatne. Odaberite godišnji paket za objavu cjenika. Plaćanje po ponudi, bez automatske naplate.
        </>
      }
      related={[
        { href: '/objava-digitalnog-cjenika/', label: 'Kako objaviti i ugraditi cjenik' },
        { href: '/usporedba/', label: 'Usporedba s besplatnim alatima i dodacima' },
        { href: '/faq/', label: 'Česta pitanja' },
        { href: '/specifikacija-csv-xml/', label: 'Specifikacija CSV/XML' },
      ]}
    >
      <section className="site-section" aria-labelledby="plans-title">
        <h2 id="plans-title">Paketi</h2>
        <PlanCards />
      </section>

      <section className="site-section" aria-labelledby="link-scope-title">
        <h2 id="link-scope-title">Što pokriva paket Link?</h2>
        <p>Link je za pripremljeni CSV koji sami ažurirate. Uključuje javni prikaz, CSV/XML izlaz za podržani format i arhivu zamijenjenih verzija uz aktivnu pretplatu. Poveznicu postavljate na svoju web stranicu; pomoć s ugradnjom dogovara se zasebno.</p>
        <p>To nije automatska sinkronizacija s blagajnom niti dnevna ponovna objava nepromijenjenog cjenika proizvoda. Točnost podataka, pravodobne izmjene i način povezivanja s vašim webom treba provjeriti za vaše poslovanje. <a href="/objava-digitalnog-cjenika/#odgovornosti">Pogledajte što treba pripremiti prije objave.</a></p>
      </section>

      <section className="site-section" aria-labelledby="included-title">
        <h2 id="included-title">Što uključuje Publisher</h2>
        <ul className="news-bullets">
          {PRICING_INCLUDED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>
          Publisher uz objavu nudi i svakodnevni nadzor. Besplatni alati razlikuju se: neki nude samo izradu datoteke, a neki i hosting i arhivu.
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
