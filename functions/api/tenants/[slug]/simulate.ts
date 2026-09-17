import { publishDraft, readCurrent, createDraft, type RuntimeEnv } from '../../../_repository'

export const onRequestPost = async ({ request, params, env }: { request: Request; params: Record<string, string>; env: RuntimeEnv }) => {
  try {
    if (params.slug !== (env.DEMO_WRITE_TENANT || 'nepar')) return Response.json({ error: 'Ovaj tenant nije omogućen za demo write workflow.' }, { status: 403 })
    if (!env.DB) return Response.json({ error: 'D1 binding DB nije konfiguriran.' }, { status: 503 })
    const current = await readCurrent(env, params.slug)
    if (!current) return Response.json({ error: 'Cjenik prvo treba učitati.' }, { status: 404 })
    const body = await request.json() as { itemName?: string; price?: number }
    if (!body.itemName || !Number.isFinite(body.price) || (body.price ?? 0) <= 0) return Response.json({ error: 'Stavka i pozitivna cijena su obavezne.' }, { status: 400 })
    const list = { ...current, updatedAt: new Date().toISOString(), items: current.items.map((item) => item.name === body.itemName ? { ...item, price: body.price as number } : item) }
    const draft = await createDraft(env, params.slug, list, 'demo-simulator.csv', 'marketino-simulator')
    if (!draft.draft) throw new Error('Draft simulacije nije spremljen.')
    const result = await publishDraft(env, params.slug, draft.draft.id, true)
    return Response.json({ ...result, publications: await (await import('../../../_repository')).readPublications(env, params.slug) })
  } catch (caught) { return Response.json({ error: caught instanceof Error ? caught.message : 'Simulacija nije uspjela.' }, { status: 422 }) }
}
