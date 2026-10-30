# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: React + TypeScript + Vite, kept intentionally small for a Cloudflare-friendly MVP.

## Users

Primary acquisition user: a business owner arriving from Facebook, Instagram or organic search who has a website and wants to check whether a public digital price list can be found. The free checker requires no registration. MIKROeRAČUN users remain an important audience, but that context belongs below the primary checker and in the existing guides.

Qualification (not the main funnel): operators on Marketino, Minimax, Pantheon, or similar should check with their provider before buying Publisher.

## Product Purpose

NEPAR Publisher is a **publishing layer** between the operator’s own price list (Excel/CSV) and their public website: validate data, emit regulatory CSV/XML, expose stable “current” feeds and version history, and support automated fetch — so the operator can link the price list on their site without buying a commercial intermediary stack only for that feature.

Success means a non-technical owner can preview data, publish their own `/c/{slug}` URL free for 24 hours, then keep the same link for 19,90 €/god (bank transfer via HUB-3 2D barcode) or ask NEPAR to install it.

## Positioning

**Category:** MIKROeRAČUN covers e-invoices (under Porezna’s conditions); Publisher covers **public price list publication on the web** (separate regulatory track).

**Acquisition funnel (Web Link MVP, 2026-10-28):** free website check or upload (Excel/CSV/XML) → validation → e-mail confirmation → real public link free for 24 h → “Zadrži ovaj link trajno — 19,90 €/god” → billing details (+29,90 € installation optional) → HUB-3 2D barcode (the order does not extend the free 24 h) → bank transfer → optional “Uplatio sam” report → ops “Potvrdi uplatu” for that exact reference in `/admin` → the same URL active 365 days → Publisher upsell +30 € jednokratno za preostalo plaćeno razdoblje (only within 30 days of activation; afterwards offered at renewal). After upload there is one decision (keep the link), not a three-package comparison. User-facing copy says “Besplatna objava 24 h”, never “probno”/“trial”; `trial` is an internal entitlement status only. No Stripe until manual payment matching becomes the bottleneck.

**Hero message (2026-10-27):** checker-first: “Imate web stranicu? Provjerite digitalni cjenik besplatno.” with the URL checker and trust statements in the first viewport at 390px, 768px and 1440px. The free checker is the primary acquisition hook; a compact line under it adds the positioning (“Objava za bilo koji postojeći web od 19,90 €/god — bez plugina”) and platform pills. Existing-web and no-plugin sections follow below, and Web Link / Publisher are the monetization path after the diagnosis. Platform names (WordPress, WooCommerce, Shopify, Wix, Webflow, custom web) are text only: a plain link or button is the integration. Never claim native integrations, automatic synchronization, certification or “100 % usklađeno”. `/digitalni-cjenik-za-wordpress-webshop/` is the SEO landing for this intent.

**Factual note (Sept 2026):** MIKROeRAČUN primarily enables **receiving** e-invoices today; **issuing** is planned from 1 Jan 2027; upgraded version testing in Oct 2026. Do not overclaim in marketing copy.

**Language:** Prefer “bez **komercijalnog** informacijskog posrednika” over absolute “bez informacijskog posrednika” (legal term of art).

**Do not compete** with Marketino/Minimax/Pantheon in the main narrative — only a small pre-purchase qualification block.

## Operating Context

**Public SEO entry (2026-10-30):** six focused routes cover the general digital price list, the 2026 guide, anchor prices, services, webshops and WooCommerce. Existing guides remain detailed instructions and retain their URLs. Every product/guide/news hero has the shared URL form that opens `/app?new=1&tab=provjera` and runs the explicit submission once. Public checks are attributed as landing checks; they never send mail. Help requests still require submitting Kontakt in the workspace. Public customer price lists, embeds, print views, entitlement access and archive indexing retain their existing rules. Prices and offers retain the locked model.

**Checker workspace (2026-10-30):** submitting the landing URL checker immediately opens the anonymous workspace and runs the check once. Provjera weba is the first user tab; upload and first-publication callbacks still open Moj cjenik. Admin history stores minimal operational summaries, with anonymous identity by default and volunteered contact only through a matching explicit inquiry. Legacy imported records have no invented /9 score.

