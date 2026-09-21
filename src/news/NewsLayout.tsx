import type { ReactNode } from 'react'
import { Logo } from '../Logo'

export function NewsLayout({
  children,
  breadcrumb,
}: {
  children: ReactNode
  breadcrumb: ReactNode
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
