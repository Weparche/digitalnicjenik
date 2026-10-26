# Digitalni cjenik — NEPAR Publisher

Provjera i objava cjenika proizvoda/usluga u CSV i XML obliku, s privatnom pripremom, probnom objavom, dashboardom, arhivom i periodičnim nadzorom. React/Vite aplikacija i Cloudflare Pages Functions, D1, R2 te zaseban monitor Worker.

**Za ovu verziju prvo pročitajte [ISPRAVCI.md](ISPRAVCI.md): obvezna je migracija 0010 i zasebna objava monitora.**

Lokalni razvoj:

```sh
npm ci
npm run dev
```

Provjere:

```sh
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
```

Playwright prije provjere pokreće produkcijski build. API pozivi u tim testovima su simulirani; stvarne funkcije dodatno provjeravaju Cloudflare integracijski testovi.

- [Ispravci, rezultati i koraci za puštanje](ISPRAVCI.md)
- [Cloudflare konfiguracija i aktivacija](CLOUDFLARE.md)
- [Opseg proizvoda i komercijalna isporuka](PRODUCT.md)

Ne spremati tajne, `.env`, `node_modules` ili `dist` u Git. Prije produkcije potvrditi konfiguraciju i operativni rad u testnom računu. Tehnička provjera nije potvrda svih pravnih obveza poslovnog korisnika.
