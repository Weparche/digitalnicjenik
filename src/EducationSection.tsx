import type { LeadIntent } from './LeadForm'
import { productFaq } from './productFaq'
import { implementationFirstYearLabel, selfServicePriceLabel } from './publisherPricing'

export function EducationSection({ onLead }: { onLead: (intent: LeadIntent) => void }) {
  return <section className="education-section" aria-labelledby="education-title">
    <div className="education-heading">
      <h2 id="education-title">Objava na mrežnim stranicama, ne samo datoteka na disku</h2>
      <p>Odluka traži objavu cjenika na webu, propisane podatke u CSV ili XML-u i mogućnost automatiziranog dohvata. NEPAR Publisher je publishing layer između vašeg cjenika i javnog weba.</p>
    </div>
    <h3 className="education-compare-title">MIKROeRAČUN rješava eRačun. Tko rješava cjenik na vašem webu?</h3>
    <div className="education-compare">
      <article>
        <h3>MIKROeRAČUN + vlastiti cjenik</h3>
        <ul>
          <li>Besplatno rješenje Porezne za eRačune (uz ispunjene uvjete)</li>
          <li>Cijene možete držati u Excelu ili CSV-u</li>
          <li>Web i dalje treba javno objavljivati cjenik u propisanom formatu</li>
          <li>Ručno održavanje linkova i verzija lako pogriješi</li>
        </ul>
      </article>
      <article className="education-complete">
        <h3>NEPAR Publisher</h3>
        <ul>
          <li>Excel/CSV → provjera strukture i obveznih polja</li>
          <li>Sidrena cijena i propisani CSV/XML s pravilnim imenom datoteke</li>
          <li>Javni feedovi i aktualni.csv / aktualni.xml (NEPAR tehničko rješenje)</li>
          <li>Verzioniranje bez prepisivanja — povijest objava i automatizirani dohvat</li>
          <li>Link na web; sljedeći mjesec promjena → Objavi novi cjenik</li>
        </ul>
      </article>
    </div>
    <details className="education-more">
      <summary>Regulativni kontekst (ukratko)</summary>
      <div className="education-proof">
        <p>Propis traži objavu na mrežnim stranicama, odgovarajuće podatke, naziv datoteke, dostupnost objavljenih verzija i automatizirani dohvat. NEPAR ne daje individualni pravni savjet — provjeravamo tehničku i podatkovnu spremnost objave.</p>
        <p>MIKROeRAČUN danas primarno omogućuje zaprimanje eRačuna; izdavanje se planira od 1. 1. 2027. Publisher ne zamjenjuje MIKRO — dopunjuje ga za cjenik na webu.</p>
      </div>
    </details>
    <div className="education-faq" aria-labelledby="education-faq-title"><h3 id="education-faq-title">Ukratko</h3><dl>{productFaq.map((entry) => <div className="education-faq-item" key={entry.question}><dt>{entry.question}</dt><dd>{entry.answer}</dd></div>)}</dl></div>
    <div className="education-guides"><h3>Detaljni vodiči na nepar.hr</h3><div className="education-guides-links"><a href="https://nepar.hr/digitalni-cjenik">Pregled obveze</a><a href="https://nepar.hr/digitalni-cjenik/sidrena-cijena">Sidrena cijena</a><a href="https://nepar.hr/digitalni-cjenik/xml-csv">XML/CSV format</a><a href="https://nepar.hr/digitalni-cjenik/automatizacija">Automatizacija</a></div></div>
    <div className="education-sources"><a href="https://narodne-novine.nn.hr/clanci/sluzbeni/2026_09_101_1213.html" target="_blank" rel="noreferrer">Odluka NN 101/2026 — digitalni cjenik</a><a href="https://narodne-novine.nn.hr/clanci/sluzbeni/2026_09_101_1212.html" target="_blank" rel="noreferrer">Odluka NN 101/2026 — dodatna cijena</a><span>NEPAR pruža tehničku i podatkovnu provjeru, ne individualni pravni savjet.</span></div>
    <div className="education-cta"><div><strong>Želite aktivirati Publisher?</strong><span>Učitajte cjenik za probu ili pošaljite upit — self-service {selfServicePriceLabel()}.</span></div><div><button className="app-button app-button-primary" type="button" onClick={() => onLead('implementation')}>Postavljanje {implementationFirstYearLabel()} prva godina</button><button className="app-button app-button-light" type="button" onClick={() => onLead('plugin')}>Self-service {selfServicePriceLabel()}</button></div></div>
  </section>
}
