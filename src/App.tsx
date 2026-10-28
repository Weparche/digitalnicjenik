import { validRequiredPrice } from './price-engine/normalize'
import { PlanCards } from './PlanCards'
import { PublicationSettings } from './PublicationSettings'
import { AcquisitionLanding } from './AcquisitionLanding'
import { AdminPanel } from './AdminPanel'
import { findSitePage } from './pages/registry'
import { SitePage } from './pages/SitePage'
import { MonitorPanel } from './MonitorPanel'
import { QrCode } from './QrCode'
import { ShareAndPrintCard } from './ShareAndPrintCard'
import { PublisherLogin, usePublisherSession } from './PublisherAuth'
import { Fragment, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { adapters, isServiceItem, parseMarketinoCsv, parseXmlPriceList, renderCsv, renderXml, validatePriceList, importIssuesFromParseWarnings, mergeValidationIssues, type Availability, type NormalizedPriceList, type PricePublication, type ValidationIssue } from './price-engine'
import { ExcelConverter } from './ExcelConverter'
import { usesProductStructure } from './price-engine/profile'
import { EducationSection } from './EducationSection'
import { TurnstileField, type LeadContext, type LeadIntent } from './LeadForm'
import {
  implementationFirstYearLabel,
  selfServicePriceLabel,
} from './publisherPricing'
import { fetchLicence, KeepLinkFlow, LicenceCard } from './PaymentOrder'
import { licenceState, untilLabel, type Licence } from './licenceView'
import { useTurnstileSiteKey } from './turnstileConfig'
import { Logo } from './Logo'
import { readAcquisitionTouch } from './acquisition'
import { NewsArticle } from './news/NewsArticle'
import { NewsIndex } from './news/NewsIndex'

const money = (value: number) => new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(value)
const anchorLabel = (item: NormalizedPriceList['items'][number]) => {
  const date = item.anchorReferenceDate || (isServiceItem(item) ? '2026-09-10' : '')
  return date && Number.isFinite(Date.parse(date)) ? 'Cijena na ' + new Intl.DateTimeFormat('hr-HR', { timeZone: 'Europe/Zagreb' }).format(new Date(date + 'T12:00:00Z')) : 'Sidrena cijena'
}
const productDisplayDetails = (item: NormalizedPriceList['items'][number]) => isServiceItem(item) ? '' : [
  item.externalId ? 'Šifra: ' + item.externalId : '', item.brand ? 'Marka: ' + item.brand : '',
  item.barcode ? 'Barkod: ' + item.barcode : '', item.unit && item.unitPrice != null ? money(item.unitPrice) + ' / ' + item.unit : '',
  item.availability === 'nedostupno' ? 'Nedostupno' : '',
].filter(Boolean).join(' · ')
const dateTime = (value: string) => new Intl.DateTimeFormat('hr-HR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
const slugFromPath = () => window.location.pathname.match(/^\/c\/([^/]+)/)?.[1]
const platformHost = () => ['localhost', '127.0.0.1'].includes(window.location.hostname) || window.location.hostname.endsWith('.pages.dev')

async function writeErrorMessage(response: Response, fallback: string) {
  const payload = await response.json().catch(() => ({})) as { error?: string; code?: string }
  if (response.status === 401) return payload.error || 'Potrebna je prijava ili operator autentikacija.'
  if (response.status === 403) return payload.error || 'Pristup tenantu nije dopušten.'
  if (response.status === 429) return payload.error || 'Previše zahtjeva. Pokušajte kasnije.'
  return payload.error || fallback
}
const isCustomPublication = () => window.location.pathname.startsWith('/arhiva') && !['localhost', '127.0.0.1'].includes(window.location.hostname) && !window.location.hostname.endsWith('.pages.dev')

function download(text: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function Arrow() { return <span className="arrow" aria-hidden="true">↘</span> }

function missingAnchorItems(list: NormalizedPriceList) {
  return list.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => isServiceItem(item) && !validRequiredPrice(item.anchorPrice, true))
}

const PRODUCT_FIELD_GROUPS: Array<{ field: ValidationIssue['field']; label: string }> = [
  { field: 'externalId', label: 'šifru' },
  { field: 'brand', label: 'marku' },
  { field: 'availability', label: 'oznaku dostupnosti' },
  { field: 'barcode', label: 'valjan barkod' },
  { field: 'unitPrice', label: 'cijenu za jedinicu mjere' },
  { field: 'unit', label: 'jedinicu mjere uz cijenu po jedinici' },
]

function summarizeValidationIssues(issues: ValidationIssue[]) {
  const isAnchor = (issue: ValidationIssue) => issue.field === 'anchorPrice' && issue.message.startsWith('Nedostaje sidrena cijena')
  const grouped = new Set(PRODUCT_FIELD_GROUPS.map((group) => group.field))
  const missingAnchors = issues.filter(isAnchor)
  const productGroups = PRODUCT_FIELD_GROUPS.map((group) => {
    const matching = issues.filter((issue) => issue.field === group.field)
    return { ...group, count: matching.length, blocking: matching.some((issue) => issue.severity !== 'warning') }
  }).filter((group) => group.count > 0)
  const other = issues.filter((issue) => !isAnchor(issue) && !grouped.has(issue.field))
  return { missingAnchorCount: missingAnchors.length, productGroups, otherIssues: other }
}

function copyText(value: string) {
  void navigator.clipboard?.writeText(value)
}

function publishedPublicUrls(slug: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://digitalnicjenik.nepar.hr'
  return {
    html: `${origin}/c/${slug}`,
    archive: `${origin}/c/${slug}/arhiva`,
    stableCsv: `${origin}/c/${slug}/cjenik.csv`,
    stableXml: `${origin}/c/${slug}/cjenik.xml`,
  }
}

function PublishedSuccessPanel({
  slug,
  publication,
  message,
  onLead,
  mode = 'sandbox',
}: {
  slug: string
  publication: PricePublication | null
  message: string
  onLead?: (intent: LeadIntent) => void
  mode?: 'sandbox' | 'publisher'
}) {
  const urls = publishedPublicUrls(slug)
  const versionLabel = publication ? `verzija ${publication.sequence}` : null
  const versionCsv = publication ? `${urls.html}/${publication.filenameStem}.csv` : null
  const versionXml = publication ? `${urls.html}/${publication.filenameStem}.xml` : null

  if (mode === 'publisher') {
    return (
      <div className="publish-success-panel publish-success-panel-live" role="status">
        <div className="publish-success-hero">
          <div className="publish-success-mark" aria-hidden="true">
            <svg viewBox="0 0 48 48" width="48" height="48" fill="none">
              <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="2" opacity=".25" />
              <path d="M14 24.5 21 31.5 34 16.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h3>Objavljeno{versionLabel ? ` · ${versionLabel}` : ''}</h3>
          <p>{message || 'Nova verzija je aktivna.'} Stable CSV i XML odmah pokazuju ovu verziju. HTML pregled i arhiva ostaju na vašim trajnim adresama.</p>
        </div>
        <div className="publish-link-grid">
          <div className="publish-link-card">
            <strong>Stable CSV</strong>
            <code>{urls.stableCsv}</code>
            <div className="publish-link-row">
              <a href={urls.stableCsv} target="_blank" rel="noreferrer">Otvori</a>
              <button type="button" className="app-link-button" onClick={() => copyText(urls.stableCsv)}>Kopiraj</button>
            </div>
          </div>
          <div className="publish-link-card">
            <strong>Stable XML</strong>
            <code>{urls.stableXml}</code>
            <div className="publish-link-row">
              <a href={urls.stableXml} target="_blank" rel="noreferrer">Otvori</a>
              <button type="button" className="app-link-button" onClick={() => copyText(urls.stableXml)}>Kopiraj</button>
            </div>
          </div>
          <div className="publish-link-card">
            <strong>Javni HTML</strong>
            <code>{urls.html}</code>
            <div className="publish-link-row">
              <a href={urls.html} target="_blank" rel="noreferrer">Otvori</a>
              <a href={urls.archive} target="_blank" rel="noreferrer">Arhiva</a>
            </div>
          </div>
          {versionCsv && versionXml && (
            <div className="publish-link-card publish-link-card-muted">
              <strong>Ova verzija (immutable)</strong>
              <code>{publication?.filenameStem}.csv / .xml</code>
              <div className="publish-link-row">
                <a href={versionCsv} target="_blank" rel="noreferrer">CSV</a>
                <a href={versionXml} target="_blank" rel="noreferrer">XML</a>
              </div>
            </div>
          )}
        </div>
        <ShareAndPrintCard slug={slug} publicUrl={urls.html} />
      </div>
    )
  }

  return (
    <div className="publish-success-panel" role="status">
      <div className="publish-success-hero">
        <div className="publish-success-mark" aria-hidden="true">
          <svg viewBox="0 0 48 48" width="48" height="48" fill="none">
            <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="2" opacity=".25" />
            <path d="M14 24.5 21 31.5 34 16.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3>Provjera je gotova{versionLabel ? ` · ${versionLabel}` : ''}</h3>
        <p>
          {message || 'Cjenik je uspješno pripremljen.'} Ovo nije trajni hosting — zatražite Publisher self-service ili postavljanje na web.
          Preuzimanja CSV/XML iznad su radne datoteke za vas, ne javni linkovi za klijente.
        </p>
      </div>

      <div className="publish-path-grid" aria-label="Zatražite ponudu">
        <button type="button" className="publish-path-card" onClick={() => onLead?.('plugin')}>
          <strong>Publisher self-service</strong>
          <span>Javni CSV/XML, aktualni link i verzije — sami ugradite link na web.</span>
          <em>{selfServicePriceLabel()} →</em>
        </button>
        <button type="button" className="publish-path-card publish-path-card-featured" onClick={() => onLead?.('implementation')}>
          <strong>Web + Publisher</strong>
          <span>Jednostavan web za cjenik, hosting, SSL i Publisher uz tehničko postavljanje.</span>
          <em>{implementationFirstYearLabel()} →</em>
        </button>
      </div>
    </div>
  )
}

function ValidationResultPanel({
  list,
  validation,
  sourceFilename,
  published,
  busy,
  message,
  publication,
  onUpdateItem,
  onConfirmAnchorsFromRetail,
  onConfirmNoSpecialSale,
  onBulkAvailability,
  onSaveDraft,
  onPublish,
  onStartTrial,
  onLead,
  mode = 'sandbox',
  publishBlocked = false,
}: {
  list: NormalizedPriceList
  validation: { status: string; blockingCount: number; warningCount: number; issues: ValidationIssue[] }
  sourceFilename: string
  published: boolean
  busy: boolean
  message: string
  publication: PricePublication | null
  onUpdateItem: (index: number, patch: Partial<NormalizedPriceList['items'][number]>) => void
  onConfirmAnchorsFromRetail: () => void
  onConfirmNoSpecialSale: () => void
  onBulkAvailability: (value: Availability) => void
  onSaveDraft: () => void
  onPublish: () => void
  onStartTrial?: () => void
  onLead?: (intent: LeadIntent) => void
  mode?: 'sandbox' | 'publisher'
  publishBlocked?: boolean
}) {
  const { missingAnchorCount, productGroups, otherIssues } = summarizeValidationIssues(validation.issues)
  const needsAnchors = missingAnchorCount > 0
  const serviceAnchorsPending = missingAnchorItems(list).length > 0
  const hasProducts = list.items.some((item) => !isServiceItem(item))
  const missingAvailability = list.items.filter((item) => !isServiceItem(item) && !item.availability).length
  const incomplete = validation.blockingCount > 0
  const tableRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!published) return
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    requestAnimationFrame(() => document.querySelector('.publish-success-panel')?.scrollIntoView({ behavior, block: 'start' }))
  }, [published])

  function focusAnchorTable() {
    tableRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
    const firstMissing = tableRef.current?.querySelector<HTMLInputElement>('input.app-table-input.is-required')
    firstMissing?.focus()
  }

  return (
    <section className="validation-app-panel">
      <div className="validation-app-head">
        <div>
          <span className="app-label">3 / REZULTAT</span>
          <h2>{published ? 'Cjenik je objavljen' : mode === 'sandbox' ? 'Pregledajte podatke, zatim objavite' : incomplete ? 'Još nekoliko stvari treba dopuniti' : 'Cjenik je spreman za objavu'}</h2>
          <p>{list.items.length} stavki učitano · {sourceFilename || 'učitana datoteka'}{publication ? ` · verzija ${publication.sequence}` : ''}</p>
        </div>
        <div className={'validation-app-count ' + (published ? 'ready' : incomplete ? 'needs-attention' : 'ready')}>
          <strong>{published ? (publication?.sequence ?? '✓') : incomplete ? validation.blockingCount : 0}</strong>
          <span>{published ? 'objavljeno' : incomplete ? 'za dopunu' : 'bez blokera'}</span>
        </div>
      </div>

      {published ? (
        <PublishedSuccessPanel
          slug={list.tenant.slug || 'nepar'}
          publication={publication}
          message={message}
          onLead={onLead}
          mode={mode}
        />
      ) : (
        <>
      <div className="validation-app-summary">
        <strong>{incomplete ? 'Pronašli smo podatke koje treba dopuniti.' : 'Svi obavezni podaci su popunjeni.'}</strong>
        {!incomplete && mode === 'sandbox' && <span className="validation-ready-formats">CSV ✓ · XML ✓</span>}
        {validation.warningCount > 0 && <span>{validation.warningCount} upozorenja</span>}

        {needsAnchors && (
          <div className="validation-group-callout" role="status">
            <p><strong>{missingAnchorCount} {missingAnchorCount === 1 ? 'stavka nema' : 'stavki nema'} sidrenu cijenu</strong></p>
            <p>Unesite cijenu koja je za pojedinu stavku vrijedila na referentni datum (10. rujna 2026.; za ranije obuhvaćene skupine proizvoda 2. svibnja 2025.), bez posebnog oblika prodaje.</p>
            <button className="app-button app-button-light" type="button" onClick={focusAnchorTable}>Dopuni sidrene cijene</button>
          </div>
        )}

        {productGroups.length > 0 && (
          <div className="validation-group-callout" role="status">
            <p><strong>Cjenik proizvoda: podaci koje Odluka traži</strong></p>
            <ul className="product-field-summary">
              {productGroups.map((group) => (
                <li key={group.field}><b>{group.blocking ? 'RUČNI PREGLED' : 'UPOZORENJE'}</b>{group.count} {group.count === 1 ? 'stavka nema' : 'stavki nema'} {group.label}</li>
              ))}
            </ul>
            {missingAvailability > 0 && (
              <button className="app-link-button" type="button" onClick={() => onBulkAvailability('dostupno')}>Sve bez oznake: dostupno →</button>
            )}
            <button className="app-button app-button-light" type="button" onClick={focusAnchorTable}>Dopuni u tablici</button>
          </div>
        )}

        {otherIssues.length > 0 && (
          <ul>
            {otherIssues.slice(0, 8).map((issue) => (
              <li key={issue.row + '-' + issue.field + '-' + issue.itemKey}>
                <b>{issue.severity === 'manual_review' ? 'RUČNI PREGLED' : issue.severity === 'error' ? 'GREŠKA' : 'UPOZORENJE'}</b>
                {issue.message}
              </li>
            ))}
          </ul>
        )}

        {validation.issues.some((issue) => issue.field === 'specialSaleApplied') && (
          <button className="app-link-button" type="button" onClick={onConfirmNoSpecialSale}>Grupno potvrdi: nije poseban oblik prodaje →</button>
        )}
      </div>

      {serviceAnchorsPending && (
        <div className="anchor-bulk-panel" role="region" aria-label="Sidrene cijene">
          <p className="anchor-bulk-question"><strong>Jesu li ove cijene bile iste 10. rujna 2026.?</strong></p>
          <p className="anchor-bulk-warning">Potvrdite samo ako su navedene redovne cijene, bez akcija i popusta, vrijedile 10. rujna 2026.</p>
          <div className="anchor-bulk-actions">
            <button className="app-button app-button-primary" type="button" onClick={onConfirmAnchorsFromRetail}>
              Da — postavi trenutne cijene kao sidrene
            </button>
            <button className="app-button app-button-light" type="button" onClick={focusAnchorTable}>
              Ne — unijet ću pojedinačno
            </button>
          </div>
        </div>
      )}

      <div className="validator-table-wrap" ref={tableRef}>
        <table>
          <thead>
            <tr>
              <th>Naziv</th>
              <th>Vrsta</th>
              <th>Maloprodajna</th>
              <th>Sidrena cijena</th>
              <th>Posebna prodaja</th>
              {hasProducts && <><th>Šifra</th><th>Marka</th><th>Barkod</th><th>Jedinica i cijena po jedinici</th><th>Dostupnost</th></>}
            </tr>
          </thead>
          <tbody>
            {list.items.map((item, index) => {
              const service = isServiceItem(item)
              const anchorMissing = !validRequiredPrice(item.anchorPrice, isServiceItem(item))
              const specialApplied = item.specialSaleApplied === true
              return (
                <tr key={index} className={anchorMissing ? 'row-needs-anchor' : undefined}>
                  <td>
                    <strong>{item.name}</strong>
                    <small>{item.category || 'Bez kategorije'}</small>
                  </td>
                  <td>{item.type || 'Nije navedena'}</td>
                  <td>{money(item.price)}</td>
                  <td>
                    <label className={'anchor-field' + (anchorMissing ? ' is-required' : '')}>
                      <span className="sr-only">Sidrena cijena za {item.name}</span>
                      <input
                        className={'app-table-input' + (anchorMissing ? ' is-required' : '')}
                        aria-label={'Sidrena cijena za ' + item.name}
                        aria-invalid={anchorMissing}
                        type="number"
                        min={isServiceItem(item) ? 0 : 0.01}
                        step="0.01"
                        placeholder="obavezno"
                        value={item.anchorPrice ?? ''}
                        onChange={(event) => onUpdateItem(index, { anchorPrice: event.target.value ? Number(event.target.value) : null })}
                      />
                      <span aria-hidden="true">€</span>
                    </label>
                    <label className="special-sale-toggle"><span>Datum referentne cijene</span><input className="app-table-input" type="date" aria-label={'Datum referentne cijene za ' + item.name} value={item.anchorReferenceDate ?? (service && !item.isNewSinceReferenceDate ? '2026-09-10' : '')} onChange={event => onUpdateItem(index, { anchorReferenceDate: event.target.value || null })} /></label>
                    <label><input type="checkbox" aria-label={'Nova stavka nakon referentnog datuma za ' + item.name} checked={item.isNewSinceReferenceDate === true} onChange={event => onUpdateItem(index, { isNewSinceReferenceDate: event.target.checked })} /> Nova stavka: datum prvog uvrštenja</label>
                    {!service && <small>2. 5. 2025. za ranije obuhvaćene proizvode; inače 10. 9. 2026. Provjerite primjenjivi režim.</small>}
                  </td>
                  <td>
                    <div className="app-sale-fields">
                      <label className="special-sale-toggle">
                        <span>Posebna prodaja</span>
                        <select
                          aria-label={'Posebna prodaja za ' + item.name}
                          value={specialApplied ? 'da' : item.specialSaleApplied === false ? 'ne' : ''}
                          onChange={(event) => {
                            const value = event.target.value
                            if (value === 'da') onUpdateItem(index, { specialSaleApplied: true })
                            else if (value === 'ne') onUpdateItem(index, { specialSaleApplied: false, specialSaleName: null })
                            else onUpdateItem(index, { specialSaleApplied: null })
                          }}
                        >
                          {item.specialSaleApplied == null && <option value="">Odaberite</option>}
                          <option value="ne">Ne</option>
                          <option value="da">Da</option>
                        </select>
                      </label>
                      {specialApplied && (
                        <input
                          className="app-table-input"
                          aria-label={'Naziv posebne prodaje za ' + item.name}
                          value={item.specialSaleName ?? ''}
                          placeholder="Naziv prodaje"
                          onChange={(event) => onUpdateItem(index, { specialSaleName: event.target.value })}
                        />
                      )}
                      {item.salePrice != null && (
                        <small className="sale-price-note">Akcijska: {money(item.salePrice)}</small>
                      )}
                      {specialApplied && <label className="special-sale-toggle"><span>Prethodna najniža cijena (30 dana)</span><input className="app-table-input" aria-label={'Najniža cijena u 30 dana za ' + item.name} type="number" min="0.01" step="0.01" value={item.lowest30DayPrice ?? ''} onChange={event => onUpdateItem(index, { lowest30DayPrice: event.target.value ? Number(event.target.value) : null })} /><small>Unesite iz svoje evidencije. Sidrena cijena nije zamjena.</small></label>}
                    </div>
                  </td>
                  {hasProducts && (service ? <td colSpan={5}><small>Usluga: ova polja se ne traže.</small></td> : <>
                    <td><input className="app-table-input" aria-label={'Šifra za ' + item.name} value={item.externalId ?? ''} placeholder="šifra" onChange={(event) => onUpdateItem(index, { externalId: event.target.value })} /></td>
                    <td><input className="app-table-input" aria-label={'Marka za ' + item.name} value={item.brand ?? ''} placeholder="marka" onChange={(event) => onUpdateItem(index, { brand: event.target.value })} /></td>
                    <td><input className="app-table-input" inputMode="numeric" aria-label={'Barkod za ' + item.name} value={item.barcode ?? ''} placeholder="EAN" onChange={(event) => onUpdateItem(index, { barcode: event.target.value.replace(/\s+/g, '') || null })} /></td>
                    <td>
                      <div className="app-sale-fields">
                        <input className="app-table-input" aria-label={'Jedinica mjere za ' + item.name} value={item.unit ?? ''} placeholder="npr. kg" onChange={(event) => onUpdateItem(index, { unit: event.target.value || null })} />
                        <input className="app-table-input" aria-label={'Cijena za jedinicu mjere za ' + item.name} type="number" min="0.01" step="0.01" value={item.unitPrice ?? ''} placeholder="€ / jedinica" onChange={(event) => onUpdateItem(index, { unitPrice: event.target.value ? Number(event.target.value) : null })} />
                        {!item.unit && <input className="app-table-input" aria-label={'Razlog iznimke cijene po jedinici za ' + item.name} value={item.unitPricingExemption ?? ''} placeholder="Ako nije primjenjivo: navedite razlog" onChange={event => onUpdateItem(index, { unitPricingExemption: event.target.value || null })} />}
                      </div>
                    </td>
                    <td>
                      <select aria-label={'Dostupnost za ' + item.name} value={item.availability ?? ''} onChange={(event) => onUpdateItem(index, { availability: (event.target.value || null) as Availability | null })}>
                        {!item.availability && <option value="">Odaberite</option>}
                        <option value="dostupno">Dostupno</option>
                        <option value="nedostupno">Nedostupno</option>
                      </select>
                    </td>
                  </>)}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="validator-actions">
        {mode === 'publisher' ? (
          <>
            <button className="app-button app-button-light" type="button" onClick={onSaveDraft} disabled={busy}>Spremi dopune</button>
            <button className="app-button app-button-primary" type="button" onClick={onPublish} disabled={incomplete || busy || published || publishBlocked}>{publishBlocked ? 'Objava zaključana' : 'Objavi novi cjenik'}</button>
          </>
        ) : (
          <button className="app-button app-button-primary" type="button" onClick={onStartTrial} disabled={busy || !list || incomplete}>
            Objavi besplatno na 24 h →
          </button>
        )}
        <div className="output-actions">
          <button type="button" onClick={() => download(renderCsv(list), incomplete ? 'cjenik-radni.csv' : 'cjenik.csv', 'text/csv;charset=utf-8')}>
            {incomplete ? 'Preuzmi radni CSV' : 'Preuzmi CSV'}
          </button>
          <button type="button" onClick={() => download(renderXml(list), incomplete ? 'cjenik-radni.xml' : 'cjenik.xml', 'application/xml')}>
            {incomplete ? 'Preuzmi radni XML' : 'Preuzmi XML'}
          </button>
        </div>
      </div>
      {publishBlocked && <p className="app-error" role="status">Aktivirajte Publisher i isti URL ponovno će biti dostupan. Uređivanje i upload su i dalje mogući.</p>}
      {message && <p className="app-success" role="status">{message}</p>}
      {mode === 'sandbox' && incomplete && (
        <p className="validator-trial-note">Dopunite označene podatke prije javne objave. Radni CSV/XML možete preuzeti za pripremu.</p>
      )}
      {incomplete && mode === 'publisher' && (
        <div className="consultation-card">
          <div>
            <h3>Još treba dopuniti — možemo pomoći.</h3>
            <p>Pošaljite nam cjenik na pregled. Objasnit ćemo što nedostaje i predložiti najkraći put.</p>
          </div>
          <button className="app-button app-button-primary" type="button" onClick={() => onLead?.('consultation')}>
            Zatražite konzultaciju
          </button>
        </div>
      )}
        </>
      )}
    </section>
  )
}

function PublisherFlow() {
  return <section className="publisher-flow" aria-label="NEPAR Publisher workflow">
    {['UČITAJ', 'PROVJERI', 'DOPUNI', 'OBJAVI', 'AKTUALNO + ARHIVA'].map((step, index) => <div className="publisher-step" key={step}><span>0{index + 1}</span><strong>{step}</strong>{index < 4 && <Arrow />}</div>)}
  </section>
}

function PrintPriceTable({ groups }: { groups: Array<[string, NormalizedPriceList['items']]> }) {
  // A real table so browsers repeat the header on every A4 page (thead { display: table-header-group }).
  return <table className="print-table">
    <thead><tr><th scope="col">Naziv</th><th scope="col">Napomena</th><th scope="col" className="print-price-col">Cijena</th></tr></thead>
    <tbody>
      {groups.map(([category, items]) => <Fragment key={category}>
        <tr className="print-category"><th scope="colgroup" colSpan={3}>{category}</th></tr>
        {items.map((item) => <tr key={category + ':' + (item.externalId || item.name)}>
          <td>{item.name}</td>
          <td>{productDisplayDetails(item)}{productDisplayDetails(item) ? ' · ' : ''}{item.specialSaleApplied === true ? 'Poseban oblik prodaje: ' + (item.specialSaleName || 'potvrđeno') : ''}{item.anchorPrice != null ? (item.specialSaleApplied === true ? ' · ' : '') + anchorLabel(item) + ': ' + money(item.anchorPrice) : ''}</td>
          <td className="print-price-col">{item.specialSaleApplied === true && item.lowest30DayPrice != null && <del title="Prethodna najniža cijena u 30 dana">{money(item.lowest30DayPrice)} </del>}<strong>{money(item.salePrice ?? item.price)}</strong></td>
        </tr>)}
      </Fragment>)}
    </tbody>
  </table>
}

function PublicPriceList({ slug, customHost = false }: { slug?: string; customHost?: boolean }) {
  const [list, setList] = useState<NormalizedPriceList | null>(null)
  const [publications, setPublications] = useState<PricePublication[]>([])
  const [error, setError] = useState('')
  const [gone, setGone] = useState(false)
  const isArchive = window.location.pathname.includes('/arhiva')
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const endpoint = isArchive ? (customHost ? '/api/publication/archive' : '/api/publication/retained?slug=' + encodeURIComponent(slug || '')) : customHost ? '/api/publication/current' : '/api/tenants/' + slug
        const response = await fetch(endpoint)
        if (response.status === 410) {
          if (!cancelled) setGone(true)
          return
        }
        if (!response.ok) throw new Error('Cjenik nije dostupan.')
        const payload = await response.json() as { priceList?: NormalizedPriceList; publication?: PricePublication; publications?: PricePublication[] }
        const nextList = payload.priceList ?? payload.publication?.payload
        if (!nextList) throw new Error('Nema objavljene verzije.')
        if (!cancelled) {
          setList(nextList)
          setPublications(payload.publications ?? [])
        }
        if (customHost && isArchive) {
          const archive = await fetch('/api/publication/archive')
          if (archive.ok) setPublications((await archive.json() as { publications: PricePublication[] }).publications ?? [])
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Cjenik nije dostupan.')
      }
    })()
    return () => { cancelled = true }
  }, [customHost, slug, isArchive])
  const variantParams = new URLSearchParams(window.location.search)
  const mode: 'embed' | 'print' | 'normal' = isArchive ? 'normal' : variantParams.get('embed') === '1' ? 'embed' : variantParams.get('print') === '1' ? 'print' : 'normal'
  const embedSlug = slug ?? list?.tenant.slug ?? ''
  useEffect(() => {
    // Embedded in a customer site by embed.js: report our content height (not documentElement.scrollHeight, which never drops below the iframe height).
    if (mode !== 'embed' || window.parent === window || typeof ResizeObserver === 'undefined') return
    const post = () => window.parent.postMessage({ type: 'nepar-cjenik-resize', slug: embedSlug, height: Math.ceil(document.body.getBoundingClientRect().height) }, '*')
    post()
    const observer = new ResizeObserver(post)
    observer.observe(document.body)
    return () => observer.disconnect()
  }, [mode, embedSlug, list])
  if (gone) return <main className="public-shell"><div className="public-top"><Logo /><span className="public-badge">NEDOSTUPNO</span></div><div className="public-not-found"><p className="eyebrow">NEPAR PUBLISHER</p><h1>Ovaj cjenik trenutačno nije dostupan.</h1><p><a href={customHost ? '/arhiva' : '/c/' + slug + '/arhiva'}>Arhiva zadržanih objava</a></p></div></main>
  if (error) return <main className="public-shell"><div className="public-top"><Logo /><span className="public-badge">PUBLICATION ERROR</span></div><div className="public-not-found"><p className="eyebrow">NEPAR PUBLISHER</p><h1>Cjenik trenutno nije dostupan.</h1><p>{error}</p></div></main>
  if (!list) return <main className="public-shell"><div className="loading-state">Učitavam objavljeni cjenik…</div></main>
  const grouped = Object.entries(list.items.reduce<Record<string, NormalizedPriceList['items']>>((groups, item) => { const key = item.category || 'Usluge'; (groups[key] ||= []).push(item); return groups }, {}))
  const demo = slug === 'patrisa-sisa'
  const currentPublication = publications.find((publication) => publication.isCurrent)
  const publicUrl = customHost ? `${window.location.origin}/` : `${window.location.origin}/c/${slug}`
  const showChrome = mode === 'normal'
  return <main className={`public-shell${mode === 'normal' ? '' : ` public-shell--${mode}`}`}>
    {mode === 'print' && <div className="print-toolbar"><button className="app-button app-button-primary" type="button" onClick={() => window.print()}>Ispis / Spremi kao PDF</button><a href={customHost ? '/' : '/c/' + slug}>← Natrag na cjenik</a></div>}
    {showChrome && <div className="public-top"><Logo /><span className="public-badge">{demo ? 'DEMO PODACI' : isArchive ? 'JAVNA ARHIVA' : 'AKTUALNI CJENIK'}</span></div>}
    <header className="public-header"><p className="eyebrow">NEPAR PUBLISHER</p><h1>{list.tenant.name}</h1><p className="public-updated">Zadnje objavljeno: {dateTime(list.updatedAt)}</p>{demo && <p className="public-demo-note">Demo podaci — ovo nije stvarni cjenik salona.</p>}</header>
    {mode === 'print' && <section className="print-qr" aria-label="QR kod za aktualni cjenik"><QrCode value={publicUrl} label={'QR kod: ' + publicUrl} size={112} /><div><strong>Aktualni digitalni cjenik</strong><span>Skenirajte QR kod ili otvorite:</span><span className="print-url">{publicUrl}</span>{currentPublication && <span>Verzija {currentPublication.sequence} · objavljeno {dateTime(currentPublication.publishedAt)}</span>}</div></section>}
    {showChrome && !isArchive && (
      <aside className="public-checker-cta">
        <div>
          <strong>Provjerite svoju web stranicu</strong>
          <p>Imate li javno dostupan ispravan CSV ili XML digitalni cjenik? Besplatna tehnička provjera.</p>
        </div>
        <a className="app-button app-button-primary" href="https://digitalnicjenik.nepar.hr/">Provjeri svoju stranicu →</a>
      </aside>
    )}
    {isArchive ? <section className="public-list public-archive" aria-label="Javna arhiva cjenika"><div className="public-list-title"><span>Arhiva objavljenih verzija</span><span className="item-count">{publications.length} verzija</span></div>{publications.map((publication) => <div className="public-archive-item" key={publication.id}><div><strong>{publication.isCurrent ? 'Aktualno · ' : ''}{dateTime(publication.publishedAt)}</strong><small>{publication.filenameStem}</small></div><div className="archive-links"><a href={(customHost ? '/' : '/c/' + slug + '/') + publication.filenameStem + '.csv'}>CSV</a><a href={(customHost ? '/' : '/c/' + slug + '/') + publication.filenameStem + '.xml'}>XML</a></div></div>)}<p className="public-archive-note">Prethodne objavljene verzije ostaju javno dostupne najmanje 30 dana od trenutka zamjene.</p></section> : <section className="public-list" aria-label="Aktualni digitalni cjenik">
      <div className="public-list-title"><span>Aktualni digitalni cjenik</span><span className="item-count">{list.items.length} stavki</span></div>
      {mode === 'print' ? <PrintPriceTable groups={grouped} /> : grouped.map(([category, items]) => <section className="price-group" key={category}><h2>{category}</h2>{items.map((item) => <div className="public-row" key={item.externalId || item.name}><div><strong>{item.name}</strong><small>{productDisplayDetails(item)}{productDisplayDetails(item) ? ' · ' : ''}{item.specialSaleApplied === true ? 'Poseban oblik prodaje: ' + (item.specialSaleName || 'potvrđeno') : ''}{item.anchorPrice != null ? (item.specialSaleApplied === true ? ' · ' : '') + anchorLabel(item) + ': ' + money(item.anchorPrice) : ''}</small></div><div className="public-price">{item.specialSaleApplied === true && item.lowest30DayPrice != null && <del title="Prethodna najniža cijena u 30 dana">{money(item.lowest30DayPrice)}</del>}<strong>{money(item.salePrice ?? item.price)}</strong></div></div>)}</section>)}
    </section>}
    {showChrome && !isArchive && <section className="public-links"><div><strong>Aktualni digitalni cjenik</strong><span><a href={currentPublication ? '/' + currentPublication.filenameStem + '.csv' : '/cjenik.csv'}>{currentPublication ? currentPublication.filenameStem + '.csv' : 'Preuzmi CSV'}</a>{currentPublication && <a href={'/' + currentPublication.filenameStem + '.xml'}>{currentPublication.filenameStem + '.xml'}</a>}</span></div><div><strong>Stable URL za automatizirani dohvat</strong><span><a href="/cjenik.csv">cjenik.csv</a><a href="/cjenik.xml">cjenik.xml</a></span></div></section>}
    <footer className="public-footer"><span>Pokreće NEPAR Publisher</span>{!isArchive && <a href={(customHost ? '/arhiva/' : '/c/' + slug + '/arhiva')}>Arhiva</a>}<a href={customHost ? '/cjenik.csv' : '/c/' + slug + '/cjenik.csv'}>CSV</a><a href={customHost ? '/cjenik.xml' : '/c/' + slug + '/cjenik.xml'}>XML</a><a href="https://digitalnicjenik.nepar.hr/">Provjeri CSV/XML na webu</a></footer>
  </main>
}

