import { PLANS, formatEur } from '../../shared/pricing'
import { SitePageLayout, SourceList, OFFICIAL_SOURCES } from './PageLayout'
import { getSitePage } from './registry'

/** A practical acquisition page for accountants: one public URL per check, no unbuilt batch promises. */
export function AccountantsPage() {
  const page = getSitePage('/digitalni-cjenik-za-knjigovode/')
  return <SitePageLayout
    page={page}
    lead="Vodite knjigovodstvo za obrte, trgovine ili salone? Provjerite javno dostupne digitalne cjenike klijenata bez registracije i pošaljite im tehnički rezultat s konkretnim uputama."
    related={[
      { href: '/digitalni-cjenik-2026/', label: 'Obveze i rokovi digitalnog cjenika' },
      { href: '/vodici/excel-csv-digitalni-cjenik/', label: 'Od Excela do CSV/XML objave' },
      { href: '/cijene/', label: 'Paketi i cijene' },
    ]}
  >
    <section className="site-section" aria-labelledby="accountant-steps">
      <h2 id="accountant-steps">Tri koraka za svakog klijenta</h2>
      <ol className="news-bullets">
        <li><strong>Upišite adresu klijentova weba.</strong> Provjera čita javno dostupne linkove i CSV/XML dokumente. Ne traži pristup računovodstvenim podacima.</li>
        <li><strong>Prođite devet tehničkih nalaza.</strong> Provjerite jesu li datoteke dostupne, je li link vidljiv s početne stranice te postoje li znakovi zaštite od automatskog dohvata.</li>
        <li><strong>Pošaljite nalaz klijentu ili webmasteru.</strong> Nakon provjere upotrijebite „Podijeli rezultat” ili ispis u PDF. Nalaz je snimka trenutnog stanja, ne službeno pravno mišljenje.</li>
      </ol>
    </section>
    <section className="site-section" aria-labelledby="accountant-checks">
      <h2 id="accountant-checks">Što checker može, a što ne može potvrditi?</h2>
      <p>Pronalazi javni cjenik, strojno čitljivu datoteku i vidljive poveznice, provjerava osnovnu strukturu i iznosi konkretne podatkovne nalaze. Pritom razlikuje „ne prolazi”, „upozorenje” i „nije moguće automatski potvrditi”.</p>
      <p>Ne potvrđuje stvarne povijesne cijene, potpunost artikala, stvarnu poslovnu primjenjivost svake odredbe ni kontinuitet 30-dnevne arhive jednim pregledom. Konačni tekst novog pravilnika treba provjeriti po objavi; nacrt savjetovanja nije obvezujući propis.</p>
    </section>
    <section className="site-section" aria-labelledby="accountant-options">
      <h2 id="accountant-options">Što ako klijent nema objavljen cjenik?</h2>
      <p>Ako ima Excel ili CSV, može besplatno provjeriti i probno objaviti datoteku na 24 sata. Postojeći web i domena ostaju mu na raspolaganju; poveznicu na objavljeni cjenik treba dodati na vlastitu stranicu.</p>
      <p>Za nastavak objave dostupan je NEPAR Web Link od <strong>{formatEur(PLANS[0].price,true)}</strong>. To je tehnička usluga, ne jamstvo pravne usklađenosti. Ugradnja na postojeći web ugovara se odvojeno.</p>
      <p><a href="/app?new=1&tab=cjenik" className="app-button app-button-primary">Isprobajte besplatnu objavu →</a></p>
    </section>
    <SourceList sources={OFFICIAL_SOURCES}/>
  </SitePageLayout>
}
