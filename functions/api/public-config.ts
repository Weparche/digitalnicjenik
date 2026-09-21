/** Public client config (no secrets). Turnstile site keys are public by design. */

export type PublicConfigEnv = { TURNSTILE_SITE_KEY?: string }

export const onRequestGet = ({ env }: { env: PublicConfigEnv }) =>
  Response.json(
    {
      turnstileSiteKey: env.TURNSTILE_SITE_KEY?.trim() || '',
      turnstileAction: 'turnstile-spin-v2',
    },
    {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=300',
      },
    },
  )
