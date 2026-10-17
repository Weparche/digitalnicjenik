/*
 * NEPAR Publisher — embed script.
 *   <script src="https://digitalnicjenik.nepar.hr/embed.js" data-cjenik="moj-slug"></script>
 * Optional: data-height="640" (initial height in px), data-title="Naslov za čitače zaslona".
 * The public price list is rendered in an iframe and reports its own height back via postMessage.
 */
(function () {
  var script = document.currentScript
  if (!script) return
  var slug = script.getAttribute('data-cjenik')
  if (!slug || !/^[a-z0-9][a-z0-9-]{0,62}$/i.test(slug)) return

  var origin
  try { origin = new URL(script.src).origin } catch (error) { return }

  var initial = parseInt(script.getAttribute('data-height') || '640', 10)
  var iframe = document.createElement('iframe')
  iframe.src = origin + '/c/' + encodeURIComponent(slug) + '?embed=1'
  iframe.title = script.getAttribute('data-title') || 'Digitalni cjenik'
  iframe.loading = 'lazy'
  iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
  iframe.style.cssText = 'display:block;width:100%;border:0;height:' + (isFinite(initial) && initial > 0 ? initial : 640) + 'px'
  script.parentNode.insertBefore(iframe, script.nextSibling)

  window.addEventListener('message', function (event) {
    // Only the iframe we created, from the Publisher origin, with the exact structured message shape.
    if (event.source !== iframe.contentWindow || event.origin !== origin) return
    var data = event.data
    if (!data || typeof data !== 'object' || data.type !== 'nepar-cjenik-resize' || data.slug !== slug) return
    var height = Number(data.height)
    if (!isFinite(height)) return
    iframe.style.height = Math.min(Math.max(Math.round(height), 120), 20000) + 'px'
  })
})()
