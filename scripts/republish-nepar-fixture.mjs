/**
 * Republish the root marketino-artikli fixture to the demo NEPAR tenant.
 * Usage: node scripts/republish-nepar-fixture.mjs
 * Optional: ORIGIN=https://digitalnicjenik.nepar.hr
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const origin = process.env.ORIGIN || 'https://digitalnicjenik.nepar.hr'
const csv = readFileSync(resolve('marketino-artikli'), 'utf8')

async function readJson(response) {
  const text = await response.text()
  const type = response.headers.get('content-type') || ''
  if (!type.includes('application/json')) {
    throw new Error(`Expected JSON from ${response.url} (status ${response.status}): ${text.slice(0, 200)}`)
  }
  return JSON.parse(text)
}

const importResponse = await fetch(`${origin}/api/tenants/nepar/import`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json' },
  body: JSON.stringify({ csv, sourceFilename: 'marketino-artikli.csv' }),
})
const imported = await readJson(importResponse)
if (!importResponse.ok) {
  console.error('Import failed', importResponse.status, imported)
  process.exit(1)
}

const draftId = imported.draft?.id
const blocking = imported.validation?.blockingCount ?? imported.validation?.issues?.filter((issue) => issue.severity !== 'warning').length
if (blocking) {
  console.error('Draft still has blockers; cannot publish.', imported.validation)
  process.exit(1)
}

const publishResponse = await fetch(`${origin}/api/tenants/nepar/publish`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json' },
  body: JSON.stringify({ draftId }),
})
const published = await readJson(publishResponse)
if (!publishResponse.ok) {
  console.error('Publish failed', publishResponse.status, published)
  process.exit(1)
}

console.log(`Republished to ${origin} · ${published.publication?.filenameStem || published.message || 'ok'} · items ${imported.draft?.normalizedPayload?.items?.length ?? '?'}`)
