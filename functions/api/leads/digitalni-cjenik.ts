import { handleLeadRequest, type LeadEnv } from '../../_lead'

type Context = { request: Request; env: LeadEnv; waitUntil?:(p:Promise<unknown>)=>void }

export const onRequestPost = ({ request, env, waitUntil }: Context) => handleLeadRequest(request, env, fetch, waitUntil)

export const onRequest = () => Response.json({ ok: false, code: 'invalid_input' }, { status: 405, headers: { allow: 'POST' } })

