# Ispravci nakon analize digitalnog cjenika

Datum: 27. listopada 2026. Osnova: `c2be6f05247084ac07f707912267f22c3e547402`. Izmjene su pripremljene za pregled i GitHub; produkcijska baza, hosting i dostava e-mailova nisu mijenjani.

## Što se mijenja za korisnika

Nepotpun cjenik ostaje u privatnoj pripremi. Probna objava traži prolaz validatora, potvrdu e-maila te stvarnu vrstu, punu adresu i oznaku objekta. Podaci objekta mogu se naknadno urediti u dashboardu; primjenjuju se objavom nove verzije. Naziv poslovanja više ne zamjenjuje adresu.

CSV i XML su alternativni formati: checker ne kažnjava web koji koristi samo jedan. Provjerava i izravno povezane datoteke na drugoj domeni, uz postojeće zaštite od pristupa privatnim odredištima. Rezultat i prodajni upit koriste isti tehnički zaključak. Nepotvrđeno ostaje jasno odvojeno od potvrđenog.

Proizvodi traže obvezne podatke, uključujući barkod te jedinicu i cijenu po jedinici ili izričito obrazloženje neprimjenjivosti. Referentni datum čuva se po stavci. Novi proizvodi/usluge imaju oznaku i datum prvog uvrštenja. Akcija ima zasebnu prethodnu najnižu cijenu, različitu od sidrene. Podaci se prenose kroz CSV/XML/Excel, validator, spremanje, javni prikaz i nadzor. Povijesne iznose unosi korisnik iz svoje evidencije.

Dashboard omogućuje uređivanje postojećeg cjenika. Objavljuje trenutačno prikazane izmjene i kad su napravljene nakon ranijeg spremanja. Javni linkovi vode na stvarni `/c/{slug}` URL. Proizvodi se mogu objaviti svaki novi dan i uz iste cijene; ista verzija u istom danu ostaje bez duplikata. Objava zahtijeva radnju korisnika ili postojeću integraciju — nadzor sam ne objavljuje cijene.

## Veza s nalazima analize

| Nalazi | Provedena izmjena |
| --- | --- |
| A01, A06, A08, A09 | XML ne preskače neispravne stavke; podržani su priloženi HOK primjeri; nepotvrđena posebna prodaja ostaje nepotvrđena; brojevi se strogo čitaju. Nevaljani opcionalni broj također ne prolazi tiho. |
| A02, A03 | Obvezni podaci objekta i validacija prije trial claim-a i prije objave; interni demo prečac ne vrijedi za korisnika. |
| A04, A15 | Monitor uspoređuje sva polja koja format prenosi, uključujući duplikate, te ponovno provodi validator nad izvorom. |
| A05, A14 | Obuhvaćena je svaka verzija unutar roka od zamjene, i ranije objavljene; dohvaćaju se oba arhivska formata. Običan istek pretplate ne prekida obveznu arhivu ni 30 dana od objave posljednje nepromjenjive datoteke. Aktualni alias može ostati zatvoren; suspenzija blokira javni pristup. |
| A07 | Nedostajuća obvezna polja proizvoda blokiraju; neprimjenjivost jedinične cijene traži razlog. Neispravna GTIN kontrolna znamenka ostaje upozorenje jer nisu svi stvarni barkodovi GTIN. |
| A10, A11 | Siguran dohvat izravnog vanjskog feeda i prihvat CSV-a ili XML-a. Checker i dalje ograničeno pretražuje web. |
| A12, A13 | Profil slijedi stvarne vrste stavki; model čuva datum reference i prvog uvrštenja. Korisnik potvrđuje koji referentni režim vrijedi. |
| A16, A17 | Neuspjela dostava ne zaključava sljedeći pokušaj na 24 sata; kalendar radnih/neradnih dana, dnevna objava istog sadržaja i dodatna cron provjera nakon 08:00. |
| A18 | Paketi ostaju ručna komercijalna isporuka prema ponudi i uplati; nema nove automatizirane naplate ni zasebnih prava za svaki marketinški paket. To je navedeno u uvjetima i postojećem PRODUCT.md. |
| A19 | Unos, čuvanje i prikaz prethodne najniže cijene odvojeni su od sidrene; opći tijek akcije traži taj podatak. Posebna zakonska izuzeća traže pregled izvan ovog tijeka. |

Dodane su stranice privatnosti i uvjeta, poveznice uz obrasce te periodično uklanjanje isteklih privatnih nacrta. Monitor za automatske probne račune koristi javni platformni URL, a za zasebno konfiguriranu domenu njezine korijenske datoteke.

## Obvezno pri puštanju

