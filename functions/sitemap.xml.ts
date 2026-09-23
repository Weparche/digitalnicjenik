import { mergeSitemapUrls, renderSitemap, staticSitemapUrls } from '../src/seo/catalog'
import { listIndexablePublicationUrls } from './_public-seo'
import type { RuntimeEnv } from './_repository'

export const onRequestGet = async ({ env }: { env: RuntimeEnv }) => {
  let extra: Awaited<ReturnType<typeof listIndexablePublicationUrls>> = []
  try {
    extra = await listIndexablePublicationUrls(env)
  } catch {
    extra = []
  }
  const xml = renderSitemap(mergeSitemapUrls(staticSitemapUrls(), extra))
  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  })
}
