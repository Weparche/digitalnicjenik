# Cloudflare / D1 deployment

Binding name: `DB`.

The repository includes the production D1 `database_id` in `wrangler.jsonc` so
`wrangler pages deploy` attaches the existing `DB` binding. Do not create a second
database; reuse `digitalni-cjenik-nepar`.

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
npx wrangler d1 migrations apply digitalni-cjenik-nepar --config wrangler.d1.jsonc --remote
npm run build
npx wrangler pages deploy dist --project-name digitalnicjenik
```

Production Pages project name is `digitalnicjenik` (custom domain `digitalnicjenik.nepar.hr`).
The Wrangler `name` in `wrangler.jsonc` may differ; always pass `--project-name digitalnicjenik`.


The demo write boundary is configured with `DEMO_WRITE_TENANT` (default
`nepar`), its public hostname with `DEMO_PUBLIC_HOSTNAME`, and the default publication timezone with
`DEFAULT_PUBLICATION_TIMEZONE` (default `Europe/Zagreb`).

Write access model:

- Demo tenant (`DEMO_WRITE_TENANT`): anonymous sandbox mutations are allowed only for that
  tenant, with server-side tenant canonicalization, tenant-scoped draft/publish SQL, and a
  dedicated demo write rate-limit bucket. No browser/Vite write secret is used.
- Any other tenant: requires `Authorization: Bearer <OPERATOR_WRITE_KEY>` (Cloudflare secret only).
- Customer `publication_targets` hostnames are not write surfaces (defense-in-depth).

### Hostname roles (demo tenant)

| Hostname | Role | Writes | Public reads (`/cjenik.csv`, publication current) |
|---|---|---|---|
| `digitalnicjenik.nepar.hr` (`DEMO_PUBLIC_HOSTNAME`) | App + primary public hostname | Allowed (demo sandbox) | Yes |
| `digitalnicjenik.pages.dev` | Intentional secondary **public read** alias for the same demo publication | Denied (403) — treated as publication target, not an app write surface | Yes |
| `localhost` / preview hosts **not** in `publication_targets` | Local/app API hosts | Allowed for demo slug | N/A unless mapped |
| Customer custom hostnames in `publication_targets` | Tenant public sites only | Denied (403) | That tenant only |

`digitalnicjenik.pages.dev` is kept in `publication_targets` on purpose so the Pages alias can serve the same current cjenik. It is **not** a write surface.

Configure these Pages secrets before enabling non-demo writes or relying on rate limits:

```text
OPERATOR_WRITE_KEY
DEMO_WRITE_RATE_LIMIT_SECRET   # optional; falls back to LEAD_RATE_LIMIT_SECRET
CHECKER_RATE_LIMIT_SECRET      # optional; falls back to LEAD_RATE_LIMIT_SECRET
```

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
