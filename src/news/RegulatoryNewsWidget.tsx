import { formatNewsDate, getLatestPost, newsArticlePath } from './posts'

const NN_1213 = 'https://narodne-novine.nn.hr/clanci/sluzbeni/2026_09_101_1213.html'
const NN_1212 = 'https://narodne-novine.nn.hr/clanci/sluzbeni/2026_09_101_1212.html'
const HOK_2026 =
  'https://www.hok.hr/novosti-iz-hok/dodatna-cijena-i-objava-cjenika-od-1-listopada-2026-najvaznije-informacije'

export function RegulatoryNewsWidget() {
  const post = getLatestPost()
  const articleHref = newsArticlePath(post.slug)

  return (
    <aside className="regulatory-news-widget" aria-labelledby="regulatory-news-widget-title">
      <p className="regulatory-news-widget-eyebrow" id="regulatory-news-widget-title">
        NOVO · REGULATIVA
      </p>
      <h2 className="regulatory-news-widget-headline">
        <a href={articleHref}>Digitalni cjenik od 1. listopada 2026.</a>
      </h2>
      <p className="regulatory-news-widget-sub">
        Što vlasnici web stranica trebaju pripremiti
      </p>
      <p className="regulatory-news-widget-meta">
        <time dateTime={post.publishedAt}>{formatNewsDate(post.publishedAt)}</time>
        <span> · {post.readingTimeMinutes} min čitanja</span>
      </p>
      <a className="regulatory-news-widget-cta" href={articleHref}>
        Pročitaj vodič →
      </a>
      <div className="regulatory-news-widget-sources">
        <p className="regulatory-news-widget-sources-label">Službeni izvori</p>
        <ul>
          <li>
            <a href={NN_1213} target="_blank" rel="noopener noreferrer">
              Narodne novine — digitalni cjenik (1213)
              <span aria-hidden="true"> ↗</span>
            </a>
          </li>
          <li>
            <a href={NN_1212} target="_blank" rel="noopener noreferrer">
              Narodne novine — dodatna cijena (1212)
              <span aria-hidden="true"> ↗</span>
            </a>
          </li>
          <li>
            <a href={HOK_2026} target="_blank" rel="noopener noreferrer">
              HOK — sažetak od 18.9.2026.
              <span aria-hidden="true"> ↗</span>
            </a>
          </li>
        </ul>
      </div>
    </aside>
  )
}
