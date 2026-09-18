import { parseMarketinoCsv } from '../../../../src/price-engine/adapters/marketinoCsv'
import { createDraft, type RuntimeEnv } from '../../../_repository'
import { accessErrorResponse, requireTenantAccess } from '../../../_write-auth'
import {
  assertSourceArtifactSize,
  attachCanonicalTenant,
  errorStatus,
  parsePriceListInput,
  readJsonBody,
  sanitizeSourceFilename,
} from '../../../_limits'
import { importIssuesFromParseWarnings } from '../../../../src/price-engine/validate'
import type { NormalizedPriceList } from '../../../../src/price-engine/types'

export const onRequestPost = async ({ request, params, env }: { request: Request; params: Record<string, string>; env: RuntimeEnv }) => {
  try {
    const tenant = await requireTenantAccess({ request, env, slug: params.slug, operation: 'import' })
    const body = await readJsonBody(request) as {
      csv?: unknown
      priceList?: unknown
      name?: string
      sourceFilename?: string
      sourceArtifact?: string
    }
    const sourceFilename = sanitizeSourceFilename(body.sourceFilename)
    const sourceArtifact = typeof body.sourceArtifact === 'string' ? body.sourceArtifact : undefined
    assertSourceArtifactSize(sourceArtifact)

    let list: NormalizedPriceList
    let importIssues = importIssuesFromParseWarnings([], 'csv')

    if (body.priceList !== undefined) {
      list = attachCanonicalTenant(parsePriceListInput(body.priceList), tenant)
    } else if (typeof body.csv === 'string' && body.csv.trim()) {
      if (new TextEncoder().encode(body.csv).byteLength > 2_000_000) {
        return Response.json({ error: 'CSV datoteka je prevelika.' }, { status: 413 })
      }
      const parsed = parseMarketinoCsv(body.csv, tenant)
      importIssues = importIssuesFromParseWarnings(parsed.warnings, 'csv')
      list = { ...parsed.priceList, source: 'marketino-csv', tenant }
    } else {
      return Response.json({ error: 'priceList ili CSV sadržaj je obavezan.' }, { status: 400 })
    }

    const result = await createDraft(env, params.slug, list, sourceFilename, body.priceList ? 'normalized-json' : 'marketino-csv', sourceArtifact, importIssues)
    return Response.json({ draft: result.draft, validation: result.validation, warnings: importIssues.map((issue) => ({ row: issue.row, message: issue.message })) })
  } catch (caught) {
    return accessErrorResponse(caught) || Response.json({ error: caught instanceof Error ? caught.message : 'CSV import nije uspio.' }, { status: errorStatus(caught) })
  }
}