function ValidationSummary({ issues, itemCount }: { issues: ValidationIssue[]; itemCount: number }) {
  const blockers = issues.filter((issue) => issue.severity !== 'warning').length
  const warnings = issues.filter((issue) => issue.severity === 'warning').length
  return <div className="validation-summary" role="status"><strong>{itemCount} stavki učitano</strong><span className={blockers ? 'has-issue' : 'is-good'}>{blockers ? '⚠ ' + blockers + ' za dopunu' : '✓ Sve spremno'}</span>{warnings > 0 && <span>⚠ {warnings} upozorenja</span>}{issues.length > 0 && <ul className="validation-issue-list">{issues.slice(0, 6).map((issue) => <li key={issue.row + '-' + issue.field + '-' + issue.itemKey}><b>{issue.severity === 'manual_review' ? 'RUČNI PREGLED' : issue.severity === 'error' ? 'GREŠKA' : 'UPOZORENJE'}</b>{issue.message}</li>)}</ul>}{issues.some((issue) => issue.field === 'specialSaleApplied') && <button className="text-button validation-group-button" type="button" onClick={() => window.dispatchEvent(new Event('nepar:confirm-no-special-sale'))}>Grupno potvrdi: nije poseban oblik prodaje <span>→</span></button>}</div>
}

