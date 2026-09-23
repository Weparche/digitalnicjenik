export const SITE_URL = 'https://digitalnicjenik.nepar.hr'
export const NEPAR_URL = 'https://nepar.hr'
export const ORGANIZATION_ID = `${NEPAR_URL}/#organization`
export const WEBSITE_ID = `${SITE_URL}/#website`

export function newsIndexUrl() {
  return `${SITE_URL}/vijesti/`
}

export function newsArticleUrl(slug: string) {
  return `${SITE_URL}/vijesti/${slug}/`
}

export function absoluteAssetUrl(path: string) {
  if (path.startsWith('http')) return path
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}
