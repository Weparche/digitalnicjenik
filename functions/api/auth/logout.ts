import { clearSessionCookieHeader, destroySession, type AuthEnv } from '../../_auth'

type Context = { request: Request; env: AuthEnv }

export async function onRequestPost({ request, env }: Context) {
  const origin = request.headers.get('origin')
  const url = new URL(request.url)
  if (!origin || origin !== url.origin) {
    return Response.json({ ok: false, code: 'invalid_input' }, { status: 403 })
  }
  await destroySession(env, request)
  return Response.json({ ok: true }, {
    headers: {
      'cache-control': 'no-store',
      'set-cookie': clearSessionCookieHeader(url.protocol === 'https:'),
    },
  })
}

export const onRequest = () => Response.json({ ok: false, code: 'invalid_input' }, { status: 405, headers: { allow: 'POST' } })
