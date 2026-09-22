import { useState, type FormEvent } from 'react'
import { formatNewsDate, getPostBySlug, newsArticlePath } from './posts'
import { absoluteAssetUrl } from './site'
import { NewsLayout } from './NewsLayout'

type CheckerResult = {
  status: 'green' | 'yellow' | 'red' | 'unavailable'
  message: string
  details?: {
    csvUrl?: string
    xmlUrl?: string
  }
}

const PUBLISHER_URL = 'https://digitalnicjenik.nepar.hr/#csv-validator'

function ArticleWebsiteChecker() {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<CheckerResult | null>(null)

  async function check(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = url.trim()
    if (!value) {
      setError('Unesite adresu svoje web stranice, primjerice https://mojweb.hr.')
      setResult(null)
      return
    }

    setError('')
    setChecking(true)
    setResult(null)
    try {
      const response = await fetch('/api/digitalni-cjenik/check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: value }),
      })
      const payload = await response.json() as CheckerResult
      if (!payload || !['green', 'yellow', 'red', 'unavailable'].includes(payload.status)) {
        throw new Error('invalid_response')
      }
      setResult(payload)
    } catch {
      setResult({
        status: 'unavailable',
        message: 'Provjeru trenutačno nije moguće dovršiti. Možete pokušati ponovno ili poslati upit.',
      })
    } finally {
      setChecking(false)
    }
  }

  const resultTitle =
    result?.status === 'green'
      ? 'Pronađen je javno dostupan CSV/XML'
      : result?.status === 'yellow'
        ? 'Cjenik postoji, ali CSV/XML nije potvrđen'
        : result?.status === 'red'
          ? 'Javni CSV/XML cjenik nije pronađen'
          : 'Provjeru trenutačno nije moguće dovršiti'

  const mailBody = url.trim()
    ? `Web stranica: ${url.trim()}\n\nMolim provjeru i preporuku za digitalni cjenik.`
    : 'Molim provjeru i preporuku za digitalni cjenik.'
  const mailHref = `mailto:nepar@nepar.hr?subject=${encodeURIComponent('Upit za digitalni cjenik')}&body=${encodeURIComponent(mailBody)}`

  return (
    <section className="news-web-checker" aria-labelledby="news-web-checker-title">
      <div className="news-web-checker-copy">
        <p className="news-web-checker-eyebrow">BESPLATNA PROVJERA</p>
        <h2 id="news-web-checker-title">Provjerite digitalni cjenik svoje web stranice</h2>
        <p>
          Unesite adresu. Provjera gleda javno dostupne tehničke signale i traži CSV/XML cjenik.
        </p>
      </div>
      <form className="news-web-checker-form" onSubmit={check} noValidate>
        <label className="sr-only" htmlFor="news-website-url">Adresa web stranice</label>
        <input
          id="news-website-url"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value)
            if (error) setError('')
          }}
          placeholder="https://vasadomena.hr"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'news-website-error' : 'news-web-checker-note'}
        />
        <button className="app-button app-button-primary" type="submit" disabled={checking}>
          {checking ? 'Provjeravamo…' : 'Provjeri svoj web →'}
        </button>
      </form>
      {error && <p id="news-website-error" className="premium-inline-error" role="alert">{error}</p>}
      <p id="news-web-checker-note" className="news-web-checker-note">
        Javno dostupni signali · bez registracije · bez pravne procjene
      </p>
      {result && (
        <div className={`news-web-checker-result is-${result.status}`} role="status" aria-live="polite">
          <h3>{resultTitle}</h3>
          <p>{result.message}</p>
          {result.status === 'green' && result.details && (
            <div className="news-web-checker-files">
              {result.details.csvUrl && <a href={result.details.csvUrl} target="_blank" rel="noopener noreferrer">CSV ↗</a>}
              {result.details.xmlUrl && <a href={result.details.xmlUrl} target="_blank" rel="noopener noreferrer">XML ↗</a>}
            </div>
          )}
          <p className="news-web-checker-disclaimer">
            Automatska provjera ne potvrđuje pravnu usklađenost, sadržaj svih obveznih polja ni 30-dnevnu arhivu.
          </p>
        </div>
      )}
      <div className="news-web-checker-actions">
        <a className="app-button app-button-primary" href={PUBLISHER_URL}>
          Otvori NEPAR Publisher →
        </a>
        <a className="app-button app-button-light" href={mailHref}>
          Pošalji upit e-mailom
        </a>
      </div>
    </section>
  )
}


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
          <p className="news-kicker">{post.kicker ?? 'Vijesti'}</p>
          <h1>{post.title}</h1>
          <p className="news-article-meta">
            <time dateTime={post.publishedAt}>{formatNewsDate(post.publishedAt)}</time>
            {post.readingTimeMinutes > 0 && (
              <span> · {post.readingTimeMinutes} min čitanja</span>
            )}
          </p>
          <ArticleWebsiteChecker />
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
          const showFormatExample =
            post.formatExample && section.heading === 'Primjer strukture CSV i XML'
          return (
            <section key={section.heading} className="news-section">
              <Tag>{section.heading}</Tag>
              <div
                className="news-section-body"
                dangerouslySetInnerHTML={{ __html: section.html }}
              />
              {showFormatExample && post.formatExample && (
                <div className="news-format-examples">
                  <h3 className="news-format-examples-title">CSV za pružatelja usluga</h3>
                  <pre className="news-code-sample">
                    <code>{post.formatExample.csvText}</code>
                  </pre>
                  <h3 className="news-format-examples-title">XML za pružatelja usluga</h3>
                  <pre className="news-code-sample">
                    <code>{post.formatExample.xmlText}</code>
                  </pre>
                  <div className="news-format-actions">
                    <a
                      className="app-button app-button-light"
                      href={post.formatExample.csvDownloadHref}
                      download
                    >
                      Preuzmi primjer CSV
                    </a>
                    <a className="app-button app-button-primary" href="/#csv-validator">
                      Provjeri svoj CSV →
                    </a>
                  </div>
                </div>
              )}
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
        {(post.cta || post.secondaryCta) && (
          <p className="news-article-cta">
            {post.cta && (
              <a className="app-button app-button-primary" href={post.cta.href}>
                {post.cta.label} →
              </a>
            )}
            {post.secondaryCta && (
              <a className="app-button app-button-light" href={post.secondaryCta.href}>
                {post.secondaryCta.label} →
              </a>
            )}
          </p>
        )}
        <p className="news-back-link">
          <a href="/vijesti">← Svi vodiči</a>
        </p>
      </article>
    </NewsLayout>
  )
}
