import type { D1DatabaseLike } from './_repository'

export const MAX_ATTACHMENT_BYTES = 4_000_000
export const MAX_REQUEST_BYTES = 4_600_000
const TURNSTILE_ACTION = 'turnstile-spin-v2'

export type LeadEnv = {
  DB?: D1DatabaseLike
  CF_ACCOUNT_ID?: string
  CF_EMAIL_API_TOKEN?: string
  EMAIL_FROM?: string
  EMAIL_TO?: string
  TURNSTILE_SECRET_KEY?: string
  LEAD_RATE_LIMIT_SECRET?: string
}

type LeadErrorCode = 'invalid_input' | 'turnstile_failed' | 'rate_limited' | 'file_rejected' | 'send_failed'
type TurnstileResult = { success?: boolean; action?: string; hostname?: string; ['error-codes']?: string[] }

const allowedExtensions = new Set(['csv', 'xml', 'xls', 'xlsx', 'pdf', 'jpg', 'jpeg', 'png', 'webp'])
const allowedMimeByExtension: Record<string, string[]> = {
  csv: ['text/csv', 'application/csv', 'text/plain', 'application/vnd.ms-excel', ''],
  xml: ['application/xml', 'text/xml', 'text/plain', ''],
  xls: ['application/vnd.ms-excel', 'application/octet-stream', ''],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip', 'application/octet-stream', ''],
  pdf: ['application/pdf', 'application/octet-stream', ''],
  jpg: ['image/jpeg', 'application/octet-stream', ''],
  jpeg: ['image/jpeg', 'application/octet-stream', ''],
  png: ['image/png', 'application/octet-stream', ''],
  webp: ['image/webp', 'application/octet-stream', ''],
}

export function jsonResponse(status: number, body: { ok: boolean; code?: LeadErrorCode; leadId?: string }) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } })
}

export function sanitizeLeadFilename(value: string) {
  const leaf = value.replace(/[\u0000-\u001f\u007f]/g, '').split(/[\\/]/).pop() ?? ''
  const base = leaf.replace(/\.\.+/g, '.').replace(/\s+/g, ' ').trim()
  const safe = base.replace(/[^\p{L}\p{N} ._()-]/gu, '-').replace(/^[.\s-]+/, '').slice(0, 120)
  return safe || 'privitak'
}

export function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!)
}

function extensionOf(filename: string) {
  return filename.toLocaleLowerCase('hr-HR').split('.').pop() ?? ''
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((byte, index) => bytes[index] === byte)
}

function validText(bytes: Uint8Array, extension: 'csv' | 'xml') {
  if (bytes.includes(0)) return false
  const text = new TextDecoder('utf-8').decode(bytes.slice(0, 64_000)).replace(/^\uFEFF/, '').trim()
  if (!text) return false
  if (extension === 'xml') return /^<\?xml\b|^<[A-Za-z_][\w:.-]*(?:\s|>|\/)/.test(text) && !/^<!doctype\s+html|^<html\b/i.test(text)
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return false
  const delimiter = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ';' : ','
  return lines[0].split(delimiter).length >= 2 && lines[1].split(delimiter).length >= 2
}

export async function validateLeadAttachment(file: File) {
  if (!file.name || file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) throw new Error('file_rejected')
  const filename = sanitizeLeadFilename(file.name)
  const extension = extensionOf(filename)
  if (!allowedExtensions.has(extension) || !(allowedMimeByExtension[extension] ?? []).includes(file.type.toLocaleLowerCase())) throw new Error('file_rejected')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const valid = extension === 'csv' || extension === 'xml'
    ? validText(bytes, extension)
    : extension === 'xls'
      ? startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
      : extension === 'xlsx'
        ? startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])
        : extension === 'pdf'
          ? startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])
          : extension === 'jpg' || extension === 'jpeg'
            ? startsWith(bytes, [0xff, 0xd8, 0xff])
            : extension === 'png'
              ? startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
              : startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  if (!valid) throw new Error('file_rejected')
  return { filename, type: file.type || allowedMimeByExtension[extension][0], bytes }
}

