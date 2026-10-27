# Sigurna objava i nadzor

Ove izmjene nastavljaju pregled commita `114a733`. Čuvaju postojeći SEO, kampanje i analitiku našeg projekta.

## Uvoz i objava

- `importIssues` na JSON uvozu prihvaća samo provjerene nalaze `IMPORT_ROW_SKIPPED`. Server ih pohranjuje u postojeći `validation_issues_json`.
- PATCH ponovno provjerava podatke, ali zadržava nalaze izgubljenih izvornih redaka. Ispravljenu izvornu datoteku treba ponovno učitati kao novi draft.
- Objava sprema posljednje dopune istog drafta i ponovno provjerava blokade na serveru. Budući referentni datum provjerava se prema vremenskoj zoni objekta.
- XML u oba okruženja koristi isti parser i provjeru sintakse. Podržani su CDATA i XML entiteti; DOCTYPE, deklaracije i nepoznati entiteti su zabranjeni. Neispravni neobvezni brojevi ostaju pogreške.
- Izuzeće jedinične cijene ne dopušta negativnu ili neispravnu unesenu vrijednost. Probne nepromjenjive datoteke također dobivaju `noindex`.

## Monitor

Cron šalje zadatak raspodjele u `digitalnicjenik-monitor`. Jedan zadatak raspodjeljuje najviše deset korisnika i po potrebi šalje nastavak. Provjera korisnika sprema snimku rezultata i arhive u D1, zatim provjerava najviše deset arhivskih verzija po izvršavanju. Svako preusmjeravanje ulazi u budžet od 40 HTTP zahtjeva; duga preusmjeravanja zato ranije stvaraju nastavak. Dohvat pojedine datoteke ograničen je na 5 MB.

`monitor_jobs` sadrži napredak i vremenski ograničeno vlasništvo zadatka. Jedinstveni aktivni zadatak po korisniku i transakcijsko spremanje konačnog rezultata sprječavaju dvostruke rezultate. Promjena aktualne publikacije tijekom provjere označava staru provjeru preskočenom.

Ručno pokretanje vraća HTTP `202` s `{ status: "queued", jobId }`. Autorizirani GET nadzora vraća `job` s napretkom, bez privatnog sadržaja zadatka. Dashboard osvježava stanje svake tri sekunde i ne prikazuje stari zeleni rezultat dok nova provjera traje ili nije uspjela.

Oba reda koriste jednu poruku po izvršavanju. Glavni red ima deset ponavljanja, nakon čega neuspjeli red označava zadatak neuspjelim. `monitor_deliveries` bilježi dostavu po primatelju: ponavljanje ne šalje ponovno uspješno dostavljene poruke. Ako se proces prekine između slanja i potvrde u bazi, dostava ostaje neodređena (`sending`); ne ponavlja se automatski unutar istog zadatka i zahtijeva operativni pregled. Neuspjeh dostave ne pokreće 24-satnu zabranu novog upozorenja.

## Puštanje

1. Napraviti i provjeriti izvoz produkcijske D1 baze; izvoz sadrži privatne podatke i ne smije u Git.
2. Primijeniti aditivne migracije `0010_publication_calendar.sql` i `0011_monitor_jobs.sql` prije novog koda.
3. Kreirati redove `digitalnicjenik-monitor` i `digitalnicjenik-monitor-dlq`.
4. Objaviti monitor s DB, DRAFTS, EMAIL i MONITOR_QUEUE bindingima. Sačuvati postojeći MONITOR_SECRET. Konfiguracija potrošača i tri dnevna cron termina nalaze se u Workerovu Wrangler configu.
5. Pushati provjerene izmjene na main i provjeriti Pages deployment te javne cjenike, oba formata, arhivu i završetak stvarnog monitor zadatka.

Zadaci i dostave mogu se pratiti kroz `monitor_jobs`, `monitor_deliveries` i Workerove strukturirane logove. Neuspjela provjera ne znači uspješan rezultat. Povratak starog Pages/Worker koda ne zahtijeva uklanjanje aditivnih stupaca i tablica.

## Provjera

`npm run ci` provodi typecheck, sve Vitest testove, produkcijski build i Playwright. `PLAYWRIGHT_PORT` omogućuje izoliran preglednički server bez prekidanja postojećeg lokalnog servera. Vitest pokreće najviše dva workerd okruženja istodobno radi stabilne potrošnje memorije i diska.

Regresijski testovi pokrivaju nepotpuni uvoz nakon spremanja i otvaranja, najnovije dopune pri objavi, CDATA i neispravni XML, vremenske zone, izuzeća cijene, velike arhive, više korisnika, istek vlasništva zadatka, preusmjeravanja, ponovljene poruke, dostavu upozorenja i prikaz napretka na mobitelu i desktopu.
