import { PLANS, formatEur, installationPriceLabel } from '../../shared/pricing'
import { renderCsv } from '../price-engine/csv'
import { renderXml } from '../price-engine/xml'
import { NEPAR_FORMAT_EXAMPLE } from './formatExample'
import { OFFICIAL_SOURCES, SitePageLayout, SourceList } from './PageLayout'
import { getSitePage } from './registry'

const related = [
  { href: '/digitalni-cjenik/', label: 'Digitalni cjenik: početak' },
  { href: '/digitalni-cjenik-2026/', label: 'Cjeloviti vodič za 2026.' },
  { href: '/sidrena-cijena/', label: 'Što je sidrena cijena' },
  { href: '/cijene/', label: 'Paketi i cijene' },
]

function PublicationPath() {
  return <section className="site-section">
    <h2>Nemate javni CSV ili XML? Krenite od svoje tablice.</h2>
    <p>Učitajte Excel, CSV ili XML, provjerite prepoznate stupce i dopunite podatke koji nedostaju. Pregled je bez registracije. Za objavu potvrdite e-mail i dobijte javni HTML cjenik, CSV, XML i arhivu na istom linku.</p>
    <p><strong>Objava je besplatna 24 sata.</strong> Nakon toga isti link zadržite uz Web Link za {formatEur(PLANS[0].price, true)}. Web Link zamjenjuje cijeli cjenik datotekom; Publisher za {formatEur(PLANS[1].price, true)} dodaje uređivanje stavki i nadzor.</p>
    <a className="app-button app-button-primary" href="/app?new=1">Učitaj Excel, CSV ili XML →</a>
    <p>Poveznicu na cjenik možete sami dodati na postojeći web. Jedna standardna NEPAR ugradnja stoji {installationPriceLabel()}. <a href="/cijene/">Usporedite što uključuju paketi.</a></p>
  </section>
}

export function TopicLinks() {
  return <nav className="topic-link-cluster" aria-label="Odaberite vodič za svoj cjenik">
    <p>Pripremate objavu? Krenite od <a href="/digitalni-cjenik/">digitalnog cjenika</a> i <a href="/digitalni-cjenik-2026/">vodiča za 2026.</a> Za podatke koje trebate pripremiti odaberite <a href="/digitalni-cjenik-za-usluge/">usluge</a>, <a href="/digitalni-cjenik-za-webshop/">webshop</a> ili <a href="/digitalni-cjenik-woocommerce/">WooCommerce</a>. <a href="/sidrena-cijena/">Sidrena cijena</a> ima zasebna pravila od same CSV/XML objave.</p>
  </nav>
}

export function DigitalPricelistPage() {
  return <SitePageLayout page={getSitePage('/digitalni-cjenik/')} lead="Digitalni cjenik je javno dostupna datoteka s cijenama koju računalo može pročitati. Provjerite nalazi li se na vašem webu — bez prijave i bez promjene postojeće stranice." related={related.slice(1)}>
    <section className="site-section"><h2>Što zapravo treba biti objavljeno?</h2>
      <p>Za obuhvaćene trgovce i pružatelje usluga s uspostavljenom mrežnom stranicom Odluka NN 101/2026-1213 predviđa cjenik u CSV ili XML obliku. Obična tablica na stranici, fotografija jelovnika ili PDF ne zamjenjuju strojno čitljivu datoteku.</p>
      <p>Izbor alata nije propisan. Ako vaš poslovni program ili postojeći web već objavljuje valjani cjenik, zadržite taj izvor. NEPAR je opcija za provjeru i objavu, bez obveznog novog weba, plugina ili promjene domene.</p>
    </section>
    <section className="site-section"><h2>Što ćete saznati besplatnom provjerom weba?</h2>
      <p>Provjera traži javni cjenik i povezane CSV/XML datoteke te prikazuje devet tehničkih provjera s dostupnim dokazima. Pristup koji web blokira označava se kao nepotvrđen, a ne kao dokaz da datoteka ne postoji.</p>
      <p>Rezultat nije pravna potvrda: alat ne može znati jesu li povijesne cijene točne niti potvrditi podatke do kojih nije mogao doći. U dashboardu možete vidjeti detalje, ponoviti provjeru ili izričito zatražiti pomoć.</p>
    </section>
    <section className="site-section topic-overview"><h2>Pronađite upute za svoje poslovanje</h2><ul>
      <li><a href="/digitalni-cjenik-za-usluge/">Saloni, servisi i druge usluge</a><p>Priprema naziva usluga, cijena i podataka o posebnoj prodaji iz Excel tablice.</p></li>
      <li><a href="/digitalni-cjenik-za-webshop/">Webshop i proizvodi</a><p>Podaci artikala, dostupnost, dnevna objava i arhiva prethodnih cjenika.</p></li>
      <li><a href="/digitalni-cjenik-woocommerce/">WooCommerce</a><p>Provjera postojećeg izvoza i razlika između jednostavne objave i posebne integracije.</p></li>
      <li><a href="/digitalni-cjenik-2026/">Rokovi i pravila za 2026.</a><p>Pregled obveza, stvarni CSV/XML primjeri i poveznice na službene izvore.</p></li>
    </ul></section>
    <PublicationPath/><SourceList sources={OFFICIAL_SOURCES}/>
  </SitePageLayout>
}

