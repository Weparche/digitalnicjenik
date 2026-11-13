import { afterEach, describe, expect, it, vi } from 'vitest'
import { analyzeDocument, parsePublicationName, renderDynamicPage, runDigitalPriceListCheck } from './check'
import { technicalReport } from '../../../shared/website-check'

const resolver = { resolve4: async () => ['93.184.216.34'], resolve6: async () => [] }
const csv = 'Naziv;Vrsta;Cijena;Sidrena cijena;Poseban oblik prodaje\nŠišanje;Usluga;15;15;NE'
const xml = '<cjenik><usluga><naziv_usluge>Šišanje</naziv_usluge><maloprodajna_cijena>15</maloprodajna_cijena><sidrena_cijena>15</sidrena_cijena><posebni_oblik_prodaje>false</posebni_oblik_prodaje></usluga></cjenik>'
const html = (s:string) => new Response(s,{headers:{'content-type':'text/html'}})
function stub(routes:Record<string,()=>Response>) {
  const fetch = vi.fn(async (input:RequestInfo|URL) => {
    const u=new URL(String(input)); return routes[u.pathname]?.() ?? new Response('missing',{status:404})
  })
  vi.stubGlobal('fetch',fetch); return fetch
}
const check = (path='/') => runDigitalPriceListCheck('https://example.hr'+path,{DIGITAL_PRICE_LIST_DNS_RESOLVER:resolver})
afterEach(()=>vi.unstubAllGlobals())
describe('checker v2 regressions',()=>{
  it('does not combine an explicit tenant file with the root of another tenant',async()=>{
    const f=stub({'/c/a/cjenik.csv':()=>new Response(csv,{headers:{'content-type':'text/csv','content-disposition':'attachment; filename="usluzni-objekt_ilica-1_A_9_20261113-073000.csv"'}}),'/cjenik.xml':()=>new Response(xml)})
    const result=await check('/c/a/cjenik.csv')
    expect(result.details).toMatchObject({csvFound:true,xmlFound:false,directDocument:true})
    expect(f.mock.calls.some(([url])=>String(url).endsWith('/cjenik.xml'))).toBe(false)
    expect(technicalReport(result).checks.find(c=>c.id==='link')?.status).toBe('unknown')
    expect(technicalReport(result).checks.find(c=>c.id==='publication')?.status).toBe('pass')
  })
  it('selects a verified link rather than an unrelated pricing page',async()=>{
    stub({'/':()=>html('<a href="/usluge/cijene">Cijene</a><a href="/cjenici">Cjenici</a>'),'/usluge/cijene':()=>html('<p>Marketing</p>'),'/cjenici':()=>html('<a href="/data/current.csv">CSV</a>'),'/data/current.csv':()=>new Response(csv)})
    const result=await check()
    expect(result.details.publicLinkUrl).toBe('https://example.hr/cjenici')
  })
  it('does not combine separately named objects or versions',async()=>{
    const a='/files/store_ilica_A_9_20261113-073000.csv',b='/files/store_dubrava_B_9_20261113-073000.xml'
    stub({'/':()=>html('<a href="'+a+'">CSV</a><a href="'+b+'">XML</a>'),[a]:()=>new Response(csv),[b]:()=>new Response(xml)})
    expect((await check()).details).toMatchObject({csvFound:true,xmlFound:false})
  })
  it('does not combine unrelated unversioned files in a shared folder',async()=>{
    stub({'/':()=>html('<a href="/files/a.csv">CSV</a><a href="/files/b.xml">XML</a>'),'/files/a.csv':()=>new Response(csv),'/files/b.xml':()=>new Response(xml)})
    expect((await check()).details).toMatchObject({csvFound:true,xmlFound:false})
  })
  it('does not infer archive from the previous file of another store',async()=>{
    const a='/files/store_ilica_A_9_20261113-073000.csv',b='/files/store_dubrava_B_8_20261112-073000.csv'
    stub({'/':()=>html('<a href="'+a+'">CSV</a><a href="'+b+'">CSV</a>'),[a]:()=>new Response(csv),[b]:()=>new Response(csv)})
    expect((await check()).details.archiveFound).toBe(false)
  })
  it('detects sitemap-based price pages and alternate spreadsheet links without claiming CSV',async()=>{
    stub({'/':()=>html('<h1>Trgovina</h1>'),'/sitemap.xml':()=>new Response('<urlset><url><loc>https://example.hr/info/digitalni-cjenici</loc></url></urlset>'),'/info/digitalni-cjenici':()=>html('<a href="/downloads/cjenik.xlsx">Preuzmi cjenik</a>')})
    const result=await check()
    expect(result.status).toBe('yellow')
    expect(result.details.otherDocumentUrls).toEqual(['https://example.hr/downloads/cjenik.xlsx'])
    expect(result.details.csvFound).toBe(false)
  })
  it('reports a JavaScript-only shell as uncertain instead of a missing cjenik',async()=>{
    stub({'/':()=>html('<html><title>Trgovina</title><div id="app"></div>'+ '<script src="/app.js"></script>'.repeat(6)+'</html>')})
    const result=await check()
    expect(result.status).toBe('yellow')
    expect(result.details.dynamicShell).toBe(true)
    expect(technicalReport(result).checks.find(c=>c.id==='machine')?.status).toBe('unknown')
  })
  it('finds ZIP price-list links and attempts a bounded range read',async()=>{
    const zip='/cjenici/cjenici_13_11_2026.zip'
    const f=stub({'/':()=>html('<a href="/info-o-cijenama">Info o cijenama</a>'),'/info-o-cijenama':()=>html('<a href="'+zip+'">Cjenik</a>')})
    const result=await check()
    expect(result.status).toBe('yellow')
    expect(result.details.otherDocumentUrls).toEqual(['https://example.hr'+zip])
    expect(f.mock.calls.some(([url])=>String(url).endsWith('.zip'))).toBe(true)
    expect(result.details.zipEvidence).toContain('nije uspio')
  })
  it('skips unrelated sitemap XML and prefers a recognizable cjenik over generic CSV',async()=>{
    stub({'/':()=>html('<a href="/sitemap.xml">XML</a><a href="/generic.csv">CSV</a><a href="/price.csv">CSV</a>'),'/generic.csv':()=>new Response('other,value\nfoo,1'),'/price.csv':()=>new Response(csv),'/sitemap.xml':()=>new Response('<urlset><url/></urlset>')})
    const result=await check()
    expect(result.details.csvUrl).toBe('https://example.hr/price.csv')
    expect(result.details.xmlFound).toBe(false)
  })
  it('parses comma-separated query publication names and Lidl-style times',()=>{
    expect(parsePublicationName('https://example.hr/download?title=SUPERMARKET%2C%C5%BDITNA+1A%2C0204%2C106273%2C13.11.2026%2C+05-21.CSV')).toMatchObject({storage:106273,objectKey:'supermarket|žitna 1a|0204'})
    expect(parsePublicationName('https://example.hr/Supermarket%20104_Ulica%2030_Jastrebarsko_1_13.11.2026_7.15h.csv')).toMatchObject({storage:1})
  })
})

