import { Fragment, useState, type FormEvent } from 'react'
import { formatNewsDate, getPostBySlug, newsArticlePath } from './posts'
import { absoluteAssetUrl } from './site'
import { NewsLayout } from './NewsLayout'

type CheckerResult = {
  status: 'green' | 'yellow' | 'red' | 'unavailable'
  message: string
  details?: {
    reachable?: boolean
    fetchBlocked?: boolean
    csvUrl?: string
    xmlUrl?: string
  }
}

const PUBLISHER_URL = 'https://digitalnicjenik.nepar.hr/#csv-validator'
const REGULATION_GUIDE_SLUG = 'digitalni-cjenik-sidrena-cijena-2026'
const REQUIRED_CONTENT_HEADING = 'Što mora sadržavati strojno čitljiv cjenik prema Odluci NN 101/2026?'
const XLSX_CONVERSION_HEADING = 'Kako pretvoriti XLSX u propisani CSV ili XML format?'
const ANCHOR_PRICE_HEADING = 'Što je sidrena cijena i kako je upisati u tablicu?'

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
        ? result.details?.fetchBlocked
          ? 'Automatski dohvat je blokiran'
          : 'Cjenik postoji, ali CSV/XML nije potvrđen'
        : result?.status === 'red'
          ? result.details?.reachable === false
            ? 'Web stranica nije pronađena'
            : result.details?.fetchBlocked
              ? 'Naslovnica blokira automatski dohvat'
              : 'Javni CSV/XML cjenik nije pronađen'
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
            <a href="/vijesti/">Vijesti</a>
            <span aria-hidden="true"> / </span>
            <span>Nije pronađeno</span>
          </>
        }
      >
        <h1>Članak nije pronađen</h1>
        <p>
          <a href="/vijesti/">Povratak na vijesti →</a>
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
          <a href="/vijesti/">Vijesti</a>
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
          const isRequiredContentSection =
            post.slug === REGULATION_GUIDE_SLUG && section.heading === 'Koji podaci moraju biti u cjeniku?'
          const Tag = section.level === 2 ? 'h2' : 'h3'
          const displayHeading = isRequiredContentSection ? REQUIRED_CONTENT_HEADING : section.heading
          const showFormatExample =
            post.formatExample && section.heading === 'Primjer strukture CSV i XML'
          return (
            <Fragment key={section.heading}>
              <section className="news-section">
                <Tag>{displayHeading}</Tag>
                <div
                  className="news-section-body"
                  dangerouslySetInnerHTML={{ __html: section.html }}
                />
                {isRequiredContentSection && (
                  <div className="news-section-body">
                    <h3>{ANCHOR_PRICE_HEADING}</h3>
                    <p>
                      U službenoj Odluci koristi se izraz <strong>dodatna cijena</strong>, dok se u praksi često govori o sidrenoj cijeni. U tablici je držite kao zasebnu vrijednost uz aktualnu maloprodajnu cijenu. Ne izračunava se iz današnje cijene, nego se preuzima referentna vrijednost prema pravilima koja vrijede za vašu robu ili uslugu. Ako se cijena od referentnog datuma nije mijenjala, aktualna i sidrena cijena mogu biti jednake.
                    </p>
                    <p>
                      Za nove stavke, posebne kategorije te personalizirane ili dinamičke cijene provjerite službeni tekst i važeća pojašnjenja prije objave. Validator može provjeriti postoji li vrijednost u datoteci, ali ne može umjesto vas odrediti koja je povijesna cijena pravno ispravna.
                    </p>
                  </div>
                )}
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
              {isRequiredContentSection && (
                <section className="news-section">
                  <h2>{XLSX_CONVERSION_HEADING}</h2>
                  <div className="news-section-body">
                    <p>
                      XLSX može ostati vaš radni izvor, ali javna strojno čitljiva objava prema Odluci ide u <strong>CSV ili XML</strong>. Odluka propisuje format objave i podatke koje cjenik treba sadržavati, ali ne propisuje jedan univerzalni naziv CSV stupaca, separator ili način na koji morate napraviti konverziju.
                    </p>
                    <ol className="news-bullets">
                      <li><strong>Uredite XLSX:</strong> jedan red neka bude zaglavlje, jedna stavka jedan red, a cijene i obvezni podaci neka budu u zasebnim poljima.</li>
                      <li><strong>Izvezite CSV ili generirajte XML:</strong> kod CSV-a koristite konzistentan separator i kodiranje koje čuva hrvatske znakove; kod XML-a svaka stavka mora imati jasno strukturirana polja.</li>
                      <li><strong>Provjerite prije objave:</strong> validirajte obvezne podatke, naziv objavljene datoteke i javnu dostupnost, a prethodne verzije zadržite onoliko dugo koliko propis zahtijeva.</li>
                    </ol>
                    <p>
                      Ako već imate Excel, možete ga <a href="/#csv-validator">učitati u NEPAR validator</a>; za gotov primjer strukture pogledajte i <a href="/vijesti/primjer-csv-digitalnog-cjenika-usluge-2026/">primjer CSV/XML cjenika za usluge</a>.
                    </p>
                  </div>
                </section>
              )}
            </Fragment>
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
          <a href="/vijesti/">← Svi vodiči</a>
        </p>
      </article>
    </NewsLayout>
  )
}
