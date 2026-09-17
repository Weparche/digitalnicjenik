import { handleLeadRequest, type LeadEnv } from '../../_lead'

type Context = { request: Request; env: LeadEnv }

export const onRequestPost = ({ request, env }: Context) => handleLeadRequest(request, env)

export const onRequest = () => Response.json({ ok: false, code: 'invalid_input' }, { status: 405, headers: { allow: 'POST' } })