export function AnchorPricePage() {
  return <SitePageLayout page={getSitePage('/sidrena-cijena/')} lead="Sidrena, odnosno dodatna cijena služi usporedbi današnje cijene s propisanom referentnom cijenom. Nije automatski popust ni cijena koju smijete izračunati iz današnje." related={[...related.filter(item => item.href !== '/sidrena-cijena/'), {href:'/vodici/sidrena-cijena/',label:'Detaljne upute za prikaz i održavanje cijena'}]}>
    <section className="site-section"><h2>Na koga se odnosi dodatna cijena?</h2>
      <p>Odluka NN 101/2026-1212 obuhvaća registriranu trgovinu na malo i registrirano pružanje usluga u Hrvatskoj. Uređuje isticanje dodatne cijene uz maloprodajnu cijenu, uključujući propisane oblike oglašavanja. Obveza nije ograničena samo na webshopove.</p>
      <p>CSV/XML objava uređena je drugom Odlukom, 1213, koja se odnosi na obuhvaćene subjekte s uspostavljenim mrežnim stranicama. Zato web bez CSV-a i pogrešno istaknuta dodatna cijena nisu isti problem.</p>
    </section>
    <section className="site-section"><h2>Koju povijesnu cijenu trebate pripremiti?</h2>
      <p>Za većinu proizvoda i usluga polazište je cijena primjenjiva 10. rujna 2026. Za određene kategorije proizvoda koje su već bile obuhvaćene prethodnom mjerom zadržava se referenca na 2. svibnja 2025. Ne primjenjujte jedan datum na sve artikle bez provjere.</p>
      <p>Povijesnu vrijednost preuzmite iz svojih evidencija. Ako je ne znate, alat je ne može pouzdano rekonstruirati. Aktualna i sidrena cijena mogu biti jednake; razlika sama po sebi ne određuje ispravnost.</p>
      <p>Primjer: usluga je na odgovarajući referentni datum stajala 15 €, a danas 17 €. U polje aktualne cijene ide 17 €, a u polje odgovarajuće dodatne cijene 15 €. Ovo je ilustracija odnosa vrijednosti, a ne određivanje referentnog datuma za svaku djelatnost.</p>
    </section>
    <section className="site-section"><h2>Sidrena, dodatna i bazna cijena</h2>
      <p>„Sidrena” je uobičajen naziv za referentnu dodatnu cijenu iz navedenih odluka. Naziv „bazna cijena” pojavljuje se i u zasebnom regulatornom okviru; ne mijenjajte polja ni datume samo zbog sličnog naziva. Za nove pravilnike provjerite konačni objavljeni tekst i početak njegove primjene.</p>
      <p><a href="/vodici/sidrena-cijena/">Detaljni vodič</a> objašnjava odnos prikaza na webu i izvora podataka. <a href="/specifikacija-csv-xml/">Specifikacija</a> pokazuje kako NEPAR prenosi cijene u CSV i XML.</p>
    </section>
    <TopicLinks/><SourceList sources={OFFICIAL_SOURCES}/>
  </SitePageLayout>
}

