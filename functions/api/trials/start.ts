import { checkSlugAvailability, previewSlugFromBusinessName, startTrialClaim, type TrialEnv } from '../../_trial'
import { accessErrorResponse } from '../../_write-auth'

export const onRequestPost = async ({ request, env }: { request: Request; env: TrialEnv }) => {
  try {
    const body = await request.json() as {
      draftId?: string
      email?: string
      businessName?: string
      slug?: string
      turnstileToken?: string
      'cf-turnstile-response'?: string
    }
    if (!body.draftId || !body.email || !body.businessName) {
      return Response.json({ ok: false, error: 'invalid_input' }, { status: 400 })
    }
    const slug = (body.slug || previewSlugFromBusinessName(body.businessName)).trim().toLocaleLowerCase('en-US')
    const result = await startTrialClaim(request, env, {
      draftId: body.draftId,
      email: body.email,
      businessName: body.businessName,
      slug,
      turnstileToken: body.turnstileToken || body['cf-turnstile-response'] || '',
    })
    return Response.json({ ok: true, ...result })
  } catch (error) {
    const denied = accessErrorResponse(error)
    if (denied) return denied
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'claim_failed' }, { status: 500 })
  }
}

export const onRequestGet = async ({ request, env }: { request: Request; env: TrialEnv }) => {
  const url = new URL(request.url)
  const businessName = url.searchParams.get('businessName') || ''
  const slug = url.searchParams.get('slug') || (businessName ? previewSlugFromBusinessName(businessName) : '')
  if (!slug) return Response.json({ error: 'invalid_input' }, { status: 400 })
  try {
    const availability = await checkSlugAvailability(env, slug)
    return Response.json({
      ok: true,
      suggested: previewSlugFromBusinessName(businessName || slug),
      ...availability,
    })
  } catch (error) {
    const denied = accessErrorResponse(error)
    if (denied) return denied
    return Response.json({ error: 'slug_check_failed' }, { status: 500 })
  }
}
