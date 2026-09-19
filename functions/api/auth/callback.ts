import { clearSessionCookieHeader, consumeMagicLink, sessionCookieHeader, type AuthEnv } from '../../_auth'
import { accessErrorResponse } from '../../_write-auth'

type Context = { request: Request; env: AuthEnv }

export async function onRequestGet({ request, env }: Context) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token') || ''
  const secure = url.protocol === 'https:'
  try {
    const session = await consumeMagicLink(env, token)
    const headers = new Headers({
      location: '/app',
      'set-cookie': sessionCookieHeader(session.sessionToken, session.maxAgeSeconds, secure),
      'cache-control': 'no-store',
    })
    return new Response(null, { status: 302, headers })
  } catch (error) {
    const denied = accessErrorResponse(error)
    if (denied) {
      const headers = new Headers({
        location: `/app?authError=${encodeURIComponent((await denied.json() as { code?: string }).code || 'invalid_token')}`,
        'set-cookie': clearSessionCookieHeader(secure),
        'cache-control': 'no-store',
      })
      return new Response(null, { status: 302, headers })
    }
    return Response.redirect(new URL('/app?authError=send_failed', url.origin).toString(), 302)
  }
}
