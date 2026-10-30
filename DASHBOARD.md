# Dashboard i jednostavniji tok objave

Isporuka koda: 30. listopada 2026. Produkcijski prolaz sa stvarnim e-mailovima provjerava se nakon objave.

## Korisnik

- Novi zajednički radni prostor za korisnika i administratora. Navigacija, tipografija, kontrole i stanja odvojeni su od marketinškog landinga.
- Web Link počinje pregledom aktualnog cjenika i gumbom **Zamijeni cjenik**. Publisher otvara postojeći editor, uz spremanje nacrta i objavu.
- Ugradnja, QR, arhiva, podaci objekta i naplata ostaju dostupni u svojim pogledima. Nadzor je dostupan uz odgovarajući paket.
- **Upute** su odmah ispod **Moj cjenik**. **Paketi i cijene** objedinjuju pregled godišnjih paketa, dodatnih usluga i postojeće naplate. Oba prikaza dostupna su i pri pripremi prve objave, bez gubitka učitane datoteke.
- Nova priprema jasno ističe besplatnu objavu na 24 h i Web Link od 19,90 € za godinu dana, bez automatske naplate. Plaćeni korisnik ne dobiva poruku o besplatnom početku.
- Upute vode na službenu HOK stranicu s Excel predlošcima proizvoda i usluga. Popunjena tablica i CSV preuzimanja zasebno su označeni kao NEPAR primjeri; ne predstavljaju se kao službeni HOK predložak.
- Hero **Učitaj cjenik** otvara `/app?new=1`. Jedan odabir datoteke prihvaća CSV, XML i Excel; Excel zadržava postojeće mapiranje stupaca.
- **Provjeri besplatno** s landinga odmah otvara prvi dashboard tab **Provjera weba** i prenosi adresu. Checker je dostupan bez registracije. Admin povijest i uvoz prethodnih zapisa opisani su u [CHECKER_HISTORY.md](CHECKER_HISTORY.md).
- Poruka „Nema aktivnog tenanta” zamijenjena je funkcionalnom pripremom prve objave. Administrator bez vlastitog cjenika vidi jasan ulaz u administraciju.
- Za novog posjetitelja potvrda e-maila ostaje dio prve objave. Već verificiran korisnik objavljuje izravno, bez drugog potvrdnog e-maila. Serverski se provjerava identitet, verificirana adresa, origin i ispravnost nacrta.
- Prijava i prijavni e-mail koriste naziv NEPAR za sve pakete. Povratak iz prijave čuva kontekst narudžbe.
- Nakon prve objave oba puta (`created` i e-mail `welcome`) pokazuju potvrdu, stvarni kraj besplatne objave i gumb za kopiranje javnog URL-a.
- Prijava uplate odmah osvježava podatke. „Moj cjenik” pokazuje da uplata čeka potvrdu i uklanja ponovljeni poziv na plaćanje. Admin potvrda osvježava aktivni paket i rok. Odabrani cjenik ostaje povezan s narudžbom i kada vlasnik ima više cjenika.
- Nadogradnja +30 € označena je kao jednokratna razlika za preostalo plaćeno razdoblje, uz očuvanje kraja razdoblja.

## Administrator

- Pregled prikazuje uplate za obradu, s iznosom, referencom i jednim gumbom **Potvrdi uplatu**.
- Potvrda odmah aktivira/produljuje paket iz narudžbe i vraća poveznicu na isti javni cjenik. Ne traži odabir paketa ili zasebnu ručnu aktivaciju.
- Ručne promjene trajanja, plana i suspenzije nalaze se pod naprednim radnjama. Postojeće potvrde, autorizacija, audit i idempotentnost ostaju.
- Polling radi samo kada je tab vidljiv i čuva pretragu, obrasce i filtere. Korisnički dashboard također osvježava stanje pretplate, bez brisanja nespremljenih izmjena u editoru.
- **Uplatio sam** ostaje prijava korisnika; aktivaciju pokreće administratorova potvrda bankovne uplate.

