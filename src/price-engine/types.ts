export type PriceSource = 'nepar' | 'marketino-csv' | 'marketino-api'
export type EntitlementPlan = 'validator' | 'publisher_self_service' | 'managed'
export type EntitlementStatus = 'active' | 'inactive' | 'expired'
export type DraftStatus = 'uploaded' | 'invalid' | 'manual_review' | 'ready_to_publish' | 'published'
export type ValidationSeverity = 'error' | 'warning' | 'manual_review'
export type ValidationField = 'name' | 'price' | 'type' | 'anchorPrice' | 'specialSaleApplied' | 'specialSaleName' | 'import'
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
  salePrice?: number | null
  unit?: string | null
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

export type ParseWarning = { row: number; message: string; field?: ValidationField }
export type ParseResult = { priceList: NormalizedPriceList; warnings: ParseWarning[] }

export type ValidationIssue = {
  row: number
  itemKey: string
  field: ValidationField
  severity: ValidationSeverity
  message: string
  code?: ValidationIssueCode
  source?: ValidationIssueSource
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
