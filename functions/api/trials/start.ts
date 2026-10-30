import { checkSlugAvailability, previewSlugFromBusinessName, startTrialClaim, type TrialEnv } from '../../_trial'
import { accessErrorResponse } from '../../_write-auth'
import { resolveSession,sessionCookieHeader } from '../../_auth'

export const onRequestPost = async ({ request, env }: { request: Request; env: TrialEnv }) => {
  try {
    if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({ok:false,error:'invalid_origin'},{status:403,headers:{'cache-control':'no-store'}})
    const session=await resolveSession(env,request)
    const body = await request.json() as {
      draftId?: string
      email?: string
      businessName?: string
      slug?: string
      turnstileToken?: string
      'cf-turnstile-response'?: string
      attribution?: unknown
    }
    if (!body.draftId || !(session?.user.email||body.email) || !body.businessName) {
      return Response.json({ ok: false, error: 'invalid_input' }, { status: 400 })
    }
    const slug = (body.slug || previewSlugFromBusinessName(body.businessName)).trim().toLocaleLowerCase('en-US')
    const result = await startTrialClaim(request, env, {
      draftId: body.draftId,
      email: session?.user.email||body.email!,
      businessName: body.businessName,
      slug,
      turnstileToken: body.turnstileToken || body['cf-turnstile-response'] || '',
      attribution: body.attribution,
    },fetch,session?.user)
    const {session:nextSession,...publicResult}=result
    const headers=new Headers({'cache-control':'no-store'})
    if(nextSession)headers.set('set-cookie',sessionCookieHeader(nextSession.sessionToken,nextSession.maxAgeSeconds,new URL(request.url).protocol==='https:'))
    return Response.json({ ok: true, ...publicResult },{headers})
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
