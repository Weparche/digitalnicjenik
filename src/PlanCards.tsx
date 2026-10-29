import { IconArrowRight, IconCheck } from '@tabler/icons-react'
import { PLANS, formatEur, type PlanId } from './publisherPricing'
import { INSTALLATION, installationPriceLabel } from '../shared/pricing'

export type ExtraServiceId = 'installation' | 'integration'

/** One-off and individual services offered next to the plans, never as a plan feature. */
export const EXTRA_SERVICES: Array<{ id: ExtraServiceId; title: string; price: string; text: string; cta: string }> = [
  { id: 'installation', title: INSTALLATION.name, price: installationPriceLabel(), text: 'Trebate pomoć s postavljanjem na web? Možemo to napraviti za vas: postavimo poveznicu ili gumb za digitalni cjenik na vašu postojeću stranicu.', cta: 'Zatraži ugradnju' },
  { id: 'integration', title: 'Napredna integracija', price: 'Individualna ponuda', text: 'Treba vam povezivanje s WooCommerceom, webshopom, API-jem ili ERP/POS sustavom? Integraciju možemo izraditi prema vašem sustavu — individualna ponuda.', cta: 'Zatraži ponudu' },
]

export function PlanCards({ onSelect, onExtra }: { onSelect?: (plan: PlanId) => void; onExtra?: (service: ExtraServiceId) => void }) {
  return <>
    <div className="acq-plans">{PLANS.map((plan) => <article key={plan.id} className={plan.id === 'publisher' ? 'acq-plan acq-plan-featured' : 'acq-plan'}>
      {plan.id === 'publisher' && <span className="acq-recommended">Preporučeni paket</span>}
      <div className="acq-plan-head"><h3>{plan.name}</h3><p className="acq-plan-tagline">{plan.tagline}</p></div>
      <p className="acq-plan-price"><strong>{formatEur(plan.price)}</strong><span>/ god</span></p>
      {plan.highlight && <p className="acq-plan-highlight">{plan.highlight}</p>}
      <ul>{plan.features.map((feature) => <li key={feature}><IconCheck size={18}/>{feature}</li>)}</ul>
      {onSelect ? <button type="button" className={plan.id === 'publisher' ? 'acq-primary' : 'acq-secondary'} onClick={() => onSelect(plan.id)}>Odaberi {plan.name}<IconArrowRight size={19}/></button> : <a className="acq-secondary" href={`/?paket=${plan.id}#posaljite-cjenik`}>Zatraži {plan.name}<IconArrowRight size={19}/></a>}
      {plan.id === 'web' && <small>Novi statički web hostamo mi. Redizajn postojećeg WordPress/Wix weba i custom razvoj nisu uključeni. <a href="/web-publisher/">Opseg web paketa</a></small>}
    </article>)}</div>
    <div className="acq-extras">{EXTRA_SERVICES.map((service) => <article key={service.id} className="acq-extra" id={service.id === 'integration' ? 'integracija' : 'ugradnja'}>
      <div><h3>{service.title}</h3><p className="acq-extra-price">{service.price}</p><p>{service.text}</p></div>
      {onExtra ? <button type="button" className="acq-secondary" onClick={() => onExtra(service.id)}>{service.cta}<IconArrowRight size={19}/></button> : <a className="acq-secondary" href="/#posaljite-cjenik">{service.cta}<IconArrowRight size={19}/></a>}
    </article>)}</div>
  </>
}
