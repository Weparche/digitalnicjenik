import { emailConfigured, type EmailEnv } from '../../_email'
import type { LeadEnv } from '../../_lead'

/** Safe readiness probe for lead/trial forms (no secret values). */
export const onRequestGet = ({ env }: { env: LeadEnv & Record<string, unknown> }) =>
  Response.json({
    envKeys: Object.keys(env).filter((key) => !key.startsWith('__')).sort(),
    db: Boolean(env.DB),
    emailTo: Boolean(env.EMAIL_TO),
    emailFrom: Boolean(env.EMAIL_FROM),
    cfAccountId: Boolean(env.CF_ACCOUNT_ID),
    cfEmailApiToken: Boolean(env.CF_EMAIL_API_TOKEN),
    emailSender: Boolean(env.EMAIL_SENDER),
    mailerSecret: Boolean(env.MAILER_SECRET),
    turnstileSecret: Boolean(env.TURNSTILE_SECRET_KEY),
    leadRateLimitSecret: Boolean(env.LEAD_RATE_LIMIT_SECRET),
    turnstileSiteKey: Boolean(env.TURNSTILE_SITE_KEY),
    emailConfigured: emailConfigured(env),
    leadReady:
      Boolean(env.DB)
      && emailConfigured(env)
      && Boolean(env.EMAIL_TO)
      && Boolean(env.TURNSTILE_SECRET_KEY)
      && Boolean(env.LEAD_RATE_LIMIT_SECRET),
  })
