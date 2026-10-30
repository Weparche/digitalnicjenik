import { parseMarketinoCsv } from '../../../src/price-engine/adapters/marketinoCsv';
import { inspectXmlPriceList } from '../../../src/price-engine/xml';
import { validatePriceList } from '../../../src/price-engine/validate';
import { normalizeHeader } from '../../../src/price-engine/normalize';
import { isServiceItem } from '../../../src/price-engine/profile';
import type { FieldSources, NormalizedPriceItem } from '../../../src/price-engine/types';
import { ruleFor } from '../../../shared/compliance/legal-profile';
import { aggregateDocumentStatus, technicalReport, type DocumentAnalysis, type DocumentFinding, type WebsiteCheckDetails } from '../../../shared/website-check';
import { checkerOpsEventId,recordCheckerRun } from '../../_checker-history';
import { dispatchLifecycle } from '../../../shared/lifecycle';
import type { EmailEnv } from '../../../shared/email';

type Resolver = {
  resolve4: (hostname: string) => Promise<string[]>;
  resolve6: (hostname: string) => Promise<string[]>;
};

type CheckerEnv = EmailEnv & {
  PUBLIC_APP_URL?:string;
  LIFECYCLE_EMAILS_ENABLED?:string;
  DIGITAL_PRICE_LIST_DNS_RESOLVER?: Resolver;
  DB?: import('../../_repository').D1DatabaseLike;
  CHECKER_RATE_LIMIT_SECRET?: string;
  LEAD_RATE_LIMIT_SECRET?: string;
  requestState?: { signal: AbortSignal; dns: Map<string, Promise<string[]>> };
};

export type PriceListKind = 'service' | 'product' | 'mixed' | 'unknown';
type PriceListKindDetection = { priceListKind: PriceListKind; priceListKindEvidence: string };
type CheckerDocumentAnalysis = DocumentAnalysis & PriceListKindDetection & {
  structure: DocumentAnalysis['status'];
  content: DocumentAnalysis['status'];
  evidence: string;
};

type CheckDetails = WebsiteCheckDetails & {
  reachable: boolean;
  https: boolean;
  csvFound: boolean;
  xmlFound: boolean;
  pricePageFound: boolean;
  archiveFound: boolean;
  csvUrl: string | null;
  xmlUrl: string | null;
  pricePageUrl: string | null;
  archiveUrl: string | null;
  csvLinkDiscovered: boolean;
  xmlLinkDiscovered: boolean;
  archiveLinkDiscovered: boolean;
  fetchBlocked: boolean;
  priceListKind: PriceListKind;
  priceListKindEvidence: string;
};

type CheckResult = {
  status: "green" | "yellow" | "red" | "unavailable";
  message: string;
  details: CheckDetails;
};

const MAX_REQUEST_BYTES = 4096;
const MAX_URL_LENGTH = 2048;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 128 * 1024;
const MAX_REDIRECTS = 5;
const MAX_SECONDARY_PAGES = 3;
const MAX_DOCUMENT_CANDIDATES = 5;
const MAX_DISCOVERED_LINKS = 50;
const FETCH_TIMEOUT_MS = 8000;
const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";
const METADATA_HOSTS = new Set([
  "metadata",
  "metadata.google.internal",
  "instance-data",
  "instance-data.ec2.internal",
]);

const emptyDetails = (): CheckDetails => ({
  reachable: false,
  https: false,
  csvFound: false,
  xmlFound: false,
  pricePageFound: false,
  archiveFound: false,
  csvUrl: null,
  xmlUrl: null,
  pricePageUrl: null,
  archiveUrl: null,
  csvLinkDiscovered: false,
  xmlLinkDiscovered: false,
  archiveLinkDiscovered: false,
  fetchBlocked: false,
  priceListKind: 'unknown',
  priceListKindEvidence: 'Nije pronađeno dovoljno podataka za klasifikaciju cjenika.',
});

const result = (status: CheckResult["status"], message: string, details: Partial<CheckDetails> = {}): CheckResult => ({
  status,
  message,
  details: { ...emptyDetails(), ...details },
});

const normalizedHostname = (hostname: string) => hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();

export function isForbiddenIp(address: string): boolean {
  const value = normalizedHostname(address);
  if (!value) return true;
  const ipv4 = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const octets = ipv4.slice(1).map(Number);
    if (octets.some((part) => part > 255)) return true;
    const [a, b] = octets;
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && (b === 0 || b === 168)) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (!value.includes(":")) return false;
  if (value === "::" || value === "::1" || value.startsWith("fc") || value.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(value)) return true;
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return Boolean(mapped && isForbiddenIp(mapped[1]));
}

export function isForbiddenHostname(hostname: string): boolean {
  const host = normalizedHostname(hostname);
  return !host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")
    || host.endsWith(".internal") || METADATA_HOSTS.has(host) || isForbiddenIp(host);
}

export function normalizeDigitalPriceListUrl(value: unknown): URL {
  if (typeof value !== "string" || !value.trim() || value.trim().length > MAX_URL_LENGTH) throw new Error("invalid_url");
  const raw = value.trim();
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try { url = new URL(candidate); } catch { throw new Error("invalid_url"); }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || isForbiddenHostname(url.hostname)) throw new Error("invalid_url");
  return url;
}

function resolverFor(env: CheckerEnv): Resolver | null {
  return env.DIGITAL_PRICE_LIST_DNS_RESOLVER ?? null;
}

async function resolveWithDoh(hostname: string, signal?: AbortSignal): Promise<string[]> {
  const addresses: string[] = [];
  for (const type of ["A", "AAAA"]) {
    const response = await fetch(`${DOH_ENDPOINT}?name=${encodeURIComponent(hostname)}&type=${type}`, {
      headers: { accept: "application/dns-json" },
      cache: "no-store",
      signal,
    });
    if (!response.ok) throw new Error("dns_unavailable");
    const payload = await response.json() as { Status?: number; Answer?: Array<{ type?: number; data?: string }> };
    if (payload.Status === 3) continue;
    if (payload.Status != null && payload.Status !== 0) throw new Error("dns_unavailable");
    for (const answer of payload.Answer ?? []) {
      if ((type === "A" && answer.type === 1) || (type === "AAAA" && answer.type === 28)) {
        if (typeof answer.data === "string") addresses.push(answer.data);
      }
    }
  }
  if (!addresses.length) throw new Error("host_not_found");
  return addresses;
}

