import { downloadQrPng, downloadQrSvg, QrCode } from './QrCode'
import { embedIframeSnippet, embedScriptSnippet, printUrl, publicInstallationLinks, publicInstallationSnippet } from './embedCode'

function copyText(value: string) {
  void navigator.clipboard?.writeText(value)
}

/** "Za ispis i web": QR, print/PDF view and embed code for the published price list. */
export function ShareAndPrintCard({ slug, publicUrl }: { slug: string; publicUrl: string }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://digitalnicjenik.nepar.hr'
  const script = embedScriptSnippet(origin, slug)
  const iframe = embedIframeSnippet(origin, slug)
  const qrId = `qr-${slug}`
  return (
    <section className="share-card" aria-labelledby="share-card-heading">
      <h3 id="share-card-heading">Za ispis i web</h3>
      <div className="share-card-grid">
        <div className="share-card-qr">
          <QrCode value={publicUrl} label={`QR kod za ${publicUrl}`} size={144} svgId={qrId} />
          <div className="publish-link-row">
            <button type="button" className="app-link-button" onClick={() => downloadQrSvg(qrId, `cjenik-${slug}-qr.svg`)}>QR (SVG)</button>
            <button type="button" className="app-link-button" onClick={() => downloadQrPng(qrId, `cjenik-${slug}-qr.png`)}>QR (PNG)</button>
          </div>
        </div>
        <div className="share-card-body">
          <strong>Ispis / PDF (A4)</strong>
          <p>Pregled za ispis s QR kodom. U dijalogu za ispis odaberite &bdquo;Spremi kao PDF&rdquo;.</p>
          <a className="app-button app-button-light" href={printUrl(origin, slug)} target="_blank" rel="noreferrer">Ispis / Spremi kao PDF</a>
          <strong>Javne poveznice za vaš web</strong>
          <p>Ministarstvo dopušta vanjski hosting uz slobodan automatski dohvat bez prijave. Na svojem webu istaknite poveznicu na aktualni cjenik (CSV ili XML) i arhivu; HTML prikaz je dodatna pomoć posjetiteljima.</p>
          <div className="publish-link-row">{publicInstallationLinks(origin,slug).map(link=><button key={link.url} type="button" className="app-link-button" onClick={()=>copyText(link.url)}>Kopiraj {link.label}</button>)}</div>
          <pre className="share-snippet" tabIndex={0}>{publicInstallationSnippet(origin,slug)}</pre>
          <button type="button" className="app-link-button" onClick={()=>copyText(publicInstallationSnippet(origin,slug))}>Kopiraj HTML poveznice</button>
          <strong>Ugradnja na vašu web stranicu</strong>
          <pre className="share-snippet" tabIndex={0}>{script}</pre>
          <div className="publish-link-row">
            <button type="button" className="app-link-button" onClick={() => copyText(script)}>Kopiraj skriptu</button>
            <button type="button" className="app-link-button" onClick={() => copyText(iframe)}>Kopiraj iframe</button>
          </div>
        </div>
      </div>
    </section>
  )
}