function Pricing() {
  return <section className="pricing-section" id="pricing"><h2>Rješenja za objavu cjenika</h2><PlanCards /></section>
}

type CheckerDetails = {
  reachable?: boolean
  fetchBlocked?: boolean
  csvFound?: boolean
  xmlFound?: boolean
  csvUrl?: string | null
  xmlUrl?: string | null
  pricePageFound?: boolean
}

type CheckerResult = {
  status: 'green' | 'yellow' | 'red' | 'unavailable'
  message: string
  details?: CheckerDetails
}

function ReadinessChecker() {
  const [url, setUrl] = useState('')
  const [urlError, setUrlError] = useState('')
  const [result, setResult] = useState<CheckerResult | null>(null)
  const [checking, setChecking] = useState(false)

  async function check(event?: React.FormEvent) {
    event?.preventDefault()
    const value = url.trim()
    if (!value) {
      setUrlError('Unesite adresu svoje web stranice, primjerice https://mojweb.hr.')
      setResult(null)
      return
    }
    setUrlError('')
    setChecking(true)
    setResult(null)
    try {
      const response = await fetch('/api/digitalni-cjenik/check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: value }),
      })
      const payload = await response.json() as CheckerResult
      if (!payload || !['green', 'yellow', 'red', 'unavailable'].includes(payload.status)) throw new Error('invalid_response')
      setResult(payload)
    } catch {
      setResult({ status: 'unavailable', message: 'Provjeru trenutačno nije moguće dovršiti. Pokušajte ponovno.' })
    } finally {
      setChecking(false)
    }
  }

  const details = result?.details ?? {}
  const resultTitle = result?.status === 'green' ? 'Strojni cjenik pronađen' : result?.status === 'yellow' ? (result.details?.fetchBlocked ? 'Automatski dohvat je blokiran' : 'Cjenik postoji, ali strojna datoteka nije potvrđena') : result?.status === 'red' ? (result.details?.reachable === false ? 'Web stranica nije pronađena' : result.details?.fetchBlocked ? 'Naslovnica blokira automatski dohvat' : 'Strojni cjenik nije pronađen') : 'Provjera trenutačno nije dostupna'
  const resultClass = result?.status === 'green' ? 'is-green' : result?.status === 'yellow' ? 'is-yellow' : result?.status === 'red' ? 'is-red' : 'is-unavailable'

  return <div className="readiness-checker" id="checker">
    <div className="checker-form-panel">
      <div><span className="checker-label">PRVI KORAK</span><h2>Provjerite svoj web</h2><p>Provjera gleda samo javno dostupne tehničke signale. Ne morate se registrirati.</p></div>
      <form onSubmit={check} noValidate>
        <label className="sr-only" htmlFor="website-readiness-url">Adresa web stranice</label>
        <input id="website-readiness-url" value={url} onChange={(event) => { setUrl(event.target.value); if (urlError) setUrlError('') }} placeholder="https://mojweb.hr" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck="false" aria-invalid={Boolean(urlError)} aria-describedby={urlError ? 'website-readiness-error' : undefined} />
        <button className="button button-amber" type="submit" disabled={checking}>{checking ? 'Provjeravamo…' : 'Provjeri web'} <span>{checking ? '◌' : '→'}</span></button>
      </form>
      {urlError && <p id="website-readiness-error" className="checker-error" role="alert">{urlError}</p>}
      <p className="checker-helper">Provjeravamo postoji li javno dostupan CSV ili XML cjenik. Ne potvrđujemo pravnu usklađenost.</p>
    </div>
    {result && <div className={'checker-result ' + resultClass} role="status" aria-live="polite"><div className="checker-result-heading"><span className="result-mark" aria-hidden="true">{result.status === 'green' ? '✓' : result.status === 'unavailable' ? '!' : '·'}</span><div><span className="checker-label">REZULTAT PROVJERE</span><h3>{resultTitle}</h3></div></div><p>{result.message}</p>{result.status === 'green' && <div className="checker-found"><span>CSV: {details.csvUrl ? <a href={details.csvUrl} target="_blank" rel="noreferrer">{details.csvUrl}</a> : 'nije pronađen'}</span><span>XML: {details.xmlUrl ? <a href={details.xmlUrl} target="_blank" rel="noreferrer">{details.xmlUrl}</a> : 'nije pronađen'}</span></div>}{result.status === 'green' && <a className="checker-result-cta" href="https://nepar.hr/digitalni-cjenik">Želite ga prikazati i održavati na webu? Pogledajte NEPAR Publisher →</a>}{result.status === 'red' && <p className="checker-next-step">Možete učitati CSV za besplatnu provjeru ili zatražiti da NEPAR pretvori i postavi vaš postojeći cjenik.</p>}{result.status === 'unavailable' && <button className="text-button" type="button" onClick={() => void check()}>Pokušajte ponovno →</button>}</div>}
    <div className={'checker-paths ' + (result ? 'has-result' : '')}><h2>Što želite napraviti?</h2><div className="checker-path-grid"><a className="checker-path" href="#demo"><span>01</span><strong>Imam CSV</strong><small>Učitaj i besplatno provjeri</small></a><a className="checker-path" href="https://nepar.hr/digitalni-cjenik"><span>02</span><strong>Nemam CSV</strong><small>Pretvorite moj postojeći cjenik</small></a><a className="checker-path checker-path-featured" href="https://nepar.hr/digitalni-cjenik"><span>03</span><strong>Želim sve riješeno</strong><small>Web + Publisher {implementationFirstYearLabel()}</small></a></div></div>
  </div>
}