export async function resolvePublicHostname(hostname: string, configured?: Resolver | null, signal?: AbortSignal): Promise<string[]> {
  const host = normalizedHostname(hostname);
  if (isForbiddenHostname(host)) throw new Error("blocked_destination");
  if (!configured) {
    const addresses = await resolveWithDoh(host, signal);
    if (addresses.some((address) => isForbiddenIp(address))) throw new Error("blocked_destination");
    return addresses;
  }
  const settled = await Promise.allSettled([configured.resolve4(host), configured.resolve6(host)]);
  const addresses = settled.flatMap((entry) => entry.status === "fulfilled" && Array.isArray(entry.value) ? entry.value : []);
  if (addresses.length) {
    if (addresses.some((address) => isForbiddenIp(address))) throw new Error("blocked_destination");
    return addresses;
  }
  throw new Error(settled.some((entry) => entry.status === "fulfilled") ? "host_not_found" : "dns_unavailable");
}

async function assertPublicUrl(url: URL, env: CheckerEnv): Promise<void> {
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || isForbiddenHostname(url.hostname)) throw new Error("blocked_destination");
  if (env.requestState?.signal.aborted) throw new Error('check_timeout');
  const cached = env.requestState?.dns.get(url.hostname);
  if (cached) { await cached; return; }
  const resolved = resolvePublicHostname(url.hostname, resolverFor(env), env.requestState?.signal);
  env.requestState?.dns.set(url.hostname, resolved);
  await resolved;
}

function isRedirect(response: Response) {
  return [301, 302, 303, 307, 308].includes(response.status);
}

function timeoutSignal() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return { signal: controller.signal, clear: () => clearTimeout(timeout) };
}

export async function safeDigitalPriceListFetch(initialUrl: URL, env: CheckerEnv): Promise<{ response: Response; url: URL }> {
  let current = new URL(initialUrl.href);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    await assertPublicUrl(current, env);
    const timeout = timeoutSignal();
    let response: Response;
    try {
      response = await fetch(current.href, {
        method: "GET",
        redirect: "manual",
        cache: "no-store",
        signal: env.requestState ? AbortSignal.any([timeout.signal, env.requestState.signal]) : timeout.signal,
        headers: { accept: "text/html,application/xml,text/xml,text/csv,*/*;q=0.1" },
      });
    } finally {
      timeout.clear();
    }
    if (!isRedirect(response)) return { response, url: current };
    if (redirects === MAX_REDIRECTS) throw new Error("too_many_redirects");
    const location = response.headers.get("location");
    if (!location) throw new Error("invalid_redirect");
    let next: URL;
    try { next = new URL(location, current); } catch { throw new Error("invalid_redirect"); }
    if (!/^https?:$/.test(next.protocol) || next.username || next.password || isForbiddenHostname(next.hostname)) throw new Error("blocked_destination");
    current = next;
  }
  throw new Error("too_many_redirects");
}

function wwwFallbackUrl(url: URL): URL | null {
  const host = normalizedHostname(url.hostname);
  if (!host || host.startsWith('www.')) return null;
  const fallback = new URL(url.href);
  fallback.hostname = `www.${host}`;
  return fallback;
}

async function fetchHomepage(initialUrl: URL, env: CheckerEnv): Promise<{ response: Response; url: URL }> {
  let primary: { response: Response; url: URL } | null = null;
  let primaryError: unknown = null;
  try {
    primary = await safeDigitalPriceListFetch(initialUrl, env);
    if (primary.response.status < 500) return primary;
  } catch (caught) {
    primaryError = caught;
  }

  const fallbackUrl = wwwFallbackUrl(initialUrl);
  if (fallbackUrl) {
    try {
      const fallback = await safeDigitalPriceListFetch(fallbackUrl, env);
      if (fallback.response.ok) return fallback;
    } catch {
      // Preserve the primary result/error below. The www probe is only a recovery path.
    }
  }

  if (primary) return primary;
  throw primaryError instanceof Error ? primaryError : new Error('homepage_unavailable');
}

async function readBounded(response: Response, maxBytes: number): Promise<{ body: string; truncated: boolean }> {
  if (!response.body) return { body: "", truncated: false };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      const room = maxBytes - total;
      if (room <= 0) {
        truncated = true;
        await reader.cancel();
        break;
      }
      if (part.value.byteLength > room) {
        chunks.push(part.value.slice(0, room));
        total += room;
        truncated = true;
        await reader.cancel();
        break;
      }
      chunks.push(part.value);
      total += part.value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return { body: new TextDecoder().decode(bytes), truncated };
}

async function readLimited(response: Response, maxBytes: number): Promise<string> {
  const read = await readBounded(response, maxBytes);
  if (read.truncated) throw new Error('response_too_large');
  return read.body;
}

function trimCsvToCompleteRecords(value: string): string {
  let quoted = false;
  let lastRecordEnd = -1;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === '"') {
      if (quoted && value[index + 1] === '"') index += 1;
      else quoted = !quoted;
      continue;
    }
    if (!quoted && (character === '\n' || character === '\r')) {
      if (character === '\r' && value[index + 1] === '\n') index += 1;
      lastRecordEnd = index + 1;
    }
  }
  return lastRecordEnd > 0 ? value.slice(0, lastRecordEnd) : value;
}

