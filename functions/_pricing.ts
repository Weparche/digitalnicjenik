/** Mirror of src/publisherPricing.ts for Worker e-mail copy (keep in sync). */

export const LAUNCH_ACTIVE = true
export const LAUNCH_SELF_SERVICE_EUR = 39.9
export const REGULAR_SELF_SERVICE_EUR = 49.9
export const IMPLEMENTATION_FIRST_YEAR_EUR = 89.9
export const LAUNCH_ACTIVATED_SUBSCRIPTIONS_CAP = 100

function formatEur(amount: number, perYear = false): string {
  const formatted = amount.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return perYear ? `${formatted} €/god` : `${formatted} €`
}

export function selfServicePriceEur(): number {
  return LAUNCH_ACTIVE ? LAUNCH_SELF_SERVICE_EUR : REGULAR_SELF_SERVICE_EUR
}

export function selfServiceIntentLabel(): string {
  const price = formatEur(selfServicePriceEur(), true)
  if (!LAUNCH_ACTIVE) return `Self-service — ${price}`
  return `Self-service — ${price} (akcija: prvih ${LAUNCH_ACTIVATED_SUBSCRIPTIONS_CAP} aktiviranih pretplata)`
}

export function implementationIntentLabel(): string {
  return `Postavljanje — ${formatEur(IMPLEMENTATION_FIRST_YEAR_EUR)} prva godina`
}

export function launchDisclaimerLine(): string {
  if (!LAUNCH_ACTIVE) return ''
  return `Nakon ${LAUNCH_ACTIVATED_SUBSCRIPTIONS_CAP} aktiviranih pretplata: ${formatEur(REGULAR_SELF_SERVICE_EUR, true)}.`
}
