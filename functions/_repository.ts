import { deterministicHash, diffPriceLists } from "../src/price-engine/hash"
import { createFilenameStemPrefix, filenameTimestamp } from "../src/price-engine/filename"
import { parseMarketinoCsv } from "../src/price-engine/adapters/marketinoCsv"
import { mergeValidationIssues, validatePriceList } from "../src/price-engine/validate"
import type { DraftStatus, Entitlement, NormalizedPriceList, PricePublication, PriceSnapshot, PublicationMetadata, PriceUpload, ValidationIssue } from "../src/price-engine/types"
import { marketinoFixture } from "./_fixture"

type D1Result = { meta?: { changes?: number } }
type D1Statement = { bind: (...values: unknown[]) => D1Statement; first: <T = Record<string, unknown>>() => Promise<T | null>; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>; run: () => Promise<D1Result> }
export type D1DatabaseLike = { prepare: (query: string) => D1Statement; batch: (statements: D1Statement[]) => Promise<D1Result[]> }
export type RuntimeEnv = {
  DB?: D1DatabaseLike
  ASSETS?: { fetch: (input: Request | URL | string) => Promise<Response> }
  DEMO_WRITE_TENANT?: string
  DEMO_PUBLIC_HOSTNAME?: string
  DEFAULT_PUBLICATION_TIMEZONE?: string
  OPERATOR_WRITE_KEY?: string
  DEMO_WRITE_RATE_LIMIT_SECRET?: string
  LEAD_RATE_LIMIT_SECRET?: string
  CHECKER_RATE_LIMIT_SECRET?: string
}

type PublicationRow = { id: string; tenant_id: string; tenant_slug: string; tenant_name: string; price_list_id: string; sequence: number; filename_stem: string; published_at: string; superseded_at: string | null; public_until: string | null; hash: string; payload_json: string; is_current: number }
type UploadRow = { id: string; tenant_id: string; source_filename: string; source_type: string; normalized_payload_json: string; validation_issues_json: string; status: DraftStatus; created_at: string; updated_at: string }
type MetadataRow = { tenant_id: string; object_type: string; object_address: string; object_code: string; next_publication_sequence: number; timezone: string; created_at: string; updated_at: string }

const now = () => new Date().toISOString()
const id = () => crypto.randomUUID()
const addDays = (value: string, days: number) => new Date(new Date(value).getTime() + days * 86400000).toISOString()
const json = <T>(value: T) => JSON.stringify(value)
const toList = (value: string) => JSON.parse(value) as NormalizedPriceList
const toIssues = (value: string) => JSON.parse(value) as ValidationIssue[]

function mapMetadata(row: MetadataRow): PublicationMetadata {
  return { objectType: row.object_type, objectAddress: row.object_address, objectCode: row.object_code, nextPublicationSequence: row.next_publication_sequence, timezone: row.timezone }
}

function mapPublication(row: PublicationRow): PricePublication {
  return { id: row.id, tenantId: row.tenant_id, priceListId: row.price_list_id, sequence: row.sequence, filenameStem: row.filename_stem, publishedAt: row.published_at, supersededAt: row.superseded_at, publicUntil: row.public_until, hash: row.hash, payload: toList(row.payload_json), isCurrent: row.is_current === 1 }
}

function mapUpload(row: UploadRow): PriceUpload {
  return { id: row.id, tenantId: row.tenant_id, sourceFilename: row.source_filename, sourceType: row.source_type, normalizedPayload: toList(row.normalized_payload_json), validationIssues: toIssues(row.validation_issues_json), status: row.status, createdAt: row.created_at, updatedAt: row.updated_at }
}

async function metadataFor(env: RuntimeEnv, tenantId: string) {
  const row = await env.DB!.prepare("SELECT tenant_id, object_type, object_address, object_code, next_publication_sequence, timezone, created_at, updated_at FROM publication_metadata WHERE tenant_id = ?").bind(tenantId).first<MetadataRow>()
  if (!row) throw new Error("Nedostaju publication metadata podaci za tenant.")
  return mapMetadata(row)
}

async function assertActivePublicationTarget(env: RuntimeEnv, tenantId: string) {
  const target = await env.DB!.prepare("SELECT id, tenant_id FROM publication_targets WHERE tenant_id = ? AND status = 'active' LIMIT 1").bind(tenantId).first<{ id: string; tenant_id: string }>()
  if (!target || target.tenant_id !== tenantId) throw new Error("Nedostaje aktivni public target za objavu.")
  return target
}

