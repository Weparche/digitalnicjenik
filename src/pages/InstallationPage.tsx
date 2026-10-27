import { PlanCards } from '../PlanCards'
import { PLANS, formatEur } from '../publisherPricing'
import { SitePageLayout, SourceList } from './PageLayout'
import { getSitePage } from './registry'

export function InstallationPage() {
  return <SitePageLayout
    page={getSitePage('/objava-digitalnog-cjenika/')}
    lead={<>NEPAR pomaže obrtnicima i malim tvrtkama objaviti pripremljeni cjenik te ga povezati s postojećom web stranicom, bez plugina i bez migracije weba. Web Link počinje od {formatEur(PLANS[0].price, true)}; za Excel, nadzor ili izradu jednostavnog weba odaberite odgovarajući paket.</>}
    related={[
      { href: '/digitalni-cjenik-za-wordpress-webshop/', label: 'Digitalni cjenik za WordPress, webshop i postojeći web' },
      { href: '/cijene/', label: 'Sve cijene i uvjeti pretplate' },
      { href: '/reference/auto-gubic/', label: 'Stvarni primjer: Auto Gubić' },
      { href: '/specifikacija-csv-xml/', label: 'Podržana CSV/XML polja i primjeri' },
    ]}
  >
    <section className="site-section" aria-labelledby="installation-steps">
      <h2 id="installation-steps">Od vašeg cjenika do poveznice na webu</h2>
      <ol className="news-bullets">
        <li><strong>Pripremite podatke.</strong> Naziv poslovnog subjekta, podatke o objektu i cjenik s aktualnim cijenama te ostalim potrebnim poljima. Web Link je za pripremljeni CSV ili XML; Publisher dodaje Excel i detaljnu validaciju.</li>
        <li><strong>Pregledajte prije objave.</strong> Besplatni validator pokazuje probleme u podržanom formatu. Vlasnik provjerava stvarne cijene i potpunost ponude.</li>
        <li><strong>Objavite cjenik.</strong> Dobivate javnu stranicu i CSV/XML poveznice. Zamjena objave čuva prethodnu verziju u arhivi 30 dana, uz aktivnu pretplatu.</li>
        <li><strong>Povežite s postojećim webom.</strong> Dodajte jasan link „Digitalni cjenik” i pristup datotekama i arhivi. Za prikaz unutar stranice Publisher nudi ugradnju; pomoć s postavljanjem dogovaramo prema platformi.</li>
        <li><strong>Održavajte aktualne podatke.</strong> Sami dostavljate novu verziju kada se cijene promijene. Publisher dodatno provjerava objavu i šalje e-mail upozorenja; nadzor nije automatski uvoz novih cijena.</li>
      </ol>
    </section>
    <section className="site-section" aria-labelledby="installation-platforms">
      <h2 id="installation-platforms">WordPress, Wix ili prilagođena stranica</h2>
      <p>Obična poveznica može se dodati na postojeći web bez promjene domene. Na WordPressu je možete staviti u izbornik ili gumb; za ugrađeni prikaz provjerite mogućnosti HTML bloka. Na Wixu i Google Sitesu način ugradnje ovisi o mogućnostima stranice i njezinim postavkama.</p>
      <p>Za vlastiti React, PHP ili drugi web razvojnom timu predajete javne poveznice i, uz Publisher, kod za ugradnju. Ako želite da datoteke budu poslužene izravno s vaše domene, najprije provjeravamo hosting i dogovaramo tehničko povezivanje.</p>
      <p><a href="/digitalni-cjenik-za-wordpress-webshop/">Upute za WordPress, WooCommerce, Shopify, Wix i vlastiti web</a> · <a href="/vodici/woocommerce-wordpress-digitalni-cjenik/">Vodič za WordPress i WooCommerce</a> · <a href="/#posaljite-cjenik">Zatražite pomoć s postojećim webom</a></p>
    </section>
    <section className="site-section" aria-labelledby="installation-plans">
      <h2 id="installation-plans">Odaberite koliko pomoći trebate</h2>
      <PlanCards />
      <p>Pretplata traje godinu dana od aktivacije. Plaćanje je po ponudi, bez automatske naplate. Ugradnja na postojeći web dogovara se zasebno; Web + Publisher uključuje jednostavan NEPAR web, a složenije izvedbe zasebnu ponudu.</p>
    </section>
    <section className="site-section" id="odgovornosti" aria-labelledby="installation-responsibilities">
      <h2 id="installation-responsibilities">Što treba provjeriti prije objave?</h2>
      <p>Stalni link i arhiva dio su tehničkog rješenja. Važno je i da datoteka sadrži odgovarajuća polja, naziv objekta i oznaku objave, da se može automatski dohvatiti te da je dostupna s vaše web stranice. Samostalni link bez povezivanja s vašim webom nije dovršena ugradnja.</p>
      <p>Prema Odluci NN 101/2026, uz izmjenu početka primjene na 17. studenoga 2026., razlikuju se rokovi ažuriranja cjenika proizvoda i usluga. Web Link ne uključuje automatsku dnevnu ponovnu objavu nepromijenjenih podataka ni povezivanje s ERP-om. Za trgovinu koja treba takav raspored prije narudžbe dogovorite odgovarajuću automatizaciju.</p>
      <p>Stalni URL znači da se adresa ne mijenja pri zamjeni cjenika, dok je pretplata aktivna. Nakon isteka pretplate javni pristup se gasi; prije isteka osigurajte nastavak dostupnosti aktualnog cjenika i potrebne arhive, produljenjem ili preseljenjem objava.</p>
      <p>Korisnik potvrđuje točne cijene i potpunost podataka. Pravila o isticanju cijena u poslovnici i drugim kanalima ne rješavaju se samom kupnjom hostinga. Za opseg obveze mjerodavni su važeći propisi; nacrti pravilnika nisu konačna pravila.</p>
    </section>
    <section className="site-section" aria-labelledby="installation-reference">
      <h2 id="installation-reference">Pogledajte stvarnu NEPAR implementaciju</h2>
      <p>Auto Gubić ima javni cjenik usluge na vlastitoj domeni, s aktualnom i sidrenom cijenom, poveznicama na CSV/XML i podacima o objavi. To je individualna NEPAR implementacija; opseg Web Linka opisan je iznad.</p>
      <a href="/reference/auto-gubic/">Kako izgleda cjenik Auto Gubića →</a>
    </section>
    <SourceList sources={[
      { title: 'NN 101/2026-1213 — Odluka o objavi cjenika', url: 'https://narodne-novine.nn.hr/clanci/sluzbeni/2026_09_101_1213.html' },
      { title: 'NN 110/2026-1310 — izmjena početka primjene', url: 'https://narodne-novine.nn.hr/clanci/sluzbeni/2026_09_110_1310.html' },
    ]} />
  </SitePageLayout>
}

