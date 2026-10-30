# SEO i hero provjera — 30.10.2026.

## Isporučeno

- Šest prerenderiranih stranica: `/digitalni-cjenik/`, `/sidrena-cijena/`, `/digitalni-cjenik-2026/`, `/digitalni-cjenik-za-usluge/`, `/digitalni-cjenik-za-webshop/`, `/digitalni-cjenik-woocommerce/`.
- Zajednički URL obrazac na početnoj, informativnim/prodajnim stranicama, vodičima i vijestima. Izričiti submit otvara dashboard i pokreće jednu provjeru. Ne mijenja privatne radne prostore, javne korisničke cjenike, embed ili print.
- Kompaktna javna navigacija i hero obrazac vidljiv na 390, 768 i 1440 px. Postojeći detaljni vodiči zadržavaju URL-ove i dobivaju kontekstualne poveznice.
- Novi naslov početne, čisti canonicali, čišćenje poznatog `paket` konteksta nakon preuzimanja, očuvanje odabranog paketa i dopuštenog konteksta upita.
- Organization logo/kontakt, Article za vodiče, BreadcrumbList, postojeći SoftwareApplication i ponude iz centralnog cjenika. Bez izmišljenih ocjena, recenzija ili `sameAs` veza.
- Nove stranice u sitemapu i llms.txt, datum stvarne izmjene početne i proširena build provjera. Aktualni plaćeni korisnički cjenici zadržavaju postojeće indeksiranje i grace pravila.
- Vodič koristi stvarni prikaz praznog dashboarda i CSV/XML iz istih renderera kao aplikacija. ImageGen nije potreban za ovu isporuku.
- U povezanom repozitoriju `C:/Nepar` aktualni Web + Publisher iznos usklađen je na 99 €, a marketinške cijene izvedene su iz tamošnjeg centralnog cjenika. Publikacija 4 arhivirana je prije promjene, nova publikacija nosi broj 5. Povijesna sidrena cijena 79,90 € ostaje nepromijenjena.

## Ključne datoteke

`src/WebsiteCheckEntry.tsx` i pripadajući CSS definiraju zajednički ulaz. `src/pages/TopicPages.tsx` i registar definiraju sadržaj. Postojeći layouti i početna koriste obrazac; `scripts/prerender.mjs`, `scripts/verify-dist.mjs` i SEO katalog pokrivaju statičku isporuku. `e2e/seo-entry.spec.ts` provjerava SSR, canonicale, hero, predaju u dashboard i odabir paketa.

## Provjere

- Digitalni cjenik: puni typecheck, 60 unit/integracijskih datoteka / 367 testova, build sa SEO provjerom, svih 60 Playwright testova prolazi.
- NEPAR: typecheck, lint, build sa statičkom provjerom, svih 18 testova cjenika/arhive na tri viewporta prolazi. Usput je ispravljena uska JSDoc tipizacija postojećih animacijskih prijelaza radi typechecka, bez promjene ponašanja.
- Renderi novih stranica pregledani su na desktopu i mobitelu; automatska provjera pokriva i tablet, širinu dokumenta i položaj primarne radnje.

## Puštanje i granice

Nema novih migracija, bindinga, tajni ni konfiguracije. Push na `main` pokreće postojeće Cloudflare Pages isporuke oba repozitorija. Nakon deploya provjeriti javni HTML šest ruta, canonical parametrizirane početne, sitemap, dostupnost slike i aktualnu cijenu na nepar.hr.

Obična provjera ne šalje mail. Kontakt i rezultat ostaju u dashboardu, a slanje upita zahtijeva izričiti submit postojećeg obrasca. Slanje upita, outreach za vanjske poveznice i ručne Search Console radnje nisu izvršeni ovom isporukom. Promjene ne obećavaju određenu poziciju na Googleu.