it('retains an explicitly historical absence as a warning without discarding the row',()=>{
 const report=analyzeDocument('csv','NAZIV,ŠIFRA,MARKA,MALOPRODAJNA_CIJENA,BARKOD,Sidrena_cijena_na_02.05.2025\nMlijeko,1,Pilos,0.53,4335619246522,Nije_bilo_u_prodaji_02.05.2025')
 expect(report.itemCount).toBe(1)
 expect(report.findingGroups?.find(g=>g.rule==='product.anchor.historical-absence')).toMatchObject({level:'warning',count:1,affectedRows:1})
 expect(report.findings.some(f=>f.rule==='item.row.unreadable'||f.rule==='product.anchor.missing')).toBe(false)
 const invalid=analyzeDocument('csv','NAZIV,ŠIFRA,MARKA,MALOPRODAJNA_CIJENA,BARKOD,Sidrena_cijena_na_02.05.2025\nMlijeko,1,Pilos,0.53,4335619246522,proizvoljno')
 expect(invalid.findings.some(f=>f.rule==='item.row.unreadable')).toBe(true)
})
it('recognizes the compact Plodine archive member timestamp',()=>{
 expect(parsePublicationName('SUPERMARKET_ALFREDA_NOBELA_6_SOP_10361_SESVETSKI_KRALJEVEC_184_248_13112026045511.csv')).toMatchObject({storage:248,stamp:'13112026045511',objectKey:'supermarket|alfreda|nobela|6|sop|10361|sesvetski|kraljevec|184'})
})

describe('native browser discovery',()=>{
  function env(attempts: number|null=1) {
    const quickAction=vi.fn(async()=>Response.json({success:true,result:'<a href="https://content.services.dmtech.com/cjenik.xlsx">Cjenik XLSX</a>'}));
    const first=vi.fn(async()=>attempts===null?null:{attempts});
    const DB={prepare:vi.fn(()=>({bind:()=>({first})}))} as unknown as NonNullable<Parameters<typeof renderDynamicPage>[1]['DB']>;
    return {CHECKER_BROWSER:{quickAction},CHECKER_BROWSER_HOSTS:'www.dm.hr,dm.hr,content.services.dmtech.com',DIGITAL_PRICE_LIST_DNS_RESOLVER:resolver,DB};
  }
  it('uses the verified dm price page with exact host restrictions and quota',async()=>{
    const e=env();
    const r=await renderDynamicPage(new URL('https://www.dm.hr/'),e);
    expect(r?.url.href).toContain('/novo/promocije/');
    expect(r?.html).toContain('.xlsx');
    const args=e.CHECKER_BROWSER.quickAction.mock.calls as unknown as Array<[string,{allowRequestPattern:string[]}]>;
    expect(args[0][0]).toBe('content');
    const allow=args[0][1].allowRequestPattern.map(p=>new RegExp(p));
    expect(allow.some(p=>p.test('https://www.dm.hr/cjenik'))).toBe(true);
    expect(allow.some(p=>p.test('https://www.dm.hr.evil.example/'))).toBe(false);
    expect(allow.some(p=>p.test('http://127.0.0.1/'))).toBe(false);
  });
  it('does not render an unlisted host or after quota exhaustion',async()=>{
    const e=env(null);
    expect(await renderDynamicPage(new URL('https://example.hr/'),e)).toBeNull();
    expect(e.DB.prepare).not.toHaveBeenCalled();
    expect(await renderDynamicPage(new URL('https://www.dm.hr/'),e)).toBeNull();
    expect(e.CHECKER_BROWSER.quickAction).not.toHaveBeenCalled();
  });
});
