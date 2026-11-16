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

/** Permanent, public destinations; never copy an expiring or version-specific URL for installation. */
export function publicInstallationLinks(origin:string,slug:string){
 const base=origin.replace(/\/$/,'')+'/c/'+encodeURIComponent(slug)
 return [
  {label:'Digitalni cjenik (HTML)',url:base},
  {label:'Digitalni cjenik (CSV)',url:base+'/cjenik.csv'},
  {label:'Digitalni cjenik (XML)',url:base+'/cjenik.xml'},
  {label:'Arhiva cjenika',url:base+'/arhiva'},
 ]
}
export function publicInstallationSnippet(origin:string,slug:string){
 return publicInstallationLinks(origin,slug).map(link=>'<a href="'+link.url+'">'+link.label+'</a>').join('\n')
}
