import type { ReactElement } from 'react'
import { ComparePage } from './ComparePage'
import { FaqPage } from './FaqPage'
import { AnchorGuidePage, AutomationGuidePage, ExcelGuidePage, GuidesHubPage, MikroGuidePage, WooGuidePage } from './GuidePages'
import { PricingPage } from './PricingPage'
import { SpecPage } from './SpecPage'
import { InstallationPage, AutoGubicReferencePage } from './InstallationPage'
import { ExistingWebPage } from './ExistingWebPage'
import type { SitePageMeta } from './registry'
import { WebPublisherPage } from './WebPublisherPage'
import { DigitalPricelistPage, AnchorPricePage, LaunchGuidePage, ServicesPricelistPage, WebshopPricelistPage, WooCommercePricelistPage } from './TopicPages'

const COMPONENTS: Record<string, () => ReactElement> = {
  '/digitalni-cjenik/': DigitalPricelistPage,
  '/sidrena-cijena/': AnchorPricePage,
  '/digitalni-cjenik-2026/': LaunchGuidePage,
  '/digitalni-cjenik-za-usluge/': ServicesPricelistPage,
  '/digitalni-cjenik-za-webshop/': WebshopPricelistPage,
  '/digitalni-cjenik-woocommerce/': WooCommercePricelistPage,
  '/web-publisher/': WebPublisherPage,
  '/digitalni-cjenik-za-wordpress-webshop/': ExistingWebPage,
  '/objava-digitalnog-cjenika/': InstallationPage,
  '/reference/auto-gubic/': AutoGubicReferencePage,
  '/cijene/': PricingPage,
  '/faq/': FaqPage,
  '/usporedba/': ComparePage,
  '/specifikacija-csv-xml/': SpecPage,
  '/vodici/': GuidesHubPage,
  '/vodici/sidrena-cijena/': AnchorGuidePage,
  '/vodici/automatizacija-digitalnog-cjenika/': AutomationGuidePage,
  '/vodici/excel-csv-digitalni-cjenik/': ExcelGuidePage,
  '/vodici/woocommerce-wordpress-digitalni-cjenik/': WooGuidePage,
  '/vodici/mikroeracun-digitalni-cjenik/': MikroGuidePage,
}

export function SitePage({ page }: { page: SitePageMeta }) {
  const Component = COMPONENTS[page.path]
  if (!Component) throw new Error(`site_page_component_missing:${page.path}`)
  return <Component />
}
