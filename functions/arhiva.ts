export const onRequestGet = async ({ request, env }: { request: Request; env: { ASSETS?: { fetch: (input: Request | URL | string) => Promise<Response> } } }) => {
  if (!env.ASSETS) return new Response('Not found', { status: 404 })
  return env.ASSETS.fetch(new URL('/index.html', request.url))
}
