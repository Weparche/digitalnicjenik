# Cloudflare / D1 deployment

Binding name: `DB`.

The repository intentionally omits `database_id` from `wrangler.jsonc`. Create the database in the target Cloudflare account and add the returned ID to the deployment configuration or dashboard binding; no production ID is committed here.

## Local

```powershell
npm install
npx wrangler d1 migrations apply digitalni-cjenik-nepar --local
npm run build
npx wrangler pages dev dist
```

`pages dev` uses the local D1 database and Pages Functions. The first request for `/api/tenants/nepar` bootstraps the untouched root `marketino-artikli` fixture into D1.

## Production

```powershell
npx wrangler d1 create digitalni-cjenik-nepar
npx wrangler d1 migrations apply digitalni-cjenik-nepar --remote
npm run build
npx wrangler pages deploy dist --project-name digitalni-cjenik-nepar
```

Before deploy, connect the `DB` binding to the created D1 database in the Pages project or add its `database_id` in deployment configuration. Apply migrations with the commands above (`--local` for local work, `--remote` for production). Production database IDs and Pages project IDs are intentionally not committed here.

The demo write boundary is configured with `DEMO_WRITE_TENANT` (default
`nepar`), its public hostname with `DEMO_PUBLIC_HOSTNAME`, and the default publication timezone with
`DEFAULT_PUBLICATION_TIMEZONE` (default `Europe/Zagreb`). Production customer
writes remain blocked until authentication/operator authorization is added.

Configure `digitalnicjenik.nepar.hr` and customer custom hostnames in Pages DNS,
then create matching active rows in `publication_targets`. Seed production
tenant metadata and active `entitlements` separately; do not hardcode those
values in the repository.

No secrets are required for this demo; the real Marketino API and webhook verification will need credentials in Phase 2.
