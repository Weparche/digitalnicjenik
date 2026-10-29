/** Hard per-price-list item limit, enforced on import/publish (functions/_limits.ts) and quoted in marketing copy. */
export const MAX_PRICE_LIST_ITEMS = 5_000
export const MAX_ITEMS_LABEL = MAX_PRICE_LIST_ITEMS.toLocaleString('de-DE')

/** Platforms where a plain link or button is enough. Text only: we do not ship native integrations or logos. */
export const PLATFORMS = ['WordPress', 'WooCommerce', 'Shopify', 'Wix', 'Webflow', 'Custom web'] as const

/** The commercial offer, shared by marketing, lead emails and prerendered SEO. */
export const PLANS = [
  { id: 'link', name: 'Web Link', price: 19.9, tagline: 'Vi vodite cjenik u Excelu. NEPAR ga objavljuje.', highlight: `Do ${MAX_ITEMS_LABEL} stavki`, summary: 'Učitajte Excel, CSV ili XML. Kad promijenite cijene, zamijenite cijeli cjenik novom datotekom.', features: ['Stalni javni URL i HTML cjenik', 'CSV i XML · immutable verzije · 30 dana arhive', 'Neograničena zamjena datoteke uz validaciju', 'QR, PDF/print, link, iframe i embed.js', 'Dnevna objava proizvoda prema kalendaru', 'Za postojeći web, bez plugina'] },
  { id: 'publisher', name: 'Publisher', price: 49.9, tagline: 'Uređujte cijene direktno u NEPAR-u. Bez ponovnog uploada Excela.', highlight: `Do ${MAX_ITEMS_LABEL} stavki · svakodnevni nadzor`, summary: 'Vodite cjenik direktno u dashboardu, uz nadzor i upozorenja.', features: ['Sve iz Web Linka', 'Uređivanje, dodavanje i brisanje stavki', 'Spremanje nacrta i objava nove verzije', 'Svakodnevni nadzor dostupnosti i sadržaja', 'E-mail upozorenja i posljednja uspješna provjera'] },
  { id: 'web', name: 'Web + Publisher', price: 99, tagline: 'Web i digitalni cjenik na jednom mjestu.', highlight: null, summary: 'Novi jednostavni statički web iz NEPAR predloška, na našem hostingu. Ugovara se po ponudi.', features: ['Sve iz paketa Publisher', 'Novi jednostavni poslovni static web', 'NEPAR hosting, SSL i održavanje hostinga', 'Responsive prikaz, osnovni SEO i sitemap', 'Kontakt, radno vrijeme, lokacija i vaše slike', 'Spajanje postojeće domene; kupnja domene nije uključena'] },
] as const
export type PlanId = typeof PLANS[number]['id']
/** One-off setup of a link or button on the customer's existing website. Custom integrations stay an individual offer. */
export const INSTALLATION = { name: 'Ugradnja digitalnog cjenika', price: 29.9, scope: 'jedna standardna ugradnja: link, gumb, postojeći NEPAR embed ili redirect na postojeći web; bez redizajna, popravka CMS-a i custom razvoja' } as const
export const installationPriceLabel = () => `${formatEur(INSTALLATION.price)} jednokratno`
export function formatEur(amount: number, perYear = false): string {
  const value = amount.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${value} €${perYear ? '/god' : ''}`
}
