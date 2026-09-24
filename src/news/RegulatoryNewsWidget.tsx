import { formatNewsDate, getLatestPost, getLatestPosts, newsArticlePath } from './posts'

export function MobileNewsLinks() {
  const posts = getLatestPosts(3)
  return (
    <nav className="premium-news-links" aria-label="Zadnje vijesti">
      <ul>
        {posts.map((item) => (
          <li key={item.slug}>
            <a href={newsArticlePath(item.slug)}>{item.widgetHeadline ?? item.title}</a>
          </li>
        ))}
      </ul>
      <a href="/vijesti/">Sve vijesti →</a>
    </nav>
  )
}

export function RegulatoryNewsWidget() {
  const post = getLatestPost()
  const latestPosts = getLatestPosts(3)
  const articleHref = newsArticlePath(post.slug)
  const eyebrow = post.widgetEyebrow ?? 'NOVO · VIJESTI'
  const headline = post.widgetHeadline ?? post.title
  const sub = post.widgetSub ?? post.excerpt

  return (
    <aside className="regulatory-news-widget" aria-labelledby="regulatory-news-widget-title">
      <p className="regulatory-news-widget-eyebrow" id="regulatory-news-widget-title">
        {eyebrow}
      </p>
      <h2 className="regulatory-news-widget-headline">
        <a href={articleHref}>{headline}</a>
      </h2>
      <p className="regulatory-news-widget-sub">{sub}</p>
      <p className="regulatory-news-widget-meta">
        <time dateTime={post.publishedAt}>{formatNewsDate(post.publishedAt)}</time>
        <span> · {post.readingTimeMinutes} min čitanja</span>
      </p>
      <a className="regulatory-news-widget-cta" href={articleHref}>
        Pročitaj vodič →
      </a>
      <nav className="regulatory-news-widget-more" aria-label="Zadnje vijesti">
        <ul>
          {latestPosts.slice(1).map((item) => (
            <li key={item.slug}>
              <a href={newsArticlePath(item.slug)}>{item.widgetHeadline ?? item.title}</a>
            </li>
          ))}
        </ul>
        <a className="regulatory-news-widget-cta" href="/vijesti/">
          Sve vijesti →
        </a>
      </nav>
      {post.sources.length > 0 && (
        <div className="regulatory-news-widget-sources">
          <p className="regulatory-news-widget-sources-label">Izvori</p>
          <ul>
            {post.sources.slice(0, 3).map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.title}
                  <span aria-hidden="true"> ↗</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  )
}