export async function hmacIp(ip: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ip))
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function stringField(form: FormData, name: string, maxLength: number) {
  const value = form.get(name)
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  return btoa(binary)
}

async function recordAttempt(env: LeadEnv, ipHash: string, status: string, attemptId: string) {
  if (!env.DB) throw new Error('send_failed')
  try {
    await env.DB.prepare('INSERT INTO lead_delivery_attempts (id, ip_hash, status, created_at) VALUES (?, ?, ?, ?)').bind(attemptId, ipHash, status, new Date().toISOString()).run()
  } catch (error) {
    if (error instanceof Error && /rate limit/i.test(error.message)) throw new Error('rate_limited')
    throw error
  }
}

async function updateAttempt(env: LeadEnv, attemptId: string, status: string) {
  await env.DB?.prepare('UPDATE lead_delivery_attempts SET status = ? WHERE id = ?').bind(status, attemptId).run()
}

async function verifyTurnstile(token: string, ip: string, requestUrl: URL, secret: string, fetcher: typeof fetch) {
  if (!token || token.length > 2048) return false
  const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token, remoteip: ip, idempotency_key: crypto.randomUUID() }),
  })
  if (!response.ok) return false
  const result = await response.json() as TurnstileResult
  return result.success === true && result.action === TURNSTILE_ACTION && (!result.hostname || result.hostname === requestUrl.hostname)
}

function normalizeContext(raw: string) {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Record<string, unknown>
    return {
      website: String(value.website ?? '').slice(0, 500),
      checkerStatus: String(value.checkerStatus ?? '').slice(0, 40),
      discoveredUrls: Array.isArray(value.discoveredUrls) ? value.discoveredUrls.slice(0, 2).map((item) => String(item).slice(0, 500)) : [],
      sourceFilename: String(value.sourceFilename ?? '').slice(0, 160),
      itemCount: Number(value.itemCount) || 0,
      blockerCount: Number(value.blockerCount) || 0,
      manualReviewCount: Number(value.manualReviewCount) || 0,
    }
  } catch {
    return null
  }
}

