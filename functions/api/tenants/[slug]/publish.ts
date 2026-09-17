import { publishDraft, type RuntimeEnv } from '../../../_repository'

export const onRequestPost = async ({ request, params, env }: { request: Request; params: Record<string, string>; env: RuntimeEnv }) => {
  try {
    if (params.slug !== (env.DEMO_WRITE_TENANT || 'nepar')) return Response.json({ error: 'Production publish zahtijeva autentikaciju/operator pristup.' }, { status: 403 })
    const body = await request.json() as { draftId?: string }
    if (!body.draftId) return Response.json({ error: 'Draft ID nedostaje.' }, { status: 400 })
    return Response.json(await publishDraft(env, params.slug, body.draftId))
  } catch (caught) { return Response.json({ error: caught instanceof Error ? caught.message : 'Objava nije uspjela.' }, { status: 422 }) }
}
