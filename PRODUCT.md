# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: React + TypeScript + Vite, kept intentionally small for a Cloudflare-friendly MVP.

## Users

Small business owners and operators who already maintain prices in a POS, ERP, or business system and need those prices to stay accurate wherever customers see them.

## Product Purpose

NEPAR Publisher helps a small business check whether its website exposes a public machine-readable price list, validate CSV/XML data, convert Excel price lists, and request a complete technical implementation. Success means a non-technical owner understands what is ready, what is missing, and can send NEPAR whatever material they already have.

## Positioning

The acquisition flow starts with a no-registration website readiness check, continues with a free CSV/XML validator or local Excel conversion, and then offers consultation, Publisher setup, or managed service. The backend keeps the existing normalization and publication infrastructure without exposing internal source-system details to customers.

## Operating Context

The customer can check a website, upload CSV/XML, map an XLS/XLSX worksheet into the same normalized model, preview rows, complete missing regulatory fields, download both machine-readable outputs, or send a file/URL to NEPAR for consultation or implementation. Excel stays local until the user explicitly attaches it to an inquiry.

## Capabilities and Constraints

The MVP supports a tolerant CSV adapter, shared XML and Excel normalization, deterministic hashes, snapshots, CSV/XML rendering, immutable publications, public `/c/:slug` lists, archive views, website readiness checking, and a Turnstile-protected implementation inquiry with an optional attachment. It does not include authentication, billing, automatic provider synchronization, CRM, marketing subscriptions, or user roles.

## Brand Commitments

Product name: NEPAR Publisher. Primary message: “Provjerite što imate. Ako želite, mi ćemo riješiti ostalo.” Tone is clear, calm, professional, and helpful; avoid provider-specific promises, stock people, cheesy AI imagery, and decoration without product meaning.

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
