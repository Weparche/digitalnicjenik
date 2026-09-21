import { formatNewsDate, NEWS_POSTS, newsArticlePath } from './posts'
import { NewsLayout } from './NewsLayout'

export function NewsIndex() {
  const sorted = [...NEWS_POSTS].sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  )

  return (
    <NewsLayout
      breadcrumb={
        <>
          <a href="/">Početna</a>
          <span aria-hidden="true"> / </span>
          <span>Vijesti</span>
        </>
      }
    >
      <header className="news-index-header">
        <p className="news-kicker">Vijesti · regulativa</p>
        <h1>Vijesti o digitalnom cjeniku</h1>
        <p className="news-index-intro">
          Sažeci i vodiči usklađeni sa službenim izvorima — fokus na objavu CSV/XML cjenika i dodatnu
          (sidrenu) cijenu od 1. listopada 2026.
        </p>
      </header>
      <ul className="news-index-list">
        {sorted.map((post) => (
          <li key={post.slug}>
            <article className="news-index-card">
              <p className="news-index-meta">
                <time dateTime={post.publishedAt}>{formatNewsDate(post.publishedAt)}</time>
                {post.readingTimeMinutes > 0 && (
                  <span> · {post.readingTimeMinutes} min čitanja</span>
                )}
              </p>
              <h2>
                <a href={newsArticlePath(post.slug)}>{post.title}</a>
              </h2>
              <p>{post.excerpt}</p>
              <a className="news-read-more" href={newsArticlePath(post.slug)}>
                Pročitaj vodič →
              </a>
            </article>
          </li>
        ))}
      </ul>
    </NewsLayout>
  )
}
