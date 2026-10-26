import { PLANS, formatEur } from '../shared/pricing'
export { LAUNCH_ACTIVE, LAUNCH_SELF_SERVICE_EUR, REGULAR_SELF_SERVICE_EUR, IMPLEMENTATION_FIRST_YEAR_EUR, LAUNCH_ACTIVATED_SUBSCRIPTIONS_CAP, selfServicePriceEur } from '../src/publisherPricing'
export const selfServiceIntentLabel = () => `Publisher — ${formatEur(PLANS[1].price, true)}`
export const implementationIntentLabel = () => `Web + Publisher — ${formatEur(PLANS[2].price, true)}`
export const launchDisclaimerLine = () => ''
