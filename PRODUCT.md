# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: React + TypeScript + Vite, kept intentionally small for a Cloudflare-friendly MVP.

## Users

Small business owners and operators who already maintain prices in a POS, ERP, or business system and need those prices to stay accurate wherever customers see them.

## Product Purpose

NEPAR Publisher helps a small business check whether its website exposes a public machine-readable price list, validate a CSV price list, and publish a maintained public web price list with CSV, XML, and change history. Success means a non-technical owner understands what is ready, what is missing, and which next step solves it.

## Positioning

The acquisition flow starts with a no-registration website readiness check, continues with a free CSV validator, and then offers Publisher, setup, or managed service. The backend keeps the existing normalization and publication infrastructure without exposing internal source-system details to customers.

## Operating Context

The customer continues working in the system where they maintain prices, exports a CSV price list, and uploads it for validation. For the MVP, they can check a website, load the demo, upload a CSV, preview normalized rows, complete missing regulatory fields, and publish immutable versions. Public lists are designed for direct links and iframe embeds.

## Capabilities and Constraints

The MVP supports a tolerant CSV adapter, canonical normalization, deterministic hashes, snapshots, CSV/XML rendering, immutable publications, public `/c/:slug` lists, archive views, embed instructions, and the website readiness checker. It does not include authentication, billing, automatic provider synchronization, or user roles. The existing source adapter and integration fixture remain internal compatibility infrastructure.

## Brand Commitments

Product name: NEPAR Publisher. Primary message: “Provjerite web, učitajte CSV i objavite cjenik bez tehničkog predznanja.” Tone is clear, calm, professional, and helpful; avoid provider-specific promises, stock people, cheesy AI imagery, and decoration without product meaning.

## Evidence on Hand

The existing integration fixture at `./marketino-artikli` contains Croatian headers and values and remains available for compatibility tests. The public product does not name that source system. Automatic provider synchronization remains explicitly future work.

## Product Principles

- Change prices at the source, not in NEPAR.
- One normalized list powers every output.
- Make sync state and history visible enough to build trust.
- Keep public price lists fast, readable, and embed-friendly.
- Never invent source data or future integration details.

## Accessibility & Inclusion

The web experience must support semantic structure, visible keyboard focus, file-picker alternatives to drag and drop, accessible status/error announcements, readable contrast, 44px touch targets, and reduced-motion behavior.
