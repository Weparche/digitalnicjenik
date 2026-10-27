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

Success means a non-technical owner can preview data, start a 7-day trial on their own `/c/{slug}` URL, then continue self-serve or ask NEPAR to install the link.

## Positioning

**Category:** MIKROeRAČUN covers e-invoices (under Porezna’s conditions); Publisher covers **public price list publication on the web** (separate regulatory track).

**Acquisition funnel:** AD / organic visitor → “Objavi svoj cjenik” (validator → 7-day trial) or free website check → Web Link / Publisher / Web + Publisher → installation help or individual integration offer when needed. Upload is also directly available as the secondary path. The existing 7-day public trial remains available after validation.

**Hero message (2026-10-27):** “Već imate web? Ne trebate novi. Digitalni cjenik za bilo koji postojeći web — od 19,90 €/god.” Primary CTA “Objavi svoj cjenik” opens the validator; secondary “Provjeri postojeći cjenik besplatno” scrolls to the checker. Platform names (WordPress, WooCommerce, Shopify, Wix, Webflow, custom web) are text only: a plain link or button is the integration. Never claim native integrations, automatic synchronization, certification or “100 % usklađeno”. `/digitalni-cjenik-za-wordpress-webshop/` is the SEO landing for this intent.

**Factual note (Sept 2026):** MIKROeRAČUN primarily enables **receiving** e-invoices today; **issuing** is planned from 1 Jan 2027; upgraded version testing in Oct 2026. Do not overclaim in marketing copy.

**Language:** Prefer “bez **komercijalnog** informacijskog posrednika” over absolute “bez informacijskog posrednika” (legal term of art).

**Do not compete** with Marketino/Minimax/Pantheon in the main narrative — only a small pre-purchase qualification block.

## Operating Context

Anonymous users upload into a private draft (≈24 h, R2 + D1 metadata). Publishing a trial requires all blocking validation issues resolved plus business name, e-mail, slug, actual object type/address/code and working calendar; the tenant is created only after magic-link verification. Owners use `/app` to edit, re-upload, and publish while entitlement is live. Expired tenants keep the dashboard (edit/upload). Current public HTML and stable CSV/XML aliases return 410 until renewed. The archive and immutable retained files survive ordinary expiry: the last version for 30 days from publication and previous versions until 30 days from replacement. Suspension blocks public access.

## Capabilities and Constraints

Supports CSV/XML/Excel normalization, private drafts, idempotent trial provisioning, entitlements (`trial` | `active` | `expired` | `suspended`) with always-set `period_end`, public access guard, trial `noindex`, iframe-friendly public pages, magic-link auth, and ops renew (`MAX(now, period_end) + 1 year`). Stripe/billing automation, CRM, and a WordPress plugin codebase are out of scope for this layer; commercial fulfillment is offer → payment → ops renew.

Frame **immutable versioning** and **stable aktualni.csv/xml** as NEPAR’s technical design that helps meet regulatory publication and fetch requirements — not as statutory labels.

## Brand Commitments

Product name: NEPAR Publisher. Tone is clear, calm, professional, and helpful.

## Evidence on Hand

The fixture at `./marketino-artikli` remains available for the demo tenant only. Automatic provider synchronization remains future work.

## Product Principles

- For self-serve tenants the Publisher draft is the source until they publish; change prices at the source they actually maintain (Excel/CSV or dashboard).
- One normalized list powers every output.
- The customer keeps the same slug/URL from trial through paid renewal.
- Demo `/c/nepar` is not a substitute for a customer trial or paid tenant.
- Never invent source data or future integration details.

## Commercial offer

- **Web Link — 19,90 €/god** (id `link`): upload/replace a prepared CSV or XML, up to 5.000 items (`MAX_PRICE_LIST_ITEMS`), persistent public URL, basic web view, CSV/XML output and a 30-day archive. No plugin: the customer adds the link to any existing website.
- **Publisher — 49,90 €/god:** Link plus Excel/CSV/XML validation, dashboard, stable feeds, versioning, archive of superseded versions for at least 30 days, monitoring, email alerts, QR, browser PDF printing and embed.
- **Web + Publisher — 79,90 €/god:** Publisher plus a simple NEPAR web/landing, hosting, SSL, basic editing and technical setup. Complex custom development requires a separate offer.
- **Existing-web help:** separate inquiry to install a link, button or price-list view. No public price; it does not require buying Web + Publisher.
- **Advanced integration:** WooCommerce/webshop/API/ERP/POS connection built for a specific system, individual offer only. No automatic synchronization product exists.

`shared/pricing.ts` is the single commercial source for frontend, pricing page, FAQs, prerendered offers and lead email labels. The old launch offer is inactive. All marketed package amounts are annual. Existing entitlement infrastructure and manual offer → payment → ops activation remain; this work does not add checkout, automated billing or tier-based access controls.

## Anonymous technical check

Nine checks cover homepage availability, HTTPS, price-list discovery, CSV, XML, a public HTML link, supported data structure, archive discovery and supported content validation. The shared score counts `pass` checks and a supported alternative format marked `not_applicable`; warnings, missing signals and unknown checks earn no points. Unknown is not failure. Legacy API colors remain for existing consumers, while the new UI derives its tone from the nine checks.

Reuse the existing safe fetcher and content verification, the price engine's CSV/XML parsers and validator, and the compliance XML feed parser to detect skipped records. A request has a 25-second fetch/DNS budget, bounded candidates and bounded response bodies; CSV/XML probes run concurrently and DNS results are reused within the request. Supported small feeds receive extra analysis without a second download. Oversized, unrecognized, blocked or partially unavailable content remains explicitly unconfirmed. Discovery is not an exhaustive crawl.

Archive discovery does not prove 30 days of history. Content validation cannot prove the historical applicability of an anchor price, the business's complete inventory or legal compliance. The existing file validator is the next step for detail. The checker does not register an account or store uploaded personal information. Lead submission still requires existing consent and anti-bot protection; file attachment remains opt-in.

## Accessibility & Inclusion

The web experience must support semantic structure, visible keyboard focus, file-picker alternatives to drag and drop, accessible status/error announcements, readable contrast, 44px touch targets, and reduced-motion behavior.
