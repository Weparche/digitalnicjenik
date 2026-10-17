import { downloadQrPng, downloadQrSvg, QrCode } from './QrCode'
import { embedIframeSnippet, embedScriptSnippet, printUrl } from './embedCode'

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