1. Napraviti sigurnosnu kopiju produkcijske D1 baze i pregledati izmjene.
2. Primijeniti migracije, uključujući **`0010_publication_calendar.sql`**, prije pokretanja novog Pages koda. Novi upiti koriste dodane stupce.

   ```sh
   npx wrangler d1 migrations apply digitalni-cjenik-nepar --config wrangler.d1.jsonc --remote
   ```

3. Objaviti Pages aplikaciju uobičajenim postupkom repozitorija. Samo upload izvora na GitHub nije migracija baze.
4. **Zasebno objaviti monitor Worker** iz `workers/monitor` (`npx wrangler deploy`). Provjeriti njegov DB i novi **DRAFTS R2 binding**, postojeće EMAIL/MONITOR_SECRET postavke te tri cron termina: `30 4 * * *`, `30 5 * * *`, `5 7 * * *` UTC. Zadnji prolaz je poslije lokalnog roka u zimskom i ljetnom vremenu.
5. U dashboardu provjeriti stvarne adrese i oznake postojećih korisnika; stari netočni podaci ne mogu se automatski rekonstruirati. Za proizvode provjeriti radne dane, neradne datume i referentne datume te objaviti novu verziju.
6. Izvan prijavljene sesije provjeriti `/c/{slug}`, CSV/XML, nepromjenjivu datoteku i arhivu; u dashboardu pokrenuti „Provjeri sada” te provjeriti stvarnu dostavu e-maila u testnom računu.

Svi potrebni arhivi se provjeravaju, pa broj HTTP podzahtjeva raste s brojem verzija. Za produkciju provjerite ograničenja Worker plana i količinu objava (dvije datoteke po verziji); besplatni limit nije dovoljan za proizvoljno veliku arhivu. Čišćenje nacrta uklanja do 100 isteklih zapisa po prolazu; kod većeg prometa prilagodite učestalost i pratite zaostatak.

## Provjera

Izvršeni su `npm run typecheck` (aplikacija, Functions, shared i monitor), Vitest: **231 test u 41 datoteci**, te Playwright: **18 prolaznih testova u Chromiumu** uz uspješan produkcijski build. Backend testovi koriste lokalni Cloudflare D1 runtime, simulirani HTTP, R2 i e-mail. Testovi u pregledniku koriste simulirane API odgovore. Ne potvrđuju produkcijski DNS, tajne, cron, dostavu e-mailova ni stvarno ugovaranje. Build ima upozorenje o većem JavaScript paketu (>500 kB), bez greške izgradnje.

Ponovljiva provjera uz instaliran Node i ovisnosti:

```sh
npm ci
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
```

## Pravna osnova i granice

Odluka propisuje CSV ili XML, podatke, imenovanje, dostupnost, ažuriranje i čuvanje; ne određuje jedan univerzalni naziv XML elementa ili CSV stupca. NEPAR ima dokumentiran vlastiti format i podržane uvozne predloške. Proširenja za povijest cijena dokumentirana su u specifikaciji. Ne tvrditi da postoji službeni univerzalni NEPAR schema certifikat.

Izvori korišteni pri pregledu: [objava cjenika, NN 101/2026-1213](https://narodne-novine.nn.hr/clanci/sluzbeni/2026_09_101_1213.html), [dodatna cijena, NN 101/2026-1212](https://narodne-novine.nn.hr/clanci/sluzbeni/2026_09_101_1212.html), [odgoda objave na 17. studenoga 2026.](https://narodne-novine.nn.hr/clanci/sluzbeni/full/2026_09_110_1310.html), [odgoda dodatne cijene](https://narodne-novine.nn.hr/clanci/sluzbeni/2026_09_110_1309.html) i [pojašnjenja Ministarstva](https://mingo.gov.hr/UserDocsImages/slike/MINGO_Poja%C5%A1njenja_dodatna%20cijena_objava%20cjenika.pdf). Raniji datum u naslovu PDF-a treba čitati zajedno s naknadnom odgodom. Prijedlog budućeg pravilnika nije ugrađen kao usvojeno pravilo.

Ovo su tehnički ispravci, ne potvrda svih zakonskih obveza. Sustav ne može znati je li popis robe/usluga potpun, jesu li povijesne cijene istinite ili jesu li svi prodajni kanali pravilno povezani. Specijalizirani sektori, posebne vrste sniženja i izuzeća zahtijevaju dodatni pregled. Vlasnik treba prije produkcije potvrditi sadržaj uvjeta/privatnosti, identitet pružatelja, porezni tretman, rokove i stvarne ugovore s pružateljima obrade. Više poslovnica i automatizirana naplata nisu ovim dodani.