function PublisherWorkspace() {
  const [list, setList] = useState<NormalizedPriceList | null>(null)
  const [draftId, setDraftId] = useState('')
  const [issues, setIssues] = useState<ValidationIssue[]>([])
  const [sourceFilename, setSourceFilename] = useState('')
  const [step, setStep] = useState<'upload' | 'validate' | 'complete' | 'published'>('upload')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [publication, setPublication] = useState<PricePublication | null>(null)
  const [message, setMessage] = useState('')
  const validation = useMemo(() => {
    if (!list) return { status: 'invalid' as const, issues, blockingCount: issues.length, warningCount: 0 }
    return mergeValidationIssues(validatePriceList(list), issues.filter((issue) => issue.code === 'IMPORT_ROW_SKIPPED'))
  }, [list, issues])
  useEffect(() => {
    const confirmGroup = () => {
      if (!window.confirm('Potvrdite da nijedna akcijska cijena nije primijenjena tijekom posebnog oblika prodaje.')) return
      setList((current) => current ? { ...current, items: current.items.map((item) => item.specialSaleApplied == null && item.salePrice == null ? { ...item, specialSaleApplied: false, specialSaleName: null } : item) } : current)
    }
    window.addEventListener('nepar:confirm-no-special-sale', confirmGroup)
    return () => window.removeEventListener('nepar:confirm-no-special-sale', confirmGroup)
  }, [])
  const updateItem = (index: number, patch: Partial<NormalizedPriceList['items'][number]>) => setList((current) => current ? { ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) } : current)

  async function loadDemo() {
    setError(''); setMessage(''); setBusy(true)
    try {
      const response = await fetch('/api/tenants/nepar')
      if (!response.ok) throw new Error('local')
      const payload = await response.json() as { priceList: NormalizedPriceList }
      setList(payload.priceList); setStep('published'); setSourceFilename('demo-cjenik.csv'); return
    } catch {
      const loaded = await adapters.nepar.load()
      setList(loaded); setStep('published'); setSourceFilename('demo-cjenik.csv')
    } finally { setBusy(false) }
  }

  async function loadFile(file?: File) {
    if (!file) return
    setError(''); setMessage(''); setBusy(true)
    try {
      const raw = await file.text()
      const isXml = file.name.toLowerCase().endsWith('.xml')
      if (!isXml && !file.name.toLowerCase().endsWith('.csv')) throw new Error('Učitajte datoteku s nastavkom .csv ili .xml.')
      const parsed = isXml
        ? { priceList: parseXmlPriceList(raw, { id: 'nepar', slug: 'nepar', name: 'NEPAR' }), warnings: [] as { row: number; message: string }[] }
        : parseMarketinoCsv(raw, { id: 'nepar', slug: 'nepar', name: 'NEPAR' })
      setList(parsed.priceList); setSourceFilename(file.name); setStep('validate')
      const result = mergeValidationIssues(validatePriceList(parsed.priceList), importIssuesFromParseWarnings(parsed.warnings || [], isXml ? 'xml' : 'csv'))
      setIssues(result.issues)
      const response = await fetch('/api/validator/validate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(isXml ? { xml: raw } : { csv: raw }) })
      if (response.ok) { const remote = await response.json() as { validation: { issues: ValidationIssue[] } }; setIssues(remote.validation.issues) }
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'CSV se ne može učitati.') } finally { setBusy(false) }
  }

  async function createRemoteDraft() {
    if (!list) return null
    const response = await fetch('/api/tenants/nepar/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ priceList: { items: list.items, currency: list.currency, updatedAt: list.updatedAt, source: list.source }, sourceFilename, importIssues: issues.filter(issue => issue.code === 'IMPORT_ROW_SKIPPED') }) })
    if (!response.ok) throw new Error(await writeErrorMessage(response, 'Draft nije spremljen.'))
    const payload = await response.json() as { draft: { id: string }; validation: { issues: ValidationIssue[] } }
    setDraftId(payload.draft.id); setIssues(payload.validation.issues)
    return payload.draft.id
  }

  async function saveDraft() {
    if (!list) return
    setBusy(true); setError(''); setMessage('')
    try {
      let idToSave = draftId
      if (!idToSave) idToSave = await createRemoteDraft() || ''
      if (idToSave) {
        const response = await fetch('/api/tenants/nepar/draft/' + idToSave, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ priceList: { items: list.items, currency: list.currency, updatedAt: list.updatedAt, source: list.source } }) })
        if (!response.ok) throw new Error(await writeErrorMessage(response, 'Dopuna nije spremljena.'))
        const payload = await response.json() as { validation: { issues: ValidationIssue[] } }
        setIssues(payload.validation.issues)
      } else setIssues(validatePriceList(list).issues)
      setStep('complete')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Dopuna nije uspjela.') } finally { setBusy(false) }
  }

  async function publish() {
    if (!list || validation.blockingCount > 0) return
    setBusy(true); setError(''); setMessage('')
    try {
      let idToPublish = draftId
      if (!idToPublish) idToPublish = await createRemoteDraft() || ''
      if (!idToPublish) throw new Error('Za objavu pokrenite Cloudflare Pages lokalni server.')
      const saved = await fetch('/api/tenants/nepar/draft/' + idToPublish, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ priceList: { items: list.items, currency: list.currency, updatedAt: list.updatedAt, source: list.source } }) })
      if (!saved.ok) throw new Error(await writeErrorMessage(saved, 'Dopuna nije spremljena.'))
      const response = await fetch('/api/tenants/nepar/publish', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ draftId: idToPublish }) })
      const payload = await response.json() as { error?: string; message?: string; publication?: PricePublication }
      if (!response.ok) throw new Error(payload.error || (response.status === 429 ? 'Previše zahtjeva. Pokušajte kasnije.' : response.status === 401 ? 'Potrebna je operator autentikacija.' : response.status === 403 ? 'Pristup tenantu nije dopušten.' : 'Objava nije uspjela.'))
      setPublication(payload.publication ?? null); setMessage(payload.message || 'Cjenik je objavljen.'); setStep('published')
      const current = await fetch('/api/tenants/nepar').then((item) => item.json()) as { priceList: NormalizedPriceList }
      setList(current.priceList)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Objava nije uspjela.') } finally { setBusy(false) }
  }

  const canPublish = list && validation.blockingCount === 0
  return <section className="demo-section" id="demo"><div className="section-heading"><p className="eyebrow">BESPLATNA PROVJERA / 01</p><h2>Učitajte cjenik.<br /><em>Mi ćemo vam reći što nedostaje.</em></h2><p>Izvezite CSV iz programa u kojem vodite cijene, učitajte ga ovdje i dopunite samo podatke potrebne za objavu.</p></div><PublisherFlow /><div className="source-picker"><button className={'source-choice ' + (step === 'published' ? 'selected' : '')} onClick={loadDemo} disabled={busy}><span className="choice-number">01</span><span><strong>Otvori demo cjenik</strong><small>Demo podaci — ovo nije stvarni cjenik salona</small></span><span className="choice-arrow">↗</span></button><label className={'source-choice file-choice ' + (step !== 'published' && list ? 'selected' : '')}><span className="choice-number">02</span><span><strong>Učitaj CSV cjenik</strong><small>Upload, provjera i preview</small></span><span className="choice-arrow">↗</span><input type="file" accept=".csv,text/csv" onChange={(event) => loadFile(event.target.files?.[0])} /></label><div className="source-choice upcoming"><span className="choice-number">03</span><span><strong>AutoSync <em>USKORO</em></strong><small>Automatsko ažuriranje iz vašeg sustava</small></span><span className="choice-arrow">→</span></div></div>{busy && <div className="inline-status" role="status"><span className="status-dot" /> Obrada cjenika…</div>}{error && <div className="error-box" role="alert"><strong>Potrebna je pažnja</strong><span>{error}</span></div>}{list && step !== 'published' && <div className="preview-panel"><div className="preview-head"><div><p className="eyebrow">PROVJERA / DOPUNA</p><h3>Podaci prije objave</h3></div><ValidationSummary issues={validation.issues} itemCount={list.items.length} /></div><div className="table-wrap"><table><thead><tr><th>Naziv</th><th>Maloprodajna</th><th>Sidrena</th><th>Posebna prodaja</th></tr></thead><tbody>{list.items.map((item, index) => <tr key={item.externalId || item.name}><td><strong>{item.name}</strong><small>{item.type || 'Vrsta nije navedena'}</small></td><td>{money(item.price)}</td><td><input className="table-input" aria-label={'Sidrena cijena za ' + item.name} type="number" min={isServiceItem(item) ? 0 : 0.01} step="0.01" value={item.anchorPrice ?? ''} onChange={(event) => updateItem(index, { anchorPrice: event.target.value ? Number(event.target.value) : null })} /></td><td>{item.salePrice != null ? <div className="sale-fields"><label><input type="checkbox" checked={item.specialSaleApplied === true} onChange={(event) => updateItem(index, { specialSaleApplied: event.target.checked, specialSaleName: event.target.checked ? item.specialSaleName : null })} /> potvrđeno</label>{item.specialSaleApplied === true && <input className="table-input" aria-label={'Naziv posebne prodaje za ' + item.name} value={item.specialSaleName ?? ''} placeholder="Naziv oblika" onChange={(event) => updateItem(index, { specialSaleName: event.target.value })} />}</div> : <span className="muted-cell">Nije navedeno</span>}</td></tr>)}</tbody></table></div><p className="validation-note">{validation.blockingCount ? 'Objava je zaključana dok se ne riješe označene stavke.' : 'Cjenik je spreman za objavu.'}</p><div className="preview-actions"><button className="button button-dark" onClick={saveDraft} disabled={busy}>Spremi dopune <span>→</span></button><button className="button button-amber" onClick={publish} disabled={!canPublish || busy}>Objavi novi cjenik <span>→</span></button></div></div>}{list && step === 'published' && <div className="published-panel" role="status"><div><span className="status-dot" /><strong>Aktualni cjenik je objavljen</strong><p>{publication ? publication.filenameStem + '.csv / .xml' : 'Stable current alias i javna arhiva su aktivni.'}</p></div><a className="button button-amber" href="/c/nepar">Otvori cjenik <span>↗</span></a></div>}{message && <p className="success-line">{message}</p>}</section>
}

