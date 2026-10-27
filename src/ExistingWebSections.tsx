import { MAX_ITEMS_LABEL, PLATFORMS } from '../shared/pricing'

// Positioning blocks shared by the home page and /digitalni-cjenik-za-wordpress-webshop/.
// Platform names are plain text: NEPAR has no native app or official integration on any of them.

export const EXISTING_WEB_PLATFORMS = ['WordPress', 'WooCommerce', 'Shopify', 'Wix', 'Webflow', 'Custom webshop', 'React / PHP / custom web']

export const EXISTING_WEB_STEPS = [
  { title: 'Učitajte svoj CSV/XML', text: 'Pregledate podatke prije objave; ništa se ne objavljuje bez vaše potvrde.' },
  { title: 'Dobijete stalnu poveznicu', text: 'Javni digitalni cjenik, CSV i XML te arhiva prethodnih verzija na istoj adresi.' },
  { title: 'Dodajte link ili gumb na postojeći web', text: 'U izbornik, podnožje, gumb ili tekst stranice. Ostatak weba ostaje kakav jest.' },
]

export const NO_PLUGIN_REASONS = [
  'Nema dodatka koji treba održavati i ažurirati.',
  'Nema ovisnosti o verziji WordPressa ili WooCommercea.',
  'Nema sukoba s temom ili drugim dodacima.',
  'Digitalni cjenik ostaje dostupan neovisno o CMS-u.',
  'Kasnije možete promijeniti web bez seljenja cjenika.',
]

export const LARGE_LIST_TITLE = 'Imate više od nekoliko desetaka stavki?'
export const LARGE_LIST_TEXT = 'Ne morate seliti cjenik u novu aplikaciju niti plaćati paket samo zato što imate više proizvoda ili usluga. Ako već imate svoj CSV/XML, NEPAR može služiti samo kao sloj za objavu, arhivu i nadzor.'
export const LARGE_LIST_LIMIT = `Web Link i Publisher podržavaju do ${MAX_ITEMS_LABEL} stavki po cjeniku.`

export function PlatformPills({ platforms = PLATFORMS, label = 'Radi uz platforme' }: { platforms?: readonly string[]; label?: string }) {
  return <ul className="ew-pills" aria-label={label}>{platforms.map((name) => <li key={name}>{name}</li>)}</ul>
}

export function ExistingWebSection({ headingLevel = 'h2', landingLink = true }: { headingLevel?: 'h2' | 'h3'; landingLink?: boolean }) {
  const Heading = headingLevel
  return <section className="ew-section" id="postojeci-web" aria-labelledby="existing-web-title">
    <div className="ew-intro">
      <Heading id="existing-web-title">Radi s webom koji već imate</Heading>
      <p>Ako na svojoj stranici možete dodati običnu poveznicu ili gumb, možete dodati NEPAR digitalni cjenik. Nema migracije weba, obveznog dodatka ni vezivanja uz određeni CMS.</p>
      <PlatformPills platforms={EXISTING_WEB_PLATFORMS} label="Platforme na koje možete dodati poveznicu"/>
    </div>
    <ol className="ew-steps">{EXISTING_WEB_STEPS.map((step) => <li key={step.title}><strong>{step.title}</strong><p>{step.text}</p></li>)}</ol>
    {landingLink && <p className="ew-more"><a href="/digitalni-cjenik-za-wordpress-webshop/">Upute za WordPress, webshop i druge platforme →</a></p>}
  </section>
}

export function LargeListSection() {
  return <section className="ew-section ew-large" aria-labelledby="large-list-title">
    <h2 id="large-list-title">{LARGE_LIST_TITLE}</h2>
    <p>{LARGE_LIST_TEXT}</p>
    <p className="ew-limit"><strong>Do {MAX_ITEMS_LABEL} stavki</strong><span>{LARGE_LIST_LIMIT}</span></p>
  </section>
}

export function NoPluginSection() {
  return <section className="ew-section ew-no-plugin" aria-labelledby="no-plugin-title">
    <h2 id="no-plugin-title">Zašto bez plugina?</h2>
    <p>Web Link ne traži instalaciju na vašem webu. To ne znači da se ništa ne može dogoditi, nego da cjenik ne ovisi o dodatku koji morate održavati.</p>
    <ul>{NO_PLUGIN_REASONS.map((reason) => <li key={reason}>{reason}</li>)}</ul>
  </section>
}
