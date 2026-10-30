/** Evidence model shared by the anonymous checker and the acquisition UI. */
export type DocumentAnalysisStatus = 'pass' | 'warning' | 'fail' | 'unknown'
/** level/source come from shared/compliance/legal-profile.ts: only binding rules can be an error. */
export type DocumentFinding = { row?: number; itemName?: string; field?: string; message: string; rule?: string; level?: 'error' | 'warning' | 'info'; source?: 'binding' | 'official-clarification' | 'draft' | 'recommendation' }
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
  /** NEPAR recommendations (level info). Never change the status and are never legal requirements. */
  recommendations?: DocumentFinding[]
}

export function aggregateDocumentStatus(statuses: DocumentAnalysisStatus[]): DocumentAnalysisStatus {
  return statuses.includes('fail') ? 'fail' : statuses.includes('warning') ? 'warning' : statuses.includes('pass') ? 'pass' : 'unknown'
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
  structureStatus?: DocumentAnalysisStatus
  contentStatus?: DocumentAnalysisStatus
  /** What proved that an earlier publication is still public (versioned file or archive page). */
  archiveEvidence?: string
  /** A linked earlier publication superseded less than 30 days ago is no longer served. */
  archiveRemoved?: boolean
  /** Publication-level notes (file name metadata, single format, chain structure). */
  publicationFindings?: DocumentFinding[]
  contentEvidence?: string
  csvAnalysis?: DocumentAnalysis
  xmlAnalysis?: DocumentAnalysis
  structureReasons?: string[]
  contentReasons?: string[]
}
export type WebsiteCheckResult = {
  checkerRunId?:string|null
  status: 'green' | 'yellow' | 'red' | 'unavailable'
  message: string
  details?: WebsiteCheckDetails
}
export const TECHNICAL_CHECKS = [
  { id: 'reachable', label: 'Web stranica dostupna', icon: 'globe' },
  { id: 'https', label: 'HTTPS zaštita', icon: 'lock' },
  { id: 'price', label: 'Digitalni cjenik pronađen', icon: 'link' },
  { id: 'machine', label: 'Strojno čitljiv cjenik — CSV ili XML', icon: 'file' },
  { id: 'link', label: 'Javni link na web stranici', icon: 'external' },
  { id: 'structure', label: 'Osnovna struktura podataka', icon: 'database' },
  { id: 'publication', label: 'Naziv objavljene datoteke', icon: 'code' },
  { id: 'archive', label: 'Arhiva prethodnih objava', icon: 'clock' },
  { id: 'content', label: 'Sadržaj cjenika', icon: 'list' },
] as const
export type TechnicalStatus = 'pass' | 'missing' | 'warning' | 'fail' | 'unknown' | 'not_applicable'
export const STATUS_LABELS: Record<TechnicalStatus, string> = {
  pass: 'Prolazi', missing: 'Nije pronađeno', warning: 'Upozorenje', fail: 'Ne prolazi', unknown: 'Nije moguće automatski potvrditi',
  not_applicable: 'Nije potrebno',
}
export function technicalReport(result: WebsiteCheckResult) {
  const d = result.details ?? {}
  const uncertain = result.status === 'unavailable' || Boolean(d.fetchBlocked || d.networkIncomplete) || d.reachable !== true
  const unknownReason = d.fetchBlocked ? 'Zaštita weba ograničava automatski dohvat.' : d.reachable === false && result.status !== 'unavailable' ? 'Web nije dostupan pa ovu stavku nije moguće potvrditi.' : 'Dohvat nije dovršen. Pokušajte ponovno ili učitajte datoteku.'
  const found = (yes: boolean | undefined, evidence: string): { status: TechnicalStatus; evidence: string } =>
    yes ? { status: 'pass', evidence } : uncertain ? { status: 'unknown', evidence: unknownReason } : { status: 'missing', evidence }

  const machineReadable = Boolean(d.csvFound || d.xmlFound)
  const machineState: { status: TechnicalStatus; evidence: string; url?: string | null } = d.csvFound && d.xmlFound
    ? { status: 'pass', evidence: 'CSV pronađen ✓ · XML pronađen ✓. Za zahtjev je dovoljan jedan od ta dva formata.', url: d.csvUrl || d.xmlUrl }
    : d.csvFound
      ? { status: 'pass', evidence: 'CSV pronađen ✓ · XML nije objavljen — nije obvezan ako postoji ispravan CSV.', url: d.csvUrl }
      : d.xmlFound
        ? { status: 'pass', evidence: 'XML pronađen ✓ · CSV nije objavljen — nije obvezan ako postoji ispravan XML.', url: d.xmlUrl }
        : uncertain
          ? { status: 'unknown', evidence: unknownReason }
          : { status: 'missing', evidence: 'Nije pronađen valjan javno dostupan CSV ni XML cjenik.' }

  const filenameFinding = d.publicationFindings?.find((finding) => finding.rule === 'publication.filename.unverified')
  const publicationState: { status: TechnicalStatus; evidence: string } = machineReadable
    ? d.publicationFindings == null
      ? { status: 'unknown', evidence: 'Naziv objavljene datoteke nije moguće potvrditi iz dostupnih podataka.' }
      : filenameFinding
        ? { status: 'warning', evidence: filenameFinding.message }
        : { status: 'pass', evidence: 'Pronađena je verzionirana objava s prepoznatljivim podacima o objektu, brojem pohrane i vremenskom oznakom.' }
    : uncertain
      ? { status: 'unknown', evidence: unknownReason }
      : { status: 'unknown', evidence: 'Naziv objavljene datoteke nije moguće provjeriti dok CSV ili XML cjenik nije pronađen.' }

  const states: Array<{ status: TechnicalStatus; evidence: string; url?: string | null }> = [
    d.fetchBlocked && d.homepageReadable !== true ? { status: 'unknown', evidence: unknownReason } : d.reachable === false && result.status === 'red' ? { status: 'missing', evidence: 'Adresa nije pronađena. Provjerite URL web stranice.' } : found(d.homepageReadable ?? d.reachable, 'HTTP odgovor naslovnice.'),
    d.reachable ? { status: d.https ? 'pass' : 'warning', evidence: d.https ? 'Dohvaćena adresa koristi HTTPS.' : 'Dohvaćena adresa ne koristi HTTPS.' } : { status: 'unknown', evidence: unknownReason },
    { ...found(d.pricePageFound || d.csvFound || d.xmlFound, 'Pretražene su javne poveznice i uobičajene adrese cjenika.'), url: d.pricePageUrl || d.csvUrl || d.xmlUrl },
    machineState,
    { ...found(Boolean(d.publicLinkUrl), 'Poveznica mora biti pročitana iz javnog HTML-a; pretpostavljena adresa nije dokaz poveznice.'), url: d.publicLinkUrl },
    { status: d.structureStatus ?? 'unknown', evidence: d.structureReasons?.join(' ') || d.contentEvidence || 'Potrebna detaljna provjera prepoznate strukture datoteke.' },
    publicationState,
    // Odluka traži dostupnost objava 30 dana, ne određenu stranicu ili adresu arhive.
    d.archiveFound
      ? { status: 'pass', evidence: `${d.archiveEvidence || 'Pronađena je prethodna objava cjenika.'} Ne potvrđuje trajanje ni potpunost povijesti objava.`, url: d.archiveUrl }
      : d.archiveRemoved
        ? { status: 'missing', evidence: 'Povezana prethodna objava više nije dostupna, iako je zamijenjena prije manje od 30 dana.', url: d.archiveUrl }
        : { status: 'unknown', evidence: 'Arhivu prethodnih objava nije moguće potvrditi. Odluka traži da objavljene datoteke ostanu dostupne 30 dana; posebna stranica arhive nije propisana.' },
    { status: d.contentStatus ?? 'unknown', evidence: d.contentReasons?.join(' ') || d.contentEvidence || 'Potrebna detaljna provjera. Učitajte cjenik u validator.' },
  ]
  const checks = TECHNICAL_CHECKS.map((check, i) => ({ ...check, ...states[i] }))
  const score = checks.filter((c) => c.status === 'pass' || c.status === 'not_applicable').length
  const unknown = checks.filter((c) => c.status === 'unknown').length
  const attention = checks.filter((c) => c.status === 'missing' || c.status === 'warning' || c.status === 'fail').length
  const publicationWarnings = (d.publicationFindings ?? []).filter((finding) => finding.level === 'warning' || finding.level === 'error').length
  const tone = attention ? (score <= 2 ? 'red' : 'yellow') : unknown || publicationWarnings ? 'yellow' : 'green'
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
