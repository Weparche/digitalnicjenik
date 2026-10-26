import { parseMarketinoCsv } from '../../../src/price-engine/adapters/marketinoCsv'
import { parseXmlPriceList } from '../../../src/price-engine/xml'
import { createPrivateDraft, type TrialEnv } from '../../_trial'
import { accessErrorResponse } from '../../_write-auth'
import { parsePublicationDetails, type PublicationDetails } from '../../../shared/publication-details'
import { importIssuesFromParseWarnings } from '../../../src/price-engine/validate'
import type { ValidationIssue } from '../../../src/price-engine/types'
import { attachCanonicalTenant, errorStatus, parsePriceListInput, readJsonBody } from '../../_limits'

export const onRequestPost = async ({ request, env }: { request: Request; env: TrialEnv }) => {
  try {
    const contentType = request.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data') && !contentType.includes('application/json')) {
      return Response.json({ error: 'invalid_input' }, { status: 400 })
    }

    let filename = 'cjenik.csv'
    let sourceType = 'marketino-csv'
    let raw = ''
    let list
    let publicationDetails: PublicationDetails | undefined
    let importIssues: ValidationIssue[] = []

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const file = form.get('file')
      if (!(file instanceof File)) return Response.json({ error: 'file_required' }, { status: 400 })
      if (file.size > 2_000_000) return Response.json({ error: 'Datoteka je prevelika.' }, { status: 413 })
      filename = file.name || filename
      raw = await file.text()
      const lower = filename.toLocaleLowerCase('hr-HR')
      if (lower.endsWith('.xml')) {
        sourceType = 'xml'
        list = parseXmlPriceList(raw, { id: 'draft', slug: 'draft', name: 'Draft' })
      } else {
        const parsed = parseMarketinoCsv(raw, { id: 'draft', slug: 'draft', name: 'Draft' })
        list = parsed.priceList
        importIssues = importIssuesFromParseWarnings(parsed.warnings, 'csv')
      }
    } else {
      const body = await readJsonBody(request) as { csv?: string; xml?: string; filename?: string; list?: ReturnType<typeof parseMarketinoCsv>['priceList']; publicationDetails?: unknown }
      if (body.publicationDetails) publicationDetails = parsePublicationDetails(body.publicationDetails)
      if (body.list) {
        list = attachCanonicalTenant(parsePriceListInput(body.list), { id: 'draft', slug: 'draft', name: 'Draft' })
        filename = body.filename || 'cjenik.json'
        sourceType = 'marketino-csv'
      } else if (body.xml) {
        raw = body.xml
        filename = body.filename || 'cjenik.xml'
        sourceType = 'xml'
        list = parseXmlPriceList(raw, { id: 'draft', slug: 'draft', name: 'Draft' })
      } else if (body.csv) {
        raw = body.csv
        filename = body.filename || 'cjenik.csv'
        const parsed = parseMarketinoCsv(raw, { id: 'draft', slug: 'draft', name: 'Draft' })
        list = parsed.priceList
        importIssues = importIssuesFromParseWarnings(parsed.warnings, 'csv')
      } else {
        return Response.json({ error: 'invalid_input' }, { status: 400 })
      }
    }

    const created = await createPrivateDraft(env, list, filename, sourceType, importIssues, publicationDetails)
    return Response.json({
      ok: true,
      draftId: created.draftId,
      expiresAt: created.expiresAt,
      itemCount: created.itemCount,
      validation: created.validation,
      priceList: list,
    })
  } catch (error) {
    const denied = accessErrorResponse(error)
    if (denied) return denied
    return Response.json({ error: error instanceof Error ? error.message : 'draft_failed' }, { status: errorStatus(error) })
  }
}