export function ServicesPricelistPage() {
  return <SitePageLayout page={getSitePage('/digitalni-cjenik-za-usluge/')} lead="Imate salon, servis ili drugi uslužni posao s vlastitim webom? Pripremite cjenik u Excelu, provjerite podatke i objavite datoteku koju posjetitelji i računala mogu otvoriti." related={[...related,{href:'/vodici/excel-csv-digitalni-cjenik/',label:'Excel u CSV/XML: upute korak po korak'}]}>
    <section className="site-section"><h2>Koje podatke pripremiti za svaku uslugu?</h2>
      <p>Pripremite naziv usluge, maloprodajnu cijenu, podatak je li primijenjen poseban oblik prodaje i njegov naziv te odgovarajuću sidrenu cijenu. Svaka usluga ima svoj redak. Proizvodi koje dodatno prodajete traže i podatke proizvoda: nemojte ih označiti kao usluge samo da bi prošli provjeru.</p>
      <p>Nazivi stupaca nisu propisani Odlukom. NEPAR prepoznaje uobičajena zaglavlja i omogućuje mapiranje stupaca. Excel ostaje radna tablica, a javna objava nastaje u CSV/XML formatu.</p>
      <p><a href="/vijesti/hok-excel-predlosci-digitalni-cjenik-2026/">HOK Excel predlošci i objašnjenje</a> dobar su početak. Možete preuzeti i naš <a href="/examples/primjer-digitalni-cjenik-usluge-2026.csv" download>CSV primjer prema HOK predlošku</a>; primjer ne određuje vaše stvarne cijene.</p>
    </section>
    <section className="site-section"><h2>Kada mijenjati objavu?</h2>
      <p>Cjenik čistih usluga ažurira se pri promjeni, najkasnije do 08:00 na dan objave izmjene. Nema potrebe svakodnevno stvarati identičnu objavu usluga. Prethodne objave moraju ostati dostupne u propisanom roku.</p>
      <p>U Web Link paketu promjenu napravite u svojoj tablici i zamijenite cijeli cjenik. Ako želite cijene uređivati izravno u dashboardu i pratiti dostupnost objave, odaberite Publisher. Neispravan novi upload ne zamjenjuje valjanu objavu.</p>
    </section>
    <section className="site-section"><h2>Kako to izgleda na stvarnom webu?</h2><p><a href="/reference/auto-gubic/">Auto Gubić</a> je NEPAR referentna implementacija cjenika usluga s javnim prikazom i datotekama. Poveznica na cjenik može biti dio postojećeg WordPressa, Wixa ili drugog weba.</p></section>
    <PublicationPath/><TopicLinks/><SourceList sources={OFFICIAL_SOURCES}/>
  </SitePageLayout>
}

