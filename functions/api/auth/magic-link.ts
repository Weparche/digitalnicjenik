import { requestMagicLink, type AuthEnv } from '../../_auth'
import { accessErrorResponse } from '../../_write-auth'

type Context = { request: Request; env: AuthEnv }

export async function onRequestPost({ request, env }: Context) {
  try {
    const origin = request.headers.get('origin')
    const url = new URL(request.url)
    if (!origin || origin !== url.origin) {
      return Response.json({ ok: false, code: 'invalid_input' }, { status: 403 })
    }
    const body = await request.json().catch(() => null) as { email?: string } | null
    await requestMagicLink(request, env, body?.email || '')
    return Response.json({ ok: true }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    return accessErrorResponse(error) || Response.json({ ok: false, code: 'send_failed' }, { status: 500 })
  }
}

export const onRequest = () => Response.json({ ok: false, code: 'invalid_input' }, { status: 405, headers: { allow: 'POST' } })
