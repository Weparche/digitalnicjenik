# Provjera weba u dashboardu i operativna povijest

Isporuka: 30. listopada 2026.

- Landing nakon unosa adrese otvara `/app?new=1&tab=provjera` i automatski pokreće jedan checker zahtjev. Registracija nije potrebna. Adresa se ne mora ponovno unositi; privremeni parametri uklanjaju se iz URL-a.
- **Provjera weba** je prvi tab korisničkog dashboarda. Rezultat, devet pojedinačnih provjera i detaljna CSV/XML analiza koriste isti postojeći checker. Otvaranje uputa i povratak ne pokreću novu provjeru niti gube rezultat.
- Upload, potvrda prve objave i izričito odabrani editor i dalje otvaraju **Moj cjenik**. Ulaz u dashboard bez odabranog taba otvara provjeru weba.
- Admin **Provjere** prikazuje domenu, vrijeme, rezultat, devet statusa, pronađene javne poveznice, izvor i dobrovoljno povezani kontakt. Dostupni su pretraga domene, rezultat, datumi prema Europe/Zagreb i straničenje po 50.
- Polling radi svakih 30 sekundi dok je prikaz aktivan i tab vidljiv. Filteri i otvoreni detalji ostaju sačuvani. Povratak na browser tab i ručni refresh osvježavaju podatke.
- Anonimni posjetitelj nema izmišljeni identitet. Kontakt iz povezanog upita posebno je označen kao neverificiran. Veza se sprema samo za točan zapis i podudarni URL, nakon dobrovoljnog slanja upita.
- Novi zapisi ne spremaju preuzete HTML/CSV/XML sadržaje ni IP adresu. URL-ovi u evidenciji uklanjaju korisničke podatke, query i fragment. Postojeći sigurni dohvat i rate limit ostaju aktivni. Checker ne šalje operativne e-mailove.

## Baza i prethodni zapisi

Migracija `0014_checker_history.sql` dodaje `checker_runs` i indekse. Primijenjena je na produkcijski D1 nakon bilježenja Time Travel točke povrata. Zapis migracije nalazi se u `d1_migrations`; lokalna točka povrata čuva se izvan gita u `.tmp-review/checker-pre-migration.json`.

Iz dostupnog KV zapisa `checks:recent` starog NEPAR servisa uvezeno je **48 zapisa** za ovaj proizvod. Uvoz ima deterministične ključeve i može se ponoviti bez duplikata. Stari servis čuvao je samo domenu, vrijeme i opći status. Zato ti zapisi imaju `source=legacy`, `score=NULL`, bez naknadno izmišljenih devet rezultata i bez povezanih identiteta. Broj označava dostupne prethodne zapise, ne rekonstruiranu cjelokupnu povijest izvan starog loga.

## Provjere

Prolaze puni typecheck, build/prerender, **362 unit/integration testa** u 59 datoteka i **51 browser test**. Novi testovi obuhvaćaju spremanje stvarnog checker rezultata, privatnost, admin ovlasti, `no-store`, lokalne datume kroz promjenu sata, straničenje, dobrovoljno povezivanje upita, nekvarenje checkera pri grešci pohrane te stare zapise bez rezultata /9.

Browser provjere obuhvaćaju izravan landing → dashboard prijelaz bez registracije, samo jedno automatsko pokretanje, očuvanje rezultata, izvor sljedeće ručne provjere i admin filtre pri polling osvježavanju. Prikazi za pregled koriste demonstracijske podatke, ne produkcijske domene korisnika.

P1 ostaje 90-dnevna agregacija/čišćenje; ne uvodi se CRM ni praćenje identiteta anonimnih posjetitelja.
