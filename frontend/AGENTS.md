# Frontend app instructions

Applies to everything under `frontend/`. Shared project rules are in the repository-root `AGENTS.md` and the backend guide it points to.

## Code shape — leave the app smaller and clearer

- Before adding a component, hook, API call or style, search `src/` for one that already does the job and extend it.
- Delete what you replace in the same change: old components, CSS files and selectors, routes, mocks, preview pages and flags. No `*V2`/`*New` copies living side by side.
- Use idiomatic React and TypeScript: function components, hooks, types derived from the API layer. Keep data fetching in `api/` and hooks, not inside presentational components.
- A component or page growing past roughly 400 lines, or a stylesheet past 300, is a signal to split it by responsibility. When touching a file already over 1,000 lines (for example `index.css`, `MapExperience.tsx`, `ClubWorkspacePage.tsx`), split the part you work on rather than adding to it.
- Prefer shared building blocks and design tokens (page header, context navigation, card, empty/error/loading state, form field) over per-feature copies of the same look.
- Large cleanups are their own reviewable tasks; in feature work, clean up what you touch. Report lines added and removed for non-trivial changes.
- Never commit generated output: screenshots, inspection JSON, `dist/`, `outputs/`, review builds or test reports.

## UI layout rules — required for every product change

- Use Club workspace, the club profile and Matches & competitions as the established layout references. Inspect their current rendered UI before designing a related screen. Operational pages use a compact header, stable context navigation, and Overview first followed by the relevant tasks.
- Never render navigation collections as inline text or concatenate names into a paragraph. Every destination needs its own bounded flex/grid row, a readable label, visible spacing and a minimum 44px touch target. Long names must wrap deliberately or truncate with their full text available. Deduplicate destinations; keep long pickers internally scrollable.
- A component must import the CSS it needs. Shared navigation must not depend on a stylesheet loaded by another route. Scope feature styles beneath the feature root; generic names such as admission-panel must never restyle a different feature when navigation loads its CSS.
- No oversized marketing heroes, slogan eyebrows, walls of explanatory copy, or giant full-width buttons in work screens. Start with the task, its current state and a useful next action. Put detailed rules beside the action they affect; use specific tabs/disclosures for editing, agreements, history and advanced work.
- Keep tab selection in the URL, preserve account/player context and drafts, and retain the existing mutation, version, privacy and permission safeguards. A layout change must not invent counts, silently accept terms, discard a pending action, or reduce useful functionality.
- Embedded schedules and work panels must fit their container: show a compact summary with a clear full-workspace link rather than nesting another page’s complete navigation, calendar and inspector. Primary actions must reflect verified current status (for example, current club versus no club), with unknown/loading states kept distinct.
- Verify the actual rendered initial page and navigation back from related lazy routes, in light/dark themes and at desktop/390px widths. Check long/empty/populated content, keyboard focus, visible active navigation, overflow, and readable line lengths. Unit tests and a successful build do not replace visual inspection.
