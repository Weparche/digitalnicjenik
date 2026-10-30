# Provjereni prikazi

Snimljeno lokalno 30. 10. 2026. Svi računi, iznosi i cjenici na ovim prikazima demonstracijski su podaci. Browser testovi koriste mockani API; serverski tokovi zasebno su provjereni integracijskim testovima nad lokalnim D1 runtimeom.

- [Web Link — desktop](user-desktop.png)
- [Web Link — mobitel](user-mobile.png)
- [Publisher editor](publisher-editor.png)
- [Admin — desktop](admin-desktop.png)
- [Admin — mobitel](admin-mobile.png)
- [Prva objava bez vlastitog cjenika](first-publication.png)
- [Upute i HOK izvor — desktop](instructions-desktop.png)
- [Upute — mobitel](instructions-mobile.png)
- [Paketi i cijene — desktop](packages-desktop.png)
- [Paketi i cijene — mobitel](packages-mobile.png)
- [Prva objava potvrđena — mobitel](first-published-mobile.png)
- [Prijava uplate čeka potvrdu — mobitel](payment-reported-mobile.png)
- [Prijava u NEPAR](login.png)
- [Hero — desktop](landing-desktop.png)
- [Hero — mobitel](landing-mobile.png)

Provjere: typecheck; build s prerenderom i provjerom SEO artefakata; 355 unit/integration testova u 58 datoteka; 41 Playwright test te ponovljena provjera pet admin scenarija nakon dopune pretrage/filtera. Impeccable detector nema nalaza na promijenjenim UI površinama.

Dopuna uputa/cijena: app typecheck i build/prerender prolaze; ponovno je prošlo 13 ciljanih browser scenarija za workspace i naplatu. Novi prikazi pregledani su na 390, 768 i 1440px.

Završna provjera: 355 unit/integration testova, 47 browser scenarija i 23 završna ciljana browser scenarija prolaze. Prikazi nakon prve objave, prijavljene uplate i prijave koriste demonstracijske podatke, uključujući ilustrativne buduće rokove.
