# Evidencija baznih cijena – vlastite NEPAR stranice

Pravilnik NN 132/2026-1583, čl. 3 i 6, te NN 132/2026-1584, čl. 3. Bazna cijena nije isto što i prethodna najniža cijena tijekom 30 dana. Ne izvoditi baznu cijenu iz postotka popusta. Za usluge uvedene nakon 10.9. koristiti dokumentiranu cijenu prvog uvrštenja uz primjenjiva pravila o akcijama.

## Digitalni cjenik
Izvor: Weparche/nepar, src/cjenikData.js, postojeća dokumentirana evidencija datuma prvih objava. Web Link 19,90 (26.10.), Publisher 49,90 (21.9.), Web + Publisher 79,90 (26.10.), ugradnja 29,90 (27.10.). Trenutačno je WEB_LINK_LAUNCH_ONLY=true: javno nudimo Web Link i standardnu ugradnju; ne otvarati skrivene pakete ovim zahvatom.

## Ostali projekti
- NEPAR Solutions: postojeća evidencija u src/cjenikData.js; provjeriti povijest i prikaze, ne prepisivati bazne vrijednosti trenutnima.
- KPDinfo: Weparche/Webovi grana KPDinfo, src/pages/paketi.tsx; osam standardnih tarifa identičnih u kodu od 24.5.2026. Akcijski eRačun stručnjak zahtijeva prethodnu redovnu cijenu iz evidencije; precrtani iznos nije sam po sebi dokaz.
- Handyman: src/config/pricing.data.json, arhivski commit 371e2456e360baa1e0fc67f26f386a963ac801ba. Usporediti jednake opsege posla i tadašnje minimalne naknade, ne samo sirove raspone. Nove stavke provjeriti po datumu prvog uvrštenja.
- NEPAR Kids: shared/pricing.ts i shared/holidays.ts, prvi Git zapisi ne dokazuju datum stvarne prve ponude (postojali direktni deployi); razlikovati pakete, redovne cijene, akcije i 30-dnevnu najnižu. Ne objavljivati pretpostavljene bazne cijene.
- GeoAdrese: src/landingContent.ts i api/src/config.ts; provjeriti starije izvore i datume prvih javnih ponuda te B2B opseg.

## Objava
Ne povezivati neobjavljene Publisher URL-ove. Najprije spremiti privatne nacrte, potvrditi cijene, aktivirati licence, objaviti kroz postojeću validaciju i provjeriti javni CSV/XML, zatim povezati stranice. Postojeće javne objave zadržati do potvrđene zamjene.
