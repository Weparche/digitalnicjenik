const LEGACY_VARIANTS = new Set(['1', '2', '3'])

export const onRequestGet = ({ request, params }: { request: Request; params: { variant?: string } }) => {
  if (!LEGACY_VARIANTS.has(params.variant ?? '')) return new Response('Not found', { status: 404 })
  return Response.redirect(new URL('/', request.url), 301)
}