export function AutoGubicReferencePage() {
  return <SitePageLayout
    page={getSitePage('/reference/auto-gubic/')}
    lead="Za Auto Gubić NEPAR je izradio web i digitalni cjenik. Ovdje možete provjeriti javno vidljive dijelove te implementacije: prikaz usluge, poveznice na datoteke i podatke o objavi."
    related={[
      { href: '/objava-digitalnog-cjenika/', label: 'Objava i ugradnja za vaš web' },
      { href: '/cijene/', label: 'Aktualni godišnji paketi' },
      { href: '/vijesti/primjeri-digitalnih-cjenika-hrvatska-2026/', label: 'Još primjera digitalnih cjenika' },
    ]}
  >
    <section className="site-section" aria-labelledby="reference-result">
      <h2 id="reference-result">Jedna stranica za posjetitelja i za preuzimanje podataka</h2>
      <p>Na stranici autoservisa posjetitelj vidi uslugu „Radni sat autoservisa”, aktualnu i sidrenu cijenu te informaciju o posebnom obliku prodaje. Na istom mjestu nalaze se vrijeme zadnjeg ažuriranja i broj pohrane.</p>
      <p>CSV i XML imaju stabilne poveznice na aktualnu verziju. Javna stranica navodi da su datoteke dostupne bez prijave i bez izvršavanja JavaScripta.</p>
      <a className="app-button app-button-primary" href="https://autogubic.hr/cjenik" target="_blank" rel="noopener noreferrer">Otvori stvarni cjenik Auto Gubića ↗</a>
    </section>
    <section className="site-section" aria-labelledby="reference-evidence">
      <h2 id="reference-evidence">Javne poveznice za provjeru</h2>
      <ul className="news-bullets">
        <li><a href="https://autogubic.hr/cjenik" target="_blank" rel="noopener noreferrer">Cjenik usluga i podaci o objavi</a></li>
        <li><a href="https://autogubic.hr/cjenik/aktualni.csv" target="_blank" rel="noopener noreferrer">Poveznica na aktualni CSV</a></li>
        <li><a href="https://autogubic.hr/cjenik/aktualni.xml" target="_blank" rel="noopener noreferrer">Poveznica na aktualni XML</a></li>
      </ul>
      <p>Pregled javne stranice: 26. listopada 2026. Podaci i datoteke na vanjskoj stranici mogu se naknadno promijeniti.</p>
    </section>
    <section className="site-section" aria-labelledby="reference-scope">
      <h2 id="reference-scope">Što ovaj primjer pokazuje</h2>
      <p>Primjer pokazuje kako se javni prikaz i strojno čitljive datoteke mogu povezati na vlastitoj domeni. Riječ je o našoj referentnoj implementaciji, a ne neovisnoj recenziji ili korisničkoj izjavi.</p>
      <p>Prikaz ne potvrđuje trajanje ni potpunost arhive, neprekidan rad sustava ili pravnu usklađenost. Individualna implementacija Auto Gubića nije obećanje da su sve njezine mogućnosti uključene u Web Link.</p>
    </section>
  </SitePageLayout>
}