function LandingLegacy() {
  return <div className="app-shell"><header className="site-header"><Logo /><nav><a href="#workflow">Kako radi</a><a href="#demo">Provjeri CSV</a><a href="#pricing">Cijene</a></nav><a className="header-cta" href="#demo">Besplatno provjeri <span>→</span></a></header><main>
    <section className="hero"><div className="hero-copy"><p className="eyebrow">NEPAR PUBLISHER <span className="eyebrow-rule" /></p><h1>Sve ćemo vam postaviti — <em>od 49,90 €.</em></h1><p className="hero-sub">Godišnji paketi Link, Publisher i Web + Publisher. Ili zatražite konzultaciju nakon besplatne provjere.</p><div className="hero-actions"><a className="button button-amber" href="#demo">Besplatno provjeri CSV <span>→</span></a><a className="button button-outline" href="#pricing">Pogledaj opcije <span>↘</span></a></div><p className="hero-note"><span className="status-dot" /> CSV upload, validacija i preview su besplatni.</p></div><div className="hero-visual" aria-label="Vizualni prikaz toka CSV datoteke do objavljenog cjenika"><picture className="visual-asset"><source media="(max-width: 520px)" srcSet="/assets/nepar-orchestration-mobile.webp" /><img src="/assets/nepar-orchestration-desktop.webp" alt="CSV dokument prolazi kroz provjeru i postaje javni digitalni cjenik" /></picture><div className="visual-top"><span>PUBLICATION / READY</span><span>NP—001</span></div><div className="visual-grid" /><div className="visual-core"><span className="core-ring ring-one" /><span className="core-ring ring-two" /><span className="core-ring ring-three" /><div className="core-label"><span>NEPAR</span><strong>PUBLISH<br />READY</strong></div></div><div className="visual-rail rail-source"><span>01 / INPUT</span><strong>CSV EXPORT</strong><i /></div><div className="visual-rail rail-web"><span>02 / OUTPUT</span><strong>WEB</strong><i /></div><div className="visual-rail rail-csv"><span>03 / OUTPUT</span><strong>CSV · XML · ARHIVA</strong><i /></div><div className="visual-readout"><span>LAST EVENT</span><strong>PUBLICATION.CREATED</strong><b>●</b></div></div></section>
    <section className="proof-strip"><span>Učitajte jednom</span><span>→</span><strong>objavite ispravno</strong><span className="proof-fade">i čuvajte svaku verziju</span></section>
    <section className="engine-section" id="workflow"><div className="section-heading"><p className="eyebrow">JEDNOSTAVAN WORKFLOW</p><h2>Vaš poslovni sustav<br /><em>ostaje izvor istine.</em></h2><p>NEPAR provjerava podatke koje već imate, pomaže popuniti što nedostaje i objavljuje ih na pravom mjestu.</p></div><div className="interactive-flow"><PublisherFlow /><div className="workflow-explanation"><div><strong>Validator</strong><span>Besplatna provjera bez objave.</span></div><Arrow /><div><strong>Publisher</strong><span>Jedna immutable verzija po objavi.</span></div><Arrow /><div><strong>Arhiva</strong><span>Aktualna i prethodne verzije na dohvat.</span></div></div></div></section>
    <PublisherWorkspace /><Pricing />
  </main><footer className="site-footer"><Logo /><span>NEPAR Publisher / MVP</span><a href="/c/nepar">Javni demo cjenik ↗</a></footer></div>
}

