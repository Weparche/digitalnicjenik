import { NAV_LINKS } from './registry'

export function SiteNav({ current }: { current?: string }) {
  return (
    <nav className="site-nav" aria-label="Glavni odjeljci">
      {NAV_LINKS.map((link) => (
        <a key={link.href} href={link.href} aria-current={link.href === current ? 'page' : undefined}>
          {link.label}
        </a>
      ))}
    </nav>
  )
}