## Ključne datoteke

- `src/WorkspaceShell.tsx`, `src/workspace.css`: zajednički izgled i navigacija.
- `src/PublisherWorkspace.tsx`, `src/App.tsx`, `src/PublicationOverview.tsx`: korisnički tok i rad s cjenikom.
- `src/WorkspaceResources.tsx`: kratke upute, izvor HOK predložaka, pregled primjera i paketi iz zajedničkog cjenika.
- `src/AdminPanel.tsx`, `src/operations.css`: prioriteti, potvrda uplata i detalji.
- `src/AcquisitionLanding.tsx`, `src/productFaq.ts`, `scripts/prerender.mjs`: kraći landing i usklađen FAQ u strukturiranim podacima.
- `functions/_trial.ts`, `functions/api/trials/start.ts`: prva objava iz postojeće verificirane sesije.
- `functions/api/orders.ts`, `functions/api/publisher/upgrade.ts`: odabir odgovarajućeg vlastitog cjenika pri radu s više cjenika.
- `functions/workspace-onboarding.integration.test.ts`, `e2e/workspace.spec.ts`: nove provjere toka i ovlasti.

## Provjere i prikazi

Typecheck i build s prerenderom i SEO provjerom prolaze. Prošlo je svih **355 unit/integration testova** u 58 datoteka i **41 browser test**. Pet admin scenarija ponovno je prošlo nakon dopune provjere pretrage/filtera. Browser scenariji obuhvaćaju 390, 768 i 1440px, početnu objavu bez tenanta, direktan hero prijelaz, nespremljene izmjene, potvrdu narudžbe, ručne iznimke i vidljivi polling. Impeccable detector za promijenjene UI datoteke nema nalaza.

Nakon dopune uputa i cijena ponovno prolaze app typecheck, build/prerender i **13 ciljanih browser testova** (`workspace` i `web-link-order`). Nove provjere obuhvaćaju redoslijed navigacije, službeni HOK izvor, sve cijene, besplatnu ponudu samo u odgovarajućem stanju te očuvanje učitane datoteke i nespremljenih izmjena. Novi prikazi vizualno su provjereni na 390, 768 i 1440px, bez vodoravnog prelijevanja stranice.

Završna provjera: puni typecheck, build/prerender, **355 unit/integration testova** i **47 browser testova** prolaze. Nakon posljednje korekcije mobilne obavijesti i odabira cjenika prošla su još **23 ciljana browser scenarija**, uključujući novi test naručivanja za drugi vlastiti cjenik. Prijava, kopiranje nakon prve objave i prijava uplate provjereni su i vizualno. Produkcijska isporuka e-mailova ovim lokalnim testovima nije potvrđena.

Prikazi su u [artifacts/dashboard](artifacts/dashboard/README.md): [korisnik](artifacts/dashboard/user-desktop.png), [Publisher](artifacts/dashboard/publisher-editor.png), [admin](artifacts/dashboard/admin-desktop.png) i [mobilni prikaz](artifacts/dashboard/user-mobile.png). Koriste lokalne demonstracijske podatke, bez produkcijskih korisničkih podataka.

## Puštanje

Osnovna UX dorada nije dodala binding ili novu varijablu. Dopuna checker povijesti dodaje migraciju `0014_checker_history.sql`, koja je primijenjena na produkcijski D1. Potrebni su postojeći D1/R2, magic-link konfiguracija i `ADMIN_EMAILS`. Za objavu treba isporučiti ažurirane Pages izvore i build; monitor Worker nije mijenjan. Produkcijska provjera e-mail transporta ostaje zaseban smoke test.

Prethodno dogovoreni P1 ostaje: 90-dnevna checker agregacija/čišćenje, napredna audit administracija, šest statičkih tema i bogatiji tijek obrade upita.
