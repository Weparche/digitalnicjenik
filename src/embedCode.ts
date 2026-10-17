/** Snippets a customer pastes into their own site. `origin` is the Publisher app host. */
export function embedScriptSnippet(origin: string, slug: string) {
  return `<script src="${origin}/embed.js" data-cjenik="${slug}"></script>`
}

export function embedIframeSnippet(origin: string, slug: string) {
  return `<iframe src="${origin}/c/${slug}?embed=1" title="Digitalni cjenik" loading="lazy" style="width:100%;height:640px;border:0"></iframe>`
}

export function printUrl(origin: string, slug: string) {
  return `${origin}/c/${slug}?print=1`
}
