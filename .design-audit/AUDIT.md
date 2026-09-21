# NorthTap UI audit (pre-redesign)

## Design read
Redesign overhaul of a Canadian consumer fintech product (purchase-specific card recommender), trust-first premium language, cold zinc + teal, Syne + DM Sans, asymmetric photo hero.

Dials: VARIANCE 6 / MOTION 4 / DENSITY 5

## Generic / templated patterns found

1. **Fraunces display serif** — LLM-favorite display serif paired with Outfit; reads as default “premium AI” type stack.
2. **Lime chartreuse accent (`#c8f135`)** on ink-green — startup fintech cliché with radial gradient blobs instead of real imagery.
3. **No photography** — hero and sections are flat color + blur orbs only.
4. **Card-with-shadow layout everywhere** — `rounded-2xl border + shadow-sm + backdrop-blur` repeated for selector, category, results, CTA.
5. **Lucide icons as the only visual system** — category pills and trophy rank marker; no authentic imagery.
6. **Uppercase micro-eyebrows** (`TRY IT FREE`, issuer labels with wide tracking) on every section.
7. **Em-dashes in copy/meta** — title and body use `—`.
8. **Hero without visual anchor** — brand + headline + CTAs, no product/lifestyle photo plane.
9. **Sun/moon theme toggle + generic sticky glass header** — standard shadcn starter chrome.
10. **Equal-weight two-column product grid** — functional but visually flat; results empty state is a dashed box.

## Preserve
- Optimizer state flow (`ownedIds`, `category`, `recommendCards`)
- All `@northtap/core` integration
- Light + dark theming via `next-themes`
- Session-only web picker semantics (no persistence)
- Route structure and primary CTAs (#optimizer, Get the app)

## Direction
- Fonts: Syne (display) + DM Sans (body); JetBrains Mono for tabular cents
- Palette: cool zinc neutrals + single teal accent (no indigo, no lime glow)
- Hero: asymmetric split with Unsplash lifestyle photography
- Product surfaces: quieter borders/dividers, less shadow card stacking
- Keep recommender logic untouched
