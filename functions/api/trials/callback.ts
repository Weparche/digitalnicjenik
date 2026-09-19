import { clearSessionCookieHeader, sessionCookieHeader } from '../../_auth'
import { provisionTrialFromToken, type TrialEnv } from '../../_trial'
import { accessErrorResponse } from '../../_write-auth'

export const onRequestGet = async ({ request, env }: { request: Request; env: TrialEnv }) => {
  const url = new URL(request.url)
  const token = url.searchParams.get('token') || ''
  const secure = url.protocol === 'https:'
  try {
    const result = await provisionTrialFromToken(env, token)
    const params = new URLSearchParams({
      slug: result.slug,
      welcome: '1',
    })
    if (result.trialEndsAt) params.set('trialEndsAt', result.trialEndsAt)
    if (result.businessName) params.set('name', result.businessName)
    const headers = new Headers({
      location: `/app?${params.toString()}`,
      'set-cookie': sessionCookieHeader(result.session.sessionToken, result.session.maxAgeSeconds, secure),
      'cache-control': 'no-store',
    })
    return new Response(null, { status: 302, headers })
  } catch (error) {
    const denied = accessErrorResponse(error)
    if (denied) {
      const payload = await denied.json() as { code?: string }
      const headers = new Headers({
        location: `/app?authError=${encodeURIComponent(payload.code || 'invalid_token')}`,
        'set-cookie': clearSessionCookieHeader(secure),
        'cache-control': 'no-store',
      })
      return new Response(null, { status: 302, headers })
    }
    return Response.redirect(new URL('/app?authError=send_failed', url.origin).toString(), 302)
  }
}
