import { useEffect, useState } from 'react'
import { INSTALLATION, PLANS, formatEur } from '../shared/pricing'
import { formatCents, orderAmountCents } from '../shared/payment'
import { readAcquisitionTouch } from './acquisition'
import { hoursLeft, licenceState, untilLabel, type Licence, type OrderPayment } from './licenceView'

const WEB_LINK = PLANS[0]
const UPGRADE_LABEL = `+${formatCents(orderAmountCents('publisher_upgrade'))}/god`
const BARCODE_OPTIONS = { bcid: 'pdf417', eclevel: 4, columns: 9, rowmult: 3 } as const

export async function fetchLicence(): Promise<Licence | null> {
  const response = await fetch('/api/orders', { credentials: 'include' })
  if (!response.ok) return null
  return await response.json() as Licence
}

/** HUB-3 PDF417, rendered only when the payment step opens so the barcode library stays out of the main bundle. */
function Hub3Barcode({ payload, reference }: { payload: string; reference: string }) {
  const [svg, setSvg] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void import('bwip-js/browser')
      .then(({ pdf417, drawingSVG }) => {
        if (!cancelled) setSvg(pdf417({ ...BARCODE_OPTIONS, text: payload, scale: 2 }, drawingSVG()))
      })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [payload])

  async function download() {
    const { pdf417 } = await import('bwip-js/browser')
    const canvas = document.createElement('canvas')
    pdf417(canvas, { ...BARCODE_OPTIONS, text: payload, scale: 4, paddingwidth: 16, paddingheight: 16, backgroundcolor: 'FFFFFF' })
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const link = Object.assign(document.createElement('a'), { href: url, download: `uplata-${reference}.png` })
      link.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  if (failed) return <p className="app-error" role="alert">2D barkod trenutačno nije moguće prikazati. Uplatite prema podacima za uplatu.</p>
  return (
    <div className="hub3-barcode">
      <div className="hub3-barcode-image" role="img" aria-label={`2D barkod za uplatu ${reference}`} dangerouslySetInnerHTML={{ __html: svg }} />
      <p>Skenirajte 2D barkod u mobilnoj aplikaciji svoje banke.</p>
      <button className="app-button app-button-light" type="button" disabled={!svg} onClick={() => void download()}>Preuzmi 2D barkod</button>
    </div>
  )
}

function CopyValue({ label, value, display }: { label: string; value: string; display?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="payment-row">
      <dt>{label}</dt>
      <dd>
        <span>{display ?? value}</span>
        <button className="app-link-button" type="button" aria-label={`Kopiraj: ${label}`} onClick={() => void navigator.clipboard?.writeText(value).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500) })}>
          {copied ? 'Kopirano' : 'Kopiraj'}
        </button>
      </dd>
    </div>
  )
}

export function PaymentStep({ order, activeUntil, publisherUntil }: { order: OrderPayment; activeUntil: string | null; publisherUntil?: string | null }) {
  const [tab, setTab] = useState<'barcode' | 'details'>('barcode')
  const upgrade = order.kind === 'publisher_upgrade'
  return (
    <section className="payment-step" aria-labelledby={`payment-${order.reference}`}>
      <span className="app-label">UPLATA · {order.reference}</span>
      <h3 id={`payment-${order.reference}`}>{upgrade ? 'Nadogradnja na Publisher' : 'Uplata za trajnu aktivaciju'}</h3>
      <p className="payment-amount"><strong>{order.amountLabel}</strong></p>
      <p className="payment-what">
        {upgrade
          ? `Publisher za preostalo razdoblje licence (${UPGRADE_LABEL}).`
          : `${WEB_LINK.name} — ${formatEur(WEB_LINK.price, true)}${order.installation ? ` + ${INSTALLATION.name.toLocaleLowerCase('hr-HR')} ${formatEur(INSTALLATION.price)} jednokratno` : ''}. Godišnja licenca, bez automatske obnove.`}
      </p>
      <div className="payment-tabs" role="tablist" aria-label="Način uplate">
        <button type="button" role="tab" aria-selected={tab === 'barcode'} className={tab === 'barcode' ? 'is-active' : ''} onClick={() => setTab('barcode')}>2D barkod</button>
        <button type="button" role="tab" aria-selected={tab === 'details'} className={tab === 'details' ? 'is-active' : ''} onClick={() => setTab('details')}>Podaci za uplatu</button>
      </div>
      {tab === 'barcode'
        ? <Hub3Barcode payload={order.hub3} reference={order.reference} />
        : (
          <dl className="payment-details">
            <div className="payment-row"><dt>Primatelj</dt><dd><span>{[order.payee.name, order.payee.street, order.payee.postalCity].filter(Boolean).join(', ')}</span></dd></div>
            <CopyValue label="IBAN" value={order.payee.iban} />
            <CopyValue label="Iznos" value={(order.amountCents / 100).toFixed(2).replace('.', ',')} display={order.amountLabel} />
            <CopyValue label="Model i poziv na broj" value={order.reference} display={`${order.payee.model} ${order.reference}`} />
            <CopyValue label="Opis plaćanja" value={order.description} />
          </dl>
        )}
      <p className="payment-note" role="status">
        {upgrade
          ? `Nakon evidentirane uplate Publisher je aktivan${publisherUntil ? ` do ${untilLabel(publisherUntil)}` : ''}.`
          : `${activeUntil ? `Link ostaje aktivan do ${untilLabel(activeUntil)}. ` : ''}Nakon evidentirane uplate isti link ostaje aktivan godinu dana.`}
      </p>
    </section>
  )
}

