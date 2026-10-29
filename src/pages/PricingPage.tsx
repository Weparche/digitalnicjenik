import { PlanCards } from '../PlanCards'
import { MAX_ITEMS_LABEL, installationPriceLabel } from '../../shared/pricing'
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
          Provjera i validacija su besplatne. Web Link vodite kroz upload, Publisher kroz dashboard. Plaćanje uplatom na račun i ručna potvrda, bez automatske naplate; Web + Publisher ugovara se po ponudi.
        </>
      }
      related={[
        { href: '/digitalni-cjenik-za-wordpress-webshop/', label: 'Digitalni cjenik za WordPress, webshop i postojeći web' },
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
        <h2 id="link-scope-title">Što pokriva Web Link?</h2>
        <p>Web Link je za Excel, CSV ili XML koji sami ažurirate, do {MAX_ITEMS_LABEL} stavki. Neograničeno zamjenjujete cijeli cjenik novom datotekom uz validaciju. Uključeni su HTML, CSV/XML, arhiva, QR, PDF, iframe i embed. Ugradnja na postojeći web zasebno stoji {installationPriceLabel()}.</p>
        <p>Posljednje valjano objavljeno stanje proizvoda automatski se ponovno objavljuje svakog radnog dana prema kalendaru. NEPAR ne mijenja cijene niti ih preuzima iz blagajne ili webshopa. Usluge ne dobivaju dnevne duplikate bez promjene. <a href="/objava-digitalnog-cjenika/#odgovornosti">Priprema i odgovornosti prije objave.</a></p>
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
          <li><strong>Uplatom na račun uz HUB-3 2D barkod.</strong> Web Link i Publisher naručujete u dashboardu; novi web ide kroz upit i ponudu.</li>
          <li>Licenca se aktivira nakon što uplata bude evidentirana i vrijedi <strong>godinu dana</strong> od aktivacije.</li>
          <li>Isti javni URL ostaje nakon aktivacije, pa se poveznice na vašem webu ne mijenjaju.</li>
          <li>Potvrđeno plaćeni godišnji paketi imaju još 7 dana gracea nakon isteka. Aktualni link, feedovi i objava rade do tog roka; potom se deaktiviraju ako obnova nije potvrđena. Prijava „Uplatio sam” sama ne aktivira niti produljuje paket.</li>
          <li>Besplatna objava traje 24 sata, bez novog gracea. Arhiva ostaje dostupna prema rokovima zadržavanja i nakon običnog isteka.</li>
        </ul>
        <p>
          Cijene su godišnje i ne uključuju mjesečnu pretplatu. NEPAR pruža tehničku provjeru objave cjenika, ne pravni savjet ni jamstvo usklađenosti.
        </p>
      </section>
    </SitePageLayout>
  )
}
