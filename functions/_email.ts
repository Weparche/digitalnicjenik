export type EmailAddress = { email: string; name?: string }
export type EmailAttachment = {
  content: string | ArrayBuffer | ArrayBufferView
  filename: string
  type?: string
  disposition?: 'attachment' | 'inline'
}

export type SendEmailBinding = {
  send: (message: {
    to: string | string[]
    from: EmailAddress | string
    subject: string
    text?: string
    html?: string
    replyTo?: string | EmailAddress
    attachments?: EmailAttachment[]
  }) => Promise<{ messageId?: string }>
}

export type EmailEnv = {
  EMAIL?: SendEmailBinding
  CF_ACCOUNT_ID?: string
  CF_EMAIL_API_TOKEN?: string
  EMAIL_FROM?: string
  EMAIL_TO?: string
}

function fromAddress(env: EmailEnv) {
  const address = env.EMAIL_FROM?.trim()
  if (!address) return null
  return { email: address, name: 'NEPAR Publisher' as const }
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

/**
 * Pages Functions do not support `send_email` bindings — use REST with
 * CF_EMAIL_API_TOKEN (nepar.hr Email Sending). Workers may still pass EMAIL.
 */
export async function sendTransactionalEmail(
  env: EmailEnv,
  message: {
    to: string
    subject: string
    text: string
    html?: string
    replyTo?: { email: string; name?: string }
    attachments?: Array<{ filename: string; content: Uint8Array | string; type?: string }>
  },
  fetcher: typeof fetch = fetch,
) {
  const from = fromAddress(env)
  if (!from) throw new Error('email_misconfigured')

  if (env.EMAIL) {
    await env.EMAIL.send({
      to: message.to,
      from,
      subject: message.subject,
      text: message.text,
      html: message.html,
      replyTo: message.replyTo,
      attachments: message.attachments?.map((item) => ({
        content: item.content,
        filename: item.filename,
        type: item.type,
        disposition: 'attachment' as const,
      })),
    })
    return
  }

  if (!env.CF_ACCOUNT_ID || !env.CF_EMAIL_API_TOKEN) throw new Error('email_misconfigured')

  const body: Record<string, unknown> = {
    to: message.to,
    from: { address: from.email, name: from.name },
    subject: message.subject,
    text: message.text,
    html: message.html,
  }
  if (message.replyTo) body.reply_to = { address: message.replyTo.email, name: message.replyTo.name }
  if (message.attachments?.length) {
    body.attachments = message.attachments.map((item) => ({
      filename: item.filename,
      type: item.type || 'application/octet-stream',
      content: typeof item.content === 'string' ? btoa(item.content) : bytesToBase64(item.content),
      disposition: 'attachment',
    }))
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetcher(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CF_ACCOUNT_ID)}/email/sending/send`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${env.CF_EMAIL_API_TOKEN}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      },
    )
    const result = await response.json().catch(() => null) as {
      success?: boolean
      result?: { delivered?: string[]; queued?: string[]; permanent_bounces?: string[] }
    } | null
    const delivered =
      response.ok
      && result?.success === true
      && (result.result?.permanent_bounces?.length ?? 0) === 0
      && ((result.result?.delivered?.length ?? 0) + (result.result?.queued?.length ?? 0) > 0)
    if (!delivered) throw new Error('send_failed')
  } finally {
    clearTimeout(timeout)
  }
}

export function emailConfigured(env: EmailEnv) {
  return Boolean(env.EMAIL_FROM && (env.EMAIL || (env.CF_ACCOUNT_ID && env.CF_EMAIL_API_TOKEN)))
}
