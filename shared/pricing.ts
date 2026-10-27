/** Hard per-price-list item limit, enforced on import/publish (functions/_limits.ts) and quoted in marketing copy. */
export const MAX_PRICE_LIST_ITEMS = 5_000
export const MAX_ITEMS_LABEL = MAX_PRICE_LIST_ITEMS.toLocaleString('de-DE')

/** Platforms where a plain link or button is enough. Text only: we do not ship native integrations or logos. */
export const PLATFORMS = ['WordPress', 'WooCommerce', 'Shopify', 'Wix', 'Webflow', 'Custom web'] as const

/** The commercial offer, shared by marketing, lead emails and prerendered SEO. */
export const PLANS = [
  { id: 'link', name: 'Web Link', price: 19.9, tagline: 'Za WordPress, webshop ili bilo koji postojeći web.', highlight: `Do ${MAX_ITEMS_LABEL} stavki`, summary: 'Digitalni cjenik za web koji već imate.', features: ['CSV i XML', '30 dana arhive', 'Radi na postojećem webu', 'Bez plugina', 'Javna poveznica i objava novih verzija'] },
  { id: 'publisher', name: 'Publisher', price: 49.9, tagline: 'Za validaciju, dashboard, verzije i upozorenja.', highlight: `Do ${MAX_ITEMS_LABEL} stavki · svakodnevni nadzor`, summary: 'Objava, validacija i svakodnevni nadzor digitalnog cjenika.', features: ['Sve iz Web Linka', 'Excel, CSV i XML s detaljnom validacijom', 'Dashboard i objava novih verzija', 'Svakodnevni nadzor dostupnosti i sadržaja', 'E-mail upozorenje kad nešto nije u redu', 'QR, ispis u PDF i ugradnja na web'] },
  { id: 'web', name: 'Web + Publisher', price: 79.9, tagline: 'Nemate web? Jednostavan web s cjenikom, uz našu pomoć.', highlight: null, summary: 'Jednostavan web za cjenik, uz našu pomoć.', features: ['Sve iz paketa Publisher', 'Jednostavan NEPAR web / landing', 'Hosting i SSL', 'Osnovno uređivanje', 'Postavljanje cjenika i tehničko povezivanje'] },
] as const
export type PlanId = typeof PLANS[number]['id']
/** One-off setup of a link or button on the customer's existing website. Custom integrations stay an individual offer. */
export const INSTALLATION = { name: 'Pomoć s ugradnjom', price: 29.9, scope: 'postavljanje poveznice ili gumba za digitalni cjenik na vaš postojeći web' } as const
export const installationPriceLabel = () => `${formatEur(INSTALLATION.price)} jednokratno`
export function formatEur(amount: number, perYear = false): string {
  const value = amount.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${value} €${perYear ? '/god' : ''}`
}
