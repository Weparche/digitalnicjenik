export type MailPayload = {
  to: string
  from: { email: string; name?: string }
  subject: string
  text: string
  html?: string
  replyTo?: { email: string; name?: string }
  attachments?: Array<{
    filename: string
    type?: string
    contentBase64: string
  }>
}

export interface Env {
  EMAIL: {
    send: (message: {
      to: string
      from: { email: string; name?: string }
      subject: string
      text?: string
      html?: string
      replyTo?: { email: string; name?: string }
      attachments?: Array<{
        filename: string
        type?: string
        content: string
        disposition?: 'attachment'
      }>
    }) => Promise<unknown>
  }
  MAILER_SECRET: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 })
    }
    const auth = request.headers.get('Authorization')
    if (!env.MAILER_SECRET || auth !== `Bearer ${env.MAILER_SECRET}`) {
      return new Response('Unauthorized', { status: 401 })
    }
    const payload = await request.json().catch(() => null) as MailPayload | null
    if (!payload?.to || !payload.from?.email || !payload.subject || !payload.text) {
      return Response.json({ ok: false, code: 'invalid_input' }, { status: 400 })
    }
    try {
      await env.EMAIL.send({
        to: payload.to,
        from: { email: payload.from.email, name: payload.from.name },
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
        replyTo: payload.replyTo,
        attachments: payload.attachments?.map((item) => ({
          filename: item.filename,
          type: item.type || 'application/octet-stream',
          content: item.contentBase64,
          disposition: 'attachment' as const,
        })),
      })
      return Response.json({ ok: true })
    } catch {
      return Response.json({ ok: false, code: 'send_failed' }, { status: 502 })
    }
  },
} satisfies ExportedHandler<Env>
