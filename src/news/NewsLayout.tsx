import type { ReactNode } from 'react'
import { Logo } from '../Logo'
import { SiteNav } from '../pages/SiteNav'

export function NewsLayout({
  children,
  breadcrumb,
  navCurrent,
}: {
  children: ReactNode
  breadcrumb: ReactNode
  navCurrent?: string
}) {
  return (
    <div className="validator-app-shell news-shell">
      <header className="app-header">
        <Logo />
        <a className="header-lead news-header-back" href="/">
          Publisher <strong>početna →</strong>
        </a>
      </header>
      <main className="validator-app news-main">
        <details className="public-navigation"><summary>Vodiči, cijene i informacije</summary><SiteNav current={navCurrent} /></details>
        <nav className="news-breadcrumb" aria-label="Navigacija">
          {breadcrumb}
        </nav>
        {children}
        <p className="news-disclaimer">
          NEPAR pruža tehničku i podatkovnu provjeru objave cjenika, ne individualni pravni savjet.
          Za obvezujuće tumačenje koristite službene propise i nadležna tijela.
        </p>
        <nav aria-label="Pravne informacije" className="news-legal-links"><a href="/impressum.html">Impressum</a> · <a href="/privatnost.html">Privatnost</a> · <a href="/uvjeti.html">Uvjeti usluge</a></nav>
      </main>
    </div>
  )
}
