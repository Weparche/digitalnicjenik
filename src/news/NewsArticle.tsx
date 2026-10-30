import { Fragment } from 'react'
import { WebsiteCheckEntry } from '../WebsiteCheckEntry'
import { formatNewsDate, getPostBySlug, newsArticlePath } from './posts'
import { absoluteAssetUrl } from './site'
import { NewsLayout } from './NewsLayout'
import { TopicLinks } from '../pages/TopicPages'

const PUBLISHER_URL = 'https://digitalnicjenik.nepar.hr/#csv-validator'
const REGULATION_GUIDE_SLUG = 'digitalni-cjenik-sidrena-cijena-2026'
const REQUIRED_CONTENT_HEADING = 'Što mora sadržavati strojno čitljiv cjenik prema Odluci NN 101/2026?'
const XLSX_CONVERSION_HEADING = 'Kako pretvoriti XLSX u propisani CSV ili XML format?'
const ANCHOR_PRICE_HEADING = 'Što je sidrena cijena i kako je upisati u tablicu?'

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
          <h1>{post.title}</h1>
          <p className="news-article-meta">
            <time dateTime={post.publishedAt}>{formatNewsDate(post.publishedAt)}</time>
            {post.readingTimeMinutes > 0 && (
              <span> · {post.readingTimeMinutes} min čitanja</span>
            )}
          </p>
          <WebsiteCheckEntry source={newsArticlePath(post.slug)}/>
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
        <TopicLinks/>
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
