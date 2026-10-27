# Acquisition landing implementation — 2026-10-26

Implemented in the existing React/Vite + Cloudflare Pages/Functions project. No production deployment was performed.

## Main changes

- `src/AcquisitionLanding.tsx`, `src/acquisition.css`: reference-based desktop composition and dedicated mobile layout, accessible URL form, honest progressive copy, cancel/retry, nine-check result, delayed solution cards, secondary upload and separate installation-help path.
- `shared/website-check.ts`: deterministic evidence/status mapping and URL input normalization; API and frontend share the score logic. Each confirmed pass adds one point, maximum nine. Missing, warning and unknown add no points. All-unknown responses have a neutral presentation.
- `functions/api/digitalni-cjenik/check.ts`: existing safe URL/DNS/redirect checks preserved; bounded content analysis reuses CSV/XML price parsers, `validatePriceList` and `shared/compliance/document-parser`. Homepage price lists are recognized; public links are distinguished from guessed feed URLs. Partial network failures and access restrictions remain unknown. Fetch/DNS work is capped at 25 seconds and document requests run concurrently.
- `shared/pricing.ts`, `src/publisherPricing.ts`, `functions/_pricing.ts`, `src/PlanCards.tsx`: one annual pricing source: Web Link 19,90 €, Publisher 49,90 €, Web + Publisher 79,90 €, plus the 5.000-item limit and platform list. Pricing page, FAQs, SEO offers, dashboard labels and lead emails use it.
- `src/LeadForm.tsx`, `functions/_lead.ts`: preserve checked site, score, discovery URLs and selected plan in the existing inquiry flow, with translated status copy and the selected plan's correct price.
- `src/App.tsx`: root delegates to the new landing and injects the existing validator. Dashboard/public routes remain. Demo data now imports the existing generated fixture module, avoiding the Vite development collision between the raw source and its public copy.
- SEO metadata, pricing copy and documentation updated without removing guides, articles, canonical links, prerender, sitemap or public endpoints.

## Validation

- `npm run typecheck`: app, Functions, shared code and monitor Worker passed.
- `npm test -- --reporter=dot`: 36 files, 196 tests passed.
- `npm run build`: TypeScript, Vite, all marketing/news prerenders and distribution verification passed.
- `npm run test:e2e`: 15 Playwright tests cover acquisition and existing admin, product fields, skipped rows, QR/print and embed checks, including mobile FAQ and resource navigation.
- New coverage: normalization and invalid input, nine-check mapping, score and tones, blocked/unavailable/partial states, discovered versus verified feeds, skipped CSV/XML records, shared pricing, plan/context handoff, cancel/retry, mobile layout, file CTA and image aspect ratio.
- Rendered 1440 × 1000, 768 × 1024 and 390 × 844: no horizontal overflow or JavaScript page exceptions. Mobile primary CTA ends around 467px and trust statements around 556px, before the bottom of the first viewport.

## Impeccable review and implemented findings

Two isolated assessments reviewed visual quality and detector/browser evidence. CLI scan: zero deterministic findings. Browser overlay initially found contrast, supporting-text and spacing issues in reused lower-page sections. Implemented fixes: secondary upload heading, inherited navigation font/case, four-line mobile headline, lower-page contrast and 44px links, translated lead state, input error focus, menu Escape, evidence chevrons, neutral unavailable state, immediate retry, cancellation, single main landmark and result-focus handling. Saturated CTA emphasis was retained; additional animation was unnecessary. Reduced motion keeps all state changes immediate.

Independent final reviews found no remaining critical design or technical misses. Supporting text contrast measured 7.24–7.58:1, demo link 4.94:1, educational/source links 6.41:1. The user's correction against edge-to-edge stretching is covered by E2E assertions.

The follow-up whole-page Impeccable pass reduced the desktop hero scale and image cap to 1160px (still intrinsic 3:2), separated the white header, improved contrast behind the introductory copy, and normalized the full page's type and spacing. The file validator aligns with the content grid, installation help follows it, the educational heading no longer forms a second hero, FAQ answers use native disclosures, resource links remain visible/aligned on mobile, and the news/footer use the same typography. The initial short FAQ no longer lists paid prices, keeping the free-check-first funnel and FAQ JSON-LD consistent. Fresh full-page captures are `full-desktop.png` and `full-mobile.png`.

Final whole-page verification: no critical findings at 390/768/1440, all seven FAQ answers usable, all eleven resource links visible with 44px targets, one main landmark, no overflow or JavaScript exceptions. Desktop photograph measures 1160 × 773.33, preserving 3:2. Evidence: `whole-page-verification.json`, `final-faq-mobile.png` and the final independent design review. The final suite passed 196 unit/integration tests and all 15 Playwright tests.

Evidence is in `artifacts/landing/`: `desktop.png`, `tablet.png`, `mobile.png`, `final-design-review.md`, `final-browser-evidence.json` and detector output. Browser evidence uses mocked anonymous results and does not send real inquiries. Real Turnstile completion/email delivery were not exercised. The local preview is static; backend behavior is verified in the Cloudflare Vitest runtime.

## Limits

Discovery checks a bounded set of public links and common locations, rather than crawling the entire website or executing third-party page scripts. Bot protection, network failures, oversized documents, unsupported schemas and unrecognized content remain unconfirmed. Archive discovery cannot verify history duration/completeness. Passing supported technical checks is not legal certification or proof of real historical prices.

Commercial fulfillment remains manual through the existing offer and activation flow. No automated ERP/POS synchronization or checkout was introduced. Vite still reports the existing single-app bundle size warning; Excel's large parser remains a separate lazy chunk. The decorative asset is approximately 36 KB, and the lower validator mounts only when approached or requested.

## Decorative image provenance

Built-in ImageGen created `public/assets/checker-office.webp`; ffmpeg converted the original PNG to WebP at quality 82. It contains photography only. Text, controls, statuses and the laptop result are DOM elements. The acquisition wordmark follows the supplied reference; other existing product logos are preserved.

Final generation prompt:

> Create a photorealistic landscape website decorative asset, 1536x1024. Bright premium small office, blurred green plant and soft daylight in background, pale wood desk in foreground. One open silver slim laptop on RIGHT HALF of composition, laptop screen nearly front facing, screen a clean blank pale white rectangle with black bezel; the visible screen region roughly x=770 to 1450 and y=285 to 760. Keyboard and laptop base below, realistic photographic perspective very mild, near straight horizontal screen edges. LEFT HALF almost white soft out of focus empty wall fading into office, broad empty negative space. Camera at laptop screen height, elegant editorial product photograph, daylight neutral colors, no blue lights. No text, no logos, no UI, no icons, no numbers, no overlays anywhere. This is only a photographic background for editable DOM content.
