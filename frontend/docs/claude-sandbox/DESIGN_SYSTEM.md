# GrassKickZ design system (sandbox overhaul)

Every redesigned screen is built from `src/design/` and nothing else. The living reference is `/design-system` in the sandbox.

## Direction

GrassKickZ is football work and football life in one place. The look is a calm, dark matchday sheet: wide pages, quiet surfaces, hierarchy from type and spacing rather than boxes-in-boxes, and one signature element — the **fixture line** (`FixtureRow`), a time column in scoreboard numerals followed by what, where and status. It appears wherever time matters: Home "This week", World "This weekend near you", the workspace "Coming up", schedules.

Kept from the owner's brief: the dark theme with the floodlight-green accent, the wide layout, the Home feed style.

## Rules

1. **Wrap redesigned surfaces in `<GkRoot>`** (class `gk`). It applies the single canonical palette (`styles/theme.css`, `.gk` block), type and scales. Do not use the legacy `--color-*`, `--fc-*`, `--club-theme-*` tokens or Tailwind arbitrary colour classes inside new work; use `--gk-*` tokens.
2. **Layout.** `PageFrame` = full width, gutter `clamp(16px…40px)`, framed at 1920px. Profiles use `width="profile"` (1440px). Never centre a narrow column with dead space on both sides. Grids: `gk-grid--split` (main + side), `gk-grid--cards`, `gk-stats`.
3. **Page header.** `PageHeader` with a sentence-case title, one line of context, actions at the right. No eyebrow labels, no slogans, no marketing copy in work screens.
4. **Type.** Inter for text, Inter Display (`--gk-font-display`) for headings and numbers. Scale: 12/13/14/16/18/22/28/36. Weights 400/500/600/700. Sentence case everywhere — no ALL-CAPS labels, no letter-spaced eyebrows. Numbers that matter (times, scores, counts) use `.gk-num` / scoreboard numerals.
5. **Structure.** Use `Section` (title + optional link) to group; `Panel` only around genuinely separate units; lists are `List` + `ListRow` / `FixtureRow` with hairline dividers, not a card per item. One radius per level: controls 10px, panels 14px, chips pill.
6. **Status.** `Badge` tones: accent (good/active), warning (needs a decision), danger (overdue/blocked), info (training/info), violet (events). Don't encode meaning by colour alone — badge text says it.
7. **Actions.** One primary `Button` per view region. Labels say what happens ("Save session", "Arrange match"), never "Submit". No arrows appended to text.
8. **States.** Every list has a loading (`Skeleton`), empty (`EmptyNote`: what's missing + the next action) and error state (`gk-notice--danger` + retry). Never invent counts or success.
9. **Tabs.** `Tabs` + `useUrlTab` so the selection lives in the URL. Minimum 44px targets.
10. **Accessibility.** Visible focus (provided), 44px touch targets, labels on every input (`Field`), reduced motion respected (provided).
11. **Code shape.** Components import the CSS they need. New feature CSS is scoped under the feature root class and uses `--gk-*` tokens only. Delete what you replace. Files over ~400 lines get split by responsibility.

## Primitives (`src/design/primitives.tsx`, `src/design/Tabs.tsx`)

`GkRoot`, `PageFrame`, `PageHeader`, `Section`, `Panel`, `List`, `ListRow`, `FixtureRow`, `StatTile`, `Button`, `ButtonLink`, `Badge`, `Count`, `Avatar`, `Field` (+ `.gk-input` on input/select/textarea), `SearchInput`, `Chip`, `EmptyNote`, `Skeleton`, `Tabs`, `useUrlTab`. Extend these rather than creating parallel versions; if a new shared primitive is needed, add it to `src/design/` with its CSS in `design.css`.
