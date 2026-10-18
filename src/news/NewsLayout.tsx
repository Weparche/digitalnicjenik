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
        <SiteNav current={navCurrent} />
        <nav className="news-breadcrumb" aria-label="Navigacija">
          {breadcrumb}
        </nav>
        {children}
        <p className="news-disclaimer">
          NEPAR pruža tehničku i podatkovnu provjeru objave cjenika, ne individualni pravni savjet.
          Za obvezujuće tumačenje koristite službene propise i nadležna tijela.
        </p>
      </main>
    </div>
  )
}