export function WebshopPricelistPage() {
  return <SitePageLayout page={getSitePage('/digitalni-cjenik-za-webshop/')} lead="Kartice proizvoda u webshopu nisu zamjena za javno dohvatljiv CSV ili XML. Prvo provjerite što vaš sustav već objavljuje, a zatim odaberite izvoz ili objavu koja prati vaše cijene." related={[...related,{href:'/digitalni-cjenik-woocommerce/',label:'Posebno za WooCommerce'}]}>
    <section className="site-section"><h2>Podaci proizvoda traže više od naziva i cijene</h2>
      <p>U pripremi obuhvatite šifru, marku, barkod, dostupnost, maloprodajnu i odgovarajuću sidrenu cijenu, podatke o posebnom obliku prodaje te jedinicu i cijenu po jedinici mjere gdje je primjenjivo. Šifra artikla i barkod imaju različitu svrhu.</p>
      <p>Izvoz za oglašavanje ili marketplace može biti dobar izvor, ali nije automatski dovoljan: provjerite povijesne cijene, posebne oblike prodaje i podatke o objavi. <a href="/specifikacija-csv-xml/">Popis polja i primjeri</a> pomažu pri usporedbi.</p>
    </section>
    <section className="site-section"><h2>Dnevna objava i promjene u izvoru podataka</h2>
      <p>Odluka za proizvode predviđa dnevno ažuriranje do 08:00 tekućeg radnog dana. NEPAR može dnevno objaviti posljednje valjano objavljeno stanje proizvoda prema kalendaru. To ne preuzima nove cijene ili stanje zaliha iz webshopa.</p>
      <p>Kad promijenite cijene u trgovini, promijenjeni podaci moraju doći i u objavljeni cjenik: novim uploadom ili zasebno dogovorenom integracijom. Ako već koristite poslovni sustav koji to radi, provjerite njegov javni izlaz prije kupnje dodatnog alata.</p>
    </section>
    <section className="site-section"><h2>Kada je NEPAR prikladan?</h2>
      <p>Web Link odgovara cjeniku do 5.000 stavki koji možete održavati datotekom. Publisher dodaje ručni editor i nadzor, ali nije sinkronizacija kataloga. Za česte promjene velikog kataloga prvo provjerite izvor podataka, opseg i mogućnost pouzdanog automatiziranog izvoza.</p>
      <p>Stabilne poveznice olakšavaju dohvat aktualne verzije, a datirane objave i arhiva čuvaju prethodna stanja. Za postojeći web dovoljan je javni link ili postojeći NEPAR embed; ne morate seliti trgovinu.</p>
    </section>
    <PublicationPath/><TopicLinks/><SourceList sources={OFFICIAL_SOURCES}/>
  </SitePageLayout>
}

export function WooCommercePricelistPage() {
  return <SitePageLayout page={getSitePage('/digitalni-cjenik-woocommerce/')} lead="Zadržite postojeći WooCommerce i prvo provjerite njegov javni cjenik. Ako datoteka nedostaje, izvoz proizvoda može biti početak — uz dopunu podataka koje standardni katalog ne sadrži." related={[...related,{href:'/vodici/woocommerce-wordpress-digitalni-cjenik/',label:'Usporedba dodatka, izvoza i Publishera'}]}>
    <section className="site-section"><h2>Provjera prije instaliranja još jednog dodatka</h2>
      <p>Unesite adresu trgovine u obrazac na vrhu. Provjera traži javne datoteke i poveznice; ne ulazi u WordPress administraciju i ne traži vaše lozinke. Ako je dohvat blokiran, dobit ćete nepotvrđen rezultat s objašnjenjem.</p>
      <p>WooCommerce stranica s proizvodima i postojeći marketinški feed mogu već sadržavati dio podataka. Provjerite konkretan CSV/XML i obvezna polja prije odluke o novom rješenju.</p>
    </section>
    <section className="site-section"><h2>Od izvoza proizvoda do objave</h2>
      <ol className="news-bullets"><li>Izvezite aktualne podatke iz svojeg postojećeg izvora. Sačuvajte šifre, varijante i barkodove kao tekst.</li><li>Provjerite odgovarajuće sidrene cijene, posebne oblike prodaje, jedinice, marke i dostupnost. Standardni izvoz ne jamči da su svi ti podaci uključeni.</li><li>Učitajte datoteku u NEPAR, mapirajte stupce i pregledajte upozorenja. Ako izvoz ne prolazi uvoz, pripremite ga prema <a href="/specifikacija-csv-xml/">primjeru našeg formata</a>.</li><li>Objavite cjenik pa u WordPress izbornik ili stranicu dodajte link ili gumb na javni URL.</li></ol>
    </section>
    <section className="site-section"><h2>Objava bez plugina, sinkronizacija po dogovoru</h2>
      <p>NEPAR nije WooCommerce plugin niti se sam povezuje s trgovinom. Jedna standardna ugradnja poveznice ili postojećeg embeda stoji {installationPriceLabel()}. Razvoj prilagođenog izvoza, API povezivanje i automatska sinkronizacija zaseban su opseg i ponuda.</p>
      <p>Za trgovinu koja već ima pouzdan automatizirani izvoz može biti bolje zadržati postojeći sustav. Za manji katalog koji održavate datotekom Web Link omogućuje objavu bez razvoja dodatka. <a href="/vodici/woocommerce-wordpress-digitalni-cjenik/">Usporedite pristupe u tehničkom vodiču.</a></p>
    </section>
    <PublicationPath/><TopicLinks/><SourceList sources={OFFICIAL_SOURCES}/>
  </SitePageLayout>
}