export async function resolveTenant(env: RuntimeEnv, slug: string) {
  return env.DB!.prepare("SELECT id, slug, name FROM tenants WHERE slug = ?").bind(slug).first<{ id: string; slug: string; name: string }>()
}

export function withCanonicalTenant(list: NormalizedPriceList, tenant: { id: string; slug: string; name: string }): NormalizedPriceList {
  return { ...list, tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name } }
}

async function tenantIdFor(env: RuntimeEnv, slug: string) {
  const row = await resolveTenant(env, slug)
  return row?.id ?? null
}

async function requireTenant(env: RuntimeEnv, slug: string) {
  const tenant = await resolveTenant(env, slug)
  if (!tenant) throw new Error("Tenant nije pronađen.")
  return tenant
}

async function ensureTenant(env: RuntimeEnv, list: NormalizedPriceList) {
  const timestamp = now()
  const statements = [
    env.DB!.prepare("INSERT INTO tenants (id, slug, name, currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(slug) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at").bind(list.tenant.id, list.tenant.slug, list.tenant.name, list.currency, timestamp, timestamp),
    env.DB!.prepare("INSERT INTO publication_metadata (tenant_id, object_type, object_address, object_code, next_publication_sequence, timezone, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?) ON CONFLICT(tenant_id) DO NOTHING").bind(list.tenant.id, "usluzni-objekt", "demo", list.tenant.slug, env.DEFAULT_PUBLICATION_TIMEZONE || "Europe/Zagreb", timestamp, timestamp),
    env.DB!.prepare("INSERT INTO publication_targets (id, tenant_id, hostname, status, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?) ON CONFLICT(id) DO UPDATE SET hostname = excluded.hostname, status = 'active', updated_at = excluded.updated_at").bind("target-" + list.tenant.id, list.tenant.id, list.tenant.slug === (env.DEMO_WRITE_TENANT || "nepar") ? (env.DEMO_PUBLIC_HOSTNAME || list.tenant.slug + ".digitalnicjenik.nepar.hr") : list.tenant.slug + ".digitalnicjenik.nepar.hr", timestamp, timestamp),
  ]
  if (list.tenant.slug === (env.DEMO_WRITE_TENANT || "nepar")) {
    statements.push(env.DB!.prepare("INSERT INTO entitlements (id, tenant_id, plan, status, period_start, period_end, created_at, updated_at) VALUES (?, ?, 'publisher_self_service', 'active', ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING").bind("entitlement-" + list.tenant.slug, list.tenant.id, timestamp, addDays(timestamp, 365), timestamp, timestamp))
  }
  await env.DB!.batch(statements)
}

async function ensureDemoProvisioned(env: RuntimeEnv, request: Request, slug: string) {
  if (!env.DB) return null
  const existing = await readCurrentPublication(env, slug)
  if (existing) return existing
  const assetUrl = new URL("/marketino-artikli", request.url)
  const response = env.ASSETS ? await env.ASSETS.fetch(assetUrl) : null
  const fixture = response?.ok ? await response.text() : marketinoFixture
  const parsed = parseMarketinoCsv(fixture, { id: slug, slug, name: slug === "patrisa-sisa" ? "Patriša Šiša" : "NEPAR" })
  const list = { ...parsed.priceList, source: "nepar" as const }
  await ensureTenant(env, list)
  const start = now()
  await env.DB.batch([
    env.DB.prepare("INSERT INTO entitlements (id, tenant_id, plan, status, period_start, period_end, created_at, updated_at) VALUES (?, ?, 'publisher_self_service', 'active', ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING").bind("entitlement-" + slug, slug, start, addDays(start, 365), start, start),
  ])
  const draft = await createDraft(env, slug, list, "marketino-artikli", "nepar")
  if (!draft.draft) throw new Error("Demo draft nije spremljen.")
  await publishDraft(env, slug, draft.draft.id, true)
  return readCurrentPublication(env, slug)
}

const publicationSelect = "SELECT p.id, p.tenant_id, t.slug AS tenant_slug, t.name AS tenant_name, p.price_list_id, p.sequence, p.filename_stem, p.published_at, p.superseded_at, p.public_until, p.hash, p.payload_json, p.is_current FROM price_publications p JOIN tenants t ON t.id = p.tenant_id"

export async function readCurrentPublication(env: RuntimeEnv, slug: string): Promise<PricePublication | null> {
  if (!env.DB) return null
  const row = await env.DB.prepare(publicationSelect + " WHERE t.slug = ? AND p.is_current = 1 LIMIT 1").bind(slug).first<PublicationRow>()
  return row ? mapPublication(row) : null
}

