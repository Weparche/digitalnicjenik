import type { LeadIntent } from './LeadForm'
import { productFaq } from './productFaq'

export function EducationSection({ onLead }: { onLead: (intent: LeadIntent) => void }) {
  return <section className="education-section" aria-labelledby="education-title">
    <div className="education-heading"><span className="app-label">ŠTO OBJAVA STVARNO ZNAČI</span><h2 id="education-title">CSV na webu je početak. Objavljeni digitalni cjenik je sustav.</h2><p>Sama datoteka ne potvrđuje da sadrži potrebne podatke, da je javno dohvatljiva ni da prethodne verzije ostaju dostupne.</p></div>
    <div className="education-compare">
      <article><h3>Samo datoteka</h3><ul><li>URL možda postoji, ali sadržaj nije provjeren</li><li>stara datoteka može biti pregažena</li><li>naziv i vrijeme objave nisu potvrđeni</li><li>automatizirani dohvat možda ne radi</li></ul></article>
      <article className="education-complete"><h3>Potpuna objava</h3><ul><li>obavezni podaci prolaze provjeru</li><li>aktualni cjenik ima stabilan javni URL</li><li>svaka objava ostaje nepromjenjiva</li><li>prethodne verzije ostaju javne najmanje 30 dana</li><li>softverski alati mogu dohvatiti aktualne cijene</li></ul></article>
    </div>
    <div className="education-proof"><div><h3>Što NEPAR dodatno provjerava</h3><p>Sidrena cijena za usluge, posebni oblici prodaje, smisleni podaci po stavci, naziv datoteke i strojno čitljiv CSV ili XML sadržaj.</p></div><p>Propis traži CSV <strong>ili</strong> XML pogodan za automatsku obradu, odgovarajući naziv datoteke, dostupnost prethodnih objava i dohvat aktualnih cijena u stvarnom vremenu.</p></div>
    <div className="education-faq" aria-labelledby="education-faq-title"><h3 id="education-faq-title">Ukratko</h3><dl>{productFaq.map((entry) => <div className="education-faq-item" key={entry.question}><dt>{entry.question}</dt><dd>{entry.answer}</dd></div>)}</dl></div>
    <div className="education-guides"><h3>Detaljni vodiči na nepar.hr</h3><div className="education-guides-links"><a href="https://nepar.hr/digitalni-cjenik">Digitalni cjenik — pregled obveze</a><a href="https://nepar.hr/digitalni-cjenik/sidrena-cijena">Vodič za sidrenu cijenu</a><a href="https://nepar.hr/digitalni-cjenik/xml-csv">Kako treba izgledati XML/CSV digitalni cjenik</a><a href="https://nepar.hr/digitalni-cjenik/automatizacija">Automatizacija digitalnog cjenika</a></div></div>
    <div className="education-sources"><a href="https://narodne-novine.nn.hr/clanci/sluzbeni/2026_09_101_1213.html" target="_blank" rel="noreferrer">Odluka NN 101/2026 — digitalni cjenik</a><a href="https://narodne-novine.nn.hr/clanci/sluzbeni/2026_09_101_1212.html" target="_blank" rel="noreferrer">Odluka NN 101/2026 — dodatna cijena</a><span>NEPAR pruža tehničku i podatkovnu provjeru, ne individualni pravni savjet.</span></div>
    <div className="education-cta"><div><strong>Želite konkretnu ponudu?</strong><span>Pošaljite datoteku, URL ili fotografiju postojećeg cjenika — ili objavite probno 7 dana iz validacije.</span></div><div><button className="app-button app-button-primary" type="button" onClick={() => onLead('implementation')}>Postavljanje 89,90 €</button><button className="app-button app-button-light" type="button" onClick={() => onLead('plugin')}>Self-service 49,90 €/god</button></div></div>
  </section>
}

