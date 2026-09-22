type Resolver = {
  resolve4: (hostname: string) => Promise<string[]>;
  resolve6: (hostname: string) => Promise<string[]>;
};

type CheckerEnv = {
  DIGITAL_PRICE_LIST_DNS_RESOLVER?: Resolver;
  DB?: import('../../_repository').D1DatabaseLike;
  CHECKER_RATE_LIMIT_SECRET?: string;
  LEAD_RATE_LIMIT_SECRET?: string;
};

type CheckDetails = {
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

async function resolveWithDoh(hostname: string): Promise<string[]> {
  const addresses: string[] = [];
  for (const type of ["A", "AAAA"]) {
    const response = await fetch(`${DOH_ENDPOINT}?name=${encodeURIComponent(hostname)}&type=${type}`, {
      headers: { accept: "application/dns-json" },
      cache: "no-store",
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

export async function resolvePublicHostname(hostname: string, configured?: Resolver | null): Promise<string[]> {
  const host = normalizedHostname(hostname);
  if (isForbiddenHostname(host)) throw new Error("blocked_destination");
  if (!configured) {
    const addresses = await resolveWithDoh(host);
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
  await resolvePublicHostname(url.hostname, resolverFor(env));
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
        signal: timeout.signal,
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

async function readLimited(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      const room = maxBytes - total;
      const chunk = part.value.byteLength > room ? part.value.slice(0, room) : part.value;
      chunks.push(chunk);
      total += chunk.byteLength;
      if (part.value.byteLength > room) {
        await reader.cancel();
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
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
    if (url.origin !== baseUrl.origin || !/^https?:$/.test(url.protocol) || url.username || url.password || isForbiddenHostname(url.hostname)) continue;
    const href = url.href.toLowerCase();
    const text = match[2].replace(/<[^>]+>/g, " ").toLowerCase();
    const format = (url.searchParams.get("format") || url.searchParams.get("type") || "").toLowerCase();
    const csv = /\.csv(?:$|[?#])/.test(href) || format === "csv" || href.includes("csv");
    const xml = /\.xml(?:$|[?#])/.test(href) || format === "xml" || href.includes("xml");
    const archive = /(arhiva|archive)/.test(`${href} ${text}`) && /(cjenik|cijene|price)/.test(`${href} ${text}`);
    if (csv || xml || archive || /(cjenik|cijene|price)/.test(`${href} ${text}`)) results.push({ url, kind: csv ? "csv" : xml ? "xml" : archive ? "archive" : "price" });
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
  return contentType.includes("text/html") || /^<!doctype\s+html|^<html[\s>]/i.test(start);
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
) {
  for (const candidate of candidates) {
    try {
      const fetched = await safeDigitalPriceListFetch(candidate, env);
      if (fetched.response.status >= 500) {
        network.failed = true;
        continue;
      }
      let body = "";
      try { body = await readLimited(fetched.response, MAX_DOCUMENT_BYTES); } catch { network.failed = true; continue; }
      if (isBotChallenge(fetched.response, body)) {
        network.blocked = true;
        continue;
      }
      network.checked = true;
      if (!fetched.response.ok) continue;
      if (documentLooksValid(kind, fetched.response, body)) return fetched.url.href;
    } catch {
      network.failed = true;
    }
  }
  return null;
}

function parseBody(request: Request): Promise<{ url?: unknown } | null> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) return Promise.resolve(null);
  return request.text().then((value) => {
    if (new TextEncoder().encode(value).byteLength > MAX_REQUEST_BYTES) return null;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as { url?: unknown } : null;
    } catch { return null; }
  }).catch(() => null);
}

export async function runDigitalPriceListCheck(input: unknown, env: CheckerEnv = {}): Promise<CheckResult> {
  let initialUrl: URL;
  try { initialUrl = normalizeDigitalPriceListUrl(input); } catch { return result("red", "Unesite ispravnu adresu web stranice."); }
  const network = { failed: false, blocked: false, checked: false };
  let homepage: { response: Response; url: URL };
  try {
    homepage = await safeDigitalPriceListFetch(initialUrl, env);
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
  const homepageChallenge = isBotChallenge(homepage.response, html);
  if (homepageChallenge) network.blocked = true;
  if (homepage.response.status >= 500) network.failed = true;
  const homepageReadable = homepage.response.ok && !homepageChallenge;
  if (homepageReadable || homepage.response.status === 404) network.checked = true;
  const details: CheckDetails = {
    ...emptyDetails(),
    reachable: true,
    https: homepage.url.protocol === "https:",
    fetchBlocked: homepageChallenge,
  };
  const links = homepageReadable ? extractLinks(html, homepage.url) : [];
  const secondary: URL[] = [];
  const csv: URL[] = [];
  const xml: URL[] = [];
  const archive: URL[] = [];
  for (const candidate of links) {
    if (candidate.kind === "price") appendUnique(secondary, candidate.url, MAX_SECONDARY_PAGES);
    if (candidate.kind === "csv") { details.csvLinkDiscovered = true; appendUnique(csv, candidate.url, MAX_DOCUMENT_CANDIDATES); }
    if (candidate.kind === "xml") { details.xmlLinkDiscovered = true; appendUnique(xml, candidate.url, MAX_DOCUMENT_CANDIDATES); }
    if (candidate.kind === "archive") { details.archiveLinkDiscovered = true; appendUnique(archive, candidate.url, MAX_SECONDARY_PAGES); }
  }
  appendUnique(secondary, new URL("/cjenik/", homepage.url.origin), MAX_SECONDARY_PAGES);
  appendUnique(secondary, new URL("/cjenici/", homepage.url.origin), MAX_SECONDARY_PAGES);
  appendUnique(csv, new URL("/cjenik.csv", homepage.url.origin), MAX_DOCUMENT_CANDIDATES);
  appendUnique(xml, new URL("/cjenik.xml", homepage.url.origin), MAX_DOCUMENT_CANDIDATES);
  appendUnique(archive, new URL("/cjenik/arhiva/", homepage.url.origin), MAX_SECONDARY_PAGES);
  appendUnique(archive, new URL("/cjenik/arhiva", homepage.url.origin), MAX_SECONDARY_PAGES);

  for (const page of secondary) {
    try {
      const fetched = await safeDigitalPriceListFetch(page, env);
      if (fetched.response.status >= 500) { network.failed = true; continue; }
      const secondaryHtml = await readLimited(fetched.response, MAX_HTML_BYTES);
      if (isBotChallenge(fetched.response, secondaryHtml)) { network.blocked = true; continue; }
      if (!fetched.response.ok) { network.checked = true; continue; }
      network.checked = true;
      if (pageLooksLikePriceList(fetched.response, secondaryHtml)) {
        details.pricePageFound = true;
        details.pricePageUrl ||= fetched.url.href;
      }
      for (const candidate of extractLinks(secondaryHtml, fetched.url)) {
        if (candidate.kind === "csv") { details.csvLinkDiscovered = true; appendUnique(csv, candidate.url, MAX_DOCUMENT_CANDIDATES); }
        if (candidate.kind === "xml") { details.xmlLinkDiscovered = true; appendUnique(xml, candidate.url, MAX_DOCUMENT_CANDIDATES); }
        if (candidate.kind === "archive") { details.archiveLinkDiscovered = true; appendUnique(archive, candidate.url, MAX_SECONDARY_PAGES); }
      }
    } catch { network.failed = true; }
  }
  details.csvUrl = await findDocument("csv", csv, env, network);
  details.xmlUrl = await findDocument("xml", xml, env, network);
  details.csvFound = Boolean(details.csvUrl);
  details.xmlFound = Boolean(details.xmlUrl);
  details.fetchBlocked = network.blocked;
  for (const candidate of archive) {
    try {
      const fetched = await safeDigitalPriceListFetch(candidate, env);
      if (fetched.response.status >= 500) { network.failed = true; continue; }
      const archiveHtml = await readLimited(fetched.response, MAX_HTML_BYTES);
      if (isBotChallenge(fetched.response, archiveHtml)) { network.blocked = true; details.fetchBlocked = true; continue; }
      if (!fetched.response.ok) { network.checked = true; continue; }
      network.checked = true;
      if (pageLooksLikeArchive(fetched.response, archiveHtml)) {
        details.archiveFound = true;
        details.archiveUrl = fetched.url.href;
        break;
      }
    } catch { network.failed = true; }
  }
  if (details.csvFound || details.xmlFound) return result("green", "Pronađen je javno dostupan strojni cjenik. CSV/XML datoteka je tehnički dostupna za automatizirani dohvat — to još nije potvrda usklađenosti s Odlukom.", details);
  if (details.pricePageFound) return result("yellow", "Pronađena je stranica ili cjenik, ali nije potvrđen valjan javni CSV/XML dokument.", details);
  if (network.blocked && !network.checked) {
    return result("yellow", "Web je zaštićen od automatskog dohvata, pa javni CSV/XML nismo mogli potvrditi.", details);
  }
  if (network.failed && !network.checked) return result("unavailable", "Provjeru trenutačno nije moguće dovršiti. Pokušajte ponovno.", details);
  if (details.fetchBlocked) return result("red", "Naslovnica je zaštićena od automatskog dohvata. Javni CSV/XML na uobičajenim adresama nije pronađen.", details);
  return result("red", "Strojni cjenik nije pronađen.", details);
}

export const onRequestPost = async ({ request, env }: { request: Request; env: CheckerEnv }) => {
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
  return Response.json(checked);
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
