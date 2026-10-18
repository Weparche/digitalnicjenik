import { faqGroups } from './faqData'
import { OFFICIAL_SOURCES, SitePageLayout, SourceList } from './PageLayout'
import { getSitePage } from './registry'

export function FaqPage() {
  const page = getSitePage('/faq/')
  return (
    <SitePageLayout
      page={page}
      lead="Kratki odgovori na najčešća pitanja o digitalnom cjeniku i sidrenoj (dodatnoj) cijeni. Rok primjene je 17. studenoga 2026.; nacrti novih pravilnika su u savjetovanju."
      related={[
        { href: '/specifikacija-csv-xml/', label: 'Specifikacija CSV/XML polje po polje' },
        { href: '/cijene/', label: 'Cijene' },
        { href: '/vijesti/odgoda-digitalnih-cjenika-sidrenih-cijena-2026/', label: 'Odgoda do 17. studenoga: detalji' },
        { href: '/vijesti/nacrti-pravilnika-digitalni-cjenik-bazna-cijena-2026/', label: 'Nacrti pravilnika na e-Savjetovanju' },
      ]}
    >
      <nav className="site-toc" aria-label="Sadržaj">
        <ul>
          {faqGroups.map((group) => (
            <li key={group.id}><a href={`#${group.id}`}>{group.title}</a></li>
          ))}
        </ul>
      </nav>
      {faqGroups.map((group) => (
        <section key={group.id} id={group.id} className="site-section" aria-labelledby={`${group.id}-title`}>
          <h2 id={`${group.id}-title`}>{group.title}</h2>
          <div className="site-faq">
            {group.entries.map((entry) => (
              <div key={entry.question} className="site-faq-item">
                <h3>{entry.question}</h3>
                <p>{entry.answer}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
      <SourceList sources={OFFICIAL_SOURCES} />
    </SitePageLayout>
  )
}