function decodeHref(value: string) {
  return value.replace(/&(?:amp|#0*38|#x0*26);/gi, "&");
}

type Candidate = { url: URL; kind: "csv" | "xml" | "archive" | "price" };

function extractLinks(html: string, baseUrl: URL): Candidate[] {
  const results: Candidate[] = [];
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorPattern.exec(html)) && results.length < MAX_DISCOVERED_LINKS) {
    const rawHref = match[1].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!rawHref) continue;
    let url: URL;
    try { url = new URL(decodeHref(rawHref), baseUrl); } catch { continue; }
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || isForbiddenHostname(url.hostname)) continue;
    const href = url.href.toLowerCase();
    const text = match[2].replace(/<[^>]+>/g, " ").toLowerCase();
    const format = (url.searchParams.get("format") || url.searchParams.get("type") || "").toLowerCase();
    const csv = /\.csv(?:$|[?#])/.test(href) || format === "csv" || href.includes("csv");
    const xml = /\.xml(?:$|[?#])/.test(href) || format === "xml" || href.includes("xml");
    const archive = /(arhiva|archive)/.test(`${href} ${text}`) && /(cjenik|cijene|price)/.test(`${href} ${text}`);
    // Follow explicit external feed/archive links through the same DNS/redirect
    // protections, but do not turn this into a cross-site general crawl.
    if (url.origin !== baseUrl.origin && !(csv || xml || archive || /(cjenik|cijene|price)/.test(`${href} ${text}`))) continue;
    if (csv || xml || archive || /(cjenik|cijene|price)/.test(`${href} ${text}`)) results.push({ url, kind: csv ? "csv" : xml ? "xml" : archive ? "archive" : "price" });
  }
  const embedded = /<(?:iframe|script)\b([^>]*)>/gi;
  while ((match = embedded.exec(html)) && results.length < MAX_DISCOVERED_LINKS) {
    const attrs = match[1];
    const src = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!src) continue;
    try {
      const url = new URL(decodeHref(src),baseUrl);
      if(url.protocol !== 'https:' || url.username || url.password || isForbiddenHostname(url.hostname)) continue;
      if(url.hostname === 'digitalnicjenik.nepar.hr' && url.pathname === '/embed.js') {
        const slug = attrs.match(/\bdata-cjenik\s*=\s*["']([a-z0-9][a-z0-9-]{0,62})["']/i)?.[1];
        if(slug)results.push({url:new URL('/c/'+encodeURIComponent(slug),url.origin),kind:'price'});
      } else if(/^<iframe/i.test(match[0]) && /(?:\/c\/[a-z0-9-]+|cjenik|cjenici|price)/i.test(url.pathname)) results.push({url,kind:'price'});
    } catch { /* Unsupported embed remains unconfirmed; never execute third-party JS. */ }
  }
  return results;
}

function appendUnique(list: URL[], value: URL, limit: number) {
  if (list.length < limit && !list.some((item) => item.href === value.href)) list.push(value);
}

export function isBotChallenge(response: Response, body = ""): boolean {
  const mitigated = (response.headers.get("cf-mitigated") || "").toLowerCase();
  if (mitigated === "challenge") return true;
  if (response.status !== 401 && response.status !== 403) return false;
  return /just a moment|cf-browser-verification|challenge-platform|cdn-cgi\/challenge|attention required/i.test(body);
}

function isHtml(response: Response, body: string) {
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const start = body.trimStart().slice(0, 120).toLowerCase();
  return contentType.includes("text/html") || /^<!doctype\s+html|^<(?:html|head|body|a|div|h1|nav)[\s>]/i.test(start);
}

function stripTags(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function pageLooksLikePriceList(response: Response, body: string): boolean {
  if (!response.ok || !isHtml(response, body)) return false;
  const text = stripTags(body).toLocaleLowerCase("hr-HR");
  if (text.length < 40) return false;
  if (/(stranica nije pronađena|page not found|\b404\b|nema rezultata)/i.test(text) && text.length < 400) return false;

  let score = 0;
  if (/<(table|tbody)[\s>]/i.test(body) && /(cijena|price|€|eur)/i.test(body) && /(naziv|name|usluga|artikl)/i.test(body)) score += 2;
  if (/itemtype=["'][^"']*(product|offer)/i.test(body) || /"@type"\s*:\s*"(product|offer)"/i.test(body)) score += 2;
  if (/<(h1|h2|h3)[^>]*>[^<]*(cjenik|cijene|price list)/i.test(body)) score += 1;
  if ((body.match(/€|eur/gi) || []).length >= 3) score += 1;
  if ((body.match(/\b\d+[.,]\d{2}\b/g) || []).length >= 3) score += 1;
  if (/\.csv|\.xml|application\/(csv|xml)/i.test(body)) score += 1;
  if (/(cjenik|cijene)/i.test(text) && score === 0) return false;
  return score >= 2;
}

export function pageLooksLikeArchive(response: Response, body: string): boolean {
  if (!pageLooksLikePriceList(response, body)) return false;
  return /(arhiva|archive|povijest|prethodn)/i.test(body);
}

function parseCsvRows(value: string): string[][] {
  const source = value.replace(/^\uFEFF/, "");
  const sample = source.split(/\r?\n/).filter(Boolean).slice(0, 5).join("\n");
  const delimiters = [";", ",", "\t"];
  const delimiter = delimiters.sort((a, b) => (sample.split(b).length - 1) - (sample.split(a).length - 1))[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') { cell += '"'; index += 1; } else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(cell.trim()); cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell.trim()); cell = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else cell += character;
  }
  if (quoted) return [];
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function fallbackXmlIsWellFormed(value: string): boolean {
  if (/<!doctype\b/i.test(value)) return false;
  const tokens = value.replace(/^\uFEFF/, "").match(/<!--[\s\S]*?-->|<\?[^>]*\?>|<!\[CDATA\[[\s\S]*?\]\]>|<[^>]+>|[^<]+/g);
  if (!tokens) return false;
  const stack: string[] = [];
  let rootSeen = false;
  let rootClosed = false;
  for (const token of tokens) {
    if (token.startsWith("<!--") || token.startsWith("<?") || token.startsWith("<![CDATA[")) continue;
    if (!token.startsWith("<")) {
      if (rootClosed && token.trim()) return false;
      continue;
    }
    if (token.startsWith("</")) {
      const name = token.match(/^<\/([A-Za-z_][\w:.-]*)\s*>$/)?.[1];
      if (!name || stack.pop() !== name) return false;
      if (!stack.length) rootClosed = true;
      continue;
    }
    const selfClosing = /\/\s*>$/.test(token);
    const name = token.match(/^<([A-Za-z_][\w:.-]*)(?:\s[^<>]*)?\/?\s*>$/)?.[1];
    if (!name || rootClosed) return false;
    if (!rootSeen) rootSeen = true;
    if (!selfClosing) stack.push(name);
    else if (!stack.length) rootClosed = true;
  }
  return rootSeen && rootClosed && stack.length === 0;
}

export function documentLooksValid(kind: "csv" | "xml", response: Response, body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed || isHtml(response, trimmed)) return false;
  if (kind === "csv") {
    const rows = parseCsvRows(trimmed).filter((row) => row.some((cell) => cell.length > 0));
    if (rows.length < 2 || rows[0].length < 2) return false;
    const width = rows[0].length;
    return rows.slice(1).some((row) => row.length >= 2 && row.slice(0, width).some((cell) => cell.length > 0));
  }
  if (typeof DOMParser !== "undefined") {
    const document = new DOMParser().parseFromString(trimmed, "application/xml");
    return Boolean(document?.documentElement) && document.getElementsByTagName("parsererror").length === 0;
  }
  return fallbackXmlIsWellFormed(trimmed);
}

async function findDocument(
  kind: "csv" | "xml",
  candidates: URL[],
  env: CheckerEnv,
  network: { failed: boolean; blocked: boolean; checked: boolean },
  analyses: Array<ReturnType<typeof analyzeDocument>>,
) {
  const remember = (analysis: ReturnType<typeof analyzeDocument>) => {
    const index = analyses.findIndex(a => a.format === kind);
    if (index < 0) analyses.push(analysis);
    else analyses[index] = analysis;
  };
  for (const candidate of candidates) {
    try {
      const fetched = await safeDigitalPriceListFetch(candidate, env);
      if (fetched.response.status >= 500) {
        network.failed = true;
        continue;
      }
      let body = "";
      let sampled = false;
      try {
        if (kind === 'csv') {
          const bounded = await readBounded(fetched.response, MAX_DOCUMENT_BYTES);
          sampled = bounded.truncated;
          body = sampled ? trimCsvToCompleteRecords(bounded.body) : bounded.body;
        } else {
          body = await readLimited(fetched.response, MAX_DOCUMENT_BYTES);
        }
      } catch {
        network.failed = true;
        if (fetched.response.ok) remember({ ...analyzeDocument(kind, '', fetched.url.href), structureReasons: ['Dohvat ili sigurnosno ograničenje onemogućuje potpunu analizu dokumenta.'] });
        continue;
      }
      if (isBotChallenge(fetched.response, body) || [401, 403, 429].includes(fetched.response.status)) {
        network.blocked = true;
        continue;
      }
      network.checked = true;
      if (!fetched.response.ok) continue;
      if (documentLooksValid(kind, fetched.response, body)) {
        const analysis = analyzeDocument(kind, body, fetched.url.href);
        if (sampled) {
          const contentStatus = analysis.contentStatus === 'pass' ? 'unknown' : analysis.contentStatus;
          remember({
            ...analysis,
            status: contentStatus,
            contentStatus,
            structureReasons: analysis.structureRecognized
              ? [`CSV je veći od ${Math.floor(MAX_DOCUMENT_BYTES / 1024)} KB; struktura je potvrđena na uzorku od ${analysis.itemCount} stavki. Potpuni sadržaj nije analiziran u URL checkeru.`]
              : analysis.structureReasons,
          });
        } else {
          remember(analysis);
        }
        return fetched.url.href;
      }
    } catch {
      network.failed = true;
    }
  }
  return null;
}

const CANONICAL_SERVICE_FIELDS = [
  ['name', 'naziv_usluge', 'naziv usluge'],
  ['price', 'maloprodajna_cijena', 'maloprodajna cijena'],
  ['specialSaleApplied', 'posebni_oblik_prodaje', 'posebni oblik prodaje'],
  ['specialSaleName', 'naziv_posebnog_oblika_prodaje', 'naziv posebnog oblika prodaje'],
  ['anchorPrice', 'sidrena_cijena', 'sidrena cijena'],
] as const

const comparableName = (value: string) => normalizeHeader(value.replace(/([a-z])([A-Z])/g, '$1 $2'))

/** Any recognized naming is valid; this only points to the NEPAR preporučena shema (HOK-template based). */
function schemaRecommendation(fieldSources: FieldSources | undefined, items: NormalizedPriceItem[]): DocumentFinding | null {
  if (!fieldSources || !items.length || !items.every(isServiceItem)) return null
  const recognized = CANONICAL_SERVICE_FIELDS.filter(([field]) => fieldSources[field])
  const differing = recognized.filter(([field, canonical]) => comparableName(fieldSources[field]!) !== comparableName(canonical))
  if (!differing.length) return null
  const definition = ruleFor('schema.alias')
  return {
    rule: 'schema.alias', level: definition.level, source: definition.source,
    message: `Struktura je valjana: ${recognized.map(([field, , label]) => `${label} prepoznat je iz polja „${fieldSources[field]}”`).join(', ')}. Za bolju interoperabilnost možete koristiti NEPAR preporučenu shemu, usklađenu s podacima iz Odluke i HOK predloškom (${differing.map(([, canonical]) => canonical).join(', ')}). To nije zakonska obveza.`,
  }
}

function parseWarningRule(field: string | undefined) {
  return field === 'name' ? 'item.name.missing' : field === 'price' ? 'item.price.invalid' : 'item.row.unreadable'
}

function withLevel(finding: DocumentFinding, rule: string): DocumentFinding {
  const definition = ruleFor(rule)
  return { ...finding, rule, level: definition.level, source: definition.source }
}

const explicitProductPattern = /proiz|product|roba|artikl/i;

function classifyPriceList(items: NormalizedPriceItem[]): PriceListKindDetection {
  if (!items.length) return { priceListKind: 'unknown', priceListKindEvidence: 'Cjenik nema dovoljno prepoznatih stavki za klasifikaciju.' };
  let services = 0;
  let products = 0;
  let unknown = 0;
  for (const item of items) {
    if (isServiceItem(item)) {
      services += 1;
      continue;
    }
    const explicitProduct = explicitProductPattern.test(item.type ?? '');
    const strongProductCue = Boolean(item.brand?.trim() || item.barcode?.trim() || item.availability);
    if (explicitProduct || strongProductCue) products += 1;
    else unknown += 1;
  }
  if (services && products) {
    return { priceListKind: 'mixed', priceListKindEvidence: `Prepoznate su i usluge (${services}) i proizvodi (${products}); ${unknown} stavki ostalo je neodređeno.` };
  }
  if (services && !products && !unknown) {
    return { priceListKind: 'service', priceListKindEvidence: `Sve prepoznate stavke (${services}) imaju jasan signal usluge.` };
  }
  if (products && !services) {
    return { priceListKind: 'product', priceListKindEvidence: `Pronađen je jasan signal proizvoda na ${products} stavki (vrsta proizvoda, marka, barkod ili dostupnost)${unknown ? `; ${unknown} stavki nema zaseban signal vrste` : ''}.` };
  }
  return { priceListKind: 'unknown', priceListKindEvidence: services ? `Prepoznato je ${services} usluga, ali ${unknown} stavki nema dovoljno jasan signal vrste.` : 'Nema dovoljno pouzdanih signala za razlikovanje proizvoda od usluga.' };
}

function aggregatePriceListKind(analyses: CheckerDocumentAnalysis[]): PriceListKindDetection {
  const classified = analyses.filter((analysis) => analysis.structureRecognized);
  const knownKinds = new Set(classified.map((analysis) => analysis.priceListKind).filter((kind) => kind !== 'unknown'));
  const priceListKind: PriceListKind = knownKinds.has('mixed') || (knownKinds.has('service') && knownKinds.has('product'))
    ? 'mixed'
    : knownKinds.has('service')
      ? 'service'
      : knownKinds.has('product')
        ? 'product'
        : 'unknown';
  const evidence = classified.map((analysis) => {
    const sampled = analysis.structureReasons.some((reason) => /uzorku/i.test(reason));
    return `${analysis.format.toUpperCase()}: ${analysis.priceListKindEvidence}${sampled ? ' Klasifikacija se temelji na analiziranom uzorku.' : ''}`;
  }).join(' ');
  return { priceListKind, priceListKindEvidence: evidence || 'Nije pronađeno dovoljno podataka za klasifikaciju cjenika.' };
}

/** The upload parsers inspect every bounded source row before the response is truncated. */
export function analyzeDocument(kind: 'csv' | 'xml', body: string, url: string | null = null): CheckerDocumentAnalysis {
  const base: DocumentAnalysis & PriceListKindDetection = { format: kind, url, fetched: true, structureRecognized: false, itemCount: 0, status: 'unknown', structureStatus: 'unknown', contentStatus: 'unknown', structureReasons: [], findings: [], totalFindings: 0, recommendations: [], priceListKind: 'unknown', priceListKindEvidence: 'Dokument nije dovoljno analiziran za klasifikaciju.' };
  const finish = (analysis: DocumentAnalysis & PriceListKindDetection): CheckerDocumentAnalysis => ({ ...analysis, structure: analysis.structureStatus, content: analysis.contentStatus, evidence: analysis.structureReasons.join(' ') });
  try {
    if (new TextEncoder().encode(body).byteLength > MAX_DOCUMENT_BYTES) throw new Error('analysis_limit');
    const parsed = kind === 'csv' ? parseMarketinoCsv(body, undefined, { inspection: true }) : inspectXmlPriceList(body);
    const rawCount = parsed.rowCount ?? parsed.priceList.items.length;
    const findings: DocumentFinding[] = parsed.warnings.map(w => withLevel({ row: w.row, itemName: w.itemName, field: w.field, message: w.message }, parseWarningRule(w.field)));
    if (parsed.priceList.items.length) {
      for (const issue of validatePriceList(parsed.priceList).issues) {
        const index = issue.row - 2;
        findings.push(withLevel({ row: parsed.sourceRows?.[index] ?? issue.row, itemName: parsed.priceList.items[index]?.name, field: issue.field, message: issue.message }, issue.rule ?? 'unknown'));
      }
    }
    if (!rawCount) findings.push(withLevel({ message: 'Cjenik ne sadrži stavke.' }, 'list.empty'));
    const errors = findings.filter(f => f.level === 'error');
    const warnings = findings.filter(f => f.level === 'warning');
    const legal = [...errors, ...warnings];
    const recommendations = [...findings.filter(f => f.level === 'info'), schemaRecommendation(parsed.fieldSources, parsed.priceList.items)].filter((f): f is DocumentFinding => Boolean(f));
    const structure = rawCount ? 'pass' : 'warning';
    const content = errors.length ? 'fail' : warnings.length ? 'warning' : 'pass';
    const classification = classifyPriceList(parsed.priceList.items);
    return finish({ ...base, ...classification, structureRecognized: true, itemCount: rawCount, structureStatus: structure, contentStatus: content, status: content,
      structureReasons: [kind.toUpperCase() + ' je parsiran; prepoznata su polja cjenika. Pronađeno stavki: ' + rawCount + '.'],
      findings: legal.slice(0, 20), totalFindings: legal.length, recommendations });
  } catch (caught) {
    const limited = caught instanceof Error && caught.message === 'analysis_limit';
    return finish({ ...base, structureReasons: [limited ? 'Sigurnosno ograničenje onemogućuje potpunu analizu. Učitajte datoteku u validator.' : 'Datoteka je dostupna, ali u njoj nisu prepoznati podaci cjenika (naziv, maloprodajna cijena) ili dokument nije ispravan za detaljnu analizu. Učitajte je u validator.'] });
  }
}

export type PublicationName = { storage: number; stamp: string; time: number | null }

/**
 * The Odluka requires the file name to carry the object type, address, object code, storage number and a
 * date/time stamp but not their exact layout, so compact (20260916T140627+0200), ISO split
 * (2026-09-15_22-45-00) and Croatian split (27.10.2026_05:00) stamps are accepted after at least three object segments.
 */
export function parsePublicationName(value: string): PublicationName | null {
  let path: string;
  try { path = decodeURIComponent(new URL(value).pathname); } catch { return null; }
  const parts = (path.split('/').pop() ?? '').replace(/\.(csv|xml)$/i, '').split('_');
  const compact = /^(\d{4})-?(\d{2})-?(\d{2})[T-](\d{2})[-:]?(\d{2})(?:[-:]?(\d{2}))?(Z|[+-]\d{2}:?\d{2})?$/i.exec(parts.at(-1) ?? '');
  const splitIsoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(parts.at(-2) ?? '');
  const splitCroDate = /^(\d{2})\.(\d{2})\.(\d{4})\.?$/.exec(parts.at(-2) ?? '');
  const splitTime = /^(\d{2})[-:](\d{2})(?:[-:](\d{2}))?$/.exec(parts.at(-1) ?? '');
  const splitDate = splitIsoDate ?? splitCroDate;
  const stampParts = compact ? 1 : splitDate && splitTime ? 2 : 0;
  if (!stampParts) return null;
  const storage = parts.at(-1 - stampParts) ?? '';
  const objectParts = parts.slice(0, -1 - stampParts);
  if (!/^\d{1,6}$/.test(storage) || objectParts.length < 3 || objectParts.some((part) => !part.trim())) return null;
  const dateParts = splitIsoDate ? splitIsoDate.slice(1) : splitCroDate ? [splitCroDate[3], splitCroDate[2], splitCroDate[1]] : [];
  const [year, month, day, hour, minute, second = '00', zone = ''] = compact ? compact.slice(1) : [...dateParts, ...splitTime!.slice(1)];
  const offset = !zone ? 'Z' : zone.toUpperCase() === 'Z' ? 'Z' : zone.replace(/^([+-]\d{2}):?(\d{2})$/, '$1:$2');
  const time = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`);
  return { storage: Number(storage), stamp: parts.slice(-stampParts).join('_'), time: Number.isFinite(time) ? time : null };
}

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_PUBLICATION_LINKS = 40;
const MAX_ARCHIVE_PROBES = 3;

function publicationFinding(rule: string, message: string): DocumentFinding {
  const definition = ruleFor(rule);
  return { rule, message, level: definition.level, source: definition.source };
}

/**
 * Archive evidence is any earlier versioned publication that is still served; the Odluka requires 30-day
 * availability, not an archive page or a particular URL. File names are checked for the prescribed parts.
 */
async function checkPublications(details: CheckDetails, links: URL[], env: CheckerEnv, network: { failed: boolean; blocked: boolean; checked: boolean }) {
  const seen = new Set<string>();
  const versioned = [details.csvUrl, details.xmlUrl, ...links.map((link) => link.href)]
    .filter((href): href is string => Boolean(href) && !seen.has(href!) && Boolean(seen.add(href!)))
    .map((href) => ({ href, name: parsePublicationName(href) }))
    .filter((entry): entry is { href: string; name: PublicationName } => entry.name != null);
  const findings: DocumentFinding[] = [];
  if (details.csvFound || details.xmlFound) {
    if (!versioned.length) findings.push(publicationFinding('publication.filename.unverified', 'Pronađena je adresa cjenika, ali nije pronađena verzionirana objava čiji naziv datoteke sadrži propisane podatke: vrstu i adresu objekta, oznaku objekta, broj pohrane i vremensku oznaku. Stabilna adresa (npr. /cjenik.csv) je korisna, ali objavljena datoteka mora imati propisani naziv.'));
    if (details.csvFound !== details.xmlFound) findings.push(publicationFinding('publication.single-format', `Pronađen je samo ${details.csvFound ? 'CSV' : 'XML'}. Odluka traži CSV ili XML, pa drugi format nije obvezan; objava oba formata je NEPAR preporuka.`));
    findings.push(publicationFinding('publication.chain.uniform', 'Ako trgovac ima više prodajnih objekata, struktura cjenika mora biti jedinstvena unutar lanca. Provjera jedne web stranice to ne može potvrditi.'));
  }
  details.publicationFindings = findings;
  if (!versioned.length) return;
  const key = (name: PublicationName) => `${name.storage}|${name.stamp}`;
  const newestFirst = [...versioned].sort((a, b) => b.name.storage - a.name.storage || (b.name.time ?? 0) - (a.name.time ?? 0));
  const current = parsePublicationName(details.csvUrl ?? '') ?? parsePublicationName(details.xmlUrl ?? '') ?? newestFirst[0].name;
  const previous = newestFirst.filter((entry) => key(entry.name) !== key(current) && entry.name.storage <= current.storage).slice(0, MAX_ARCHIVE_PROBES);
  for (const entry of previous) {
    try {
      const fetched = await safeDigitalPriceListFetch(new URL(entry.href), env);
      const { body } = await readBounded(fetched.response, MAX_DOCUMENT_BYTES);
      if (isBotChallenge(fetched.response, body) || [401, 403, 429].includes(fetched.response.status)) { network.blocked = true; continue; }
      if (fetched.response.ok && !isHtml(fetched.response, body)) {
        details.archiveFound = true;
        details.archiveUrl = fetched.url.href;
        details.archiveEvidence = `Prethodna objava (broj pohrane ${entry.name.storage}) i dalje je javno dostupna.`;
        return;
      }
      if ([404, 410].includes(fetched.response.status) && entry.name.time != null) {
        const supersededAt = versioned.map((other) => other.name.time).filter((time): time is number => time != null && time > entry.name.time!).sort((a, b) => a - b)[0];
        if (supersededAt != null && Date.now() - supersededAt < RETENTION_MS) {
          details.archiveRemoved = true;
          details.archiveUrl = fetched.url.href;
        }
      }
    } catch { network.failed = true; }
  }
}

function parseBody(request: Request): Promise<{ url?: unknown;attribution?:unknown;source?:unknown } | null> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) return Promise.resolve(null);
  return request.text().then((value) => {
    if (new TextEncoder().encode(value).byteLength > MAX_REQUEST_BYTES) return null;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as { url?: unknown;attribution?:unknown;source?:unknown } : null;
    } catch { return null; }
  }).catch(() => null);
}

export async function runDigitalPriceListCheck(input: unknown, env: CheckerEnv = {}): Promise<CheckResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try { return await checkWebsite(input, { ...env, requestState: { signal: controller.signal, dns: new Map() } }); }
  finally { clearTimeout(timeout); controller.abort(); }
}

async function checkWebsite(input: unknown, env: CheckerEnv): Promise<CheckResult> {
  let initialUrl: URL;
  try { initialUrl = normalizeDigitalPriceListUrl(input); } catch { return result("red", "Unesite ispravnu adresu web stranice."); }
  const network = { failed: false, blocked: false, checked: false };
  const analyses: CheckerDocumentAnalysis[] = [];
  let homepage: { response: Response; url: URL };
  try {
    homepage = await fetchHomepage(initialUrl, env);
  } catch (caught) {
    if (caught instanceof Error && caught.message === "host_not_found") {
      return result("red", "Web stranica nije pronađena. Provjerite adresu.");
    }
    return result("unavailable", "Provjeru trenutačno nije moguće dovršiti. Pokušajte ponovno.");
  }
  let html = "";
  try { html = await readLimited(homepage.response, MAX_HTML_BYTES); } catch {
    if (homepage.response.ok) return result("unavailable", "Provjeru trenutačno nije moguće dovršiti. Pokušajte ponovno.");
  }
  const homepageChallenge = isBotChallenge(homepage.response, html) || [401, 403, 429].includes(homepage.response.status);
  if (homepageChallenge) network.blocked = true;
  if (homepage.response.status >= 500) network.failed = true;
  const homepageReadable = homepage.response.ok && !homepageChallenge;
  if (homepageReadable || homepage.response.status === 404) network.checked = true;
  const details: CheckDetails = {
    ...emptyDetails(),
    reachable: true,
    https: homepage.url.protocol === "https:",
    fetchBlocked: homepageChallenge,
    homepageReadable,
  };
  if (homepageReadable && pageLooksLikePriceList(homepage.response, html)) {
    details.pricePageFound = true;
    details.pricePageUrl = homepage.url.href;
  }
  const links = homepageReadable ? extractLinks(html, homepage.url) : [];
  const directFormat = homepageReadable && !isHtml(homepage.response,html)
    ? documentLooksValid('csv',homepage.response,html) ? 'csv' : documentLooksValid('xml',homepage.response,html) ? 'xml' : null
    : null;
  if(directFormat) analyses.push(analyzeDocument(directFormat,html,homepage.url.href));
  const secondary: URL[] = [];
  const csv: URL[] = [];
  const xml: URL[] = [];
  const archive: URL[] = [];
  const documentLinks: URL[] = [];
  for (const candidate of links) {
    if (candidate.kind === 'price' || candidate.kind === 'csv' || candidate.kind === 'xml') details.publicLinkUrl ||= candidate.url.href;
    if (candidate.kind === "price") appendUnique(secondary, candidate.url, MAX_SECONDARY_PAGES);
    if (candidate.kind === "csv") { details.csvLinkDiscovered = true; appendUnique(csv, candidate.url, MAX_DOCUMENT_CANDIDATES); }
    if (candidate.kind === "xml") { details.xmlLinkDiscovered = true; appendUnique(xml, candidate.url, MAX_DOCUMENT_CANDIDATES); }
    if (candidate.kind === "csv" || candidate.kind === "xml") appendUnique(documentLinks, candidate.url, MAX_PUBLICATION_LINKS);
    if (candidate.kind === "archive") { details.archiveLinkDiscovered = true; appendUnique(archive, candidate.url, MAX_SECONDARY_PAGES); }
  }
  appendUnique(secondary, new URL("/cjenik/", homepage.url.origin), MAX_SECONDARY_PAGES);
  appendUnique(secondary, new URL("/cjenici/", homepage.url.origin), MAX_SECONDARY_PAGES);
  appendUnique(csv, new URL("/cjenik.csv", homepage.url.origin), MAX_DOCUMENT_CANDIDATES);
  appendUnique(xml, new URL("/cjenik.xml", homepage.url.origin), MAX_DOCUMENT_CANDIDATES);

  for (const page of secondary) {
    try {
      const fetched = await safeDigitalPriceListFetch(page, env);
      if (fetched.response.status >= 500) { network.failed = true; continue; }
      const secondaryHtml = await readLimited(fetched.response, MAX_HTML_BYTES);
      if (isBotChallenge(fetched.response, secondaryHtml) || [401, 403, 429].includes(fetched.response.status)) { network.blocked = true; continue; }
      if (!fetched.response.ok) { network.checked = true; continue; }
      network.checked = true;
      if (pageLooksLikePriceList(fetched.response, secondaryHtml)) {
        details.pricePageFound = true;
        details.pricePageUrl ||= fetched.url.href;
      }
      for (const candidate of extractLinks(secondaryHtml, fetched.url)) {
        if (candidate.kind === 'csv' || candidate.kind === 'xml') details.publicLinkUrl ||= candidate.url.href;
        if (candidate.kind === "csv") { details.csvLinkDiscovered = true; appendUnique(csv, candidate.url, MAX_DOCUMENT_CANDIDATES); }
        if (candidate.kind === "xml") { details.xmlLinkDiscovered = true; appendUnique(xml, candidate.url, MAX_DOCUMENT_CANDIDATES); }
        if (candidate.kind === "csv" || candidate.kind === "xml") appendUnique(documentLinks, candidate.url, MAX_PUBLICATION_LINKS);
        if (candidate.kind === "archive") { details.archiveLinkDiscovered = true; appendUnique(archive, candidate.url, MAX_SECONDARY_PAGES); }
      }
    } catch { network.failed = true; }
  }
  [details.csvUrl, details.xmlUrl] = await Promise.all([
    directFormat === 'csv' ? Promise.resolve(homepage.url.href) : findDocument("csv", csv, env, network, analyses),
    directFormat === 'xml' ? Promise.resolve(homepage.url.href) : findDocument("xml", xml, env, network, analyses),
  ]);
  details.csvFound = Boolean(details.csvUrl);
  details.xmlFound = Boolean(details.xmlUrl);
  details.fetchBlocked = network.blocked;
  let archivePageUrl: string | null = null;
  for (const candidate of archive) {
    try {
      const fetched = await safeDigitalPriceListFetch(candidate, env);
      if (fetched.response.status >= 500) { network.failed = true; continue; }
      const archiveHtml = await readLimited(fetched.response, MAX_HTML_BYTES);
      if (isBotChallenge(fetched.response, archiveHtml) || [401, 403, 429].includes(fetched.response.status)) { network.blocked = true; details.fetchBlocked = true; continue; }
      if (!fetched.response.ok) { network.checked = true; continue; }
      network.checked = true;
      for (const link of extractLinks(archiveHtml, fetched.url)) if (link.kind === 'csv' || link.kind === 'xml') appendUnique(documentLinks, link.url, MAX_PUBLICATION_LINKS);
      if (!archivePageUrl && pageLooksLikeArchive(fetched.response, archiveHtml)) archivePageUrl = fetched.url.href;
    } catch { network.failed = true; }
  }
  await checkPublications(details, documentLinks, env, network);
  if (!details.archiveFound && !details.archiveRemoved && archivePageUrl) {
    details.archiveFound = true;
    details.archiveUrl = archivePageUrl;
    details.archiveEvidence = 'Pronađena je javna stranica s prethodnim objavama cjenika.';
  }
  details.networkIncomplete = network.failed;
  details.csvAnalysis = analyses.find(a => a.format === 'csv') ?? { format: 'csv', url: csv[0]?.href ?? null, fetched: false, structureRecognized: false, itemCount: 0, status: 'unknown', structureStatus: 'unknown', contentStatus: 'unknown', structureReasons: ['CSV nije potvrđen u ovoj provjeri.'], findings: [], totalFindings: 0 };
  details.xmlAnalysis = analyses.find(a => a.format === 'xml') ?? { format: 'xml', url: xml[0]?.href ?? null, fetched: false, structureRecognized: false, itemCount: 0, status: 'unknown', structureStatus: 'unknown', contentStatus: 'unknown', structureReasons: ['XML nije potvrđen u ovoj provjeri.'], findings: [], totalFindings: 0 };
  const classification = aggregatePriceListKind(analyses);
  details.priceListKind = classification.priceListKind;
  details.priceListKindEvidence = classification.priceListKindEvidence;
  details.structureStatus = aggregateDocumentStatus(analyses.map(a => a.structureStatus));
  details.contentStatus = aggregateDocumentStatus(analyses.map(a => a.contentStatus));
  details.structureReasons = analyses.map(a => a.format.toUpperCase() + ': ' + a.structureReasons.join(' '));
  details.contentReasons = analyses.map(a => {
    const sampled = a.structureReasons.some(reason => /uzorku/i.test(reason));
    const baseReason = a.structureRecognized ? a.totalFindings + ' nalaza u ' + a.itemCount + ' analiziranih stavki' + (a.findings.some(f => f.level === 'error') ? ', uključujući nedostajuće ili neispravne obvezne podatke.' : '.') : 'Sadržaj nije moguće potvrditi.';
    return a.format.toUpperCase() + ': ' + baseReason + (sampled ? ' Velika datoteka provjerena je na ograničenom uzorku; potpuni sadržaj ostaje za validator.' : '');
  });
  details.contentEvidence = details.contentReasons.join(' ') + ' Ne potvrđuje stvarnu primjenjivost cijena ni pravnu usklađenost.';
  if (details.contentStatus === 'fail' || details.contentStatus === 'warning' || details.structureStatus === 'warning') return result('yellow', 'Pronađen je strojni cjenik s konkretnim nalazima. Pregledajte odvojene CSV/XML rezultate.', details);
  if (details.csvFound || details.xmlFound) return result("green", "Pronađen je javno dostupan strojni cjenik. CSV/XML datoteka je tehnički dostupna za automatizirani dohvat — to još nije potvrda usklađenosti s Odlukom.", details);
  if (details.pricePageFound) return result("yellow", "Pronađena je stranica ili cjenik, ali nije potvrđen valjan javni CSV/XML dokument.", details);
  if (network.blocked && !network.checked) {
    return result("yellow", "Web je zaštićen od automatskog dohvata, pa javni CSV/XML nismo mogli potvrditi.", details);
  }
  if (network.failed && !network.checked) return result("unavailable", "Provjeru trenutačno nije moguće dovršiti. Pokušajte ponovno.", details);
  if (details.fetchBlocked) return result("red", "Naslovnica je zaštićena od automatskog dohvata. Javni CSV/XML na uobičajenim adresama nije pronađen.", details);
  return result("red", "Strojni cjenik nije pronađen.", details);
}

// nepar.hr/admin lists which websites people check. workers.dev, not nepar.hr: a Pages Function
// fetching its own zone would skip the Worker route.
const NEPAR_CHECK_LOG_URL = "https://nepar-contact.ig29007.workers.dev/analytics/check";

function reportCheckToNepar(url: unknown, status: CheckResult["status"]) {
  return fetch(NEPAR_CHECK_LOG_URL, {
    method: "POST",
    headers: { "content-type": "text/plain;charset=UTF-8" },
    body: JSON.stringify({ url, status }),
  }).then(() => undefined, () => undefined);
}

export const onRequestPost = async ({ request, env, waitUntil }: { request: Request; env: CheckerEnv; waitUntil?: (promise: Promise<unknown>) => void }) => {
  try {
    await consumeCheckerBudget(request, env);
  } catch (caught) {
    if (caught instanceof Error && caught.message === "rate_limited") {
      return Response.json({ ...result("unavailable", "Previše provjera. Pokušajte kasnije."), code: "rate_limited" }, { status: 429 });
    }
    if (caught instanceof Error && caught.message === "rate_limit_misconfigured") {
      return Response.json(result("unavailable", "Provjeru trenutačno nije moguće dovršiti. Pokušajte ponovno."), { status: 503 });
    }
  }
  const body = await parseBody(request);
  if (!body || body.url === undefined) return Response.json(result("red", "Unesite ispravnu adresu web stranice."), { status: 400 });
  const checked = await runDigitalPriceListCheck(body.url, env);
  let checkerRunId:string|null=null;
  const checkedAt=new Date();
  try {const normalized=normalizeDigitalPriceListUrl(body.url).href;checkerRunId=await recordCheckerRun(env.DB,normalized,checked,body.attribution,body.source,checkedAt);if(checkerRunId&&env.DB&&technicalReport(checked).score<9)waitUntil?.(dispatchLifecycle({...env,DB:env.DB},checkedAt,checkerOpsEventId(normalized,checkedAt)))}catch{/* Invalid addresses are not checker runs. */}
  waitUntil?.(reportCheckToNepar(body.url, checked.status));
  return Response.json({ ...checked,checkerRunId, report: technicalReport(checked) }, { headers: { 'cache-control': 'no-store' } });
};

const CHECKER_LIMIT_PER_HOUR = 30;
const HOUR_MS = 3_600_000;

async function consumeCheckerBudget(request: Request, env: CheckerEnv) {
  if (!env.DB) return;
  const secret = env.CHECKER_RATE_LIMIT_SECRET || env.LEAD_RATE_LIMIT_SECRET;
  if (!secret) throw new Error("rate_limit_misconfigured");
  const { hmacIp } = await import("../../_lead");
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
  const ipHash = await hmacIp(ip, secret);
  const windowStart = new Date(Math.floor(Date.now() / HOUR_MS) * HOUR_MS).toISOString();
  const existing = await env.DB.prepare("SELECT attempt_count FROM checker_rate_buckets WHERE ip_hash = ? AND window_start = ?").bind(ipHash, windowStart).first<{ attempt_count: number }>();
  if ((existing?.attempt_count ?? 0) >= CHECKER_LIMIT_PER_HOUR) throw new Error("rate_limited");
  await env.DB.prepare(
    `INSERT INTO checker_rate_buckets (ip_hash, window_start, attempt_count, updated_at)
     VALUES (?, ?, 1, ?)
     ON CONFLICT(ip_hash, window_start) DO UPDATE SET
       attempt_count = attempt_count + 1,
       updated_at = excluded.updated_at
     WHERE attempt_count < ?`,
  ).bind(ipHash, windowStart, new Date().toISOString(), CHECKER_LIMIT_PER_HOUR).run();
}
