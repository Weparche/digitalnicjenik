import { resolveSession, type AuthEnv } from '../../_auth'

type Context = { request: Request; env: AuthEnv }

export async function onRequestGet({ request, env }: Context) {
  const session = await resolveSession(env, request)
  if (!session) {
    return Response.json({ authenticated: false }, { status: 401, headers: { 'cache-control': 'no-store' } })
  }
  return Response.json({
    authenticated: true,
    user: session.user,
    tenants: session.tenants,
  }, { headers: { 'cache-control': 'no-store' } })
}
