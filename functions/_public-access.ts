import type { Entitlement } from '../src/price-engine/types'
import { resolveTenant, readEntitlement, type RuntimeEnv } from './_repository'

export type PublicTenantAccess = {
  tenant: { id: string; slug: string; name: string } | null
  entitlement: Entitlement | null
  accessible: boolean
  trial: boolean
  expired: boolean
  canPublish: boolean
}

const DEMO_SLUG = (env: RuntimeEnv) => env.DEMO_WRITE_TENANT || 'nepar'

export function entitlementIsLive(entitlement: Entitlement | null, now = Date.now()) {
  if (!entitlement) return false
  if (entitlement.status !== 'trial' && entitlement.status !== 'active') return false
  if (entitlement.plan === 'validator') return false
  if (!entitlement.periodEnd) return false
  return new Date(entitlement.periodEnd).getTime() >= now
}

export function entitlementCanPublish(entitlement: Entitlement | null, now = Date.now()) {
  return entitlementIsLive(entitlement, now)
}

export async function getPublicTenantAccess(env: RuntimeEnv, slug: string): Promise<PublicTenantAccess> {
  const tenant = await resolveTenant(env, slug)
  if (!tenant) {
    return { tenant: null, entitlement: null, accessible: false, trial: false, expired: true, canPublish: false }
  }

  // Demo showcase remains always publicly readable when provisioned.
  if (slug === DEMO_SLUG(env)) {
    const entitlement = await readEntitlement(env, slug)
    return {
      tenant,
      entitlement,
      accessible: true,
      trial: false,
      expired: false,
      canPublish: entitlementCanPublish(entitlement),
    }
  }

  const entitlement = await readEntitlement(env, slug)
  const live = entitlementIsLive(entitlement)
  return {
    tenant,
    entitlement,
    accessible: live,
    trial: entitlement?.status === 'trial' && live,
    expired: !live,
    canPublish: entitlementCanPublish(entitlement),
  }
}

export function publicGoneResponse(message = 'Ovaj cjenik trenutačno nije dostupan.') {
  return new Response(message, {
    status: 410,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  })
}

export function publicGoneJson() {
  return Response.json(
    { error: 'unavailable', message: 'Ovaj cjenik trenutačno nije dostupan.' },
    { status: 410, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } },
  )
}

export function applyPublicAccessHeaders(headers: Headers, access: PublicTenantAccess) {
  headers.set('cache-control', access.accessible ? 'public, max-age=60' : 'no-store')
  if (access.trial || !access.accessible) {
    headers.set('x-robots-tag', 'noindex, nofollow')
  }
  // Allow iframe embed for self-serve Publisher install.
  headers.set('content-security-policy', "frame-ancestors *")
  headers.delete('x-frame-options')
  return headers
}
