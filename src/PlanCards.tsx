import { IconArrowRight, IconCheck } from '@tabler/icons-react'
import { PLANS, formatEur, type PlanId } from './publisherPricing'

export function PlanCards({ onSelect }: { onSelect?: (plan: PlanId) => void }) {
  return <div className="acq-plans">{PLANS.map((plan) => <article key={plan.id} className={plan.id === 'publisher' ? 'acq-plan acq-plan-featured' : 'acq-plan'}>
    {plan.id === 'publisher' && <span className="acq-recommended">Preporučeni paket</span>}
    <h3>{plan.name}</h3><p className="acq-plan-price"><strong>{formatEur(plan.price)}</strong><span>/ god</span></p><p>{plan.summary}</p>
    <ul>{plan.features.map((feature) => <li key={feature}><IconCheck size={18}/>{feature}</li>)}</ul>
    {onSelect ? <button type="button" className={plan.id === 'publisher' ? 'acq-primary' : 'acq-secondary'} onClick={() => onSelect(plan.id)}>Odaberi {plan.name}<IconArrowRight size={19}/></button> : <a className="acq-secondary" href={`/?paket=${plan.id}#posaljite-cjenik`}>Zatraži {plan.name}<IconArrowRight size={19}/></a>}
    {plan.id === 'web' && <small>Za složenije web stranice zatražite posebnu ponudu.</small>}
  </article>)}</div>
}
