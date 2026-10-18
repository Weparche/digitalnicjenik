import type { ReactElement } from 'react'
import { ComparePage } from './ComparePage'
import { FaqPage } from './FaqPage'
import { ExcelGuidePage, GuidesHubPage, MikroGuidePage, WooGuidePage } from './GuidePages'
import { PricingPage } from './PricingPage'
import { SpecPage } from './SpecPage'
import type { SitePageMeta } from './registry'

const COMPONENTS: Record<string, () => ReactElement> = {
  '/cijene/': PricingPage,
  '/faq/': FaqPage,
  '/usporedba/': ComparePage,
  '/specifikacija-csv-xml/': SpecPage,
  '/vodici/': GuidesHubPage,
  '/vodici/excel-csv-digitalni-cjenik/': ExcelGuidePage,
  '/vodici/woocommerce-wordpress-digitalni-cjenik/': WooGuidePage,
  '/vodici/mikroeracun-digitalni-cjenik/': MikroGuidePage,
}

export function SitePage({ page }: { page: SitePageMeta }) {
  const Component = COMPONENTS[page.path]
  if (!Component) throw new Error(`site_page_component_missing:${page.path}`)
  return <Component />
}
