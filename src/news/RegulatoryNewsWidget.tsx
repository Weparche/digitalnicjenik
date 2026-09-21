import { formatNewsDate, getLatestPost, newsArticlePath } from './posts'

export function RegulatoryNewsWidget() {
  const post = getLatestPost()
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