export function OrderForm({
  kind,
  defaultEmail,
  defaultName,
  onPlaced,
  onCancel,
  previous,
}: {
  kind: 'web_link' | 'publisher_upgrade'
  defaultEmail: string
  defaultName: string
  onPlaced: () => void
  onCancel?: () => void
  previous?: OrderPayment | null
}) {
  const [customerType, setCustomerType] = useState<'company' | 'person'>(previous?.customerType ?? 'company')
  const [billingName, setBillingName] = useState(previous?.billingName ?? defaultName)
  const [oib, setOib] = useState(previous?.oib ?? '')
  const [address, setAddress] = useState(previous?.address ?? '')
  const [postalCity, setPostalCity] = useState(previous?.postalCity ?? '')
  const [email, setEmail] = useState(previous?.email ?? defaultEmail)
  const [installation, setInstallation] = useState(previous?.installation ?? false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const total = formatCents(orderAmountCents(kind, installation))

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, installation, customerType, billingName, oib, address, postalCity, email, attribution: readAcquisitionTouch() }),
      })
      const payload = await response.json().catch(() => ({})) as { ok?: boolean; error?: string }
      if (!response.ok || !payload.ok) throw new Error(payload.error && !payload.error.includes('_') ? payload.error : 'Narudžbu trenutačno nije moguće spremiti.')
      onPlaced()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Narudžbu trenutačno nije moguće spremiti.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="order-form" onSubmit={(event) => void submit(event)}>
      <h3>Podaci za izdavanje računa</h3>
      <fieldset className="order-customer-type">
        <legend className="sr-only">Kupac</legend>
        <label><input type="radio" name="customerType" checked={customerType === 'company'} onChange={() => setCustomerType('company')} /> Tvrtka / obrt</label>
        <label><input type="radio" name="customerType" checked={customerType === 'person'} onChange={() => setCustomerType('person')} /> Fizička osoba</label>
      </fieldset>
      <label>{customerType === 'company' ? 'Naziv tvrtke ili obrta' : 'Ime i prezime'}<input value={billingName} onChange={(event) => setBillingName(event.target.value)} required minLength={2} maxLength={120} autoComplete={customerType === 'company' ? 'organization' : 'name'} /></label>
      <label>{customerType === 'company' ? 'OIB' : 'OIB (neobavezno)'}<input value={oib} onChange={(event) => setOib(event.target.value.replace(/\D/g, '').slice(0, 11))} required={customerType === 'company'} inputMode="numeric" pattern="\d{11}" maxLength={11} /></label>
      <label>Adresa<input value={address} onChange={(event) => setAddress(event.target.value)} required minLength={3} maxLength={120} autoComplete="street-address" placeholder="Ulica i kućni broj" /></label>
      <label>Poštanski broj i grad<input value={postalCity} onChange={(event) => setPostalCity(event.target.value)} required minLength={3} maxLength={80} placeholder="10000 Zagreb" /></label>
      <label>E-mail za račun<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} autoComplete="email" /></label>
      {kind === 'web_link' && (
        <label className="order-installation"><input type="checkbox" checked={installation} onChange={(event) => setInstallation(event.target.checked)} /> Dodajte pomoć s ugradnjom na web (+{formatEur(INSTALLATION.price)} jednokratno)</label>
      )}
      <p className="order-total">Ukupno za uplatu: <strong>{total}</strong></p>
      {error && <p className="app-error" role="alert">{error}</p>}
      <div className="publisher-upgrade-actions">
        <button className="app-button app-button-primary" type="submit" disabled={busy}>{busy ? 'Spremamo…' : 'Nastavi na uplatu →'}</button>
        {onCancel && <button className="app-button app-button-light" type="button" onClick={onCancel} disabled={busy}>Odustani</button>}
      </div>
    </form>
  )
}

