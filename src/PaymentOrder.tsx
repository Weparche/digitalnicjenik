import { useEffect, useState } from 'react'
import { INSTALLATION, PLANS, formatEur } from '../shared/pricing'
import { formatCents, orderAmountCents, orderLabel, type OrderKind } from '../shared/payment'
import { readAcquisitionTouch } from './acquisition'
import { hoursLeft, licenceState, untilLabel, type Licence, type OrderPayment } from './licenceView'

const WEB_LINK = PLANS[0]
const UPGRADE_LABEL = `+${formatCents(orderAmountCents('publisher_upgrade'))}/god`
const BARCODE_OPTIONS = { bcid: 'pdf417', eclevel: 4, columns: 9, rowmult: 3 } as const

export async function fetchLicence(): Promise<Licence | null> {
  const selected = new URLSearchParams(window.location.search).get('order')
  const response = await fetch('/api/orders' + (selected ? '?order=' + encodeURIComponent(selected) : ''), { credentials: 'include' })
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
  const [reported, setReported] = useState(Boolean(order.paymentReportedAt))
  const [reporting, setReporting] = useState(false)
  const [reportError, setReportError] = useState('')
  async function reportPayment() {
    setReporting(true); setReportError('')
    try {
      const response = await fetch('/api/orders/report', {method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({reference:order.reference})})
      if (!response.ok) throw new Error('Prijavu trenutačno nije moguće spremiti. Osvježite prikaz i pokušajte ponovno.')
      setReported(true)
    } catch(error) {setReportError(error instanceof Error ? error.message : 'Prijava nije uspjela.')} finally {setReporting(false)}
  }
  const upgrade = order.kind === 'publisher_upgrade'
  if(order.status==='paid'||order.status==='cancelled')return <section className="payment-step"><h3>{order.status==='paid'?'Uplata je potvrđena':'Narudžba je otkazana'}</h3><p>{order.reference} · {orderLabel(order.kind)} · {order.amountLabel}</p><p>{order.status==='paid'?'Ne trebate ponovno uplatiti. Aktualni paket i rok prikazani su u dashboardu.':'Za novu narudžbu otvorite dashboard.'}</p></section>
  return (
    <section className="payment-step" aria-labelledby={`payment-${order.reference}`}>
      <span className="app-label">UPLATA · {order.reference}</span>
      <h3 id={`payment-${order.reference}`}>{upgrade ? 'Nadogradnja na Publisher' : 'Uplata — ' + orderLabel(order.kind)}</h3>
      <p className="payment-amount"><strong>{order.amountLabel}</strong></p>
      <p className="payment-what">
        {upgrade
          ? `Publisher za preostalo razdoblje licence (${UPGRADE_LABEL}).`
          : `${orderLabel(order.kind)}${order.installation ? ` + ${INSTALLATION.name.toLocaleLowerCase('hr-HR')} ${formatEur(INSTALLATION.price)} jednokratno` : ''}. ${order.kind === 'installation' ? 'Jednokratna usluga, bez produljenja pretplate.' : 'Godišnja licenca, bez automatske obnove.'}`}
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
          : order.kind==='installation' ? 'Ugradnju dogovaramo nakon potvrde uplate. Ova usluga ne produljuje pretplatu.' : `${activeUntil && Date.parse(activeUntil)>Date.now() ? `Link ostaje aktivan do ${untilLabel(activeUntil)}. ` : ''}Tek nakon potvrde bankovne uplate aktiviramo ili obnavljamo isti link.`}
      </p>
      {reported ? <p className="app-status" role="status">Uplata je prijavljena — čeka potvrdu. Ne trebate ponovno uplatiti.</p> : <button className="app-button app-button-primary" type="button" disabled={reporting} onClick={() => void reportPayment()}>{reporting ? 'Spremamo prijavu…' : 'Uplatio sam'}</button>}
      {reportError && <p className="app-error" role="alert">{reportError}</p>}
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
  initialInstallation = false,
}: {
  kind: 'web_link' | 'publisher' | 'publisher_upgrade'
  defaultEmail: string
  defaultName: string
  onPlaced: () => void
  onCancel?: () => void
  previous?: OrderPayment | null
  initialInstallation?: boolean
}) {
  const [customerType, setCustomerType] = useState<'company' | 'person'>(previous?.customerType ?? 'company')
  const [billingName, setBillingName] = useState(previous?.billingName ?? defaultName)
  const [oib, setOib] = useState(previous?.oib ?? '')
  const [address, setAddress] = useState(previous?.address ?? '')
  const [postalCity, setPostalCity] = useState(previous?.postalCity ?? '')
  const [email, setEmail] = useState(previous?.email ?? defaultEmail)
  const [installation, setInstallation] = useState(previous?.installation ?? initialInstallation)
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
      {(kind === 'web_link' || kind === 'publisher') && (
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
export function KeepLinkFlow({ licence, email, name, startOpen = false, onChanged, initialInstallation = false, kind = 'web_link' }: { licence: Licence; email: string; name: string; startOpen?: boolean; onChanged: () => void; initialInstallation?: boolean; kind?: 'web_link' | 'publisher' }) {
  const [open, setOpen] = useState(startOpen)
  const [editing, setEditing] = useState(false)
  const order = licence.order?.kind === kind ? licence.order : null
  if (order && !editing) {
    return (
      <>
        <PaymentStep order={order} activeUntil={licence.entitlement?.periodEnd ?? null} />
        {!order.paymentReportedAt&&order.status!=='paid'&&<button className="app-link-button" type="button" onClick={() => setEditing(true)}>Izmijeni podatke za račun</button>}
      </>
    )
  }
  if (!open && !editing) {
    return <div className="publisher-upgrade-actions"><button className="app-button app-button-primary" type="button" onClick={() => setOpen(true)}>{kind==='publisher'?'Obnovi Publisher':'Zadrži ovaj link trajno'} — {formatEur(PLANS[kind==='publisher'?1:0].price, true)} →</button></div>
  }
  return <OrderForm kind={kind} initialInstallation={initialInstallation} defaultEmail={email} defaultName={name} previous={order} onCancel={() => { setOpen(false); setEditing(false) }} onPlaced={() => { setOpen(false); setEditing(false); onChanged() }} />
}

export function LicenceCard({ licence, email, name, onChanged }: { licence: Licence; email: string; name: string; onChanged: () => void }) {
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [helpSent, setHelpSent] = useState(false)
  const [renewOpen,setRenewOpen] = useState(new URLSearchParams(window.location.search).get('renew') === '1')
  const state = licenceState(licence)
  const periodEnd = licence.entitlement?.periodEnd ?? null
  if (state === 'none') return null
  const annualKind = licence.entitlement?.plan === 'publisher_self_service' || (licence.entitlement?.status==='trial'&&licence.order?.kind==='publisher') ? 'publisher' : 'web_link'
  if (state === 'grace' || state === 'suspended') return <section className="licence-card publisher-upgrade-banner"><h2>{state === 'suspended' ? 'Pristup je suspendiran' : licence.order?.paymentReportedAt ? 'Uplata je prijavljena — čeka potvrdu' : 'Obnova čeka uplatu'}</h2><p>Plaćeno razdoblje završilo je {periodEnd ? untilLabel(periodEnd) : '—'}.{state === 'grace' && licence.entitlement?.graceUntil ? ` Cjenik ostaje aktivan do ${untilLabel(licence.entitlement.graceUntil)}.` : ''}</p>{licence.entitlement?.plan === 'managed' ? <a href="mailto:nepar@nepar.hr">Dogovori obnovu Web + Publishera — {formatEur(PLANS[2].price,true)}</a> : <KeepLinkFlow licence={licence} email={email} name={name} kind={annualKind} startOpen onChanged={onChanged}/>}</section>

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
          {state === 'expired' ? licence.entitlement?.plan==='managed'?'Obnovu Web + Publishera dogovorite s NEPAR-om.':`Uplatite ${formatEur(PLANS[annualKind==='publisher'?1:0].price)} i isti link se vraća.` : null}
        </p>
        {licence.entitlement?.plan==='managed'?<a href="mailto:nepar@nepar.hr">Dogovori obnovu</a>:<KeepLinkFlow licence={licence} email={email} name={name} kind={annualKind} onChanged={onChanged} />}
        {state === 'free' && <button className="app-link-button" type="button" onClick={() => setUpgradeOpen(!upgradeOpen)}>Želim uređivati stavke — Publisher {formatEur(PLANS[1].price,true)}</button>}
        {state === 'free' && upgradeOpen && <OrderForm kind="publisher" defaultEmail={email} defaultName={name} onPlaced={onChanged}/>}
        {help}
      </section>
    )
  }

  const pendingUpgrade = licence.order?.kind === 'publisher_upgrade' ? licence.order : null
  return (
    <section className={`publisher-upgrade-banner licence-card licence-${state}`}>
      <span className="app-label">{state === 'publisher' ? 'PUBLISHER' : WEB_LINK.name.toLocaleUpperCase('hr-HR')}</span>
      <h2>{periodEnd ? `Aktivno do ${untilLabel(periodEnd)}` : 'Aktivno'}</h2>
      {licence.order && licence.order.kind !== 'publisher_upgrade' && <PaymentStep order={licence.order} activeUntil={licence.access?.accessUntil ?? periodEnd}/>}
      {licence.entitlement?.plan === 'managed' ? <a href="mailto:nepar@nepar.hr">Obnova Web + Publishera po ponudi — {formatEur(PLANS[2].price,true)}</a> : <><button className="app-link-button" type="button" onClick={() => setRenewOpen(!renewOpen)}>Obnovi {orderLabel(annualKind)} — {formatEur(PLANS[annualKind === 'publisher' ? 1 : 0].price,true)}</button>{renewOpen && (!licence.order || licence.order.status==='paid') && <OrderForm kind={annualKind} defaultEmail={email} defaultName={name} onPlaced={() => {setRenewOpen(false);onChanged()}}/>}</>}
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
