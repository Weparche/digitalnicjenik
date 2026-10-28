import type { ReactNode } from 'react'
import { formatNewsDate } from '../news/posts'
import { NewsLayout } from '../news/NewsLayout'
import { getSitePage, type SitePageMeta } from './registry'

export function Breadcrumb({ page }: { page: SitePageMeta }) {
  const parent = page.parent ? getSitePage(page.parent) : null
  return (
    <>
      <a href="/">Početna</a>
      {parent && (
        <>
          <span aria-hidden="true"> / </span>
          <a href={parent.path}>{parent.label}</a>
        </>
      )}
      <span aria-hidden="true"> / </span>
      <span>{page.label}</span>
    </>
  )
}

/** Shared frame for the evergreen pages: breadcrumb, answer-first lead, last-updated date, CTA. */
export function SitePageLayout({
  page,
  lead,
  children,
  related,
}: {
  page: SitePageMeta
  lead: ReactNode
  children: ReactNode
  related?: Array<{ href: string; label: string }>
}) {
  return (
    <NewsLayout breadcrumb={<Breadcrumb page={page} />} navCurrent={page.path}>
      <article className="site-page">
        <header className="site-page-header">
          <p className="news-kicker">NEPAR Publisher</p>
          <h1>{page.title}</h1>
          <p className="site-page-lead">{lead}</p>
          <p className="news-article-meta">
            Ažurirano: <time dateTime={page.updatedAt}>{formatNewsDate(page.updatedAt)}</time>
          </p>
        </header>
        {children}
        <aside className="site-cta" aria-label="Sljedeći korak">
          <div>
            <strong>Provjerite svoj cjenik besplatno</strong>
            <span>Učitajte Excel, CSV ili XML i odmah vidite što nedostaje. Objava je besplatna 24 sata.</span>
          </div>
          <a className="app-button app-button-primary" href="/#csv-validator">Učitaj cjenik →</a>
        </aside>
        {related && related.length > 0 && (
          <nav className="site-related" aria-label="Povezane stranice">
            <h2>Povezano</h2>
            <ul>
              {related.map((link) => (
                <li key={link.href}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </article>
    </NewsLayout>
  )
}

export function SourceList({ sources }: { sources: Array<{ title: string; url: string }> }) {
  return (
    <section className="news-sources" aria-labelledby="site-sources-title">
      <h2 id="site-sources-title">Službeni izvori</h2>
      <ul>
        {sources.map((source) => (
          <li key={source.url}>
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              {source.title}
              <span className="news-external-mark" aria-hidden="true"> ↗</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

export const OFFICIAL_SOURCES = [
  { title: 'NN 101/2026-1213 — Odluka o objavi cjenika proizvoda i usluga', url: 'https://narodne-novine.nn.hr/clanci/sluzbeni/2026_09_101_1213.html' },
  { title: 'NN 101/2026-1212 — Odluka o isticanju dodatne cijene', url: 'https://narodne-novine.nn.hr/clanci/sluzbeni/2026_09_101_1212.html' },
  { title: 'Vlada RH — produljenje roka na 17. studenoga 2026.', url: 'https://vlada.gov.hr/produljuje-se-rok-za-isticanje-sidrenih-cijena-na-17-studenoga/47358' },
]
