# NEPAR Digitalni Cjenik — visual direction

> Active direction (2026-10-26): the acquisition route follows the supplied NEPAR checker reference. Historical public-list styling remains scoped to its existing routes.

## Active root surface

The `/` route is a Persuade surface. The first viewport contains the eyebrow “Već imate web? Ne trebate novi.”, the H1 “Digitalni cjenik za bilo koji postojeći web”, the entry price, the primary action “Objavi svoj cjenik” (opens the validator), the secondary “Provjeri postojeći cjenik besplatno” (scrolls to the checker) and text-only platform pills. Directly below: “Radi s webom koji već imate” (three steps), then the checker card with URL field, trust statements and upload path. Pricing cards are always visible; Web Link leads with a highlighted “Do 5.000 stavki”, and installation help and individual integration sit as quiet tiles below the plans. A quiet file-upload card opens the existing validator. The deadline badge reads 17.11.2026.; educational and regulatory content follows the primary journey.

The header is sticky across the whole page and sits outside the hero container. Its logo, navigation and deadline remain inside the page's content width. Anchor destinations and programmatic scroll targets leave room below the header. In the result, “Riješite digitalni cjenik” is a prominent blue 56px action before the secondary file-validation path; it spans the available width on mobile.

Use a near-white `#f8fafc` canvas, white surfaces, black Inter Variable display type, slate body text and saturated NEPAR blue actions (`#0660ff`, hover `#1d4ed8`). The supplied reference's three-bar NEPAR wordmark anchors the acquisition surface; existing product logos stay on other routes. Green marks confirmed checks, amber uncertainty or review, and red missing signals. Preserve visible focus, 44px targets and safe wrapping at 390px.

The decorative office photograph is `public/assets/checker-office.webp` (1536 × 1024, approximately 36 KB). Keep its intrinsic 3:2 ratio with automatic height and a 1160px maximum scene width inside the content margins. Never stretch it to fill the viewport. A restrained white contrast layer blends its left edge into the copy's reading surface; it is not a decorative gradient. The example result on the laptop is real DOM, explicitly labeled as an example. The photo and example are hidden below 1000px. The mobile headline uses four lines at 390px; its input, 52px action and trust statements fit the first viewport. All essential UI works without the photo.

The checker result persists through validator and lead handoffs. A confirmed URL is shown as evidence, never imported automatically. “Imam CSV” scrolls to and focuses the validator container, not its hidden file input. CSV, XML, and mapped Excel rows share one normalized validation path. A source file is attached to an inquiry only after explicit checkbox confirmation.

`shared/website-check.ts` owns the deterministic nine-check presentation. Each check has an explicit status and expandable evidence. A score counts confirmed passes, not legal conditions. Completely unavailable checks show a neutral dash and “0 potvrđenih”, with immediate retry, rather than a prominent failure score. Loading copy rotates without claiming completed stages; cancellation and reduced motion are supported. Motion is limited to control feedback and the result progress reveal.

Plans: three annual plans from `shared/pricing.ts` — Web Link, Publisher (recommended), Web + Publisher — each with a one-line audience tagline, plus installation help and advanced integration as separate no-price tiles. `PlanCards` is shared with `/cijene/`. Form context includes checked URL, legacy checker status, confirmed score, discovered feeds and selected plan. Existing validator, public cjenik, archive, dashboard, trial and SEO routes retain their behavior.

The rest of the landing follows the same hierarchy: nine checks → how it works → file validator → installation help → Publisher explanation/comparison → FAQ/resources → current news. Lower section headings stay 30–34px desktop / 26–28px mobile, card headings 20–23px, supporting body text 14–16px. Major intervals are 64px desktop / 44px mobile. The validator aligns with the page grid; use Inter for controls and prose. FAQs are native disclosure rows with large targets, not a wall of unstyled definition text. Resource navigation remains visible on mobile, explicitly overriding historical global navigation styles. The initial short pricing FAQ explains the next step without listing paid prices; it remains identical to prerendered FAQ structured data.

## Active palette

- canvas `#f8fafc`
- ink `#0f172a`
- body `#334155`
- muted `#64748b`
- acquisition primary `#0660ff`, focus `#2563eb`, hover `#1d4ed8`
- border `#e2e8f0`

Acquisition surfaces use restrained 9–16px radii, fine borders, one soft shadow tier and Tabler line icons. The nine-item grid is a compact explanation of the checker, not a grid of product pitches. Avoid gradients, glass and additional animation. The remaining sections below document the established public-list world and do not override this route.

## Historical public-list world

Safelight control room: a quiet, dark technical workspace where price changes move through a deliberate processing line and emerge as publishable outputs. The page should feel like a calibrated instrument, not a generic SaaS dashboard.

## Historical surface mode

Persuade on the landing page; Operate inside the demo. The first viewport must explain the promise in one glance and give the visitor a direct path into a real fixture-backed demo.

## Material and palette

Near-black ink surfaces, warm paper-white typography, thin graphite rules, and one amber signal color for active sync and primary actions. Use subtle grain/scanline texture only as a background material. Avoid gradients as decoration, blue SaaS palettes, glassmorphism, and oversized rounded containers.

## Type and composition

Use a sturdy grotesk display face for the hero and a highly legible sans for body copy. Small uppercase technical labels and tabular numerals carry system status. The layout uses generous editorial whitespace, a disciplined 12-column desktop grid, and narrow ruled panels for data.

## Signature interaction

The readiness-to-publication flow is the focal moment: a visitor checks a website, validates a CSV, then sees the path to WEB, CSV, XML, and ARHIVA. The existing amber processing grammar remains, but the first viewport prioritizes a useful answer over backend mechanics.

## Responsive behavior

At 390px, the flow becomes a vertical processing line, source and outputs remain individually scannable, and primary actions stay full-width with 44px minimum targets. Data rows wrap service names while prices remain aligned and high contrast.

## Guardrails

Keep customer-facing copy in Croatian. Data in the UI must come from the normalized model or the real `marketino-artikli` fixture. Decorative visuals never carry essential product information. Respect `prefers-reduced-motion`.
