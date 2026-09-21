import { formatNewsDate, getPostBySlug, newsArticlePath } from './posts'
import { absoluteAssetUrl } from './site'
import { NewsLayout } from './NewsLayout'

export function NewsArticle({ slug }: { slug: string }) {
  const post = getPostBySlug(slug)
  if (!post) {
    return (
      <NewsLayout
        breadcrumb={
          <>
            <a href="/">Početna</a>
            <span aria-hidden="true"> / </span>
            <a href="/vijesti">Vijesti</a>
            <span aria-hidden="true"> / </span>
            <span>Nije pronađeno</span>
          </>
        }
      >
        <h1>Članak nije pronađen</h1>
        <p>
          <a href="/vijesti">Povratak na vijesti →</a>
        </p>
      </NewsLayout>
    )
  }

  const imageUrl = absoluteAssetUrl(post.image.src)

  return (
    <NewsLayout
      breadcrumb={
        <>
          <a href="/">Početna</a>
          <span aria-hidden="true"> / </span>
          <a href="/vijesti">Vijesti</a>
          <span aria-hidden="true"> / </span>
          <span>{post.title}</span>
        </>
      }
    >
      <article className="news-article">
        <header className="news-article-header">
          <p className="news-kicker">Regulativa</p>
          <h1>{post.title}</h1>
          <p className="news-article-meta">
            <time dateTime={post.publishedAt}>{formatNewsDate(post.publishedAt)}</time>
            {post.readingTimeMinutes > 0 && (
              <span> · {post.readingTimeMinutes} min čitanja</span>
            )}
          </p>
          <img
            className="news-article-hero"
            src={post.image.src}
            alt={post.image.alt}
            width={post.image.width}
            height={post.image.height}
          />
        </header>
        {post.sections.map((section) => {
          const Tag = section.level === 2 ? 'h2' : 'h3'
          return (
            <section key={section.heading} className="news-section">
              <Tag>{section.heading}</Tag>
              <div
                className="news-section-body"
                dangerouslySetInnerHTML={{ __html: section.html }}
              />
            </section>
          )
        })}
        <section className="news-sources" aria-labelledby="news-sources-title">
          <h2 id="news-sources-title">Službeni izvori</h2>
          <ul>
            {post.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.title}
                  <span className="news-external-mark" aria-hidden="true">
                    {' '}
                    ↗
                  </span>
                </a>
                <span className="news-source-type">
                  {source.type === 'primary' ? 'Primarni izvor' : 'Sekundarni izvor'}
                </span>
              </li>
            ))}
          </ul>
        </section>
        {post.cta && (
          <p className="news-article-cta">
            <a className="app-button app-button-primary" href={post.cta.href}>
              {post.cta.label} →
            </a>
          </p>
        )}
        <p className="news-back-link">
          <a href="/vijesti">← Svi vodiči</a>
        </p>
      </article>
    </NewsLayout>
  )
}