export async function handleLeadRequest(request: Request, env: LeadEnv, fetcher: typeof fetch = fetch) {
  const requestUrl = new URL(request.url)
  const origin = request.headers.get('origin')
  if (!origin || origin !== requestUrl.origin) return jsonResponse(403, { ok: false, code: 'invalid_input' })
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > MAX_REQUEST_BYTES) return jsonResponse(413, { ok: false, code: 'file_rejected' })
  if (!env.CF_ACCOUNT_ID || !env.CF_EMAIL_API_TOKEN || !env.EMAIL_FROM || !env.EMAIL_TO || !env.TURNSTILE_SECRET_KEY || !env.LEAD_RATE_LIMIT_SECRET || !env.DB) return jsonResponse(503, { ok: false, code: 'send_failed' })

  let form: FormData
  try { form = await request.formData() } catch { return jsonResponse(400, { ok: false, code: 'invalid_input' }) }
  const intent = stringField(form, 'intent', 30)
  const name = stringField(form, 'name', 120)
  const email = stringField(form, 'email', 254)
  const phone = stringField(form, 'phone', 40)
  const website = stringField(form, 'website', 500)
  const platform = stringField(form, 'platform', 40)
  const materials = stringField(form, 'materials', 40)
  const message = stringField(form, 'message', 3000)
  const privacy = form.get('privacy')
  const token = stringField(form, 'cf-turnstile-response', 2048)
  if (!['implementation', 'consultation', 'plugin'].includes(intent) || !name || !validEmail(email) || privacy !== 'on') return jsonResponse(400, { ok: false, code: 'invalid_input' })
  const intentLabel = intent === 'implementation' ? 'Implementacija' : intent === 'plugin' ? 'Plugin / link' : 'Konzultacija'

  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
  const attemptId = crypto.randomUUID()
  try {
    await recordAttempt(env, await hmacIp(ip, env.LEAD_RATE_LIMIT_SECRET), 'received', attemptId)
  } catch (error) {
    return jsonResponse(error instanceof Error && error.message === 'rate_limited' ? 429 : 503, { ok: false, code: error instanceof Error && error.message === 'rate_limited' ? 'rate_limited' : 'send_failed' })
  }

  let turnstileOk = false
  try { turnstileOk = await verifyTurnstile(token, ip, requestUrl, env.TURNSTILE_SECRET_KEY, fetcher) } catch { turnstileOk = false }
  if (!turnstileOk) {
    await updateAttempt(env, attemptId, 'turnstile_failed')
    return jsonResponse(403, { ok: false, code: 'turnstile_failed' })
  }

  let attachment: Awaited<ReturnType<typeof validateLeadAttachment>> | null = null
  const file = form.get('attachment')
  if (file instanceof File && file.size > 0) {
    try { attachment = await validateLeadAttachment(file) } catch {
      await updateAttempt(env, attemptId, 'file_rejected')
      return jsonResponse(400, { ok: false, code: 'file_rejected' })
    }
  }
  const context = normalizeContext(stringField(form, 'context', 4000))
  const rows = [
    ['Namjera', intentLabel],
    ['Ime / tvrtka', name], ['E-mail', email], ['Telefon', phone || '—'], ['Web', website || '—'],
    ['Platforma', platform || '—'], ['Materijali', materials || '—'], ['Poruka', message || '—'],
    ['Checker', context?.checkerStatus || '—'], ['Pronađeni URL-ovi', context?.discoveredUrls.join('\n') || '—'],
    ['Učitana datoteka', context?.sourceFilename || '—'], ['Stavke / blokade', context ? `${context.itemCount} / ${context.blockerCount} (${context.manualReviewCount} ručni pregled)` : '—'],
    ['Privitak', attachment?.filename || '—'], ['Lead ID', attemptId],
  ]
  const text = rows.map(([label, value]) => `${label}: ${value}`).join('\n\n')
  const html = `<html lang="hr"><body style="font-family:Arial,sans-serif;color:#0f172a"><h1>Novi upit za digitalni cjenik</h1><table role="presentation" style="border-collapse:collapse;width:100%">${rows.map(([label, value]) => `<tr><th style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:top">${escapeHtml(label)}</th><td style="padding:8px;border-bottom:1px solid #e2e8f0;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`).join('')}</table></body></html>`
  const emailPayload: Record<string, unknown> = {
    to: env.EMAIL_TO,
    from: { address: env.EMAIL_FROM, name: 'NEPAR Publisher' },
    reply_to: { address: email, name },
    subject: `${intentLabel} · digitalni cjenik · ${name}`.slice(0, 180),
    text,
    html,
  }
  if (attachment) emailPayload.attachments = [{ content: bytesToBase64(attachment.bytes), filename: attachment.filename, type: attachment.type, disposition: 'attachment' }]

  let sent = false
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)
    const response = await fetcher(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CF_ACCOUNT_ID)}/email/sending/send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.CF_EMAIL_API_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify(emailPayload),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))
    const result = await response.json().catch(() => null) as { success?: boolean; result?: { delivered?: string[]; queued?: string[]; permanent_bounces?: string[] } } | null
    sent = response.ok && result?.success === true && (result.result?.permanent_bounces?.length ?? 0) === 0 && ((result.result?.delivered?.length ?? 0) + (result.result?.queued?.length ?? 0) > 0)
  } catch { sent = false }
  await updateAttempt(env, attemptId, sent ? 'sent' : 'send_failed')
  return sent ? jsonResponse(200, { ok: true, leadId: attemptId }) : jsonResponse(502, { ok: false, code: 'send_failed' })
}
