import { publishDraft, readCurrent, createDraft, readPublications, withCanonicalTenant, type RuntimeEnv } from '../../../_repository'
import { accessErrorResponse, requireTenantAccess } from '../../../_write-auth'
import { errorStatus, readJsonBody } from '../../../_limits'

export const onRequestPost = async ({ request, params, env }: { request: Request; params: Record<string, string>; env: RuntimeEnv }) => {
  try {
    const tenant = await requireTenantAccess({ request, env, slug: params.slug, operation: 'simulate' })
    const current = await readCurrent(env, params.slug)
    if (!current) return Response.json({ error: 'Cjenik prvo treba učitati.' }, { status: 404 })
    const body = await readJsonBody(request) as { itemName?: string; price?: number }
    if (!body.itemName || !Number.isFinite(body.price) || (body.price ?? 0) <= 0) {
      return Response.json({ error: 'Stavka i pozitivna cijena su obavezne.' }, { status: 400 })
    }
    const list = withCanonicalTenant({
      ...current,
      updatedAt: new Date().toISOString(),
      items: current.items.map((item) => item.name === body.itemName ? { ...item, price: body.price as number } : item),
    }, tenant)
    const draft = await createDraft(env, params.slug, list, 'demo-simulator.csv', 'marketino-simulator')
    if (!draft.draft) throw new Error('Draft simulacije nije spremljen.')
    const result = await publishDraft(env, params.slug, draft.draft.id, true)
    return Response.json({ ...result, publications: await readPublications(env, params.slug) })
  } catch (caught) {
    return accessErrorResponse(caught) || Response.json({ error: caught instanceof Error ? caught.message : 'Simulacija nije uspjela.' }, { status: errorStatus(caught) })
  }
}