/** Order form or, once ordered, the payment step. Shared by the welcome screen and the dashboard card. */
export function KeepLinkFlow({ licence, email, name, startOpen = false, onChanged }: { licence: Licence; email: string; name: string; startOpen?: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState(startOpen)
  const [editing, setEditing] = useState(false)
  const order = licence.order?.kind === 'web_link' ? licence.order : null
  if (order && !editing) {
    return (
      <>
        <PaymentStep order={order} activeUntil={licence.entitlement?.periodEnd ?? null} />
        <button className="app-link-button" type="button" onClick={() => setEditing(true)}>Izmijeni podatke za račun</button>
      </>
    )
  }
  if (!open && !editing) {
    return <div className="publisher-upgrade-actions"><button className="app-button app-button-primary" type="button" onClick={() => setOpen(true)}>Zadrži ovaj link trajno — {formatEur(WEB_LINK.price, true)} →</button></div>
  }
  return <OrderForm kind="web_link" defaultEmail={email} defaultName={name} previous={order} onCancel={() => { setOpen(false); setEditing(false) }} onPlaced={() => { setOpen(false); setEditing(false); onChanged() }} />
}

export function LicenceCard({ licence, email, name, onChanged }: { licence: Licence; email: string; name: string; onChanged: () => void }) {
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [helpSent, setHelpSent] = useState(false)
  const state = licenceState(licence)
  const periodEnd = licence.entitlement?.periodEnd ?? null
  if (state === 'none') return null

  async function askForHelp() {
    const response = await fetch('/api/publisher/upgrade', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ intent: 'consultation', attribution: readAcquisitionTouch() }),
    }).catch(() => null)
    if (response?.ok) setHelpSent(true)
  }

  const help = helpSent
    ? <p className="app-success" role="status">Upit je poslan. Javit ćemo se na {email}.</p>
    : <button className="sales-link" type="button" onClick={() => void askForHelp()}>Trebam pomoć</button>

  if (state === 'free' || state === 'awaiting_payment' || state === 'expired') {
    const label = state === 'free' ? 'BESPLATNA OBJAVA 24 H' : state === 'awaiting_payment' ? 'ČEKAMO UPLATU' : 'LINK JE UGAŠEN'
    const hours = hoursLeft(periodEnd)
    return (
      <section className={`publisher-upgrade-banner licence-card licence-${state}`}>
        <span className="app-label">{label}</span>
        <h2>
          {state === 'free' && periodEnd ? `Besplatna objava aktivna do ${untilLabel(periodEnd)}${hours !== null ? ` (još ${hours} h)` : ''}` : null}
          {state === 'awaiting_payment' ? 'Čekamo uplatu' : null}
          {state === 'expired' ? 'Link je ugašen, podaci su sačuvani' : null}
        </h2>
        <p>
          {state === 'free' ? `Zadržite isti link za ${formatEur(WEB_LINK.price, true)}. Uplata 2D barkodom, bez automatske obnove.` : null}
          {state === 'awaiting_payment' && periodEnd ? `Link ostaje aktivan do ${untilLabel(periodEnd)}.` : null}
          {state === 'expired' ? `Uplatite ${formatEur(WEB_LINK.price)} i isti link se vraća.` : null}
        </p>
        <KeepLinkFlow licence={licence} email={email} name={name} onChanged={onChanged} />
        {help}
      </section>
    )
  }

  const pendingUpgrade = licence.order?.kind === 'publisher_upgrade' ? licence.order : null
  return (
    <section className={`publisher-upgrade-banner licence-card licence-${state}`}>
      <span className="app-label">{state === 'publisher' ? 'PUBLISHER' : WEB_LINK.name.toLocaleUpperCase('hr-HR')}</span>
      <h2>{periodEnd ? `Aktivno do ${untilLabel(periodEnd)}` : 'Aktivno'}</h2>
      {state === 'web_link' && (pendingUpgrade
        ? <PaymentStep order={pendingUpgrade} activeUntil={periodEnd} publisherUntil={periodEnd} />
        : licence.upgradeAvailable
          ? upgradeOpen
            ? <OrderForm kind="publisher_upgrade" defaultEmail={email} defaultName={name} onCancel={() => setUpgradeOpen(false)} onPlaced={() => { setUpgradeOpen(false); onChanged() }} />
            : (
              <div className="licence-upsell">
                <p><strong>Trebate uređivanje stavki, nadzor i obavijesti?</strong> Publisher svaki dan provjerava vaš cjenik i javlja vam kad nešto nije u redu.</p>
                <button className="app-button app-button-primary" type="button" onClick={() => setUpgradeOpen(true)}>Nadogradi na Publisher {UPGRADE_LABEL}</button>
              </div>
            )
          : <p>Publisher možete odabrati kod obnove.</p>)}
      {help}
    </section>
  )
}