**Workspace update (2026-10-30):** the hero upload opens `/app?new=1`. Visitors review and correct their file in the workspace without signing up first. `/app` still provides magic-link login for returning users. A signed-in account without a price list gets first-publication onboarding; the current verified owner can publish via an explicit same-origin POST without receiving another verification e-mail. Object type, code and URL get sensible editable defaults; required business identity, address and actual price data are still validated. Admin payment confirmation acts directly on its order reference and activates the public link; manual exceptions are progressively disclosed. No new CRM, billing model or permissions are introduced.

Anonymous users upload into a private draft (≈24 h, R2 + D1 metadata). The free publication requires all blocking validation issues resolved plus business name, e-mail, slug, actual object type/address/code and working calendar; the tenant is created only after magic-link verification. Owners use `/app` to edit, re-upload, and publish while entitlement is live. Expired tenants keep the dashboard (edit/upload). Current public HTML and stable CSV/XML aliases return 410 until renewed. The archive and immutable retained files survive ordinary expiry: the last version for 30 days from publication and previous versions until 30 days from replacement. Suspension blocks public access.

## Capabilities and Constraints

Supports CSV/XML/Excel normalization, private drafts, idempotent provisioning of the free 24 h publication (plan `web_link`, status `trial`), entitlements (`trial` | `active` | `expired` | `suspended`) with always-set `period_end`, bank-transfer orders (`payment_orders`, DB-generated reference `yyyy-number`, one pending order per tenant and kind), public access guard, `noindex` during the free publication, iframe-friendly public pages, magic-link auth, and ops renew driven by the pending order (Web Link: one year from now after the free publication, otherwise `MAX(now, period_end) + 1 year`; Publisher upgrade: same period). Plan permissions come only from `featuresForPlan()` in `shared/entitlements.ts`. Stripe/billing automation, statement matching, CRM, and a WordPress plugin codebase are out of scope for this layer; fulfillment is order → bank transfer → ops “Potvrdi uplatu” → e-mail; the fiscal invoice is issued manually from the order e-mail.

Frame **immutable versioning** and **stable aktualni.csv/xml** as NEPAR’s technical design that helps meet regulatory publication and fetch requirements — not as statutory labels.

## Launch operations (2026-10-29)

- **Effective access** comes from one rule, `entitlementAccess()` / `liveEntitlementSql()` in `shared/entitlements.ts`, used by public HTML/CSV/XML/embed, publish (incl. its atomic SQL guard), daily publication, monitoring, dashboards, admin and SEO/sitemap. States: free publication, active paid period, paid grace, expired (410), suspended.
- **Paid grace:** a confirmed annual payment sets `paid_confirmed_at` and `grace_until = period_end + 7 days`. A pending order, a reported payment or a free/demo/manual activation never grants grace; legacy paid periods are marked by the audited admin action “Potvrdi ranije plaćeno godišnje razdoblje”. Renewal is `MAX(now, period_end) + 365 days`, never from `grace_until`.
- **Admin** uses the normal magic-link session plus `ADMIN_EMAILS`; every `/api/ops/*` endpoint checks it server-side and cookie writes check the origin. The operator key stays a service fallback. Every manual action needs a reason, a confirmation and is written to `admin_audit`; payment confirmation is idempotent per reference.
- **E-mail outbox** (`lifecycle_events` + `lifecycle_deliveries`): the business change and its event are written atomically, sent after commit to the current verified owner, with `Reply-To: nepar@nepar.hr`. Transactional messages (order, reported/confirmed payment, inquiry, monitor incident, failed daily publication) are always sent. Scheduled reminders (free publication expiring/expired, renewal 30/7/1 days, grace start/3 days/deactivation, 24 h payment reminder) are sent only with `LIFECYCLE_EMAILS_ENABLED=true`; a reminder older than 24 h is cancelled, never sent late.
- **Daily publication** (~06:30 Europe/Zagreb, watchdog 07:15) republishes the last valid state, skips pure services and never overwrites a newer manual publication; it runs only with `DAILY_PUBLICATION_ENABLED=true`.
- **Release order:** D1 backup bookmark → migration `0013_launch_operations` → Pages and monitor Worker → payment, access and e-mail smoke checks → only then switch on `DAILY_PUBLICATION_ENABLED` and `LIFECYCLE_EMAILS_ENABLED`.
- **P1 (not in this release):** full checker-history admin, audit UI, advanced filters, six static themes, 90-day checker aggregation/cleanup, richer inquiry workflow, recovery e-mail.

