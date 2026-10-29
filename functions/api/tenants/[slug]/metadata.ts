import { requireTenantAccess, accessErrorResponse } from '../../../_write-auth'
import { readJsonBody, errorStatus } from '../../../_limits'
import type { RuntimeEnv } from '../../../_repository'
import { parsePublicationDetails } from '../../../../shared/publication-details'

export const onRequestPatch = async ({ request, params, env }: { request: Request; params: Record<string, string>; env: RuntimeEnv }) => {
  try {
    const tenant = await requireTenantAccess({ request, env, slug: params.slug, operation: 'metadata' })
    const details = parsePublicationDetails(await readJsonBody(request, 4096))
    await env.DB!.prepare('UPDATE publication_metadata SET object_type = ?, object_address = ?, object_code = ?, working_days_json = ?, closed_dates_json = ?, updated_at = ? WHERE tenant_id = ?')
      .bind(details.objectType, details.objectAddress, details.objectCode, JSON.stringify(details.workingDays), JSON.stringify(details.closedDates), new Date().toISOString(), tenant.id).run()
    return Response.json({ ok: true, metadata: details })
  } catch (error) {
    return accessErrorResponse(error) || Response.json({ error: error instanceof Error ? error.message : 'Podaci nisu spremljeni.' }, { status: errorStatus(error, 400) })
  }
}
