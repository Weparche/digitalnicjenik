// Notifies Bing and other IndexNow engines about the URLs in the live sitemap.
// Usage: npm run indexnow            (all sitemap URLs)
//        npm run indexnow -- <url>…  (only the given URLs)
// The key file public/<key>.txt must be deployed first; the key is public by design.
import { readdirSync, readFileSync } from 'node:fs'

const HOST = 'digitalnicjenik.nepar.hr'
const keyFile = readdirSync('public').find((name) => /^[0-9a-f]{32}\.txt$/.test(name))
if (!keyFile) throw new Error('IndexNow key file public/<32 hex>.txt not found')
const key = keyFile.replace('.txt', '')

const requested = process.argv.slice(2)
let urls = requested
if (!urls.length) {
  const sitemap = await (await fetch(`https://${HOST}/sitemap.xml`)).text()
  urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
}

const response = await fetch('https://api.indexnow.org/IndexNow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/${key}.txt`, urlList: urls }),
})
console.log(`IndexNow: ${urls.length} URLs → HTTP ${response.status}`)
if (!response.ok && response.status !== 202) {
  console.error(await response.text())
  process.exit(1)
}
