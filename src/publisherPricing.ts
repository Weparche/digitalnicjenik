import { PLANS, formatEur } from '../shared/pricing'
export { PLANS, formatEur } from '../shared/pricing'
export type { PlanId } from '../shared/pricing'
// Compatibility exports for existing Publisher and educational surfaces.
export const LAUNCH_ACTIVE = false
export const REGULAR_SELF_SERVICE_EUR = PLANS[1].price
export const LAUNCH_SELF_SERVICE_EUR = REGULAR_SELF_SERVICE_EUR
export const IMPLEMENTATION_FIRST_YEAR_EUR = PLANS[2].price
export const LAUNCH_ACTIVATED_SUBSCRIPTIONS_CAP = 100
export const selfServicePriceEur = () => REGULAR_SELF_SERVICE_EUR
export const selfServicePriceLabel = () => formatEur(REGULAR_SELF_SERVICE_EUR, true)
export const regularSelfServicePriceLabel = selfServicePriceLabel
export const implementationFirstYearLabel = () => formatEur(IMPLEMENTATION_FIRST_YEAR_EUR, true)
export const launchOfferShort = selfServicePriceLabel
export const launchOfferDetail = () => `Publisher ${selfServicePriceLabel()}.`
export const launchAfterCapLine = () => null
export const COMMERCIAL_INTERMEDIARY_LINE = 'Godišnja cijena, bez automatske naplate. Vaša postojeća web stranica i domena ostaju vaše.'
