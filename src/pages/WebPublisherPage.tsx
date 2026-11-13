import { SitePageLayout } from './PageLayout'
import { getSitePage } from './registry'
export function WebPublisherPage(){
  return <SitePageLayout page={getSitePage('/web-publisher/')} lead="Web + Publisher trenutačno nije dostupan za nove narudžbe." related={[{href:'/cijene/',label:'Cijena Web Linka'},{href:'/digitalni-cjenik-za-wordpress-webshop/',label:'Ugradnja na postojeći web'}]}><section className="site-section"><h2>Trenutačno dostupan Web Link</h2><p>Za postojeću web stranicu možete pripremiti i besplatno objaviti digitalni cjenik na 24 sata. Postojeće pretplate ostaju nepromijenjene.</p><a className="app-button app-button-primary" href="/app?new=1">Pripremi cjenik</a></section></SitePageLayout>
}
