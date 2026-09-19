# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: React + TypeScript + Vite, kept intentionally small for a Cloudflare-friendly MVP.

## Users

Small business owners and operators who already maintain prices in a POS, ERP, or business system and need those prices to stay accurate wherever customers see them.

## Product Purpose

NEPAR Publisher helps a small business check whether its website exposes a public machine-readable price list, validate CSV/XML data, convert Excel price lists, and publish a real public price list on a stable `/c/{slug}` URL with CSV/XML feeds. Success means a non-technical owner can preview data, start a 7-day trial on their own URL, then continue self-serve or ask NEPAR to install it.

## Positioning

The acquisition flow is trial-first: website readiness check → free CSV/XML/Excel preview (private draft, no public publish) → e-mail verify → trial tenant with real `/c/{slug}` → dashboard upgrade (49,90 €/god self-serve or 89,90 € first year with install) → paid renewal. `/c/nepar` is the NEPAR demo fixture only and is never the destination for customer uploads.

## Operating Context

Anonymous users upload into a private draft (≈24 h, R2 + D1 metadata). Publishing a trial requires business name, e-mail, and slug; the tenant is created only after magic-link verification. Owners use `/app` to edit, re-upload, and publish while entitlement is live. Expired tenants keep the dashboard (edit/upload) but public HTML/CSV/XML/archive return 410 until renewed.

## Capabilities and Constraints

Supports CSV/XML/Excel normalization, private drafts, idempotent trial provisioning, entitlements (`trial` | `active` | `expired` | `suspended`) with always-set `period_end`, public access guard, trial `noindex`, iframe-friendly public pages, magic-link auth, and ops renew (`MAX(now, period_end) + 1 year`). Stripe/billing automation, CRM, and a WordPress plugin codebase are out of scope for this layer; commercial fulfillment is offer → payment → ops renew.

## Brand Commitments

Product name: NEPAR Publisher. Primary message: “Provjerite što imate. Ako želite, mi ćemo riješiti ostalo.” Tone is clear, calm, professional, and helpful.

## Evidence on Hand

The fixture at `./marketino-artikli` remains available for the demo tenant. Automatic provider synchronization remains future work.

## Product Principles

- Change prices at the source when a provider exists; for self-serve tenants the Publisher draft is the source until they publish.
- One normalized list powers every output.
- The customer keeps the same slug/URL from trial through paid renewal.
- Demo `/c/nepar` is not a substitute for a customer trial or paid tenant.
- Never invent source data or future integration details.

## Commercial offer

- Publisher self-service: **49,90 €/god** (same URL; customer embeds link/iframe).
- Publisher + install: **89,90 € first year**, then **49,90 €/god**.

## Accessibility & Inclusion

The web experience must support semantic structure, visible keyboard focus, file-picker alternatives to drag and drop, accessible status/error announcements, readable contrast, 44px touch targets, and reduced-motion behavior.