export async function readPublications(env: RuntimeEnv, slug: string, publicOnly = true): Promise<PricePublication[]> {
  if (!env.DB) return []
  const query = publicationSelect + " WHERE t.slug = ?" + (publicOnly ? " AND (p.is_current = 1 OR p.public_until >= ?)" : "") + " ORDER BY p.is_current DESC, p.published_at DESC"
  const rows = publicOnly ? await env.DB.prepare(query).bind(slug, now()).all<PublicationRow>() : await env.DB.prepare(query).bind(slug).all<PublicationRow>()
  return rows.results.map(mapPublication)
}

export async function readPublicationByStem(env: RuntimeEnv, stem: string, publicOnly = true): Promise<PricePublication | null> {
  if (!env.DB) return null
  const query = publicationSelect + " WHERE p.filename_stem = ?" + (publicOnly ? " AND (p.is_current = 1 OR p.public_until >= ?)" : "") + " LIMIT 1"
  const row = publicOnly ? await env.DB.prepare(query).bind(stem, now()).first<PublicationRow>() : await env.DB.prepare(query).bind(stem).first<PublicationRow>()
  return row ? mapPublication(row) : null
}

export async function readPublicationForHost(env: RuntimeEnv, hostname: string): Promise<PricePublication | null> {
  if (!env.DB) return null
  const row = await env.DB.prepare(publicationSelect + " JOIN publication_targets target ON target.current_publication_id = p.id WHERE target.tenant_id = p.tenant_id AND lower(target.hostname) = lower(?) AND target.status = 'active' AND p.is_current = 1 LIMIT 1").bind(hostname).first<PublicationRow>()
  return row ? mapPublication(row) : null
}

export async function readMetadataForSlug(env: RuntimeEnv, slug: string) {
  const tenantId = await tenantIdFor(env, slug)
  return tenantId ? metadataFor(env, tenantId) : null
}

export async function readEntitlement(env: RuntimeEnv, slug: string): Promise<Entitlement | null> {
  const row = await env.DB?.prepare("SELECT e.id, e.tenant_id, e.plan, e.status, e.period_start, e.period_end FROM entitlements e JOIN tenants t ON t.id = e.tenant_id WHERE t.slug = ? ORDER BY e.created_at DESC LIMIT 1").bind(slug).first<{ id: string; tenant_id: string; plan: Entitlement["plan"]; status: Entitlement["status"]; period_start: string | null; period_end: string | null }>()
  return row ? { id: row.id, tenantId: row.tenant_id, plan: row.plan, status: row.status, periodStart: row.period_start, periodEnd: row.period_end } : null
}

export async function readCurrent(env: RuntimeEnv, slug: string) {
  return (await readCurrentPublication(env, slug))?.payload ?? null
}

export async function readSnapshots(env: RuntimeEnv, slug: string): Promise<PriceSnapshot[]> {
  return (await readPublications(env, slug, false)).map((publication) => ({ id: publication.id, tenantId: publication.tenantId, source: publication.payload.source, hash: publication.hash, data: publication.payload, createdAt: publication.publishedAt, changedItems: [] }))
}

export async function readDraft(env: RuntimeEnv, slug: string, draftId: string): Promise<PriceUpload | null> {
  const row = await env.DB?.prepare("SELECT u.id, u.tenant_id, u.source_filename, u.source_type, u.normalized_payload_json, u.validation_issues_json, u.status, u.created_at, u.updated_at FROM price_uploads u JOIN tenants t ON t.id = u.tenant_id WHERE u.id = ? AND t.slug = ?").bind(draftId, slug).first<UploadRow>()
  return row ? mapUpload(row) : null
}