## Brand Commitments

Product name: NEPAR Publisher. Tone is clear, calm, professional, and helpful.

## Evidence on Hand

The fixture at `./marketino-artikli` remains available for the demo tenant only. Automatic provider synchronization remains future work.

## Product Principles

- For self-serve tenants the Publisher draft is the source until they publish; change prices at the source they actually maintain (Excel/CSV or dashboard).
- One normalized list powers every output.
- The customer keeps the same slug/URL from the free publication through paid renewal.
- Demo `/c/nepar` is not a substitute for a customer publication or paid tenant.
- Never invent source data or future integration details.

## Commercial offer

- **Web Link — 19,90 €/god = hosting and publication** (id `link`, entitlement plan `web_link`): permanent public URL, CSV/XML, the public 30-day archive, QR/PDF/embed, replacing the whole price list with a new file (and filling in required fields), up to 5.000 items (`MAX_PRICE_LIST_ITEMS`). No plugin: the customer adds the link to any existing website. Web Link on its own is a complete, correct publication; nothing needed for compliance is locked behind Publisher.
- **Publisher — 49,90 €/god = management and monitoring** (plan `publisher_self_service`): everything in Web Link plus editing single items without Excel, daily monitoring and e-mail alerts. Do not market automatic updating/sync or a detailed change history until they exist.
- **Web + Publisher — 79,90 €/god:** Publisher plus a simple NEPAR web/landing, hosting, SSL, basic editing and technical setup. Complex custom development requires a separate offer.
- **Existing-web help:** separate inquiry to install a link, button or price-list view. No public price; it does not require buying Web + Publisher.
- **Advanced integration:** WooCommerce/webshop/API/ERP/POS connection built for a specific system, individual offer only. No automatic synchronization product exists.

`shared/pricing.ts` is the single commercial source for frontend, pricing page, FAQs, prerendered offers and lead email labels. The old launch offer is inactive. All marketed package amounts are annual. Web Link and Publisher upgrade are ordered in `/app` and paid by bank transfer (HUB-3 2D barcode, payee Nepar, vl. Ivan Gorupić, IBAN HR0623600001103276807); other packages stay offer → payment → ops activation. There is no card checkout or automated billing.

## Anonymous technical check

Nine checks cover homepage availability, HTTPS, price-list discovery, CSV, XML, a public HTML link, supported data structure, archive discovery and supported content validation. The shared score counts `pass` checks and a supported alternative format marked `not_applicable`; warnings, missing signals and unknown checks earn no points. Unknown is not failure. Legacy API colors remain for existing consumers, while the new UI derives its tone from the nine checks.

Reuse the existing safe fetcher and content verification, the price engine's CSV/XML parsers and validator, and the compliance XML feed parser to detect skipped records. A request has a 25-second fetch/DNS budget, bounded candidates and bounded response bodies; CSV/XML probes run concurrently and DNS results are reused within the request. Supported small feeds receive extra analysis without a second download. Oversized, unrecognized, blocked or partially unavailable content remains explicitly unconfirmed. Discovery is not an exhaustive crawl.

Archive discovery does not prove 30 days of history. Content validation cannot prove the historical applicability of an anchor price, the business's complete inventory or legal compliance. The existing file validator is the next step for detail. The checker does not register an account or store uploaded personal information. Lead submission still requires existing consent and anti-bot protection; file attachment remains opt-in.

## Accessibility & Inclusion

The web experience must support semantic structure, visible keyboard focus, file-picker alternatives to drag and drop, accessible status/error announcements, readable contrast, 44px touch targets, and reduced-motion behavior.
