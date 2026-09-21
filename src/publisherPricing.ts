/** Copy-only launch pricing for NEPAR Publisher self-service (no D1 counter). */

export const LAUNCH_ACTIVE = true
export const LAUNCH_SELF_SERVICE_EUR = 39.9
export const REGULAR_SELF_SERVICE_EUR = 49.9
export const IMPLEMENTATION_FIRST_YEAR_EUR = 89.9
export const LAUNCH_ACTIVATED_SUBSCRIPTIONS_CAP = 100

export function formatEur(amount: number, perYear = false): string {
  const formatted = amount.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return perYear ? `${formatted} €/god` : `${formatted} €`
}

export function selfServicePriceEur(): number {
  return LAUNCH_ACTIVE ? LAUNCH_SELF_SERVICE_EUR : REGULAR_SELF_SERVICE_EUR
}

export function selfServicePriceLabel(): string {
  return formatEur(selfServicePriceEur(), true)
}

export function regularSelfServicePriceLabel(): string {
  return formatEur(REGULAR_SELF_SERVICE_EUR, true)
}

export function implementationFirstYearLabel(): string {
  return formatEur(IMPLEMENTATION_FIRST_YEAR_EUR, false)
}

export function launchOfferShort(): string {
  if (!LAUNCH_ACTIVE) return selfServicePriceLabel()
  return `${formatEur(LAUNCH_SELF_SERVICE_EUR, true)} — akcija: prvih ${LAUNCH_ACTIVATED_SUBSCRIPTIONS_CAP} aktiviranih pretplata`
}

export function launchOfferDetail(): string {
  if (!LAUNCH_ACTIVE) return `Publisher self-service ${selfServicePriceLabel()}.`
  return `Publisher self-service ${formatEur(LAUNCH_SELF_SERVICE_EUR, true)} (akcija: prvih ${LAUNCH_ACTIVATED_SUBSCRIPTIONS_CAP} aktiviranih pretplata), zatim ${regularSelfServicePriceLabel()}.`
}

export function launchAfterCapLine(): string | null {
  if (!LAUNCH_ACTIVE) return null
  return `Nakon ${LAUNCH_ACTIVATED_SUBSCRIPTIONS_CAP} aktiviranih pretplata cijena je ${regularSelfServicePriceLabel()}.`
}

export const COMMERCIAL_INTERMEDIARY_LINE =
  'Bez komercijalnog informacijskog posrednika — godišnja cijena umjesto mjesečnog SaaS-a.'
