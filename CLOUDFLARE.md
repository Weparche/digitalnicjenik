# Cloudflare / D1 deployment

Binding name: `DB`.

The repository intentionally omits `database_id` from `wrangler.jsonc`. Pages production uses a dashboard D1 binding named `DB`; no production ID is committed here.

## Local

```powershell
npm install
npx wrangler d1 migrations apply digitalni-cjenik-nepar --config wrangler.d1.jsonc --local
npm run build
npx wrangler pages dev dist --d1 DB=digitalni-cjenik-nepar
```

`pages dev` uses the local D1 database and Pages Functions. The first request for `/api/tenants/nepar` bootstraps the untouched root `marketino-artikli` fixture into D1.

## Production

```powershell
npx wrangler d1 create digitalni-cjenik-nepar
npx wrangler d1 migrations apply digitalni-cjenik-nepar --config wrangler.d1.jsonc --remote
npm run build
npx wrangler pages deploy dist --project-name digitalni-cjenik-nepar
```

Before deploy, connect the created D1 database to the Pages project with binding name `DB`. Apply migrations with the commands above (`--local` for local work, `--remote` for production). Production database IDs and Pages project IDs are intentionally not committed here; adding a name-only D1 binding to `wrangler.jsonc` makes the Pages configuration validator reject the deployment.

The demo write boundary is configured with `DEMO_WRITE_TENANT` (default
`nepar`), its public hostname with `DEMO_PUBLIC_HOSTNAME`, and the default publication timezone with
`DEFAULT_PUBLICATION_TIMEZONE` (default `Europe/Zagreb`). Production customer
writes remain blocked until authentication/operator authorization is added.

Configure `digitalnicjenik.nepar.hr` and customer custom hostnames in Pages DNS,
then create matching active rows in `publication_targets`. Seed production
tenant metadata and active `entitlements` separately; do not hardcode those
values in the repository.

## Lead forma i Email Sending

Nova ruta `POST /api/leads/digitalni-cjenik` koristi D1 binding `DB`, Turnstile
Siteverify i Cloudflare Email Sending REST API. Prije javnog uključivanja forme u
Pages production/preview konfiguraciji postavite:

```text
CF_ACCOUNT_ID
CF_EMAIL_API_TOKEN          secret
EMAIL_FROM                  publisher@nepar.hr
EMAIL_TO                    nepar@nepar.hr
TURNSTILE_SECRET_KEY        secret
LEAD_RATE_LIMIT_SECRET      secret
VITE_TURNSTILE_SITE_KEY     build variable
```

Domenu `nepar.hr` prvo onboardajte za Email Sending i verificirajte odredište
`nepar@nepar.hr`. `CF_EMAIL_API_TOKEN`, `TURNSTILE_SECRET_KEY` i
`LEAD_RATE_LIMIT_SECRET` nikad se ne spremaju u repozitorij. Nakon migracije
`0004_lead_rate_limit.sql` napravite production integration test s privitkom;
REST API ima ukupni limit poruke od 5 MiB pa posebno provjerite graničnu
datoteku prije javnog lansiranja.

Turnstile widget mora imati hostname `digitalnicjenik.nepar.hr` i action
`turnstile-spin-v2`. Backend prihvaća poruku tek kada Siteverify vrati
`success: true` za isti action/hostname. D1 zapisuje samo HMAC hash IP-a, status
pokušaja i vrijeme; ime, e-mail, poruka i datoteka ostaju izvan baze i logova.

Buduća automatska sinkronizacija s providerom zahtijevat će zasebne vjerodajnice.
