import { readPublicationForHost, readPublications, type RuntimeEnv } from '../../_repository'

export const onRequestGet = async ({ request, env }: { request: Request; env: RuntimeEnv }) => {
  const publication = await readPublicationForHost(env, new URL(request.url).hostname)
  if (!publication) return Response.json({ publications: [] })
  const publications = await readPublications(env, publication.payload.tenant.slug)
  return Response.json({ publications: publications.map((item) => ({ ...item, csvUrl: '/' + item.filenameStem + '.csv', xmlUrl: '/' + item.filenameStem + '.xml' })) })
}