export function LaunchGuidePage() {
  return <SitePageLayout page={getSitePage('/digitalni-cjenik-2026/')} lead="Praktičan pregled od pripreme podataka do javne objave. Rok prilagodbe je 17. studenoga 2026.; sadržaj provjerite prema službenim odlukama i važećim izmjenama." related={related.filter(item => item.href !== '/digitalni-cjenik-2026/')}>
    <nav className="topic-toc" aria-label="Sadržaj vodiča"><strong>Što trebate pripremiti</strong><ul>{[['obveza','Na koga se odnosi'],['podaci','Podaci i datoteke'],['rokovi','Ažuriranje i arhiva'],['primjeri','CSV/XML primjeri'],['objava','Objava na webu']].map(([id,label])=><li key={id}><a href={`#${id}`}>{label}</a></li>)}</ul></nav>
    <section className="site-section" id="obveza"><h2>Tko treba objaviti digitalni cjenik?</h2>
      <p>Odluka o objavi cjenika odnosi se na obuhvaćene trgovce i pružatelje usluga koji imaju uspostavljene mrežne stranice. Ne odnosi se samo na online trgovine: relevantan je i poslovni web salona ili servisa.</p>
      <p>Ova Odluka sama po sebi ne zahtijeva da subjekt bez weba izradi novu stranicu. To ne ukida druge obveze isticanja cijena. MIKROeRAČUN, račun i digitalni cjenik također imaju različite uloge. Za posebnu djelatnost ili izuzeće provjerite službeni tekst i nadležno tijelo.</p>
      <p>Produženje roka na 17.11.2026. objavljeno je nakon izvornih rujanskih odluka. <a href="https://narodne-novine.nn.hr/clanci/sluzbeni/2026_09_110_1310.html" target="_blank" rel="noopener noreferrer">Izmjenu odluke</a> čitajte uz izvorni tekst, a nacrt pravilnika nemojte tretirati kao važeći propis.</p>
    </section>
    <section className="site-section" id="podaci"><h2>CSV ili XML: podaci prije formata</h2>
      <p>Dovoljan je CSV ili XML prema pravilima Odluke; oba formata nisu zasebna zakonska obveza. NEPAR nakon objave priprema oba. Excel, PDF i slika mogu pomoći u radu, ali ne zamjenjuju traženu strojno čitljivu objavu.</p>
      <ul className="news-bullets"><li><strong>Usluge:</strong> naziv, maloprodajna cijena, poseban oblik prodaje i njegov naziv te sidrena cijena.</li><li><strong>Proizvodi:</strong> uz cijene pripremite šifru, marku, barkod, dostupnost i podatke o jedinici mjere gdje je primjenjivo.</li><li><strong>Sidrena cijena:</strong> povijesna vrijednost prema odgovarajućem referentnom datumu, ne procjena iz aktualne cijene. <a href="/sidrena-cijena/">Pregled datuma i pojmova.</a></li></ul>
      <p>Odluka propisuje sadržaj, a ne univerzalne nazive stupaca ili XML oznaka. Naziv datoteke obuhvaća oblik objekta, adresu, oznaku objekta, broj pohrane i vremensku oznaku. Konkretan izlaz nastaje iz podataka o vašem objektu. <a href="/specifikacija-csv-xml/">Specifikacija NEPAR formata</a> razlikuje obvezne podatke od naših tehničkih preporuka.</p>
    </section>
    <section className="site-section" id="rokovi"><h2>Ažuriranje do 08:00 i arhiva 30 dana</h2>
      <p>Proizvodi se ažuriraju svakog radnog dana do 08:00. Usluge se ažuriraju pri promjeni, do 08:00 na dan objave izmjene. To su različita pravila; ne trebate svakodnevno duplicirati čisti cjenik usluga.</p>
      <p>Prethodne objave trebaju ostati javno dostupne tijekom propisanih 30 dana. Posebna stranica arhive i stabilni aliasi aktualnih datoteka praktična su pomoć, ali njihov naziv nije univerzalna propisana shema. NEPAR čuva verzije; novu datoteku nemojte ručno prepisivati preko jedine stare kopije.</p>
      <p>Dnevna NEPAR objava koristi posljednje objavljeno valjano stanje proizvoda. Promjene u Excelu, blagajni ili webshopu ne dolaze u sustav same od sebe — objavite ih ili dogovorite integraciju.</p>
    </section>
    <section className="site-section" id="primjeri"><h2>Stvarni primjeri izlaznih datoteka</h2>
      <p>Slijede primjeri za usluge generirani istim rendererima koje koristi aplikacija. Podaci su demonstracijski, a nazivi polja predstavljaju NEPAR format.</p>
      <details><summary>Otvori CSV primjer za usluge</summary><pre className="news-code-sample"><code>{renderCsv(NEPAR_FORMAT_EXAMPLE).replace(/^\uFEFF/,'')}</code></pre></details>
      <details><summary>Otvori XML primjer istih podataka</summary><pre className="news-code-sample"><code>{renderXml(NEPAR_FORMAT_EXAMPLE)}</code></pre></details>
      <p><a href="/examples/nepar-format-primjer-usluge.csv" download>Preuzmi CSV za usluge</a> · <a href="/examples/nepar-format-primjer-usluge.xml" download>Preuzmi XML</a> · <a href="/examples/nepar-format-primjer-proizvodi.csv" download>CSV za proizvode</a></p>
      <figure className="topic-example"><img src="/assets/provjera-cjenika-dashboard.png" alt="NEPAR dashboard provjere weba: polje adrese i objašnjenje devet provjera, prije pokretanja analize" width="1200" height="800" loading="lazy"/><figcaption>Stvarni prikaz alata prije analize. Rezultat vašeg weba nastaje tek nakon pokretanja provjere; prikaz nije dokaz usklađenosti.</figcaption></figure>
    </section>
    <section className="site-section" id="objava"><h2>Od tablice do poveznice na vlastitom webu</h2>
      <p>Učitajte tablicu, provjerite mapiranje i nedostajuće podatke, potvrdite e-mail pa objavite besplatno na 24 sata. Na web dodajte javni link, gumb ili postojeći embed. Web Link zadržava taj isti URL za {formatEur(PLANS[0].price,true)}, bez uređivanja pojedinačnih stavki.</p>
      <p><a href="/reference/auto-gubic/">Pogledajte stvarnu NEPAR implementaciju za Auto Gubić</a> s poveznicama na javni prikaz i feedove. To je primjer izvedbe, a ne jamstvo neprekidne dostupnosti ili pravna potvrda.</p>
      <a className="app-button app-button-primary" href="/app?new=1">Učitaj i provjeri svoju datoteku →</a>
    </section>
    <TopicLinks/><SourceList sources={[...OFFICIAL_SOURCES,{title:'NN 110/2026-1310 — izmjena odluke o objavi cjenika',url:'https://narodne-novine.nn.hr/clanci/sluzbeni/2026_09_110_1310.html'}]}/>
  </SitePageLayout>
}
