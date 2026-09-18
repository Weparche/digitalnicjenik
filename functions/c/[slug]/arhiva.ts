import { readPublications, type RuntimeEnv } from '../../_repository'

export const onRequestGet = async ({ request, params, env }: { request: Request; params: Record<string, string>; env: RuntimeEnv }) => {
  // Keep the JSON response useful to direct function tests/legacy callers, but
  // let browser navigation render the same archive UI as the root public route.
  if (env.ASSETS) return env.ASSETS.fetch(new URL('/app-shell.html', request.url))
  return Response.json({ publications: await readPublications(env, params.slug) })
}
