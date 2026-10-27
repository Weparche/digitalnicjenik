import { ExistingWebSection, LargeListSection, NoPluginSection, PlatformPills } from '../ExistingWebSections'
import { PlanCards } from '../PlanCards'
import { PLANS, formatEur } from '../publisherPricing'
import { faqGroups } from './faqData'
import { SitePageLayout } from './PageLayout'
import { EXISTING_WEB_PATH, getSitePage } from './registry'

// Plain-link instructions only. NEPAR has no native app, plugin or official integration on these platforms.
export const PLATFORM_GUIDES = [
  { platform: 'WordPress', text: 'U izborniku (Izgled → Izbornici ili urednik stranice) dodajte prilagođenu poveznicu (Custom Link) s nazivom „Digitalni cjenik”. Možete dodati i gumb u bloku stranice ili podnožju.' },
  { platform: 'WooCommerce', text: 'Isti princip kao WordPress: poveznica u izborniku, podnožju ili na stranici trgovine. Za osnovni Web Link nije potreban WooCommerce plugin.' },
  { platform: 'Shopify', text: 'U postavkama navigacije (Navigation) dodajte stavku izbornika s poveznicom na digitalni cjenik, primjerice u podnožje trgovine.' },
  { platform: 'Wix, Webflow i vlastiti web', text: 'Dodajte običnu poveznicu ili gumb u izbornik, podnožje ili sadržaj. Za React, PHP ili drugi vlastiti web razvojnom timu predajete samo URL.' },
]

export const LINK_PLACEMENTS = ['Glavni izbornik', 'Podnožje stranice', 'Gumb na stranici usluga ili trgovine', 'Poveznica u tekstu stranice']

export function ExistingWebPage() {
  const page = getSitePage(EXISTING_WEB_PATH)
  const faq = faqGroups.find((group) => group.id === page.faqGroupId)!
  const webLink = PLANS[0]
  return <SitePageLayout
    page={page}
    lead={<>Za digitalni cjenik ne trebate novi web ni plugin. Dobivate stalnu poveznicu koju dodate u izbornik, podnožje ili gumb, a postojeći web ostaje nepromijenjen. Javni cjenik, CSV/XML i arhiva nalaze se na NEPAR infrastrukturi. Web Link stoji {formatEur(webLink.price, true)}.</>}
    related={[
      { href: '/cijene/', label: 'Cijene i godišnji paketi' },
      { href: '/objava-digitalnog-cjenika/', label: 'Objava i ugradnja korak po korak' },
      { href: '/specifikacija-csv-xml/', label: 'Specifikacija CSV/XML' },
      { href: '/#csv-validator', label: 'Besplatni validator cjenika' },
      { href: '/faq/', label: 'Sva česta pitanja' },
    ]}
  >
    <PlatformPills/>
    <ExistingWebSection landingLink={false}/>

    <section className="site-section" aria-labelledby="link-placement">
      <h2 id="link-placement">Gdje staviti poveznicu?</h2>
      <p>Dovoljno je da posjetitelj i program za dohvat podataka mogu doći do cjenika s vašeg weba. Najčešća mjesta:</p>
      <ul className="news-bullets">{LINK_PLACEMENTS.map((place) => <li key={place}>{place}</li>)}</ul>
    </section>

    <section className="site-section" aria-labelledby="platform-guides">
      <h2 id="platform-guides">Kratke upute po platformi</h2>
      <dl className="ew-platforms">{PLATFORM_GUIDES.map((guide) => <div key={guide.platform}><dt>{guide.platform}</dt><dd>{guide.text}</dd></div>)}</dl>
      <p>Ovo su upute za običnu poveznicu, a ne službene integracije s tim platformama. Detaljnije o izvozu iz WooCommercea pročitajte u <a href="/vodici/woocommerce-wordpress-digitalni-cjenik/">vodiču za WooCommerce i WordPress</a>.</p>
    </section>

    <NoPluginSection/>
    <LargeListSection/>

    <section className="site-section" aria-labelledby="web-link-scope">
      <h2 id="web-link-scope">Što Web Link ne radi</h2>
      <p>Web Link objavljuje digitalni cjenik iz datoteke koju učitate. Ne mijenja cijene na vašem webshopu i ne čita proizvode iz WooCommercea, blagajne ili ERP-a. Novu verziju cjenika učitate kada se cijene promijene.</p>
      <p>Treba vam povezivanje s webshopom, API-jem ili ERP/POS sustavom? Takvu integraciju možemo izraditi prema vašem sustavu, po <a href="#integracija">individualnoj ponudi</a>.</p>
    </section>

    <section className="site-section" aria-labelledby="existing-web-plans">
      <h2 id="existing-web-plans">Paketi</h2>
      <PlanCards/>
    </section>

    <section className="site-section" id="cesta-pitanja" aria-labelledby="existing-web-faq">
      <h2 id="existing-web-faq">Česta pitanja</h2>
      <div className="site-faq">{faq.entries.map((entry) => <div key={entry.question} className="site-faq-item"><h3>{entry.question}</h3><p>{entry.answer}</p></div>)}</div>
    </section>
  </SitePageLayout>
}