type LandingVariant = '1' | '2' | '3'

function VariantBottom() {
  return <><section className="engine-section" id="workflow"><div className="section-heading"><p className="eyebrow">KAKO RADI</p><h2>Jedan jasan put<br /><em>do cjenika na webu.</em></h2><p>Prvo provjerite web. Ako već imate CSV, provjerite ga besplatno. Ako želite, NEPAR može pretvoriti i postaviti cijeli cjenik.</p></div><div className="interactive-flow"><PublisherFlow /><div className="workflow-explanation"><div><strong>Provjeri web</strong><span>Pronađite javni CSV ili XML.</span></div><Arrow /><div><strong>Provjeri CSV</strong><span>Učitajte datoteku i dopunite što nedostaje.</span></div><Arrow /><div><strong>Objavi</strong><span>Publisher održava aktualni cjenik i arhivu.</span></div></div></div></section><PublisherWorkspace /><Pricing /></>
}

function LandingVariant({ variant }: { variant: LandingVariant }) {
  const content = variant === '1'
    ? { label: 'PREGLED ZA VLASNIKE WEB STRANICA', title: <>Prvo provjerite.<br /><em>Onda odlučite.</em></>, body: 'U nekoliko sekundi saznajte može li vaš web već ponuditi strojni cjenik. Ako ne može, pokazat ćemo vam najjednostavniji sljedeći korak.', sideTitle: 'Bez nagađanja', sideBody: 'Provjeravamo samo ono što je javno dostupno vašim kupcima.', sideItems: ['Javni CSV ili XML dokument', 'Dostupnost bez prijave', 'Tehnički rezultat, bez pravnih obećanja'] }
    : variant === '2'
      ? { label: 'NEPAR / WEB CHECKER', title: <>Ne nagađajte.<br /><em>Provjerite.</em></>, body: 'Jedan URL. Jedan jasan rezultat. Bez registracije, bez poziva i bez čitanja tehničke dokumentacije.', sideTitle: 'Vaš prvi odgovor', sideBody: 'Ako pronađemo datoteku, pokazujemo točan URL. Ako ne pronađemo, dobit ćete konkretan izbor.', sideItems: ['GREEN — dokument potvrđen', 'YELLOW — cjenik postoji, datoteka nije potvrđena', 'RED — nema potvrđenog strojnog cjenika'] }
      : { label: 'NEPAR PUBLISHER', title: <>Vaš web, vaš cjenik,<br /><em>jedan jasan sljedeći korak.</em></>, body: 'Možda je sve već spremno. Možda samo treba izvesti CSV. Provjerite prvo — tek nakon toga odlučujete želite li sami ili da mi sve riješimo.', sideTitle: 'Za WordPress, Wix i Google Sites', sideBody: 'Ne morate biti programer. Ako vam je web izradio netko drugi, i dalje možete krenuti od ove provjere.', sideItems: ['Provjerite web bez registracije', 'Učitajte CSV iz svog programa', `Zatražite Web + Publisher ${implementationFirstYearLabel()}`] }
  return <div className={'app-shell variant-page variant-' + variant}><header className="site-header"><Logo /><nav><a href="#checker">Provjeri web</a><a href="#demo">Imam CSV</a><a href="#pricing">Cijene</a></nav><a className="header-cta" href="#checker">Provjeri web <span>→</span></a></header><main>
    <section className="variant-hero"><div className="variant-intro"><p className="eyebrow">{content.label} <span className="eyebrow-rule" /></p><h1>{content.title}</h1><p className="hero-sub">{content.body}</p><ReadinessChecker /></div><aside className="variant-proof"><div className="proof-seal">N</div><span className="checker-label">ŠTO DOBIVATE</span><h2>{content.sideTitle}</h2><p>{content.sideBody}</p><ul>{content.sideItems.map((item) => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}</ul><a className="variant-proof-link" href="#posaljite-cjenik">Trebate da mi to postavimo? <strong>Od 49,90 € →</strong></a></aside></section>
    <section className="variant-trust"><span>Jasan odgovor prije kupnje</span><span>•</span><strong>CSV cjenik · XML cjenik · javna provjera</strong><span>•</span><span>Za stranice koje već imate</span></section>
    <VariantBottom />
  </main><footer className="site-footer"><Logo /><span>NEPAR Publisher / varijanta {variant}</span><a href="/">Natrag na početnu ↗</a></footer></div>
}

function TrialClaimForm({
  list,
  sourceFilename,
  onCancel,
}: {
  list: NormalizedPriceList
  sourceFilename: string
  onCancel: () => void
}) {
  const [businessName, setBusinessName] = useState(list.tenant.name && list.tenant.name !== 'Draft' ? list.tenant.name : '')
  const [email, setEmail] = useState('')
  const [slug, setSlug] = useState('')
  const [slugHint, setSlugHint] = useState('')
  const [objectAddress, setObjectAddress] = useState('')
  const [objectCode, setObjectCode] = useState('1')
  const [objectType, setObjectType] = useState(list.items.every(isServiceItem) ? 'usluzni-objekt' : 'prodavaonica')
  const [workingDays, setWorkingDays] = useState([1, 2, 3, 4, 5])
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const { siteKey, loading: turnstileLoading } = useTurnstileSiteKey()

  useEffect(() => {
    const controller = new AbortController()
    const name = businessName.trim()
    if (name.length < 2) {
      setSlug('')
      setSlugHint('')
      return
    }
    const timer = window.setTimeout(() => {
      void fetch(`/api/trials/start?businessName=${encodeURIComponent(name)}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) return
          const payload = await response.json() as { suggested?: string; available?: boolean; slug?: string; suggestions?: string[] }
          const next = payload.suggested || payload.slug || ''
          setSlug((current) => current || next)
          if (payload.available === false && payload.suggestions?.length) {
            setSlugHint(`Zauzeto — predlažemo ${payload.suggestions[0]}`)
            setSlug((current) => (current === next ? payload.suggestions![0] : current))
          } else {
            setSlugHint('')
          }
        })
        .catch(() => undefined)
    }, 350)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [businessName])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    if (!turnstileToken) {
      setError('Dovršite sigurnosnu provjeru prije slanja.')
      setBusy(false)
      return
    }
    try {
      const draftResponse = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          list: { ...list, tenant: { ...list.tenant, name: businessName.trim() || list.tenant.name } },
          filename: sourceFilename || 'cjenik.csv',
          publicationDetails: { objectType, objectAddress, objectCode, workingDays },
        }),
      })
      const draftPayload = await draftResponse.json() as { draftId?: string; error?: string }
      if (!draftResponse.ok || !draftPayload.draftId) throw new Error(draftPayload.error || 'Draft nije spremljen.')

      const claimResponse = await fetch('/api/trials/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          draftId: draftPayload.draftId,
          email,
          businessName: businessName.trim(),
          slug: slug.trim().toLocaleLowerCase('en-US'),
          turnstileToken,
          attribution: readAcquisitionTouch(),
        }),
      })
      const claimPayload = await claimResponse.json() as { ok?: boolean; error?: string; code?: string }
      if (!claimResponse.ok || !claimPayload.ok) {
        if (claimPayload.code === 'turnstile_failed' || claimResponse.status === 403) {
          throw new Error('Sigurnosna provjera nije uspjela. Osvježite provjeru i pokušajte ponovno.')
        }
        throw new Error(claimPayload.error || 'Potvrdni link nije moguće poslati.')
      }
      setSent(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Zahtjev nije uspio.')
      if (window.turnstile) window.turnstile.reset()
      setTurnstileToken('')
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <section className="trial-claim-panel" role="status">
        <span className="app-label">PROVJERITE E-MAIL</span>
        <h2>Poslali smo potvrdni link</h2>
        <p>Otvorite poveznicu u e-mailu i cjenik će biti objavljen na <strong>/c/{slug}</strong>. Objava je besplatna 24 sata. Poveznica u e-mailu vrijedi 30 minuta.</p>
        <button className="app-button app-button-light" type="button" onClick={onCancel}>Natrag na pregled</button>
      </section>
    )
  }

  return (
    <section className="trial-claim-panel">
      <span className="app-label">BESPLATNA OBJAVA 24 H</span>
      <h2>Odaberite adresu svog cjenika</h2>
      <p>Nakon potvrde e-maila cjenik je javno dostupan 24 sata. Isti link zadržite za 19,90 €/god — uplata 2D barkodom.</p>
      <form className="trial-claim-form" onSubmit={(event) => void submit(event)}>
        <label>Naziv poslovanja<input value={businessName} onChange={(event) => setBusinessName(event.target.value)} required maxLength={120} placeholder="Auto Gubić" /></label>
        <label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} placeholder="info@primjer.hr" autoComplete="email" /></label>
        <label>Adresa vašeg cjenika<input value={slug} onChange={(event) => setSlug(event.target.value.toLocaleLowerCase('en-US').replace(/[^a-z0-9-]/g, ''))} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={48} /></label>
        <label>Vrsta objekta<select value={objectType} onChange={event => setObjectType(event.target.value)}><option value="usluzni-objekt">Uslužni objekt</option><option value="prodavaonica">Prodavaonica</option><option value="internetska-trgovina">Internetska trgovina</option></select></label>
        <label>Puna adresa objekta<input value={objectAddress} onChange={event => setObjectAddress(event.target.value)} required minLength={5} maxLength={240} placeholder="Ulica i broj, poštanski broj i mjesto" autoComplete="street-address" /></label>
        <label>Oznaka objekta<input value={objectCode} onChange={event => setObjectCode(event.target.value)} required maxLength={80} /></label>
        {!list.items.every(isServiceItem) && <fieldset><legend>Radni dani objekta za provjeru ažuriranja</legend>{['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'].map((label, day) => <label key={day}><input type="checkbox" checked={workingDays.includes(day)} onChange={event => setWorkingDays(event.target.checked ? [...workingDays, day] : workingDays.filter(value => value !== day))} />{label}</label>)}</fieldset>}
        <p>Podatke koristimo za račun, potvrdu e-maila i javnu objavu cjenika. Provjerite točnost adrese i cijena. <a href="/privatnost.html" target="_blank" rel="noreferrer">Obrada podataka</a> · <a href="/uvjeti.html" target="_blank" rel="noreferrer">Uvjeti objave</a></p>
        <p className="trial-slug-preview">Vaš cjenik bit će dostupan na <strong>{typeof window !== 'undefined' ? window.location.origin : 'https://digitalnicjenik.nepar.hr'}/c/{slug || '…'}</strong></p>
        {slugHint && <p className="premium-inline-error">{slugHint}</p>}
        <TurnstileField onToken={setTurnstileToken} />
        {error && <p className="app-error" role="alert">{error}</p>}
        <div className="trial-claim-actions">
          <button className="app-button app-button-primary" type="submit" disabled={busy || turnstileLoading || !siteKey}>{busy ? 'Šaljemo…' : 'Pošalji potvrdni link →'}</button>
          <button className="app-button app-button-light" type="button" onClick={onCancel} disabled={busy}>Odustani</button>
        </div>
      </form>
    </section>
  )
}

function ValidatorApp({
  onContextChange,
  onLead,
  embedded = false,
  mode = 'sandbox',
  tenantSlug = 'nepar',
  tenantName = 'NEPAR',
  tenantId,
  publishBlocked = false,
  entitlementStatus,
  trialEndsAt,
  canEditItems = true,
}: {
  onContextChange?: (context: LeadContext) => void
  onLead?: (intent: LeadIntent) => void
  embedded?: boolean
  mode?: 'sandbox' | 'publisher'
  tenantSlug?: string
  tenantName?: string
  tenantId?: string
  publishBlocked?: boolean
  entitlementStatus?: string
  trialEndsAt?: string | null
  canEditItems?: boolean
}) {
  const [list, setList] = useState<NormalizedPriceList | null>(null)
  const [draftId, setDraftId] = useState('')
  const [issues, setIssues] = useState<ValidationIssue[]>([])
  const [sourceFilename, setSourceFilename] = useState('')
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [publication, setPublication] = useState<PricePublication | null>(null)
  const [published, setPublished] = useState(false)
  const [claimOpen, setClaimOpen] = useState(false)
  const resolvedTenantId = tenantId || tenantSlug
  const tenantIdentity = { id: resolvedTenantId, slug: tenantSlug, name: tenantName }
  const apiBase = `/api/tenants/${encodeURIComponent(tenantSlug)}`
  const fetchOpts: RequestInit = mode === 'publisher' ? { credentials: 'include' } : {}
  const validation = useMemo(() => {
    if (!list) return { status: 'invalid' as const, issues, blockingCount: issues.length, warningCount: 0 }
    return mergeValidationIssues(validatePriceList(list), issues.filter((issue) => issue.code === 'IMPORT_ROW_SKIPPED'))
  }, [list, issues])

  useEffect(() => {
    onContextChange?.({
      sourceFilename: sourceFilename || undefined,
      sourceFile,
      itemCount: list?.items.length,
      blockerCount: list ? validation.blockingCount : undefined,
      manualReviewCount: list ? validation.issues.filter((issue) => issue.severity === 'manual_review').length : undefined,
    })
  }, [list, onContextChange, sourceFile, sourceFilename, validation.blockingCount, validation.issues])

  useEffect(() => {
    if (mode !== 'publisher') return
    let cancelled = false
    void fetch(apiBase, { credentials: 'include' }).then(async (response) => {
      if (cancelled || !response.ok) return
      const payload = await response.json() as { priceList?: NormalizedPriceList; publication?: PricePublication }
      if (!payload.priceList) return
      setList(payload.priceList)
      setPublished(!usesProductStructure(payload.priceList))
      setSourceFilename('trenutna-objava')
      if (payload.publication) setPublication(payload.publication)
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [apiBase, mode])

  const updateItem = (index: number, patch: Partial<NormalizedPriceList['items'][number]>) => {
    setPublished(false)
    setList((current) => current ? { ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) } : current)
  }

  function applyNormalizedList(priceList: NormalizedPriceList, file: File, importIssues: ValidationIssue[] = []) {
    const scoped = { ...priceList, tenant: { ...priceList.tenant, ...tenantIdentity } }
    setList(scoped)
    setSourceFilename(file.name)
    setSourceFile(file)
    setIssues(mergeValidationIssues(validatePriceList(scoped), importIssues).issues)
    setPublished(false)
    setDraftId('')
    setPublication(null)
    setMessage('')
    setClaimOpen(false)
    requestAnimationFrame(() => document.querySelector('.validation-app-panel')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }))
  }

  async function loadFile(file?: File) {
    if (!file) return
    setBusy(true); setError(''); setMessage(''); setPublished(false); setDraftId(''); setPublication(null); setClaimOpen(false)
    try {
      if (file.size > 2_000_000) throw new Error('Datoteka je prevelika. Maksimalna veličina je 2 MB.')
      const raw = await file.text()
      const lowerName = file.name.toLowerCase()
      const isXml = lowerName.endsWith('.xml')
      if (!isXml && !lowerName.endsWith('.csv')) throw new Error('Učitajte datoteku s nastavkom .csv ili .xml.')
      const parsed = isXml
        ? { priceList: parseXmlPriceList(raw, tenantIdentity), warnings: [] as { row: number; message: string }[] }
        : parseMarketinoCsv(raw, tenantIdentity)
      applyNormalizedList(parsed.priceList, file, importIssuesFromParseWarnings(parsed.warnings || [], isXml ? 'xml' : 'csv'))
      try {
        const response = await fetch('/api/validator/validate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(isXml ? { xml: raw } : { csv: raw }) })
        if (response.ok) setIssues(((await response.json()) as { validation: { issues: ValidationIssue[] } }).validation.issues)
      } catch {
        // The local validator is enough for an anonymous preview; the API adds server-side confirmation when available.
      }
    } catch (caught) {
      setList(null); setSourceFile(null); setError(caught instanceof Error ? caught.message : 'Datoteku nije moguće učitati.')
    } finally { setBusy(false) }
  }

  async function createRemoteDraft() {
    if (!list) return ''
    const response = await fetch(`${apiBase}/import`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      ...fetchOpts,
      body: JSON.stringify({ priceList: { items: list.items, currency: list.currency, updatedAt: list.updatedAt, source: list.source }, sourceFilename, importIssues: issues.filter(issue => issue.code === 'IMPORT_ROW_SKIPPED') }),
    })
    if (!response.ok) throw new Error(await writeErrorMessage(response, 'Cjenik nije moguće pripremiti.'))
    const payload = await response.json() as { draft: { id: string }; validation: { issues: ValidationIssue[] } }
    setDraftId(payload.draft.id); setIssues(payload.validation.issues)
    return payload.draft.id
  }

  async function persistDraft() {
    if (!list) throw new Error('Cjenik nije učitan.')
    const id = draftId || await createRemoteDraft()
    if (!id) throw new Error('Cjenik nije moguće spremiti.')
    const response = await fetch(`${apiBase}/draft/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      ...fetchOpts,
      body: JSON.stringify({ priceList: { items: list.items, currency: list.currency, updatedAt: list.updatedAt, source: list.source } }),
    })
    if (!response.ok) throw new Error(await writeErrorMessage(response, 'Dopuna nije spremljena.'))
    const payload = await response.json() as { validation: { issues: ValidationIssue[] } }
    setIssues(payload.validation.issues)
    return id
  }

  async function saveDraft() {
    if (!list || mode !== 'publisher') return
    setBusy(true); setError(''); setMessage('')
    try {
      await persistDraft()
      setMessage('Dopune su spremljene. Provjerite sažetak prije objave.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Dopuna nije uspjela.') } finally { setBusy(false) }
  }

  async function publish() {
    if (!list || validation.blockingCount > 0 || mode !== 'publisher' || publishBlocked) return
    setBusy(true); setError(''); setMessage('')
    try {
      // Always persist the currently displayed edits, including edits after a previous save.
      const id = await persistDraft()
      if (!id) throw new Error('Za objavu je potreban aktivan Publisher.')
      const response = await fetch(`${apiBase}/publish`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        ...fetchOpts,
        body: JSON.stringify({ draftId: id }),
      })
      const payload = await response.json() as { error?: string; message?: string; publication?: PricePublication }
      if (!response.ok) throw new Error(payload.error || 'Objava nije uspjela.')
      setPublication(payload.publication ?? null); setMessage(payload.message || 'Cjenik je objavljen.'); setPublished(true); setDraftId('')
      const current = await fetch(apiBase, fetchOpts).then((item) => item.json()).catch(() => null) as { priceList?: NormalizedPriceList } | null
      if (current?.priceList) setList(current.priceList)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Objava nije uspjela.') } finally { setBusy(false) }
  }

  function confirmNoSpecialSale() {
    if (!list || !window.confirm('Potvrdite da akcijske cijene nisu primijenjene tijekom posebnog oblika prodaje.')) return
    setPublished(false)
    setList({ ...list, items: list.items.map((item) => item.specialSaleApplied == null && item.salePrice == null ? { ...item, specialSaleApplied: false, specialSaleName: null } : item) })
  }

  function bulkAvailability(value: Availability) {
    if (!list) return
    setPublished(false)
    setList({ ...list, items: list.items.map((item) => (!isServiceItem(item) && !item.availability ? { ...item, availability: value } : item)) })
    setMessage(`Dostupnost je postavljena na „${value}” za stavke bez oznake. Pregledajte tablicu prije objave.`)
  }

  function confirmAnchorsFromRetail() {
    if (!list) return
    const pending = missingAnchorItems(list)
    if (!pending.length) return
    if (!window.confirm('Potvrdite da su navedene redovne cijene, bez akcija i popusta, vrijedile 10. rujna 2026. Sidrena cijena bit će postavljena na trenutnu maloprodajnu cijenu za ' + pending.length + ' usluga.')) return
    setPublished(false)
    setList({
      ...list,
      items: list.items.map((item) => {
        const needsAnchor = isServiceItem(item) && !validRequiredPrice(item.anchorPrice, true)
        return needsAnchor ? { ...item, anchorPrice: item.price } : item
      }),
    })
    setMessage('Sidrene cijene su postavljene prema potvrđenim maloprodajnim cijenama. Pregledajte tablicu prije objave.')
  }

  const intro = mode === 'publisher'
    ? <section className="validator-app-intro"><h1>Dashboard<br /><em>{tenantName}</em></h1><p>{canEditItems ? 'Učitajte novi CSV/XML, pretvorite Excel ili ručno uredite stavke.' : 'Učitajte novi CSV/XML ili pretvorite Excel; nova datoteka zamjenjuje cijeli cjenik.'} Stalni linkovi se ažuriraju tek nakon Objavi.{entitlementStatus === 'trial' && trialEndsAt ? ` Besplatna objava aktivna do ${untilLabel(trialEndsAt)}.` : ''}</p></section>
    : <section className="validator-app-intro">{embedded ? null : <span className="app-label">NEPAR PUBLISHER / BESPLATNA PROVJERA</span>}{embedded ? <h2>Učitajte cjenik.<br /><em>Provjerite što nedostaje.</em></h2> : <h1>Učitajte cjenik.<br /><em>Provjerite što nedostaje.</em></h1>}{embedded ? null : <p>Učitajte CSV ili XML. Pregledajte podatke, zatim objavite cjenik na vlastitom URL-u — besplatno 24 sata.</p>}</section>

  const tool = <>
    {mode === 'publisher' && <PublicationSettings slug={tenantSlug} onSaved={() => setPublished(false)} />}
    {mode === 'publisher' && canEditItems && published && list && <button className="app-button app-button-light" type="button" onClick={() => { setPublished(false); setMessage('') }}>Uredi postojeći cjenik</button>}
    <section className="validator-tool" aria-label={mode === 'publisher' ? 'Publisher cjenik' : 'Validator cjenika'}><div className="upload-card"><div className="upload-card-heading"><div><h2>CSV ili XML cjenik</h2><p>{mode === 'publisher' ? 'Nova datoteka zamjenjuje draft. Ručne izmjene u tablici ostaju dok ne objavite.' : 'Za besplatni pregled nije potrebna registracija.'}</p></div><span className="upload-icon" aria-hidden="true">↥</span></div><div className="upload-actions"><label className="upload-action"><input type="file" accept=".csv,text/csv" onChange={(event) => void loadFile(event.target.files?.[0])} /><strong>Učitaj CSV</strong><span>Najčešći format za izvoz cijena</span></label><label className="upload-action"><input type="file" accept=".xml,text/xml,application/xml" onChange={(event) => void loadFile(event.target.files?.[0])} /><strong>Učitaj XML</strong><span>Ako već imate XML cjenik</span></label></div><p className="upload-note">Maksimalno 2 MB · CSV ili XML · dobit ćete oba izlaza</p>{busy && <p className="app-status" role="status">Provjeravamo datoteku…</p>}{error && <p className="app-error" role="alert">{error}</p>}</div><aside className="checks-card"><span className="app-label">{mode === 'publisher' ? 'PRIJE OBJAVE' : '2 / ŠTO PROVJERAVAMO'}</span><h2>Podaci koji često nedostaju</h2><ul><li><span>01</span>Naziv, vrsta i pozitivna maloprodajna cijena</li><li><span>02</span>Sidrena cijena i mjerodavni datum</li><li><span>03</span>Posebna prodaja i prethodna najniža cijena kod akcije</li><li><span>04</span>Datum prvog uvrštenja za nove stavke</li></ul><p>Provjera je tehnički i podatkovni pregled. Ne zamjenjuje pravni savjet.</p></aside></section>
    {list && claimOpen && mode === 'sandbox' && (
      <TrialClaimForm list={list} sourceFilename={sourceFilename} onCancel={() => setClaimOpen(false)} />
    )}
    {list && !(claimOpen && mode === 'sandbox') && (
      <ValidationResultPanel
        list={list}
        validation={validation}
        sourceFilename={sourceFilename}
        published={published}
        busy={busy}
        message={message}
        publication={publication}
        onUpdateItem={updateItem}
        onConfirmAnchorsFromRetail={confirmAnchorsFromRetail}
        onConfirmNoSpecialSale={confirmNoSpecialSale}
        onBulkAvailability={bulkAvailability}
        onSaveDraft={() => void saveDraft()}
        onPublish={() => void publish()}
        onStartTrial={() => setClaimOpen(true)}
        onLead={onLead}
        mode={mode}
        publishBlocked={publishBlocked}
      />
    )}
    <ExcelConverter onConverted={applyNormalizedList} />
    {mode === 'sandbox' && <p className="validator-footnote">Želite prvo vidjeti primjer? <a href="/c/nepar">Otvori demo podatke →</a></p>}
  </>

  if (embedded) {
    return <div className="validator-app validator-app-embedded">{intro}{tool}</div>
  }

  if (mode === 'publisher') {
    return <div className="validator-app">{intro}{tool}</div>
  }

  return <div className="validator-app-shell"><header className="app-header"><Logo /><a href="#posaljite-cjenik" onClick={(event) => { if (onLead) { event.preventDefault(); onLead('implementation') } }}>Trebate pomoć? <strong>NEPAR postavljanje →</strong></a></header><main className="validator-app">
    {intro}
    {tool}
  </main></div>
}

export function Landing() {
  return <AcquisitionLanding renderValidator={(onContextChange, onLead) => <ValidatorApp embedded onContextChange={onContextChange} onLead={onLead} />} />
}

function PublisherWelcome({
  slug,
  licence,
  email,
  name,
  onLicenceChanged,
  onContinue,
}: {
  slug: string
  licence: Licence | null
  email: string
  name: string
  onLicenceChanged: () => void
  onContinue: () => void
}) {
  const [copied, setCopied] = useState(false)
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://digitalnicjenik.nepar.hr'
  const publicUrl = `${origin}/c/${slug}`
  const periodEnd = licence?.entitlement?.periodEnd ?? null
  const state = licenceState(licence)
  return (
    <section className="publisher-welcome" role="status">
      <span className="app-label">CJENIK JE OBJAVLJEN</span>
      <h1>Vaš digitalni cjenik je objavljen!</h1>
      {periodEnd && (state === 'free' || state === 'awaiting_payment') && <p>{state === 'free' ? 'Besplatna objava aktivna je do' : 'Link ostaje aktivan do'} <strong>{untilLabel(periodEnd)}</strong>.</p>}
      <div className="publisher-welcome-link">
        <a className="publisher-welcome-url" href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a>
        <button className="app-link-button" type="button" onClick={() => void navigator.clipboard?.writeText(publicUrl).then(() => setCopied(true))}>{copied ? 'Kopirano' : 'Kopiraj link'}</button>
      </div>
      <p>Ovaj link možete odmah staviti na svoju web stranicu. Isti link ostaje aktivan ako ga zadržite.</p>
      {licence && (state === 'free' || state === 'awaiting_payment' || state === 'expired') && <KeepLinkFlow licence={licence} email={email} name={name} onChanged={onLicenceChanged} />}
      <div className="publisher-welcome-actions">
        <a className="app-button app-button-light" href={`${publicUrl}/cjenik.csv`}>Preuzmi CSV</a>
        <a className="app-button app-button-light" href={`${publicUrl}/cjenik.xml`}>Preuzmi XML</a>
        <button className="app-button app-button-light" type="button" onClick={onContinue}>Otvori dashboard</button>
      </div>
    </section>
  )
}

function PublisherEntry() {
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const authError = params.get('authError') || undefined
  const welcome = params.get('welcome') === '1'
  const welcomeSlug = params.get('slug') || ''
  const welcomeName = params.get('name') || ''
  const welcomeTrialEndsAt = params.get('trialEndsAt')
  const { session, error, logout } = usePublisherSession()
  const [showWelcome, setShowWelcome] = useState(welcome)
  const [licence, setLicence] = useState<Licence | null>(null)
  const [licenceVersion, setLicenceVersion] = useState(0)

  const tenant = session?.tenants[0]

  useEffect(() => {
    if (!tenant) return
    let cancelled = false
    void fetchLicence()
      .then((next) => { if (!cancelled && next) setLicence(next) })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [tenant, licenceVersion])
  const reloadLicence = () => setLicenceVersion((value) => value + 1)

  if (session === undefined) {
    return (
      <div className="validator-app-shell premium-entry publisher-shell">
        <header className="app-header"><Logo /></header>
        <main className="publisher-auth"><p className="app-status" role="status">Provjeravamo prijavu…</p></main>
      </div>
    )
  }

  if (!session) return <PublisherLogin initialError={authError} />

  if (!tenant) {
    return (
      <div className="validator-app-shell premium-entry publisher-shell">
        <header className="app-header"><Logo /><button className="header-lead" type="button" onClick={() => void logout()}>Odjava</button></header>
        <main className="publisher-auth">
          <section className="publisher-auth-panel">
            <h1>Nema aktivnog tenanta</h1>
            <p>Vaš e-mail je prijavljen, ali još nema povezanog Publisher tenanta. Javite se na nepar@nepar.hr.</p>
            {error && <p className="app-error" role="alert">{error}</p>}
          </section>
        </main>
      </div>
    )
  }

  const entitlement = licence?.entitlement ?? null
  const features = licence?.features
  const status = entitlement?.status || 'trial'
  const periodEnd = entitlement?.periodEnd ?? welcomeTrialEndsAt
  const publishBlocked = status === 'expired' || status === 'suspended' || (periodEnd != null && new Date(periodEnd).getTime() < Date.now() && status !== 'active')

  if (showWelcome) {
    return (
      <div className="validator-app-shell premium-entry publisher-shell">
        <header className="app-header">
          <Logo />
          <button className="header-lead" type="button" onClick={() => void logout()}>Odjava</button>
        </header>
        <main className="validator-app premium-entry-main publisher-dashboard">
          <PublisherWelcome
            slug={welcomeSlug || tenant.slug}
            licence={licence}
            email={session.user.email}
            name={welcomeName || tenant.name}
            onLicenceChanged={reloadLicence}
            onContinue={() => {
              setShowWelcome(false)
              const url = new URL(window.location.href)
              url.searchParams.delete('welcome')
              url.searchParams.delete('trialEndsAt')
              url.searchParams.delete('name')
              url.searchParams.delete('slug')
              window.history.replaceState({}, '', url.pathname)
            }}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="validator-app-shell premium-entry publisher-shell">
      <header className="app-header">
        <Logo />
        <div className="publisher-header-meta">
          <span>{session.user.email}</span>
          <strong>{tenant.name}</strong>
          <button className="header-lead" type="button" onClick={() => void logout()}>Odjava</button>
        </div>
      </header>
      <main className="validator-app premium-entry-main publisher-dashboard">
        {licence && <LicenceCard licence={licence} email={session.user.email} name={tenant.name} onChanged={reloadLicence} />}
        {features?.monitoring && <MonitorPanel slug={tenant.slug} />}
        <ValidatorApp
          mode="publisher"
          tenantSlug={tenant.slug}
          tenantId={tenant.id}
          tenantName={tenant.name}
          publishBlocked={publishBlocked}
          entitlementStatus={status}
          trialEndsAt={periodEnd}
          canEditItems={features?.editItems ?? false}
        />
      </main>
    </div>
  )
}

export default function App() {
  const path = typeof window !== 'undefined' ? window.location.pathname : '/'
  if (path === '/admin' || path === '/admin/') return <AdminPanel />
  if (path === '/app' || path.startsWith('/app/')) return <PublisherEntry />
  if (path === '/vijesti' || path === '/vijesti/') return <NewsIndex />
  const newsMatch = path.match(/^\/vijesti\/([^/]+)\/?$/)
  if (newsMatch) return <NewsArticle slug={newsMatch[1]!} />
  const sitePage = findSitePage(path)
  if (sitePage) return <SitePage page={sitePage} />
  const slug = slugFromPath()
  if (slug) return <PublicPriceList slug={slug} />
  if (isCustomPublication()) return <PublicPriceList customHost />
  return <Landing />
}