export async function createDraft(env: RuntimeEnv, slug: string, list: NormalizedPriceList, sourceFilename: string, sourceType: string, sourceArtifact?: string | null, extraIssues: ValidationIssue[] = []) {
  if (!env.DB) throw new Error("D1 binding DB nije konfiguriran.")
  const provisional = withCanonicalTenant(list, { id: list.tenant.id || slug, slug, name: list.tenant.name || slug })
  await ensureTenant(env, provisional)
  const tenant = await requireTenant(env, slug)
  const canonical = withCanonicalTenant(provisional, tenant)
  const validation = mergeValidationIssues(validatePriceList(canonical), extraIssues)
  const timestamp = now()
  const draftId = id()
  await env.DB.batch([
    env.DB.prepare("INSERT INTO price_uploads (id, tenant_id, source_filename, source_type, normalized_payload_json, validation_issues_json, status, created_at, updated_at, source_artifact_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(draftId, tenant.id, sourceFilename, sourceType, json(canonical), json(validation.issues), validation.status as DraftStatus, timestamp, timestamp, sourceArtifact ?? null),
    env.DB.prepare("INSERT INTO sync_logs (id, tenant_id, provider, status, message, created_at, event_type, details_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(id(), tenant.id, sourceType, validation.status === "ready_to_publish" ? "validated" : "manual_review", "Učitano " + canonical.items.length + " stavki.", timestamp, "upload_validated", json({ draftId, blockingCount: validation.blockingCount, warningCount: validation.warningCount })),
  ])
  return { draft: await readDraft(env, slug, draftId), validation }
}

export async function updateDraft(env: RuntimeEnv, slug: string, draftId: string, list: NormalizedPriceList) {
  if (!env.DB) throw new Error("D1 binding DB nije konfiguriran.")
  const tenant = await requireTenant(env, slug)
  const draft = await readDraft(env, slug, draftId)
  if (!draft || draft.status === "published") throw new Error("Draft nije pronađen ili je već objavljen.")
  if (draft.tenantId !== tenant.id) throw new Error("Draft nije pronađen.")
  const canonical = withCanonicalTenant(list, tenant)
  const validation = validatePriceList(canonical)
  const timestamp = now()
  const updated = await env.DB.prepare("UPDATE price_uploads SET normalized_payload_json = ?, validation_issues_json = ?, status = ?, updated_at = ? WHERE id = ? AND tenant_id = ? AND status != 'published'").bind(json(canonical), json(validation.issues), validation.status, timestamp, draftId, tenant.id).run()
  if (!(updated.meta?.changes ?? 0)) throw new Error("Draft nije pronađen ili je već objavljen.")
  return { draft: await readDraft(env, slug, draftId), validation }
}

export async function publishDraft(env: RuntimeEnv, slug: string, draftId: string, internalDemo = false) {
  if (!env.DB) throw new Error("D1 binding DB nije konfiguriran.")
  const tenant = await requireTenant(env, slug)
  const draft = await readDraft(env, slug, draftId)
  if (!draft || draft.tenantId !== tenant.id) throw new Error("Draft nije pronađen.")
  const payload = withCanonicalTenant(draft.normalizedPayload, tenant)
  if (draft.status !== "ready_to_publish" && !internalDemo) throw new Error("Cjenik još nije spreman za objavu.")
  const draftValidation = validatePriceList(payload)
  if (!internalDemo && draftValidation.status !== "ready_to_publish") throw new Error("Cjenik više nije spreman za objavu. Ponovno provjerite dopune.")
  const entitlement = await readEntitlement(env, slug)
  if (!internalDemo && (!entitlement || entitlement.status !== "active" || entitlement.plan === "validator")) throw new Error("Aktivan Publisher entitlement nije pronađen.")
  const current = await readCurrentPublication(env, slug)
  const hash = await deterministicHash(payload)
  if (current?.hash === hash) {
    await env.DB.prepare("UPDATE price_uploads SET status = 'published', updated_at = ? WHERE id = ? AND tenant_id = ?").bind(now(), draftId, tenant.id).run()
    return { changed: false, message: "Nema promjena za objavu.", publication: current, current: current.payload, changedItems: [] }
  }
  const timestamp = now()
  const tenantId = tenant.id
  const metadata = await metadataFor(env, tenantId)
  const publicationId = id()
  const priceListId = id()
  const filenamePrefix = createFilenameStemPrefix(metadata)
  const filenameTime = filenameTimestamp(new Date(timestamp), metadata.timezone)
  const publicUntil = addDays(timestamp, 30)
  await assertActivePublicationTarget(env, tenantId)
  // The first statement claims the draft. Every following statement also
  // requires that this payload is not already current. This makes a retry or
  // concurrent request idempotent without relying on a JavaScript-side lock.
  const guard = "EXISTS (SELECT 1 FROM price_uploads WHERE id = ? AND tenant_id = ? AND status = 'published') AND NOT EXISTS (SELECT 1 FROM price_publications WHERE tenant_id = ? AND is_current = 1 AND hash = ?)"
  const entitlementGuard = internalDemo ? "1 = 1" : "EXISTS (SELECT 1 FROM entitlements WHERE tenant_id = ? AND status = 'active' AND plan IN ('publisher_self_service', 'managed') AND (period_end IS NULL OR period_end >= ?))"
  const firstBindings = internalDemo ? [timestamp, draftId, tenantId] : [timestamp, draftId, tenantId, tenantId, timestamp]
  const insertedGuard = "EXISTS (SELECT 1 FROM price_publications WHERE id = ? AND tenant_id = ?)"
  const results = await env.DB.batch([
    env.DB.prepare("UPDATE price_uploads SET status = 'published', updated_at = ? WHERE id = ? AND tenant_id = ? AND status " + (internalDemo ? "IN ('ready_to_publish', 'manual_review', 'invalid')" : "= 'ready_to_publish'") + " AND " + entitlementGuard).bind(...firstBindings),
    env.DB.prepare("UPDATE price_publications SET is_current = 0, superseded_at = ?, public_until = ? WHERE tenant_id = ? AND is_current = 1 AND " + guard).bind(timestamp, publicUntil, tenantId, draftId, tenantId, tenantId, hash),
    env.DB.prepare("INSERT INTO price_list_versions (id, tenant_id, hash, payload_json, created_at) SELECT ?, ?, ?, ?, ? WHERE " + guard).bind(priceListId, tenantId, hash, json(payload), timestamp, draftId, tenantId, tenantId, hash),
    env.DB.prepare("INSERT INTO price_publications (id, tenant_id, price_list_id, sequence, filename_stem, published_at, superseded_at, public_until, hash, payload_json, is_current) SELECT ?, ?, ?, next_publication_sequence, ? || '_' || next_publication_sequence || '_' || ?, ?, NULL, NULL, ?, ?, 1 FROM publication_metadata WHERE tenant_id = ? AND " + guard).bind(publicationId, tenantId, priceListId, filenamePrefix, filenameTime, timestamp, hash, json(payload), tenantId, draftId, tenantId, tenantId, hash),
    env.DB.prepare("UPDATE publication_metadata SET next_publication_sequence = next_publication_sequence + 1, updated_at = ? WHERE tenant_id = ? AND " + insertedGuard).bind(timestamp, tenantId, publicationId, tenantId),
    env.DB.prepare("UPDATE publication_targets SET current_publication_id = ?, updated_at = ? WHERE tenant_id = ? AND " + insertedGuard).bind(publicationId, timestamp, tenantId, publicationId, tenantId),
    env.DB.prepare("INSERT INTO sync_logs (id, tenant_id, provider, status, message, created_at, event_type, details_json) SELECT ?, ?, ?, 'published', ?, ?, 'publication_published', ? WHERE " + insertedGuard).bind(id(), tenantId, draft.sourceType, "Objavljena nova verzija cjenika.", timestamp, json({ publicationId, hash }), publicationId, tenantId),
  ])
  const inserted = results[3]?.meta?.changes ?? 0
  if (!inserted) {
    const concurrentCurrent = await readCurrentPublication(env, slug)
    if (concurrentCurrent?.hash === hash) return { changed: false, message: "Nema promjena za objavu.", publication: concurrentCurrent, current: concurrentCurrent.payload, changedItems: [] }
    throw new Error("Objava nije mogla biti atomski dovršena. Pokušajte ponovno.")
  }
  const publication = await env.DB.prepare(publicationSelect + " WHERE p.id = ? AND p.tenant_id = ? LIMIT 1").bind(publicationId, tenantId).first<PublicationRow>()
  if (!publication) throw new Error("Objavljena publikacija nije pronađena.")
  return { changed: true, message: "Cjenik je objavljen.", publication: mapPublication(publication), current: payload, changedItems: diffPriceLists(current?.payload, payload) }
}

export async function persistPriceList(env: RuntimeEnv, priceList: NormalizedPriceList, provider = priceList.source) {
  const result = await createDraft(env, priceList.tenant.slug, priceList, "marketino-artikli", provider)
  if (!result.draft) throw new Error("Draft nije spremljen.")
  return publishDraft(env, priceList.tenant.slug, result.draft.id, true)
}

export async function bootstrapFromFixture(env: RuntimeEnv, request: Request, slug: string) {
  if (env.DB) {
    const current = await readCurrent(env, slug)
    if (current) return current
    if (slug !== (env.DEMO_WRITE_TENANT || "nepar") && slug !== "patrisa-sisa") return null
    const provisioned = await ensureDemoProvisioned(env, request, slug)
    return provisioned?.payload ?? null
  }
  const assetUrl = new URL("/marketino-artikli", request.url)
  const response = await fetch(assetUrl)
  if (!response.ok) return null
  const parsed = parseMarketinoCsv(await response.text(), { id: slug, slug, name: slug === "patrisa-sisa" ? "Patriša Šiša" : "NEPAR" })
  return { ...parsed.priceList, source: "nepar" as const }
}
