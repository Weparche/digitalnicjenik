export type ComplianceProfile = 'products' | 'services'
/** `info` never affects the overall result; `warn` never pages by itself; `fail` does. */
export type IssueSeverity = 'info' | 'warn' | 'fail'
export type MonitorOverall = 'ok' | 'warn' | 'fail' | 'skipped'
export type MonitorTrigger = 'cron' | 'retry' | 'manual'
export type FreshnessStatus = 'ok' | 'warn' | 'n/a'

export type MonitorIssue = {
  code: string
  severity: IssueSeverity
  message: string
  field?: string
  rows?: number
}

export type MonitorRunRecord = {
  id: string
  tenantId: string
  publicationId: string | null
  checkedAt: string
  trigger: MonitorTrigger
  ruleset: string
  profile: ComplianceProfile
  overall: MonitorOverall
  csvStatus: number | null
  xmlStatus: number | null
  csvRows: number | null
  xmlRows: number | null
  expectedRows: number | null
  prevRows: number | null
  filenamePublicationMatch: boolean | null
  filenameRulesetMatch: boolean | null
  filenameCsv: string | null
  filenameXml: string | null
  freshnessStatus: FreshnessStatus
  archiveExpected: number | null
  archiveAvailable: number | null
  archiveLatestStatus: number | null
  archiveOldestStatus: number | null
  payloadSha256: string | null
  csvSha256: string | null
  xmlSha256: string | null
  issues: MonitorIssue[]
  durationMs: number
  publishedAt: string | null
  publicationSequence: number | null
}

export type AlertKind = 'fail' | 'persistent_fail' | 'recovery'

export type MonitorState = {
  tenantId: string
  lastOverall: MonitorOverall | null
  lastOkAt: string | null
  lastAlertAt: string | null
  lastAlertKind: AlertKind | null
  alertOpen: boolean
  consecutiveFailures: number
  lastManualAt: string | null
}
