export type PriceSource = 'nepar' | 'marketino-csv' | 'marketino-api'
export type EntitlementPlan = 'validator' | 'web_link' | 'publisher_self_service' | 'managed'
export type EntitlementStatus = 'trial' | 'active' | 'expired' | 'suspended'
export type DraftStatus = 'uploaded' | 'invalid' | 'manual_review' | 'ready_to_publish' | 'published'
export type ValidationSeverity = 'error' | 'warning' | 'manual_review'
export type ValidationField = 'name' | 'price' | 'type' | 'anchorPrice' | 'specialSaleApplied' | 'specialSaleName' | 'externalId' | 'brand' | 'barcode' | 'availability' | 'unit' | 'unitPrice' | 'import'
export type Availability = 'dostupno' | 'nedostupno'
export type ValidationIssueCode = 'IMPORT_ROW_SKIPPED'
export type ValidationIssueSource = 'csv' | 'xlsx' | 'xml'

export type NormalizedPriceItem = {
  externalId?: string
  category?: string
  name: string
  type?: string
  description?: string
  price: number
  anchorPrice?: number | null
  anchorReferenceDate?: string | null
  lowest30DayPrice?: number | null
  salePrice?: number | null
  unit?: string | null
  /** Cijena za jedinicu mjere (Odluka NN 101/2026-1213, čl. III), gdje je primjenjivo. */
  unitPrice?: number | null
  /** Explicit owner assessment when unit pricing is not applicable. */
  unitPricingExemption?: string | null
  /** Marka proizvoda (obavezno za cjenik proizvoda). */
  brand?: string | null
  /** Barkod robe (EAN/GTIN) kao tekst, da se ne izgube početne nule. */
  barcode?: string | null
  availability?: Availability | null
  specialSaleApplied?: boolean | null
  specialSaleName?: string | null
  isNewSinceReferenceDate?: boolean
}

export type NormalizedPriceList = {
  tenant: { id: string; slug: string; name: string }
  source: PriceSource
  currency: 'EUR'
  updatedAt: string
  items: NormalizedPriceItem[]
}

export type ParseWarning = { row: number; message: string; field?: ValidationField; itemName?: string }
/** Canonical field → source column/element name as it appears in the file (e.g. name → "service_name"). */
export type FieldSources = Partial<Record<'name' | 'price' | 'specialSaleApplied' | 'specialSaleName' | 'anchorPrice' | 'anchorReferenceDate' | 'isNewSinceReferenceDate', string>>
export type ParseResult = { priceList: NormalizedPriceList; warnings: ParseWarning[]; sourceRows?: number[]; rowCount?: number; fieldSources?: FieldSources }

export type ValidationIssue = {
  row: number
  itemKey: string
  field: ValidationField
  severity: ValidationSeverity
  message: string
  code?: ValidationIssueCode
  source?: ValidationIssueSource
  /** Stable rule id; shared/compliance/legal-profile.ts maps it to a level and legal source. */
  rule?: string
}

export type ValidationResult = {
  status: Exclude<DraftStatus, 'uploaded' | 'published'>
  issues: ValidationIssue[]
  blockingCount: number
  warningCount: number
}

export type PublicationMetadata = {
  objectType: string
  objectAddress: string
  objectCode: string
  nextPublicationSequence: number
  timezone: string
  workingDays?: number[]
  closedDates?: string[]
}

export type PricePublication = {
  id: string
  tenantId: string
  priceListId: string
  sequence: number
  filenameStem: string
  publishedAt: string
  supersededAt: string | null
  publicUntil: string | null
  hash: string
  payload: NormalizedPriceList
  isCurrent: boolean
}

export type PriceUpload = {
  id: string
  tenantId: string
  sourceFilename: string
  sourceType: string
  normalizedPayload: NormalizedPriceList
  validationIssues: ValidationIssue[]
  status: DraftStatus
  createdAt: string
  updatedAt: string
}

export type Entitlement = {
  id: string
  tenantId: string
  plan: EntitlementPlan
  status: EntitlementStatus
  periodStart: string | null
  periodEnd: string | null
  paidConfirmedAt?: string | null
  graceUntil?: string | null
}

export interface PriceSourceAdapter {
  id: PriceSource
  name: string
  load(input?: unknown): Promise<NormalizedPriceList>
}

export type PriceSnapshot = {
  id: string
  tenantId: string
  source: PriceSource
  hash: string
  data: NormalizedPriceList
  createdAt: string
  changedItems: PriceChange[]
}

export type PriceChange = {
  name: string
  category?: string
  before?: number
  after?: number
}
