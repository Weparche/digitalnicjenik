/** Evidence model shared by the anonymous checker and the acquisition UI. */
export type DocumentAnalysisStatus = 'pass' | 'warning' | 'unknown'
export type DocumentFinding = { row?: number; itemName?: string; field?: string; message: string }
export type DocumentAnalysis = {
  format: 'csv' | 'xml'
  url: string | null
  fetched: boolean
  structureRecognized: boolean
  itemCount: number
  status: DocumentAnalysisStatus
  structureStatus: DocumentAnalysisStatus
  contentStatus: DocumentAnalysisStatus
  structureReasons: string[]
  findings: DocumentFinding[]
  totalFindings: number
}

export function aggregateDocumentStatus(statuses: DocumentAnalysisStatus[]): DocumentAnalysisStatus {
  return statuses.includes('warning') ? 'warning' : statuses.includes('pass') ? 'pass' : 'unknown'
}

export type WebsiteCheckDetails = {
  reachable?: boolean
  homepageReadable?: boolean
  https?: boolean
  csvFound?: boolean
  xmlFound?: boolean
  pricePageFound?: boolean
  archiveFound?: boolean
  csvUrl?: string | null
  xmlUrl?: string | null
  pricePageUrl?: string | null
  archiveUrl?: string | null
  publicLinkUrl?: string | null
  csvLinkDiscovered?: boolean
  xmlLinkDiscovered?: boolean
  archiveLinkDiscovered?: boolean
  fetchBlocked?: boolean
  networkIncomplete?: boolean
  structureStatus?: 'pass' | 'warning' | 'unknown'
  contentStatus?: 'pass' | 'warning' | 'unknown'
  contentEvidence?: string
  csvAnalysis?: DocumentAnalysis
  xmlAnalysis?: DocumentAnalysis
  structureReasons?: string[]
  contentReasons?: string[]
}
export type WebsiteCheckResult = {
  status: 'green' | 'yellow' | 'red' | 'unavailable'
  message: string
  details?: WebsiteCheckDetails
}
export const TECHNICAL_CHECKS = [
  { id: 'reachable', label: 'Web stranica dostupna', icon: 'globe' },
  { id: 'https', label: 'HTTPS zaštita', icon: 'lock' },
  { id: 'price', label: 'Digitalni cjenik pronađen', icon: 'link' },
  { id: 'csv', label: 'CSV datoteka', icon: 'file' },
  { id: 'xml', label: 'XML datoteka', icon: 'code' },
  { id: 'link', label: 'Javni link na web stranici', icon: 'external' },
  { id: 'structure', label: 'Osnovna struktura podataka', icon: 'database' },
  { id: 'archive', label: 'Arhiva prethodnih objava', icon: 'clock' },
  { id: 'content', label: 'Sadržaj cjenika', icon: 'list' },
] as const
export type TechnicalStatus = 'pass' | 'missing' | 'warning' | 'unknown' | 'not_applicable'
export const STATUS_LABELS: Record<TechnicalStatus, string> = {
  pass: 'Prolazi', missing: 'Nije pronađeno', warning: 'Upozorenje', unknown: 'Nije moguće automatski potvrditi',
  not_applicable: 'Nije potrebno — drugi format je dostupan',
}
export function technicalReport(result: WebsiteCheckResult) {
  const d = result.details ?? {}
  const uncertain = result.status === 'unavailable' || Boolean(d.fetchBlocked || d.networkIncomplete) || d.reachable !== true
  const unknownReason = d.fetchBlocked ? 'Zaštita weba ograničava automatski dohvat.' : d.reachable === false && result.status !== 'unavailable' ? 'Web nije dostupan pa ovu stavku nije moguće potvrditi.' : 'Dohvat nije dovršen. Pokušajte ponovno ili učitajte datoteku.'
  const found = (yes: boolean | undefined, evidence: string): { status: TechnicalStatus; evidence: string } =>
    yes ? { status: 'pass', evidence } : uncertain ? { status: 'unknown', evidence: unknownReason } : { status: 'missing', evidence }
  const states: Array<{ status: TechnicalStatus; evidence: string; url?: string | null }> = [
    d.fetchBlocked && d.homepageReadable !== true ? { status: 'unknown', evidence: unknownReason } : d.reachable === false && result.status === 'red' ? { status: 'missing', evidence: 'Adresa nije pronađena. Provjerite URL web stranice.' } : found(d.homepageReadable ?? d.reachable, 'HTTP odgovor naslovnice.'),
    d.reachable ? { status: d.https ? 'pass' : 'warning', evidence: d.https ? 'Dohvaćena adresa koristi HTTPS.' : 'Dohvaćena adresa ne koristi HTTPS.' } : { status: 'unknown', evidence: unknownReason },
    { ...found(d.pricePageFound || d.csvFound || d.xmlFound, 'Pretražene su javne poveznice i uobičajene adrese cjenika.'), url: d.pricePageUrl || d.csvUrl || d.xmlUrl },
    { ...found(d.csvFound, d.csvFound ? 'Dohvaćen je tablični CSV sadržaj, ne samo naziv datoteke.' : 'Valjan CSV nije pronađen među provjerenim adresama.'), url: d.csvUrl },
    { ...found(d.xmlFound, d.xmlFound ? 'Dohvaćen je sintaktički ispravan XML sadržaj.' : 'Valjan XML nije pronađen među provjerenim adresama.'), url: d.xmlUrl },
    { ...found(Boolean(d.publicLinkUrl), 'Poveznica mora biti pročitana iz javnog HTML-a; pretpostavljena adresa nije dokaz poveznice.'), url: d.publicLinkUrl },
    { status: d.structureStatus ?? 'unknown', evidence: d.structureReasons?.join(' ') || d.contentEvidence || 'Potrebna detaljna provjera prepoznate strukture datoteke.' },
    { ...found(d.archiveFound, 'Provjera pronalazi arhivu; ne potvrđuje trajanje ni potpunost povijesti objava.'), url: d.archiveUrl },
    { status: d.contentStatus ?? 'unknown', evidence: d.contentReasons?.join(' ') || d.contentEvidence || 'Potrebna detaljna provjera. Učitajte cjenik u validator.' },
  ]
  const checks = TECHNICAL_CHECKS.map((check, i) => ({ ...check, ...states[i] }))
  // CSV and XML are legal alternatives; lack of the second is not a fault.
  for (const check of checks) {
    if (check.status === 'missing' && ((check.id === 'csv' && !d.csvFound && d.xmlFound) || (check.id === 'xml' && !d.xmlFound && d.csvFound))) {
      check.status = 'not_applicable'
      check.evidence = 'Zahtjev formata ispunjava CSV ili XML. Drugi format nije obvezan.'
    }
  }
  const score = checks.filter((c) => c.status === 'pass' || c.status === 'not_applicable').length
  const unknown = checks.filter((c) => c.status === 'unknown').length
  const attention = checks.filter((c) => c.status === 'missing' || c.status === 'warning').length
  const tone = attention ? (score <= 2 ? 'red' : 'yellow') : unknown ? 'yellow' : 'green'
  return { checks, score, unknown, attention, tone }
}

export function normalizeWebsiteInput(value: string): string {
  const input = value.trim()
  if (!input || input.length > 2048 || /\s/.test(input)) throw new Error('invalid_url')
  const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(input) ? input : `https://${input}`)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname.includes('.')) throw new Error('invalid_url')
  url.hash = ''
  return url.href
}
