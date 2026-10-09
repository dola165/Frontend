# GrassKickZ frontend: visual design system audit

This read-only audit was prepared on 10 October 2026 to give tomorrow's redesign team measured facts. No source file was changed.

**Method.** Counts come from scripts, not estimates. PostCSS parsed every CSS file. The TypeScript compiler API parsed the JSX. ripgrep and grep handled the rest. The scripts covered `src/`, excluding `src/design-preview/` and `src/demo/`; both are separate entry points and are not imported by `App.tsx`. Those exclusions remove 2 CSS files, `overview-study.css` (51 KB) and `workspace.css` (51 KB). Tests, `__tests__` and `__fixtures__` are excluded. "Uses" means `var(--x)` references in CSS and TS/TSX, including Tailwind `[var(--x)]` classes. Every number was measured. Where a cascade outcome is stated, it was worked out from selector specificity and was **not** checked in a rendered page.

## 0. Headline numbers

| Metric | Value |
|---|---|
| CSS files / lines / bytes | **160** / 24,907 / **1.64 MB** |
| CSS rules / declarations | 14,294 / 44,686 |
| CSS selectors that style a bare element under a class (`.x button`, `.y h2`) | **6,252 of 15,527 (40%)**; ends in `button` 900, `p` 602, `span` 582, `h2` 358, `input` 257 |
| Production TS/TSX files | ~790 (plus 27 orphan `.tsx` files, §6.4) |
| Distinct custom properties: token files / all CSS | **385** / 517 (2,001 declarations) |
| `var(--…)` references / of which go directly to `--color-*` | 16,517 / 8,033 (49%) |
| Literal colours outside `theme.css` and `visualColors.ts` | **0**, enforced by the guard (§1.8) |
| Ad-hoc `color-mix()` alpha blends (CSS + TSX) | **1,892**, using 194 distinct percentages |
| Distinct font sizes in use | **47 px values**, plus 84 distinct `clamp()` and 24 off-grid rem values |
| Distinct `font-weight` values in CSS | 14 (Inter is loaded only at 400/500/600) |
| Distinct `border-radius` values in CSS | 71 (27 single-px values) |
| Distinct `box-shadow` values in CSS | 262 across 368 declarations |
| Distinct page `max-width` values (≥900 px) in CSS | **33** across 86 declarations |
| Distinct media-query breakpoints | 54 px values across 357 conditions |
| `!important` declarations | 411 (`index.css` 43, `opportunities.css` 42) |
| Tailwind arbitrary-value classes in TSX | 5,566: `text-[…]` 2,740, `bg-[…]` 1,209, `border-[…]` 1,022 |

---

## 1. Tokens

### 1.1 Where tokens are defined

| File | Distinct props | Main blocks (props): selector |
|---|---|---|
| `src/styles/theme.css` (225 lines) | 41 | 9 palette blocks (§1.2) + derived block L163 (18): `--color-*-soft`, `--color-hover`, `--color-overlay-soft/strong`, `--color-shadow-soft/strong`, `--color-hero-scrim`, compat `--app-bg/text/surface/border` |
| `src/index.css` (4,055 lines) | **308** | `:root` L8 (247), `.dark` L267 (243), `.top-nav-force-dark` L591 (15), `.club-page-shell` L894 (32), `.workspace-page-shell` L930 (40), `.workspace-light` L979 (19), `.feed-home-shell` L1002 (30), `.dark .feed-home-shell` L1053 (29), `.schedule-page-shell` L1591 (26, **dead**), `.map-page-shell` L2001 (38), `.dark .map-page-shell` L3256 (33), `.map-force-light/dark` L3356/3382, `.chat-messenger-shell` L3535 (21), `.dark .club-page-shell` L3970 (21), 11 small tone blocks (`.club-tone-*`, `.schedule-tone-*`) |
| `src/styles/product-design.css` | 61 | `html.product-design-active` L3 (28 aliases), `… :is(.top-nav-force-dark, .product-design-scope .club-page-shell)` L37 (24) |
| `src/styles/workspace-design.css` | 81 | `.workspace-design-scope` L3 (73 aliases) |
| `src/styles/product-identity.css` | 49 | `.dark` L9 (28), `.dark .feed-home-shell, .dark .club-page-shell` L39 (21) |
| `src/styles/app-motion.css` | 5 | `--app-motion-ease` `cubic-bezier(.22,1,.36,1)`, `--app-motion-soft` `cubic-bezier(.16,1,.3,1)`, `--app-motion-fast` 180ms, `--app-motion-arrival` 320ms |
| `src/styles/actions.css` | 0 | — |
| `src/theme.ts` | 0 | No CSS properties. `ThemePreference = 'map-light'\|'dark'\|'light'`. `readThemePreference` reads localStorage `theme-preference` (fallback `theme`) and defaults to **`'map-light'`**. `themeForRoute` returns light only for `/map` or the `light` preference, otherwise **dark**, so the default experience is dark. `applyDocumentTheme` toggles `html.dark` and sets `data-theme`. |
| Other feature CSS | 132 more | `club-design-theme.css` 98 declarations, `workspace-design-theme.css` 57, `store.css` 42, `club-connections.css` 33, `opportunities.css` 30, … (`--sd-*`, `--mx-*`, `--op-*`, `--fw-*`, `--tw-*`, `--mp-*` local alias sets) |
| `src/styles/visualColors.ts` | — | 198 fixed hex values (map paint, QR, emblems, landing art); referenced 291 times in 23 files |

### 1.2 Canonical palette (`theme.css`): 7 literal palettes on overlapping selectors

| Role | Base light `:root` | Base dark `:root.dark` | Slate (`.top-nav-force-dark`, `.dark .feed-home-shell`, `.dark .club-page-shell`) | Home/club "approved" dark | **Product light** `html.product-design-active:not(.dark)`, `.club-design-scope` | **Product dark** `html.dark.product-design-active`, `.dark .workspace-design-scope`, club `workspace-refresh` | Map light `.map-force-light` |
|---|---|---|---|---|---|---|---|
| page | #f4f5f3 | #09090b | #0e1318 | #090d12 | #f3f5f4 | #0a0d0f | #e5ddd3 |
| surface | #fafbf9 | #18181b | #10151b | #131821 | #ffffff | #13181d | #faf8f1 |
| elevated | #ffffff | #27272a | #1c252e | #1c222d | #e9eeec | #1c232a | #faf8f1 |
| inset | #eaf0eb | #18181b | #202d38 | #0e131b | #f7f9f8 | #0e1216 | #efece2 |
| border | #bdc9c0 | #3f3f46 | #33414d | #28313f | #c7d1cd | #222b35 | #dadccf |
| text (= ink) | #21352b | #f4f4f5 | #f2f6fa | #eef3f7 | #17251e | #f2f4f6 | #243d33 |
| secondary | #4c6255 | #a1a1aa | #aab8c5 | #adb7c4 | #4b5f54 | #a5afb8 | #626c5f |
| muted | #54695d | = secondary | = secondary | = secondary | = secondary | = secondary | = secondary |
| accent | #246844 | #00c853 | #00e676 (`#00ff6e` on `.top-nav-force-dark`) | #39bf9b, then Home overrides: light #146b3c / dark #00e676 | #146b3c | #00e676 | #2e6248 |
| on-accent | #ffffff | #000000 | – | #102b23 (Home dark #06110b) | #ffffff | #06110b | – |
| danger / warning | #b62e43 / #815609 | #ec8daf / #d0a85a | – | – | – | – / #e8ba62 | – |
| orange / info / cyan / purple / pink | #994417 / #245caa / #076a79 / #7044a1 / #a43670 | #ff9e58 / #7db7e6 / #64c6ff / #9076ff / #e07da7 | – | #e8b56c / #8cb9e8 / #72c6db / #af96ed / – | – | **orange = warning #e8ba62; cyan = info #83b9ef**; purple #bf9bf5 | – |
| overlay / shadow / media-surface | #0c1510 / #0a1610 / #0c1510 | #060608 / #000000 / #060608 | | | | | |

