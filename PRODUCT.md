# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: React + TypeScript + Vite, kept intentionally small for a Cloudflare-friendly MVP.

## Users

Primary user: a small business operator **outside the VAT system** who **uses or plans to use MIKROeRAČUN**, has their **own website**, and does **not** rely on a commercial POS/ERP that already publishes a public machine-readable price list for them.

Qualification (not the main funnel): operators on Marketino, Minimax, Pantheon, or similar should check with their provider before buying Publisher.

## Product Purpose

NEPAR Publisher is a **publishing layer** between the operator’s own price list (Excel/CSV) and their public website: validate data, emit regulatory CSV/XML, expose stable “current” feeds and version history, and support automated fetch — so the operator can link the price list on their site without buying a commercial intermediary stack only for that feature.

Success means a non-technical owner can preview data, start a 7-day trial on their own `/c/{slug}` URL, then continue self-serve or ask NEPAR to install the link.

## Positioning

**Category:** MIKROeRAČUN covers e-invoices (under Porezna’s conditions); Publisher covers **public price list publication on the web** (separate regulatory track).

**Acquisition funnel:** MIKROeRAČUN + own website → Excel/CSV upload (free validation) → 7-day public trial → paid Publisher self-service.

**Hero message:** “Koristite MIKROeRAČUN?” / “MIKROeRAČUN je za eRačune. NEPAR Publisher objavljuje vaš cjenik na webu.”

**Factual note (Sept 2026):** MIKROeRAČUN primarily enables **receiving** e-invoices today; **issuing** is planned from 1 Jan 2027; upgraded version testing in Oct 2026. Do not overclaim in marketing copy.

**Language:** Prefer “bez **komercijalnog** informacijskog posrednika” over absolute “bez informacijskog posrednika” (legal term of art).

**Do not compete** with Marketino/Minimax/Pantheon in the main narrative — only a small pre-purchase qualification block.

## Operating Context

Anonymous users upload into a private draft (≈24 h, R2 + D1 metadata). Publishing a trial requires business name, e-mail, and slug; the tenant is created only after magic-link verification. Owners use `/app` to edit, re-upload, and publish while entitlement is live. Expired tenants keep the dashboard (edit/upload) but public HTML/CSV/XML/archive return 410 until renewed.

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

- Publisher self-service: **39,90 €/god** launch — **first 100 activated subscriptions** (copy-only cap; ops applies manually), then **49,90 €/god** (same URL; customer embeds link/iframe).
- Publisher + install: **89,90 € first year**, then **49,90 €/god**.

Toggle launch off in `src/publisherPricing.ts` and `functions/_pricing.ts` (`LAUNCH_ACTIVE = false`) when the promotion ends.

## Accessibility & Inclusion

The web experience must support semantic structure, visible keyboard focus, file-picker alternatives to drag and drop, accessible status/error announcements, readable contrast, 44px touch targets, and reduced-motion behavior.
