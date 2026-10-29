import { resolveSession, type AuthEnv } from './_auth'
import { adminEmailAllowed } from '../shared/admin'
import { AccessDeniedError, accessErrorResponse, operatorAuthorized } from './_write-auth'

export type AdminActor = { id: string; email: string | null; type: 'admin' | 'service' }
export const OPS_HEADERS = { 'cache-control': 'no-store' }
export async function requireAdmin(request: Request, env: AuthEnv): Promise<AdminActor> {
  if (operatorAuthorized(env, request)) return { id: 'operator-service', email: null, type: 'service' }
  const session = await resolveSession(env, request)
  if (!session) throw new AccessDeniedError(401, 'unauthorized', 'Prijavite se administratorovim e-mailom.')
  if (!adminEmailAllowed(env, session.user.email)) throw new AccessDeniedError(403, 'forbidden', 'Nemate administratorsko pravo.')
  if (!['GET', 'HEAD'].includes(request.method) && request.headers.get('origin') !== new URL(request.url).origin) {
    throw new AccessDeniedError(403, 'invalid_origin', 'Zahtjev mora doći s ove stranice.')
  }
  return { id: session.user.id, email: session.user.email, type: 'admin' }
}
export function opsError(error: unknown) {
  const response = accessErrorResponse(error) ?? Response.json({ error: 'Operaciju nije moguće dovršiti.' }, { status: 500 })
  response.headers.set('cache-control', 'no-store')
  return response
}
