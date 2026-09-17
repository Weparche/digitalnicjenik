# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: React + TypeScript + Vite, kept intentionally small for a Cloudflare-friendly MVP.

## Users

Small business owners and operators who already maintain prices in a POS, ERP, or business system and need those prices to stay accurate wherever customers see them.

## Product Purpose

NEPAR Digitalni Cjenik turns an existing price source into a public web price list plus CSV, XML, and change history. Success means a user can change a price once in their source system and clearly understand that every output is updated from the same data.

## Positioning

NEPAR is the translation layer between the system where a business manages prices and the customer-facing surfaces that need the latest version. The product demo proves the flow with a real Marketino CSV fixture and a mock API seam without asking users to re-enter prices.

## Operating Context

The customer continues working in Marketino or another source system. For the MVP, they can load the NEPAR demo, upload a Marketino CSV export, preview normalized rows, generate outputs, and simulate a source-side price change. Public lists are designed for direct links and iframe embeds.

## Capabilities and Constraints

The MVP supports a NEPAR source adapter, a tolerant Marketino CSV adapter, a read-only Marketino mock API adapter, canonical normalization, deterministic hashes, snapshots, CSV/XML rendering, public `/c/:slug` lists, archive views, embed instructions, and an illustrative webhook seam. It does not include authentication, billing, real Marketino/NeoSalon APIs, or user roles. The root `marketino-artikli` file is a real UTF-8 Marketino export and must remain the integration fixture.

## Brand Commitments

Product name: NEPAR Digitalni Cjenik. Internal engine name: NEPAR Price Engine. Primary message: “Promijenite cijenu jednom. Mi ažuriramo sve ostalo.” Tone is clear, premium, professional, technical, and B2B; avoid generic SaaS, stock people, cheesy AI imagery, and decoration without product meaning.

## Evidence on Hand

The real Marketino export at `./marketino-artikli` contains 26 service rows with Croatian headers and values. No pre-existing app, NEPAR price-list module, design system, Cloudflare configuration, D1 binding, or SEO utility was present in the workspace at inspection time. No real Marketino API credentials/specification or webhook specification is available, so those seams must be explicitly marked as mock/future.

## Product Principles

- Change prices at the source, not in NEPAR.
- One normalized list powers every output.
- Make sync state and history visible enough to build trust.
- Keep public price lists fast, readable, and embed-friendly.
- Never invent source data or future integration details.

## Accessibility & Inclusion

The web experience must support semantic structure, visible keyboard focus, file-picker alternatives to drag and drop, accessible status/error announcements, readable contrast, 44px touch targets, and reduced-motion behavior.