- `theme.css` contains 114 hex literals, 85 of them unique. `--color-surface`, `--color-border` and `--color-text` each have 7 literal definitions; `--color-accent` has 10. A later block, `.dark .club-page-shell:not(.map-force-light)`, adds a further set of club-only dark accents (#22d3ee, #60a5fa, #c084fc, #ffc857).
- Some selectors (e.g. `.dark .feed-home-shell`, `.top-nav-home.top-nav-force-dark`) appear in 3–4 palette blocks, so the colour that wins depends on **source order**.
- In 6 of the 7 palettes `--color-secondary` equals `--color-muted`. `--color-ink` always equals `--color-text`.
- The derived soft tokens use a 12% mix in `theme.css`, but `--color-accent-soft` is redefined at **9%** in both `product-design.css` and `workspace-design.css`. `workspace-design.css` also redefines the other soft tokens at 10%.

### 1.3 Light vs dark alias layer in `index.css`

| | Count |
|---|---|
| Props in `:root` (light) / `.dark` | 247 / 243 |
| Only in light | 4 (`--app-header-height` 100px, `--app-active-header-height`, `--app-page-gutter` 16/24/32px, `--app-page-max-width` 2240px) |
| Same name, identical value | 168 |
| Same name, different value | 75 |

Representative differences:

| Token | Light | Dark |
|---|---|---|
| `--border-subtle` | border 10% | 8% |
| `--border-strong` | 18% | 12% |
| `--shadow-panel` | 0 16px 34px shadow 8% | 0 16px 36px shadow **40%** |
| `--shadow-float` | 0 24px 50px 14% | 0 28px 60px 50% |
| `--workspace-zone-highlight` | info 12% | text 4% |
| `--feed-accent-blue` | `--color-info` | `--color-accent` (green) |

Other dark-specific styling sits outside the tokens:

- 115 CSS rules in 25 files target `.dark` or a `*-force-dark` class.
- 48 CSS rules target light-only scopes.
- TSX contains 163 Tailwind `dark:` variants.

### 1.4 Usage: top 40

Column key: "Uses" counts `var()` references in CSS and TSX; "Defs" is the number of times the token is defined across all CSS.

| # | Token | Uses | Files | Defs | | # | Token | Uses | Files | Defs |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `--color-accent` | 1288 | 183 | 10 | | 21 | `--fc-card-bg` | 202 | 64 | 15 |
| 2 | `--color-border` | 1114 | 151 | 7 | | 22 | `--color-orange` | 201 | 42 | 5 |
| 3 | `--color-secondary` | 820 | 120 | 7 | | 23 | `--color-elevated` | 199 | 56 | 7 |
| 4 | `--color-surface` | 636 | 120 | 7 | | 24 | `--color-warning` | 188 | 49 | 3 |
| 5 | `--color-text` | 610 | 142 | 7 | | 25 | `--accent-primary` | 180 | 34 | 18 |
| 6 | `--color-muted` | 471 | 72 | 7 | | 26 | `--club-theme-border-subtle` | 178 | 28 | 6 |
| 7 | `--fc-border` | 457 | 78 | 13 | | 27 | `--club-theme-text-secondary` | 178 | 26 | 7 |
| 8 | `--color-inset` | 393 | 67 | 7 | | 28 | `--fc-text-muted` | 134 | 35 | 14 |
| 9 | `--color-shadow` | 364 | 75 | 2 | | 29 | `--sd-border` | 124 | 10 | 2 |
| 10 | `--fc-accent` | 364 | 71 | 13 | | 30 | `--color-purple` | 113 | 26 | 5 |
| 11 | `--fc-text-secondary` | 352 | 75 | 16 | | 31 | `--club-theme-text-primary` | 97 | 26 | 7 |
| 12 | `--text-secondary` | 315 | 64 | 20 | | 32 | `--sd-muted` | 94 | 9 | 2 |
| 13 | `--color-info` | 312 | 49 | 5 | | 33 | `--color-overlay` | 93 | 52 | 2 |
| 14 | `--color-danger` | 281 | 84 | 2 | | 34 | `--fc-page-bg` | 93 | 43 | 14 |
| 15 | `--fc-text-primary` | 262 | 77 | 14 | | 35 | `--theme-border` | 89 | 29 | 9 |
| 16 | `--color-ink` | 255 | 64 | 7 | | 36 | `--venue-accent` | 86 | 5 | 6 |
| 17 | `--color-on-accent` | 223 | 113 | 7 | | 37 | `--club-tone-green` | 83 | 21 | 6 |
| 18 | `--border-subtle` | 211 | 24 | 14 | | 38 | `--fc-surface-hover` | 83 | 40 | 11 |
| 19 | `--text-primary` | 211 | 66 | 20 | | 39 | `--bg-surface` | 79 | 23 | 16 |
| 20 | `--color-page` | 210 | 41 | 7 | | 40 | `--fc-accent-soft` | 78 | 32 | 11 |

Usage by family:

| Family | Uses | Split |
|---|---|---|
| `--color-*` | 8,028 | |
| `--fc-*` ("Functional Clarity") | 2,226 | 865 TSX / 1,379 CSS |
| `--club-*` | 878 | |
| `--text-*` | 576 | |
| `--app-*` | 399 | |
| `--feed-*` | 298 | |
| `--schedule-*` | 79 | 40 tokens defined |
| `--workspace-*` | 12 | 28 tokens defined |

All families are listed in Appendix A.

### 1.5 Duplicates and near-duplicates

**Alias fan-in.** This counts how many other custom properties resolve to each canonical role in at least one scope:

| Canonical | Aliases | Examples |
|---|---|---|
| `--color-accent` | **92** | `--accent-primary --app-accent-primary --fc-accent --workspace-accent --club-tone-green --schedule-accent-green --feed-accent --chat-accent --venue-accent --op-accent --mx-accent --sd-accent --fw-accent --tw-green --mp-green --landing-green` … |
| `--color-surface` | **64** | `--bg-surface --theme-surface --app-shell-surface --app-surface --club-theme-surface --club-card --club-band --fc-card-bg --fc-sidebar-bg --feed-surface --feed-card --gk-surface --workspace-theme-surface --schedule-theme-surface --sd-surface --mx-bg --dola-surface --tw-surface --op-surface --chat-card` … |
| `--color-border` | **57** | `--border-subtle --border-strong --theme-border --theme-border-strong --app-border-subtle --app-border-strong --app-border --club-theme-border-subtle --fc-border --schedule-theme-border-subtle --feed-card-border --gk-border --mx-border --sd-border --tw-line --op-border` … |
| `--color-info` | 44 | `--state-info --club-tone-blue --club-tone-purple(!) --schedule-accent-purple(!)` … |
| `--color-secondary` | 42 | `--text-secondary --fc-text-secondary --club-tone-pink(!) --schedule-accent-pink(!) --feed-accent-pink(!)` … |
| `--color-inset` / `--color-elevated` | 34 / 34 | `--bg-inset --theme-surface-inset --fc-surface-hover` … / `--bg-elevated --theme-surface-strong --gk-raised` … |
| `--color-text` / `--color-page` / `--color-muted` | 33 / 32 / 28 | |

**Same token, different meaning by scope.** The first five rows are within the token files only.

| Token | Defs | Resolves to |
|---|---|---|
| `--border-subtle` | 11 | border **10%/8% alpha** in `:root`/`.dark`/map. **Full `--color-border`** in `product-design.css` and `workspace-design.css`. `--fc-border` inside `.workspace-page-shell`. |
| `--fc-card-bg` | 6 | `--color-elevated` (`:root`, `.dark`, `.workspace-light`). `--color-surface` (product, workspace scopes). `--gk-raised` (`product-identity.css`). |
| `--bg-inset` | 12 | `--color-inset`. Inside `.workspace-page-shell` it is `--fc-page-bg`, which is `--color-page`. |
| `--accent-primary-soft` | 17 (all CSS) | 8%, 8.63%, 9%, 10%, 12%, 14% or 20% accent, depending on scope |
| `--text-primary` | 13 | `--color-text`, `--club-theme-text-primary`, `--fc-text-primary` or `--schedule-theme-text-primary`. `journeys.css` sets it to `--mp-text`. |
| `--sd-text` | | `var(--fc-text-primary, var(--color-secondary))`. The fallback is the wrong role (`squad-design.css`). |
| `--club-tone-purple` / `--schedule-accent-purple` | | Purple names that resolve to `--color-info` (blue) |
| `--club-tone-pink` / `--schedule-accent-pink` / `--feed-accent-pink` | | Pink names that resolve to `--color-secondary` (grey) |

**Unused.** 80 of the 385 token-file props have 0 `var()` references. This includes all 22 `--workspace-theme-*`, `--workspace-accent*` and `--workspace-state-*` tokens, 34 `--feed-*` tokens, `--app-surface`, `--app-border`, `--bg-panel`, `--color-orange-soft`, `--color-cyan-soft`, `--color-pink-soft`, `--color-overlay-soft` and `--color-overlay-strong`. Appendix B has the full list.

**Referenced but never defined.** 41 names. Most rely on a fallback (`--border-color` ×17, `--fc-surface` ×6, `--input-bg`, `--bg-primary`, `--color-primary`, `--muted-foreground`, …). A few are set at runtime from JS (`--landing-parallax-y`, `--card-turn-x/y`).

### 1.6 Non-colour tokens

| Kind | What exists |
|---|---|
| Spacing | Only `--app-page-gutter` (16 / 24 @≥640 / 32 @≥1440). There is **no spacing scale**. |
| Radius | `--fc-radius` 6px (7 uses), `--work-radius` 10px (1 use). There is **no radius scale**. |
| Typography | **None.** `--tw-font-weight-black: 900` is defined and unused. Tailwind has no `@theme` block, so utilities use Tailwind defaults. |
| Shadow | `--shadow-panel` (20 uses), `--shadow-float` (5), `--map-shadow-soft` (11), `--map-shadow-strong` (3), `--app-shadow-panel` (2), `--theme-shadow` (3), `--family-shadow` (3), `--club-/--feed-/--schedule-shadow-panel/float` (1 each), `--app-shadow-float` (0) |
| Layout | `--app-header-height` 100px (46 uses; Android 0px), `--app-active-header-height`, `--app-page-max-width` 2240px, `--home-frame-width` 1920px |
| Motion | `--app-motion-*` (4), plus duplicate easings `--club-motion-ease`, `--map-ease`, `--family-ease` |

Semantic utility classes defined in `index.css` `@layer utilities` (`.bg-surface`, `.text-primary`, `.theme-border`, `.app-card`, …) are barely used:

- `bg-base` / `bg-surface` / `border-strong` / `shadow-float`: 0 uses each
- `text-muted`: 36
- `theme-border`: 29

TSX uses `[var(--…)]` arbitrary values instead, with 4,855 `var()` references in TS/TSX.

### 1.7 `scripts/check-theme-colors.mjs`: what it enforces

- It runs as `npm run check:theme` and is the **first step of `npm run build`**. It currently **passes**: "962 production source files; palette confined to 2 definition files".
- It scans `src/**/*.{css,ts,tsx,js,jsx}` except `__tests__`, `__fixtures__`, `*.test.*`, `styles/theme.css` and `styles/visualColors.ts`.
- **CSS** (PostCSS, every declaration): a value fails if it contains a hex colour (`#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`), `rgb(`/`rgba(`/`hsl(`/`hsla(`, or if the whole value is exactly one of `white black gray grey red green blue orange yellow purple pink gold lime cyan navy`.
- **TS/TSX** (TypeScript AST, every string and template chunk): a chunk fails if it contains hex/rgb/hsl or a Tailwind palette utility. That means `(bg|text|border[-trblxy]|ring|ring-offset|divide|outline|fill|stroke|decoration|placeholder|accent|from|via|to|shadow)-(white|black|gray|slate|zinc|stone|neutral|green|emerald|red|blue|amber|yellow|orange|purple|indigo|pink|cyan|teal|violet|lime|rose|sky|fuchsia)[-N]`. A named colour also fails when assigned to `color`, `background`, `backgroundColor`, `borderColor`, `fill`, `stroke`, `bgColor` or `fgColor`.
- **It does not check:**
  - which token is used (any `var()` passes)
  - `color-mix()` percentages or Tailwind opacity modifiers
  - `oklch`/`lab`/`hwb`
  - CSS named colours outside the 15 listed
  - font sizes, weights, radii, shadows and spacing

**Consolidate:** collapse the ~350 aliases onto the 23 `--color-*` roles with one light and one dark palette, add real spacing, radius, type and shadow scales through Tailwind `@theme`, and delete the 80 unused tokens.

---

## 2. Raw values that bypass tokens

### 2.1 Colour

| Measure | Count |
|---|---|
| Literal hex/rgb/hsl in CSS outside `theme.css` | **0** |
| Literal hex in TSX outside `visualColors.ts`; `bg-[#…]` classes | **0** / 0 |
| `color-mix()` in CSS / TSX | **1,665 in 111 files** / 227 in 55 files (179 of them as `[color-mix(…)]` Tailwind classes) |
| Distinct mix percentages / distinct (token, %) pairs | **194 / 781**. Most frequent: 5.1% ×154, 12% ×101, 8% ×63, **7.06%** ×58, 10% ×57, 40% ×52, 6% ×45, 20% ×45, **33.33%** ×42, **12.55%** ×35, **6.27%** ×32. The fractional values are mechanically converted hex alphas (0x0D, 0x12, 0x20, 0x10, 0x55). |
| Tailwind opacity modifiers on token colours (`…]/[0.04]`, `…]/50`) | 703 in 78 files (36 distinct) |

### 2.2 Font size

| | Count |
|---|---|
| CSS `font-size` declarations | 3,693. **3,492 in px (94.6%)**, 46 distinct px values. |
| Other CSS values | 127 distinct: **84 distinct `clamp()`** (95 declarations) and 24 off-grid rem (`.9rem` ×12, `.85rem` ×11, `.78rem`, `.76rem`, `.83rem`, …) |
| Tailwind arbitrary `text-[Npx]` | 411. `11px` ×186, `10px` ×176, `9px` ×16, `12px` ×14, `13px` ×8, `14px` ×5, `8px` ×4, `15px` ×2 |
| Tailwind named sizes | 1,287. `text-sm` 645, `text-xs` 482, `xl` 37, `2xl` 32, `lg` 31, `base` 30, `3xl` 20, `4xl` 6, `5xl` 4 |
| Inline `style={{fontSize}}` | 8 |

§3.2 has the size-by-size table.

### 2.3 Font weight

- **CSS:** 1,063 declarations, 14 distinct values: 650 ×309, 600 ×277, 700 ×168, 500 ×85, **750 ×73**, 400 ×62, 550 ×35, 800 ×21, 900 ×11, 760 ×9, 720 ×8, 730 ×3, 680 ×1.
- **Tailwind:** `font-semibold` 724, `bold` 210, `medium` 131, `black` 55, `extrabold` 25, `normal` 3.
- **Mismatch:** Inter is imported only at **400/500/600**. **603 CSS declarations and 290 Tailwind classes request a weight above 600**; none of those can render as designed.

### 2.4 Border radius

| Source | Distribution |
|---|---|
| CSS (1,581 declarations, 71 distinct) | 8px 229 · 12px 204 · 10px 203 · 50% 120 · 6px 102 · 9px 98 · 7px 89 · 14px 75 · 0 67 · 5px 67 · 16px 47 · 4px 40 · 18px 32 · 11px 30 · 13px 26 · 20px 25 · 999px 21 · 3px 13 · plus 53 other values |
| Tailwind (867 uses, 26 distinct) | `rounded-xl` (12px) 332 · `rounded-full` 224 · `rounded-lg` (8px) 138 · `rounded-2xl` (16px) 50 · `rounded-[4px]` 41 · `rounded` 22 · `rounded-[2px]` 12 · `rounded-[var(--fc-radius)]` 6 · … |

Distinct radius values per component kind (CSS):

| Component kind | Distinct radii | Most common |
|---|---|---|
| Card/panel | 21 | 12px 26, 10px 25, 14px 17 |
| Button | 22 | 8px 57, 7px 31, 9px 29, 6px 24, 10px 22 |
| Input | 17 | |
| Modal | 13 | |
| Badge | 11 | |

### 2.5 Box shadow

- **CSS:** 368 declarations, **262 distinct**. 52 are `none` and 41 use a token, leaving **275 raw**. Many are multi-layer neon glows in the landing and map files.
- **Tailwind:** 74 uses, 28 distinct: `shadow-2xl` ×28 and 21 different `shadow-[0_Npx_Npx_color-mix(…)]` arbitrary shadows.

### 2.6 Spacing

| Measure | Count |
|---|---|
| `gap` declarations / distinct values | 2,882 / 123. Top: 12px 384, 8px 376, 10px 299, 16px 202, 7px 188, 6px 175 |
| `padding` declarations / distinct values | 3,175 / **721** |
| Distinct px values across padding, margin and gap | 84 |
| px values that are not multiples of 4 | **5,175 of 9,617 (54%)** |

### 2.7 Top offending files

CSS:

| File | Font-size decls | Radius decls | Raw shadows | Weights |
|---|---|---|---|---|
| `components/workspace/opportunities/opportunities.css` | **229** | 58 | – | 34 |
| `components/map/map-atlas.css` | 127 | **64** | 19 | 29 |
| `components/landing/landing-chapters.css` | 105 | 26 | 9 | – |
| `features/venues/venues.css` | 105 | 47 | – | 20 |
| `components/landing/landing.css` | 88 | – | 4 | – |
| `features/competitions/matches-experience.css` | 80 | 27 | – | – |
| `features/matchExchange/match-exchange.css` | 80 | 23 | – | 25 |
| `features/parents/family-workspace.css` | 80 | 37 | – | 29 |
| `index.css` | – | 54 | 37 | 34 |
| `components/landing/landing-electric.css` | – | – | **42** | – |
| `components/workspace/workspace-design-theme.css` | – | 44 | – | – |

TSX, Tailwind arbitrary values:

| File | All `*-[…]` classes | `text-[Npx]` |
|---|---|---|
| `components/map/MapFilterSidebar.tsx` | **301** | 32 |
| `pages/UserProfilePage.tsx` | 237 | 31 |
| `pages/AccountPage.tsx` | 205 | 15 |
| `pages/MessagingPage.tsx` | 168 | 15 |
| `features/tournaments/components/BracketEditor.tsx` | 165 | 8 |
| `components/map/MapExperience.tsx` | 151 | 18 |
| `components/layout/TopNav.tsx` | 143 | – |
| `pages/AdminPage.tsx` | 133 | 14 |
| `features/tournaments/components/BracketTree.tsx` | 127 | 10 |
| `pages/TournamentDetailPage.tsx` | 115 | – |
| `components/schedule/ScheduleGrid.tsx` | 112 | 25 |
| `components/club/ClubManagementModal.tsx` | 115 | 15 |

**Consolidate:** define a 6–8 step type scale, a 4–5 step radius scale, 3 shadows and a 4px spacing scale. Replace `color-mix` percentages with the existing `--color-*-soft` and `--color-hover` roles. Extend the guard to px font sizes, radii and shadows.

---

## 3. Typography

### 3.1 Families

| Declaration | Where |
|---|---|
| `@import` Google Fonts **Inter 400;500;600** | `src/index.css:1`. This is the only web font. |
| `body { font-family: "Inter","Segoe UI",sans-serif }` | `index.css:534` |
| `"Inter","IBM Plex Sans","Segoe UI"` | `index.css:975` (`.workspace-page-shell`), `landing.css:1` (`.gk-landing`). IBM Plex Sans is never loaded. |
| `Inter,"Segoe UI"` redeclared | `matches-experience.css:2`, `match-detail-refinement.css:12`, `competition-detail.css:2`, `landing.css:142`, `embedded-map-filters.css:1` |
| `Bahnschrift`/`Arial Narrow` condensed | 7 declarations in `schedule-week-board.css`, `schedule-direction-workspace.css` and `schedule-editor-identity.css` |
| `Georgia` serif | 7 declarations: `landing.css:73` and `:118`, `landing-stadium.css:130`, `landing-chapters.css:78`, `role-scenes.css:12` and `:24`, **`opportunities.css:16` (inside the product UI)** |
| Tailwind `font-sans`/`font-mono`/`font-[…]` | 0 |
| Total `font-family` declarations | 30, of which 12 are `inherit` |

### 3.2 Effective type scale

Combined usage across CSS px, exact rem equivalents and Tailwind (5,220 total):

| px | CSS | TW `text-[Npx]` | TW named | **Total** |
|---|---|---|---|---|
| 5–7 | 41 | 0 | 0 | 41 |
| 8 | 62 | 4 | 0 | 66 |
| 9 | 152 | 16 | 0 | 168 |
| **10** | 360 | 176 | 0 | **536** |
| **11** | 563 | 186 | 0 | **749** |
| **12** | 874 | 14 | 482 (xs) | **1,370** |
| **13** | 509 | 8 | 0 | **517** |
| **14** | 248 | 5 | 643 (sm) | **896** |
| 15 | 80 | 2 | 0 | 82 |
| 16 | 111 | 0 | 30 (base) | 141 |
| 17 | 63 | 0 | 0 | 63 |
| 18 | 64 | 0 | 31 (lg) | 95 |
| 19 | 40 | 0 | 0 | 40 |
| 20 | 51 | 0 | 37 (xl) | 88 |
| 21–23 | 98 | 0 | 0 | 98 |
| 24 | 36 | 0 | 32 (2xl) | 68 |
| 25–29 | 83 | 0 | 0 | 83 |
| 30 | 23 | 0 | 20 (3xl) | 43 |
| 31–95 | 64 | 0 | 10 | 74 |

- **56% of all size usages are 12px or smaller**, and 30% are smaller than 12px. 78% fall between 10 and 14px.
- **47 distinct px sizes** are in use. Every integer from 5 to 40 appears.

### 3.3 Headings

| | Count |
|---|---|
| JSX `<h1>` / `<h2>` / `<h3>` | 117 / 491 / 338 |
| `<h1>` with no `className` (styled by an ancestor CSS selector) | 80 of 117. 31 use Tailwind (`text-3xl` ×10, `text-2xl` ×7, `text-xl` ×6). |
| CSS `font-size` declarations on `h1` selectors | 117, with **69 distinct values**: 30px ×10, 28px ×7, 34px ×6, 25px ×6, 32px ×5, 26px ×5, plus 30 distinct `clamp()` values |
| CSS `font-size` declarations on `h2` / `h3` | 307 with 72 distinct / 207 with 40 distinct |
| Shared page-header component | **None** |

Three scope-level heading rules exist:

| Rule | Size | Other values | Applies to |
|---|---|---|---|
| `product-design.css:74-77` | `clamp(28px, 2.6vw, 38px)` | lh 1.2, weight 750, `-.035em`, header gap 20, mb 24 | 8 discovery page h1s |
| `workspace-design.css:307-310` | `clamp(28px, 2.5vw, 38px)` | | `.mw-heading`, `.org-setup-header`, `.venue-workspace-heading`, `.rw-heading`, `.tw-header` |
| `squad-design.css` `.sd-heading` | `clamp(25px, 2.8vw, 36px)` | lh 1.13 | Club workspace tabs |

### 3.4 Uppercase "eyebrow" labels (e.g. "YOUR DAILY STARTING POINT" in `locales/clubOverview.ts:2`, rendered with `.sd-eyebrow`)

| Form | Count |
|---|---|
| CSS rules with `text-transform: uppercase` | **106 rules in 58 files**. Sizes: 10px ×47, 11px ×28, 9px ×14, 12px ×5. Letter-spacing has 22 distinct values (`.12em` ×16, `.08em` ×13, `.1em` ×9, …). Weights 600–900. |
| Distinct `*-eyebrow` / `*-kicker` class names in CSS | **40**: `landing-eyebrow`, `atlas-eyebrow`, `venue-eyebrow`, `parent-eyebrow`, `mx-eyebrow`, `co-eyebrow`, `store-eyebrow`, `sd-eyebrow`, `cp-eyebrow`, `tw-eyebrow`, `request-eyebrow`, `rw-eyebrow`, `workspace-section-kicker`, `ops-kicker`, `org-setup-kicker`, … |
| JSX `className` attributes using an eyebrow/kicker class | **236** |
| Inline Tailwind eyebrows (`uppercase` + `tracking-*` + `text-xs` or `text-[9–12px]`) | **154 in TSX**. Top: MapFilterSidebar 30, AccountPage 11, ClubManagementModal 11, UserProfilePage 7, BracketEditor 7. |
| `eyebrow=` props (`SectionHeader`, `EntitySection`) | 24 |
| **Total eyebrow sites** | **≈414** |

Letter-spacing and line-height:

- CSS letter-spacing: 78 distinct values over 378 declarations.
- Tailwind tracking: 16 distinct, mostly arbitrary (`[0.14em]` ×41, `[0.18em]` ×36).
- CSS line-height: 39 distinct values.

**Consolidate:** one heading component with 3 levels taken from the product-design values, one `Eyebrow` style (or remove eyebrows from work pages, as `AGENTS.md` already asks), and a type scale of 12/13/14/16/18/22/28–38 using weights 400/500/600 only, unless more Inter weights are loaded.

---

## 4. Layout widths and app shell

### 4.1 Layout modes in `App.tsx`

All modes sit inside `div.product-app-shell` (L428). `TopNav` renders `nav#app-top-navigation`, which is sticky at z-1500, uses `AppPageFrame` and has a 56px primary row. `--app-header-height` is 100px.

| Mode | Routes | Markup | Width |
|---|---|---|---|
| Landing/auth | `/`, `/login`, `/signup`, … | `<main>` | Page-owned |
| **Immersive canvas** | `/map`, `/world`, `/calendar`, `/messages`, `/onboarding`, `/dob`, `/set-password`, `/clubs/:id/workspace`, `/clubs/:id/operations`, `/tournaments/:id/workspace` | `<main class="relative w-full">` with height `calc(100dvh - header)`. TopNav is collapsible here. | Full width |
| **Framed** (most routes) | Routes in the `isFullScreenPage` list (`App.tsx:290-315`) that are not immersive | `<main class="app-page-shell">` > `AppPageFrame.app-route-frame.py-6` | `.app-page-frame` **2240px**, gutters 16/24/32px. `/clubs`, `/clubs/:id`, `/organizations/:id` and `/profile/:id` use the `bleed` variant (no max-width). |
| **Home feed** | `/home`, `/feed` | `.feed-home-shell` > `HomeOpportunities` + `.feed-home-grid.home-feed-layout`: `LeftSidebar` + `main` + `RightSidebar` | Frame 1920px. Columns `1fr` → `240 \| 1fr` @1024 → `240 \| 680 \| 240` @1280 → `280 \| 680 \| 280` @1536 (`home-feed.css`, `home-rails.css`) |
| Fallback | Unknown routes only | Tailwind grid `max-w-[1480px]` `220px \| 1fr \| 280px` (`xl: 220 \| 720 \| 280`) with both sidebars | 1,480px |

### 4.2 Shell components

| Component | Lines | Status |
|---|---|---|
| `components/layout/TopNav.tsx` | 521 (38 KB) | Header. Imports only `football-nav-switch.css`; the rest of its styling is in `index.css` (`.top-nav-*`, `.world-nav-button`), `theme.css`, `home-feed.css` and `product-identity.css`. |
| `components/layout/LeftSidebar.tsx` / `RightSidebar.tsx` | 126 / 230 | Home rails (`.home-side-rail`); also mounted in the fallback grid |
| `components/layout/RouteViewport.tsx` | 40 | Wraps every route in `.app-route-arrival`, plus `.workspace-design-scope` when `workspaceSurface()` matches one of 12 surfaces (club, organization, venue, tournament, squad, referee, agent, family, schedule, messages, admin, connections) and `.product-design-scope` from `productSurface()`. Imports `workspace-design.css` and `product-design.css`. |
| `components/layout/productDesign.ts` | 57 | `productSurface()` has 10 surfaces. It is undefined for `/home`, `/feed`, `/clubs/:id` and `/organizations/:id`. `useProductDesign` toggles `html.product-design-active` (which switches the palette in `theme.css`) and `data-product-surface`. |
| `AppPageShell.tsx`: `AppPageFrame` | | Used by App, TopNav and PageHeroSection |
| `AppPageShell.tsx`: `AppPageShell`, `LeftRail`, `CenterCanvas`, `RightRail` | | **0 uses (dead)**. Their CSS (`.app-page-grid*`, `.app-left-rail`, `.app-center-canvas`, `.app-right-rail`, `.app-page-column-band`) is effectively dead too. |
| `EntityPageLayout.tsx`: `EntityPageLayout`, `EntityBannerBand` | | **0 uses** |
| `EntityPageLayout.tsx`: `EntitySection` / `EntityHeaderBand` / `EntityFrame` | | 1 use each (MyClubInvitationsPanel, MyClubPage) |
| `PageHeroSection.tsx` | | 1 use (`ClubHero`) |

### 4.3 Page max-widths

There are 33 distinct values of 900px or more in CSS. The value that wins is the one stated by specificity, not by render.

| Route family | Root class | Declared max-width (file:line) | Scope override |
|---|---|---|---|
| Discovery: matches, store, stadiums, jobs, volunteer, event venues | `.mx-page` `.store-page` `.venue-page` `.jobs-directory` `.jobs-detail` `.volunteer-page` `.ev-page` | mx 1600 (`match-exchange.css:8`), mx `:is(…)` 1440 (`:750`), mx-detail 1600/1440, store 1440, venue 1560, venue-directory 1440, **jobs-detail 960 (`store.css:159`) and 1220 (`jobs-opportunities.css:645`)**, volunteer 1160, ev 960 | **1520** (`product-design.css:69`, padding `28px clamp(16px,3vw,40px) 64px`) |
| Requests, tryouts | `.request-centre` `.tryout-page` | 1100 / 1120 | **1200** (`product-design.css:73`) |
| Account, notifications, tournament directory | `.account-page` `.notifications-page` `.tournament-directory` | – | **1520** (`product-design.css:113`) |
| Matches hub, competition detail | `.mc-hub` `.competition-detail` | 1520 (`matches-hub.css:1`), 1440 (`matches-experience.css:2`), 1440 | – |
| Tournaments | `.tc-directory` `.tc-workspace` `.tournament-public-page` `.td-hub` `.tournament-setup` | 1600 / 1660 (`tournament-hub.css`), 1600 (`tournament-public.css`), `var(--app-page-max-width,2240px)`, setup 1240 / 1320 | tw-workspace 1520 |
| Workspaces | `.my-work-page` `.parent-hub` `.squad-page` `.rw-workspace` `.venue-workspace` `.org-setup` `.tw-workspace` `.club-connections` `.admin-workspace` | my-work 1424 · parent-hub **1220 / 1480 / 1640 / 1680** · squad-page **1320 / 1380 / 1600 / 1720** · rw 1600 · org-setup 1120 · club-connections 1120 · agent panel 1280 | **1520** (`workspace-design.css:87`, padding `32px clamp(16px,3vw,48px) 64px`) |
| Club workspace content | `.workspace-tab-content` `.work-home` `.club-overview` | **1424** (`workspace-design-theme.css:41`) vs **1480** (`workspace-experience.css:15`), 1320 (`workspace-home.css:6`), 1280 (`workspace-polish.css:7`) | Full-width canvas |
| Club public profile | `.club-profile-frame` `.club-page-frame` `.club-directory-frame` | 1680 (`club-overview.css:3`), `var(--app-page-max-width)` (`index.css:1407`), `min(1880px, 100vw - 24px)`, 1680 | Bleed |
| Organization/entity profile | `.entity-profile-frame` | 1680, `var(--app-page-max-width, 1920px)` | Bleed |
| Club squads (public) | `.sp-page` | 1480 | – |
| Admissions | `.admission-applicant` `.club-admission` | 1120, 1440, 1320 | – |
| Misc | | ops 1700, schedule-bounded 1760, dola 1240, workspaces-page 1180, mh-page 1180, my-club-gallery 1490, moderation 900 | – |
| Tailwind-only pages | | `max-w-5xl` (1024px): AgentDashboard, FollowedClubs, FootballRoles, People. `max-w-6xl`: AuthSplitShell, MyClubPage. `max-w-3xl`: Notifications, Account section, BrowseClubs intro. `max-w-4xl`: ClubPublicProfileSettings. `max-w-[680px]`: Feed, Post, TabOverview. `max-w-[760px]`: UserProfile. | – |

Breakpoints: there are 54 distinct px values. The most used are 600 (58), 767 (30), 760 (27), 700 (27), 900 (19), 1100 (19), 650 (14) and 1000 (13). Near-duplicates include 639/640, 767/768, 1023/1024, 1099/1100 and 1199/1200. Container queries appear in 14 files.

**Consolidate:** one `PageFrame` component with 3 widths (reading ≈720, content 1520, full canvas) and one breakpoint set. Delete `AppPageShell`, `EntityPageLayout` and the per-feature `max-width`s that the 1520 scope rules already override.

---

## 5. Repeated UI patterns

| Pattern | Distinct implementations | Best existing one to keep | Where the duplicates live |
|---|---|---|---|
| **Page header / hero** | No `PageHeader` component. Components: `SectionHeader` (`components/workspace/helpers.tsx`, 15 uses / 10 files, section level), `EntitySection` (1), `PageHeroSection` (1), `ClubHero`, `ClubProfileStickyHeader`, `OpportunityHeader`, `AdmissionSessionHeading`, `ScheduleWorkspaceHeader` (orphan). **151 heading/header/head/hero CSS classes in 64 prefix families**; 42 distinct root header classes in JSX; 69 distinct h1 sizes. | Product-design heading spec (`product-design.css:74-77`) for the page level; `SectionHeader` for sections | `.mx-head`, `.store-heading`, `.venue-directory-heading`, `.venue-workspace-heading`, `.tw-header`, `.rw-heading`, `.mw-heading`, `.org-setup-header`, `.sd-heading`, `.squad-page-heading`, `.coach-room-header`, `.parent-profile`, `.tournament-setup__header`, `.sp-page-heading`, `.connections-heading`, … |
| **Card / panel** | No `Card` component (`.app-card` has 3 uses). **128 card/panel/tile classes in 63 families.** **259 inline Tailwind cards** (rounded + border + `bg-[…]` + padding) in 83 files; top: `ContextPanel` 18, `AdminPage` 15, `UserProfilePage` 12, `AccountPage` 11, `TournamentDetailPage` 11, `ClubManagementModal` 11. 21 distinct card radii. | Product-design card spec: 1px `--color-border`, **14px** radius, `--color-surface`, no shadow. `product-design.css:78-80` forces it on 32 listed classes; `workspace-design.css:311-313` on 9 more. | Every feature CSS file (`mx-panel`, `venue-panel`, `store-product-card`, `campaign-card`, `job-card`, `parent-panel`, `org-setup-card`, `tw-*`, …). Tailwind `rounded-xl` (12px, 332 uses) conflicts with the 14px spec. |
| **Stat tile / facts** | `StatTile` (local to AccountPage, 3), `StatCard` (local to ClubManagementModal, 9 uses / 2 files), `MetricCardV2` (**orphan**), `RecordFacts` (`.gk-record-facts`, 2), `CompetitionFacts`, `OpportunityFacts`/`TermsFacts`, `Fact` (ClubPreviewContent). 22 stat/metric classes in 14 families. | `components/ui/RecordFacts.tsx` + `.gk-record-facts` (`workflow-ui.css`; tokens, auto-fit grid) | `venue-owner-metrics`, `club-overview-stat(s)`, `admission-metric(s)`, `rc-metric(s)`, `tc-metrics`, `parent-stats`, `profile-stat-grid`, `trip-stats`, `schedule-workspace-stat`, `journey-action-metrics`. `tw-stat-*` in `index.css` and `venue-operation-stats` / `op-review-stats` are dead. |
| **Tabs / segmented** | Shared: `SelectionIndicator` + `.app-selection-rail` (`app-motion.css`; 8 files), `DiscoverySectionTabs` (5 files, opportunities only), `EntityTabs` (1). **32 tab/segment classes in 24 families.** `aria-pressed` in 68 files; `role="tablist"` in only 8. | `.app-selection-rail` + `SelectionIndicator` (underline, URL state; endorsed in `DESIGN.md`) | `mx-tabs`, `mh-periods`, `request-tabs`, `tw-tabs`, `squad-tabs`, `venue-owner-tabs`, `venue-section-tabs`, `volunteer-tabs`, `admission-view-tabs`, `entity-profile-tabs`, `tc-hub-tabs`, `mc-entry-tabs`, `mc-view-switch`, `cp-view-switch`, `cp-filter-tabs`, `schedule-*-segments`, `sd-segments`, `rw-segments`, `mp-tabs`, `mw-view-tabs`, `workspace-staff-tabs`, `workspace-record-tabs`, … |
| **List rows** | 16 row components: `DetailRow`, `InfoRow`, `WorkspaceRow`, `CheckRow`, `RadioRow`, `NotificationListItem`, `PersonRow`, `AssignmentRow`, `SessionRow`, `RequirementRow`, `InquiryRow`, `LegacyRow`, `PreviewEntry`, `TryoutEntry`, `CalendarEntry`, `ClubAccessEntry`. `DataTable` (helpers; 6 uses / 5 files). 56 row/item classes in 35 families. 13 `<table>` elements in 11 files. | `DataTable` for tables; no shared row exists | Spread across features (`op-*` 8, `tw-*` 4, `map-*` 3, …) |
| **Empty state** | `EmptyState` (`components/ui/EmptyState.tsx` + `.gk-empty`; imported by 26 files). The `helpers.tsx` `EmptyState` wrapper delegates to it (5 importers). `EmptyStateCard` (6 uses, 2 of them in orphan pages). `AdmissionEmpty` (6 uses / 2 files). **60 `*-empty` classes in 45 families.** | **`components/ui/EmptyState.tsx`** (icon, title, description, one action, compact variant) | `mx-empty`, `store-empty`, `jobs-empty`, `request-empty`, `volunteer-empty`, `venue-empty`, `parent-empty`, `squad-empty`, `tw-empty`, `td-empty`, `op-empty`, `co-empty`, `cp-empty`, `rw-empty`, … |
| **Error state** | `ErrorBlock` (helpers; 10 uses / 7 files), `AdmissionError` (39 uses / 21 files), `ErrorBoundary` / `RouteRecoveryPage` (route level). **`role="alert"` appears 388 times in 244 files**, mostly inline. 37 error/alert classes in 33 families. | `AdmissionError` shape (`role="alert"`, message, optional retry; the most used). `ErrorBlock` is the generic Tailwind equivalent. | Inline Tailwind alerts in ClubWorkspacePage, AccountPage, AdminPage, …; `mp-error`, `squad-error`, `org-error`, `tw-error`, `ttr-dialog-error`, … |
| **Loading / skeleton** | `PageSpinner` (13 uses / 11 files), `AdmissionLoading` (15 / 10), `PageBootSpinner` (App), the RouteViewport text fallback, `SkeletonCard` (7 / 3), `SkeletonMessageRow` (4 / 1), `SkeletonHero` (0). **`animate-spin` 144 times in 84 files** (`Loader2` 140); `animate-pulse` 7. 18 loading/skeleton classes in 15 families. | `SkeletonCard` for collections (`DESIGN.md` asks for layout-matched skeletons); `PageSpinner` for pages | `mc-skeletons`, `venue-skeleton`, `jobs-loading`, `jobs-detail-loading`, `mp-loading`, `sw-loading`, `td-loading`, `entity-profile-loading`, … |
| **Buttons** | No `Button` component. 2,102 `<button>` elements: 885 styled by a CSS class, 299 Tailwind-only, 48 mixed, **722 with no class** (styled by ancestor selectors; 900 CSS selectors end in `button`). 731 `<Link>`. **116 button classes in 46 families: 44 primary variants**, 10 secondary, 12 text, 8 icon, 6 danger. **42 inline Tailwind accent-filled primaries in 32 files.** 22 distinct button radii. | `.app-text-action` (`actions.css`; 52 uses / 30 files) for text actions; the primary spec in `product-design.css:93-95` (accent + on-accent, no shadow, normalizes 6 classes) | Primary classes: `mx-primary`, `tw-primary`, `venue-button-primary`, `venue-button--primary`, `cp-button-primary`, `sd-primary`, `admission-primary`, `parent-button-primary`, `prf-primary`, `org-setup-primary`, `entity-button-primary`, `schedule-*-primary` (×4), `map-primary-button`, `post-primary`, `mc-primary`, `ttr-primary`, … Busiest families: `venue-button` 116 JSX uses, `tw-button/primary` 66, `sd-*` 66, `parent-button` 47, `admission-*` 45. |
| **Form fields / selects** | `AdmissionField` (**69 uses / 7 files**; the only one with label/hint/aria wiring), `Field`/`TimeField` (mapPlanning), `TextField` (MapFilterSidebar), `SmoothSelect`, `ImageUploadField`, `LocationPicker`, plus 7 `*Picker`. 47 field/input/select classes in 28 families. 669 `<input>` (**543 without className**), 324 `<select>`, 152 `<textarea>`, 963 `<label>`. 17 distinct input radii. Global normalizers set min-height 42px (`product-design.css:81`) and 44px (`:173`, `workspace-design.css:314`). | `AdmissionField` (`features/admissions/club/ui.tsx`) | `venue-field`, `prf-field`, `mp-field`, `tw-field`/`tw-input`, `rc-form-field`, `store-field`, `post-field`, `joining-field`, `map-input`, … (`op-field` is dead) |
| **Modals / drawers** | `ConfirmDialog` (17 uses / 14 files) is the only shared dialog. Shared behaviour: `useDialogFocus` (44 files), `usePanelMotion` (10). **36 `*Modal`/`*Dialog`/`*Drawer` components**; `role="dialog"` in 49 files; 26 `fixed inset-0` overlays; 15 `createPortal`. 50 modal/dialog/drawer classes in 22 families. Motion wrappers: `app-motion-dialog`/`panel` (8 + 1 files) vs `club-motion-dialog`/`panel` (4 + 3). 13 distinct modal radii. | `ConfirmDialog` structure + `useDialogFocus` + `.app-motion-dialog` | `tw-modal-*`, `tw-dialog`, `sw-dialog-*`, `rc-dialog-*`, `ttr-dialog-*`, `mp-dialog`, `prf-dialog`, `parent-dialog`, `post-dialog`, `joining-dialog`, `mobile-schedule-sheet`, `club-preview-drawer`, `wo-drawer-backdrop`, … |
| **Badges / chips** | 12 components: `StatusBadge` (`components/ui`, 7 / 3), `Pill` (helpers, 13 / 5; the same 5 tones as StatusBadge), `AdmissionPill` (14 / 3), `TournamentStatusBadge` / `TournamentScopeBadge` / `RegistrationPolicyBadge`, `Status` (matchExchange, 10 / 6), `TrialistBadge`, `OpportunityBadge`, `Tag`, `ToggleChip`, `ExtensionDemoLabel`. **58 inline Tailwind badges in 34 files.** 49 badge/chip/pill classes in 27 families. 11 distinct radii. | `components/ui/StatusBadge.tsx` (5 semantic tones on `--state-*`; bump its 10px text) | `Pill` ≈ `StatusBadge` ≈ `AdmissionPill`; classes `map-chip`/`map-pill`, `mp-pill`, `tw-badge`/`tw-status-badge`, `venue-tag`, `op-badge`, `admission-pill`, `parent-badge`, `chat-role-badge`, … |

Primitives that are already well adopted: `MediaImage` (114 uses / 74 files), `EmptyState`, `ConfirmDialog` and `useDialogFocus`.

**Consolidate:** build about 10 primitives: PageHeader, Card, Stat/Facts, Tabs, Button, Field, Dialog, Badge, Empty/Error/Loading. Retire the 40 per-feature class families and the scope-level `:is(...)` normalizer lists in `product-design.css` and `workspace-design.css`.

---

## 6. Largest files and dead CSS

### 6.1 CSS top 20 by lines (bytes in parentheses)

Many files are minified onto a few lines, so bytes are the truer size. Biggest by bytes outside this list: `map-atlas.css` 41 KB / 400 lines, `landing-electric.css` 40 KB / 251 lines, `landing-chapters.css` 32 KB, `landing-stadium.css` 31 KB, `landing.css` 30 KB / 150 lines, `matches-experience.css` 27 KB / 211 lines, `store.css` 27 KB, `squad-communication.css` 25 KB / 129 lines, `planning.css` 24 KB / **33 lines**. 18 CSS files are over 300 lines and 37 TSX files are over 400.

| # | File | Lines | Bytes |
|---|---|---|---|
| 1 | `src/index.css` | 4,055 | 141,088 |
| 2 | `features/venues/venues.css` | 1,996 | 48,188 |
| 3 | `features/clubs/jobs-opportunities.css` | 1,039 | 22,758 |
| 4 | `components/schedule/schedule-event-editor.css` | 996 | 23,738 |
| 5 | `features/matchExchange/match-exchange.css` | 949 | 29,787 |
| 6 | `components/squads/player-roster-forms.css` | 912 | 21,063 |
| 7 | `features/tournaments/components/tournament-workspace.css` | 812 | 18,659 |
| 8 | `features/parents/family-workspace.css` | 713 | 35,136 |
| 9 | `components/schedule/schedule-week-board.css` | 641 | 14,080 |
| 10 | `components/workspace/opportunities/opportunities.css` | 543 | 45,688 |
| 11 | `components/squads/squad-public.css` | 479 | 9,950 |
| 12 | `components/squads/squad-workspace.css` | 455 | 9,596 |
| 13 | `components/schedule/schedule-direction-workspace.css` | 452 | 11,329 |
| 14 | `components/map/map-atlas.css` | 400 | 41,448 |
| 15 | `features/parents/parents.css` | 380 | 23,440 |
| 16 | `components/workspace/workspace-design-theme.css` | 369 | 26,737 |
| 17 | `components/squads/squad-roster.css` | 343 | 8,202 |
| 18 | `components/landing/landing-stadium.css` | 319 | 31,302 |
| 19 | `components/schedule/schedule-editor-identity.css` | 287 | 9,562 |
| 20 | `components/landing/landing-chapters.css` | 272 | 32,181 |

Override and refinement layers that restyle other files make up 15 files and 206 KB: `product-design.css` 23.6 KB, `workspace-design.css` 12.1 KB, `product-identity.css`, `workspace-design-theme.css` 26.7 KB, `workspace-experience.css` 20.2 KB, `workspace-polish.css` 18.9 KB, `matches-experience.css` 27.3 KB, `club-profile-refinement.css`, `match-detail-refinement.css`, `parent-hub-refinement.css`, `planning-polish.css`, `club-design-theme.css`, `recruitment-design.css`, `squad-design.css`, `schedule-editor-identity.css`, …

### 6.2 TSX top 20 by lines

| # | File | Lines | Bytes |
|---|---|---|---|
| 1 | `components/map/MapExperience.tsx` | 2,263 | 135,511 |
| 2 | `pages/ClubWorkspacePage.tsx` | 1,280 | 75,075 |
| 3 | `components/schedule/EventCreationModal.tsx` | 1,280 | 79,719 |
| 4 | `components/map/MapFilterSidebar.tsx` | 1,279 | 80,545 |
| 5 | `pages/UserProfilePage.tsx` | 1,117 | 67,585 |
| 6 | `pages/AccountPage.tsx` | 1,040 | 67,169 |
| 7 | `pages/MessagingPage.tsx` | 1,004 | 63,513 |
| 8 | `features/venues/VenueEditors.tsx` | 896 | 42,369 |
| 9 | `components/schedule/ScheduleGrid.tsx` | 896 | 40,105 |
| 10 | `pages/CalendarPage.tsx` | 863 | 38,408 |
| 11 | `features/tournaments/components/BracketEditor.tsx` | 844 | 50,998 |
| 12 | `features/tournaments/components/BracketTree.tsx` | 821 | 45,564 |
| 13 | `pages/ClubSquadsPage.tsx` | 722 | 34,231 |
| 14 | `components/workspace/tabs/PlayersTab.tsx` | 702 | 44,317 |
| 15 | `features/tournaments/components/TournamentCompetition.tsx` | 676 | 26,889 |
| 16 | `components/workspace/tabs/SquadsTab.tsx` | 651 | 34,688 |
| 17 | `pages/TournamentDetailPage.tsx` | 636 | 59,335 |
| 18 | `features/tournaments/components/TournamentBracketBoard.tsx` | 570 | 22,992 |
| 19 | `pages/MatchDetailPage.tsx` | 548 | 27,430 |
| 20 | `pages/JobsDirectoryPage.tsx` | 536 | 28,071 |

### 6.3 Dead CSS sample (top 10 CSS files by lines)

A class counts as unreferenced when it never appears literally in any TS/TSX/HTML file and no dynamic `prefix-${…}` construction matches it. "Dead rules" are rules where every selector contains an unreferenced class.

| File | Classes | Unreferenced | Dead rules / bytes | Notable dead families |
|---|---|---|---|---|
| `index.css` | 299 | **109 (36%)** | 171 rules / **37.3 KB of 141 KB** | `.schedule-page-shell` + `schedule-ribbon-*`/`schedule-page-*` (whole block from L1591); `.tournament-workspace-shell` + `tw-table`/`tw-btn-*`/`tw-stat-*`/`tw-modal-*` (L3403–3532, "Soviet Brutalist"); `chat-messenger-shell` children (`chat-role-badge`, `chat-msg-tick`, …); legacy `map-rail`/`map-filter-card`/`map-chip`/`map-input`/`talanti-map-marker--*`/`map-design-futuristic`; `feed-story-*`; unused utilities `bg-base`, `bg-surface`, `shadow-float`, `theme-surface-inset`, … |
| `components/workspace/opportunities/opportunities.css` | 116 | **60 (52%)** | 250 rules / **19.1 KB of 45.7 KB** | The whole `op-editor-*`/`op-form-*`/`op-live-*`/`op-review-*`/`op-art-*` editor |
| `features/venues/venues.css` | 140 | 23 (16%) | 85 rules / 9.2 KB | `venue-week-grid`, `venue-day-timeline`, `venue-editor*`, `venue-operations-toolbar`, `venue-directory-hero`, … |
| `features/matchExchange/match-exchange.css` | 102 | 13 (13%) | 55 rules / 6.3 KB | `mx-referee*`, `mx-workspace-nav`, `mx-listing-columns`, `mx-availability-layout`, … |
| `features/clubs/jobs-opportunities.css` | 71 | 8 (11%) | 32 rules / 4.6 KB | `jobs-pathway*` |
| `features/parents/family-workspace.css` | 107 | 13 (12%) | 34 rules / 3.0 KB | `parent-hub-header`, `parent-actions`, `parent-family-summary`, … |
| `features/tournaments/components/tournament-workspace.css` | 69 | 2 | 1 rule | `tw-count`, `tw-refresh` |
| `schedule-event-editor.css`, `player-roster-forms.css`, `schedule-week-board.css` | 46 / 59 / 36 | 0 | 0 | – |
| **Top-10 total** | | | **≈80 KB of 400 KB (20%) dead** | |

Spot checks outside the top 10: `map-atlas.css` 4 unreferenced classes, `landing-electric.css` 0, `workspace-design-theme.css` 1.

### 6.4 Other dead code relevant to the redesign

**27 orphan `.tsx` files** (2,596 lines) are imported by nothing, not even tests:

- `pages/MarketplacePage.tsx` 332, `NeedsBoardPage.tsx` 206, `OpportunityDirectoryPage.tsx` 154, `CreateClubPage.tsx` 7. The `/marketplace` and `/needs` routes render `RouteRecoveryPage` instead.
- `components/ui/CollapsiblePanel.tsx`, `CompactFilterSummary.tsx`, `DetailPanelSection.tsx`
- `components/workspace/MetricCardV2.tsx`, `QuickLinkTile.tsx`, `tabs/AgentEngagementsTab.tsx` 186
- `components/tournaments/TournamentCard.tsx` 114, `TournamentListCard.tsx` 111
- `components/store/ProductCard.tsx` 94, `ProductQuickViewModal.tsx` 154
- `components/map/VisibleClubsRail.tsx` 165, `components/landing/LandingCommandPalette.tsx` 184
- `components/schedule/ScheduleWorkspaceHeader.tsx` 76, `components/club/ClubSidebar.tsx` 72
- `components/club/tabs/TabTeams.tsx` 132, `TabOpportunities.tsx` 81
- `features/tournaments/components/EntryReviewPanel.tsx` 179
- `features/parents/ChildActivationDialog.tsx` 81
- 6 smaller files

All 160 CSS files are imported somewhere; there are no orphan stylesheets.

**Consolidate:** delete the dead `index.css` blocks (≈37 KB), the opportunities editor CSS (≈19 KB), the 27 orphan TSX files and the `AppPageShell`/`EntityPageLayout` remnants before the redesign starts.

---

## 7. Workspace shells

**There are 10 workspace roots and 0 shared workspace-shell components.** `RouteViewport` adds the same `.workspace-design-scope` wrapper to all of them. That wrapper does three things:

- sets the product palette
- applies a 1520px max-width and `32px clamp(16px,3vw,48px) 64px` padding to 10 listed roots
- applies one h1 rule to 5 listed headers

Everything else is per-workspace.

| Workspace | Route(s) | App mode | Root component → class | Navigation pattern | Header | Declared width → effective | CSS (bytes) |
|---|---|---|---|---|---|---|---|
| **Club** | `/clubs/:id/workspace` (`/operations` redirects here; `/squads` and `/profile-settings` share the `club` surface) | **Immersive** (full width, collapsible TopNav) | `pages/ClubWorkspacePage.tsx` (1,280 lines) → `.workspace-page-shell.club-workspace-shell.workspace-refresh[.workspace-light]`, a flex row | **App-like left sidebar**: `WorkspaceSidebar.tsx` (119) `aside > nav.work-navigation` with grouped disclosures. Width declared **3 times: 232px (`workspace-polish.css:3`), 236px (`workspace-home.css:102`), 246px (`workspace-experience.css:20`)**. Mobile drawer + `.workspace-mobile-bar` (`index.css:3840+`). Legacy right `ContextPanel.tsx` (336). | `.work-breadcrumb` + per-tab `.sd-heading` / `.club-overview-panel-heading` with the `.sd-eyebrow` uppercase label | `.workspace-tab-content` **1424 vs 1480**; `.work-home` 1320; `.club-overview` 1280 | `index.css` (`.workspace-page-shell` 40-token block, `.workspace-light` 19), its own palette block in `theme.css`, `workspace-design-theme.css` 26.7K, `workspace-experience.css` 20.2K, `workspace-polish.css` 18.9K, `workspace-home.css` 13.1K, `squad-design.css` 4.3K + tab CSS. **227 `.club-workspace-shell` selectors in 6 files; 199 `.workspace-refresh` selectors in 3 files.** |
| **Organization** | `/organizations/:id/workspace`, `/organizations/create` | Framed | `pages/OrganizationWorkspacePage.tsx` (87) → `.org-setup` | Horizontal **button row** `.org-setup-nav` (`aria-current`, overflow-x) | `.org-setup-header` + `.org-setup-kicker` | 1120 → **1520** | `organizations/setup/setup.css` 4.9K (5 lines) |
| **Tournament** | `/tournaments/:id/workspace` (`/tournaments/setup` is separate) | **Immersive** | `pages/TournamentWorkspacePage.tsx` (171) → `.tw-workspace.tc-workspace` | Grid `.tc-workspace-frame` 185px (160 @breakpoint) left `nav.tw-tabs` (`aria-pressed` buttons). `workspace-design.css` also styles `.tw-tabs` as a horizontal scroller. | `.tw-header` + `.tw-eyebrow` | 1600 / 1660 → **1520** | `tournament-workspace.css` 18.7K, `tournament-hub.css` 13.0K, plus a dead `.tournament-workspace-shell` block in `index.css`. Setup: `tournament-setup.css` (1240 / 1320). |
| **Stadium / venue** | `/stadiums/:id/manage` | Framed | `pages/StadiumWorkspacePage.tsx` (75) → `main.venue-page.venue-workspace` | Grid `.venue-workspace-layout` **220px** (190 @801–1200) left `aside.venue-workspace-sidebar` with grouped nav | `.venue-workspace-heading` + `.venue-eyebrow` | 1560 → **1520** | `venues.css` 48.2K + `venue-owner.css` 14.1K |
| **Referee** | `/referees/me` | Framed | `features/refereeWorkspace/RefereeWorkspace.tsx` (89) → `.mx-page.rw-workspace` | Grid `.rw-layout` **210px** (175) `aside.rw-sidebar` + `nav.rw-segments` | `.rw-heading` | 1600 → **1520** | `referee-workspace.css` 13.6K + `match-exchange.css` (`mx-*`) |
| **Agent** | `/agent`, `/agent/dashboard` | Framed | `pages/AgentDashboardPage.tsx` (361) → `.agent-hub` (Tailwind `md:flex`) | Tailwind **`aside.w-64` (256px)** + `nav` | Tailwind utilities | panel 1280 | `agent-hub.css` 1.1K; styling is mostly inline Tailwind on `--fc-*` tokens |
| **Parent hub / family** | `/parent`, `/parent/enrollment` | Framed | `pages/ParentHubPage.tsx` (89) → `.parent-hub.parent-hub-refined.connected-parent-hub.parent-workspace-content` | Child picker `nav.parent-children` + content with **right rail** `.parent-family-layout`, declared as **260px / 285px / 300px in 3 files** | `.parent-profile` + `.parent-eyebrow` | 1220 / 1480 / 1640 / 1680 → **1520** | **6 stylesheets imported by one page**: `parents.css` 23.4K, `family-workspace.css` 35.1K, `squad-life.css` 11.6K, `parent-hub-refinement.css` 5.8K, `parent-workspace.css` 3.7K, `connected-parent-hub.css` 3.1K |
| **Squad** | `/squads`, `/squads/:id` | Framed | `pages/SquadCommunicationPage.tsx` (78) → `main.squad-page[.coach-room]`, `.squad-home` | Grid `.squad-room-layout` **270px** (220) left + `.squad-tabs` | `.squad-page-heading` / `.coach-room-header` + `.squad-eyebrow` | 1320 / 1380 / 1600 / 1720 → **1520** | `squad-communication.css` 24.7K, `squad-life.css`, `family-workspace.css` |
| *Club squads (public-style)* | `/clubs/:id/squads` | Framed | `pages/ClubSquadsPage.tsx` (722) → `.squad-design.squad-design-public.sp-page` | Page tabs | `.sp-page-heading` | 1480 | `squad-design.css` + `squad-public.css` 10K |
| **Admin** | `/admin` | Framed | `pages/AdminPage.tsx` (404) → `.admin-workspace` (all Tailwind) | Tailwind `flex-wrap` button row | `header.mb-6` (Tailwind) | → **1520** | No stylesheet; 133 arbitrary Tailwind values |
| *My work / connections* | `/workspaces`, `/club-operations`, `/my-club`, `/my-organizations` | Framed | `components/layout/WorkspacesPage.tsx` → `.my-work-page`; `MyClubOperationsPage` → `.club-ops.club-connections` | Lists only | `.mw-heading`, `.connections-heading` | 1424 / 1120 → **1520** | `my-work.css` 20.8K, `club-connections.css` 12.2K, `operations.css` |
| *Schedule* | `/calendar` | Immersive | `pages/CalendarPage.tsx` (863) | Schedule toolbar | – | `.schedule-bounded-workspace` 1760 | 6 `schedule-*.css` files, ≈2,650 lines |

How the workspaces differ:

1. **Navigation.** Five different left-nav implementations with five widths: 185, 210, 220, 232–246 and 256px. The squad workspace adds a sixth width (270px). Two workspaces use top button rows (organization, admin). One uses a right rail (parent).
2. **Height model.** Only Club and Tournament run as full-height canvases (`100dvh - header`). The rest scroll inside the 2240px `AppPageFrame`.
3. **Styling tech.** Club, Venue, Parent, Squad and Tournament use feature CSS. Agent and Admin are Tailwind-only. Referee reuses Match-Exchange `mx-*`.
4. **Tokens.** Club uses `--fc-*` plus `--sd-*`, Parent and Squad use `--fw-*`, Tournament `--tw-*`, Venue `--venue-*`, Referee `--mx-*`, and Agent `--fc-*` in Tailwind. All are rebound by `workspace-design.css`.
5. **Theme.** `.workspace-page-shell` has its own token block. It is reused by `AccountPage`, which is not a workspace.

**Consolidate:** one `WorkspaceShell` (left nav at a fixed width, optional right rail, PageHeader, content max-width) driven by the 12 `RouteViewport` surfaces, replacing the 10 roots and their conflicting per-feature width declarations.

---

## Appendix A. Token families defined in `index.css` and `src/styles/*.css`

There are 385 distinct names. Families with total `var()` uses:

| Family | Count | Uses |
|---|---|---|
| `--color-*` | 36 | 8,028 |
| `--fc-*` | 20 | 2,226 |
| `--club-*` | 56 | 878 |
| `--text-*` | 3 | 576 |
| `--app-*` | 34 | 399 |
| `--feed-*` | 56 | 298 |
| `--border-*` | 2 | 240 |
| `--accent-*` | 6 | 239 |
| `--bg-*` | 5 | 233 |
| `--theme-*` | 10 | 230 |
| `--mx-*` | 5 | 223 |
| `--map-*` | 18 | 186 |
| `--state-*` | 8 | 174 |
| `--chat-*` | 21 | 156 |
| `--venue-*` | 2 | 120 |
| `--op-*` | 3 | 91 |
| `--schedule-*` | 40 | 79 |
| `--fw-*` | 5 | 69 |
| `--dola-*` | 4 | 41 |
| `--gk-*` | 7 | 33 |
| `--opportunity-*` | 1 | 31 |
| `--social-*` | 6 | 30 |
| `--shadow-*` | 2 | 25 |
| `--workspace-*` | 28 | 12 |
| `--overlay-*` | 1 | 5 |
| `--landing-*` | 2 | 5 |
| `--tw-*` | 2 | 3 |
| `--blip-*` | 1 | 2 |
| `--auth-*` | 1 | 0 |

## Appendix B. Unused and undefined tokens

**Unused** (defined in token files, 0 `var()` references): `--app-theme-overlay` `--app-theme-overlay-strong` `--app-shadow-float` `--map-main-surface` `--workspace-shell-glow` `--workspace-shell-top` `--workspace-shell-bottom` `--club-system-action-icon` `--workspace-theme-base` `--workspace-theme-sidebar-bg` `--workspace-theme-text-primary` `--workspace-theme-text-secondary` `--workspace-theme-text-muted` `--workspace-theme-border` `--workspace-theme-surface` `--workspace-theme-surface-hover` `--workspace-accent` `--workspace-accent-soft` `--workspace-accent-border` `--workspace-state-danger` `--workspace-state-danger-soft` `--workspace-state-warning` `--workspace-state-warning-soft` `--workspace-state-success` `--workspace-state-success-soft` `--workspace-state-info` `--workspace-state-info-soft` `--schedule-theme-elevated` `--feed-theme-base` `--feed-theme-surface` `--feed-theme-elevated` `--feed-theme-inset` `--feed-theme-border-subtle` `--feed-theme-border-strong` `--feed-theme-text-primary` `--feed-theme-text-secondary` `--feed-theme-text-muted` `--feed-accent-blue` `--feed-accent-blue-soft` `--feed-accent-blue-border` `--feed-accent-pink` `--feed-accent-pink-soft` `--feed-accent-pink-border` `--feed-accent-orange` `--feed-accent-orange-soft` `--feed-accent-orange-border` `--feed-nav-surface` `--feed-page-surface` `--feed-shell-glow` `--feed-shell-top` `--feed-shell-bottom` `--feed-left-bg` `--feed-center-bg` `--feed-right-bg` `--feed-card-muted` `--feed-card-soft` `--feed-layer-border` `--feed-layer-bg-strong` `--feed-visual-bg` `--feed-side-divider` `--feed-online` `--feed-offline` `--feed-sidebar-header-bg` `--map-glow-strong` `--tw-font-weight-black` `--chat-header-bg` `--chat-divider` `--social-people` `--social-clubs` `--social-video` `--gk-border` `--auth-field-surface` `--color-orange-soft` `--color-cyan-soft` `--color-pink-soft` `--color-overlay-soft` `--color-overlay-strong` `--app-surface` `--app-border` `--bg-panel`

**Referenced but never defined**, with reference counts: `--border-color`(17) `--beam-height`(6) `--base-scale`(6) `--fc-surface`(6) `--border`(4) `--fc-color-blue`(4) `--card-turn-x`(3) `--card-turn-y`(3) `--feed-card-bg`(3) `--fc-danger`(2) `--theme-danger-text`(2) `--fc-bg`(2) `--surface`(2) `--text`(2) `--input-bg`(2) `--state-error`(2) `--org-kind-accent`(2) `--theme-bg`(2) `--text-inverse`(2) `--landing-parallax-y`(1) `--reading-progress`(1) `--map-accent`(1) `--muted-foreground`(1) `--atlas-ink`(1) `--border-default`(1) `--surface-panel`(1) `--mx-panel`(1) `--status-danger-text`(1) `--fc-card`(1) `--app-overlay`(1) `--bg-secondary`(1) `--bg-primary`(1) `--card-bg`(1) `--color-primary`(1) `--bg-main`(1) `--accent-ink`(1) `--border-primary`(1) `--map-text-primary`(1) `--fc-error`(1) `--fc-warning`(1) `--accent-on-primary`(1)
