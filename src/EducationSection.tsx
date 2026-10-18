import type { LeadIntent } from './LeadForm'
import { productFaq } from './productFaq'
import { implementationFirstYearLabel, selfServicePriceLabel } from './publisherPricing'

export function EducationSection({ onLead }: { onLead: (intent: LeadIntent) => void }) {
  return <section className="education-section" aria-labelledby="education-title">
    <div className="education-heading">
      <h2 id="education-title">Objavljen cjenik nije isto što i ispravan cjenik</h2>
      <p>Odluka traži objavu cjenika na webu, propisane podatke u CSV ili XML-u i mogućnost automatiziranog dohvata. Datoteka može biti dostupna, a imati pogrešan broj stavki, krivi naziv ili praznu sidrenu cijenu. Zato objavi dodajemo nadzor.</p>
    </div>
    <h3 className="education-compare-title">Samo datoteka ili datoteka s nadzorom?</h3>
    <div className="education-compare">
      <article>
        <h3>Samo objava datoteke</h3>
        <ul>
          <li>CSV/XML se generira ili izvozi</li>
          <li>Je li datoteka dostupna i ispravna provjeravate sami</li>
          <li>Greška se otkrije kad je netko prijavi</li>
          <li>Promjena propisa traži prepravljanje</li>
        </ul>
      </article>
      <article className="education-complete">
        <h3>NEPAR Publisher</h3>
        <ul>
          <li>Excel/CSV → provjera strukture, obveznih polja i sidrene cijene</li>
          <li>Javni CSV/XML na stabilnom URL-u, propisani naziv datoteke, arhiva 30 dana</li>
          <li>Svakodnevna provjera: dostupnost, broj stavki, sadržaj, naziv datoteke, arhiva</li>
          <li>E-mail upozorenje čim nešto nije u redu, uz QR, ispis i ugradnju na web</li>
          <li>Verzionirana pravila: prilagodba novom pravilniku bez prepravljanja</li>
        </ul>
      </article>
    </div>
    <nav className="education-guides" aria-label="Više o digitalnom cjeniku"><h3>Saznajte više</h3><div className="education-guides-links"><a href="/cijene/">Cijene</a><a href="/usporedba/">Usporedba načina objave</a><a href="/specifikacija-csv-xml/">Specifikacija CSV/XML</a><a href="/faq/">Česta pitanja</a><a href="/vodici/excel-csv-digitalni-cjenik/">Vodič: Excel u CSV/XML</a><a href="/vodici/woocommerce-wordpress-digitalni-cjenik/">WooCommerce i WordPress</a><a href="/vodici/mikroeracun-digitalni-cjenik/">MIKROeRAČUN i cjenik</a></div></nav>
    <details className="education-more">
      <summary>Regulativni kontekst (ukratko)</summary>
      <div className="education-proof">
        <p>Propis traži objavu na mrežnim stranicama, odgovarajuće podatke, naziv datoteke, dostupnost objavljenih verzija i automatizirani dohvat. NEPAR ne daje individualni pravni savjet — provjeravamo tehničku i podatkovnu spremnost objave.</p>
        <p>Rok primjene je 17. studenoga 2026. (Vlada, 29.9.2026.). MIKROeRAČUN rješava eRačune, a ne cjenik na webu — <a href="/vodici/mikroeracun-digitalni-cjenik/">razlika</a>.</p>
      </div>
    </details>
    <div className="education-faq" aria-labelledby="education-faq-title"><h3 id="education-faq-title">Ukratko</h3><dl>{productFaq.map((entry) => <div className="education-faq-item" key={entry.question}><dt>{entry.question}</dt><dd>{entry.answer}</dd></div>)}</dl></div>
    <div className="education-guides"><h3>Dokumentacija na nepar.hr</h3><div className="education-guides-links"><a href="https://nepar.hr/digitalni-cjenik">Pregled obveze</a><a href="https://nepar.hr/digitalni-cjenik/sidrena-cijena">Sidrena cijena</a><a href="https://nepar.hr/digitalni-cjenik/xml-csv">XML/CSV format</a><a href="https://nepar.hr/digitalni-cjenik/automatizacija">Automatizacija</a></div></div>
    <div className="education-sources"><a href="https://narodne-novine.nn.hr/clanci/sluzbeni/2026_09_101_1213.html" target="_blank" rel="noreferrer">Odluka NN 101/2026 — digitalni cjenik</a><a href="https://narodne-novine.nn.hr/clanci/sluzbeni/2026_09_101_1212.html" target="_blank" rel="noreferrer">Odluka NN 101/2026 — dodatna cijena</a><span>NEPAR pruža tehničku i podatkovnu provjeru, ne individualni pravni savjet.</span></div>
    <div className="education-cta"><div><strong>Želite aktivirati Publisher?</strong><span>Učitajte cjenik za probu ili pošaljite upit — self-service {selfServicePriceLabel()}.</span></div><div><button className="app-button app-button-primary" type="button" onClick={() => onLead('implementation')}>Postavljanje {implementationFirstYearLabel()} prva godina</button><button className="app-button app-button-light" type="button" onClick={() => onLead('plugin')}>Self-service {selfServicePriceLabel()}</button></div></div>
  </section>
}
