# Schedule design exploration 02

> Current product direction (17 September): this visual layout is now shared by **My schedule** and **Squad schedule**, including Parent Hub and squad communication. The old Club schedule/miniature family calendar split is superseded. See the backend workspace documentation `docs/SCHEDULE_PHILOSOPHY.md` for the current user workflow and record ownership. The exploration notes below are historical.

An interactive alternative to the first schedule redesign. This exploration adds a separate preview; it does not change the product schedule implementation or deploy anything.

## Preview

Open http://127.0.0.1:5300/e2e/fixtures/schedule-direction.html while the frontend Vite server is running on port 5300. The comparison link opens the first version.

The preview uses sample club data and the real event editor. Creating or editing events updates local React state only. Reloading restores the samples. Its API adapter handles requests locally. This English-language concept is for choosing a visual direction, not for direct production deployment.

## Direction

- A club week board with bold dates, readable session cards, squad names and venues.
- Familiar hourly calendar and agenda alternatives, with agenda selected initially on phones.
- A weekly training panel with weekday markers and a direct shortcut on phones.
- Near-black and charcoal surfaces, bright green actions and restrained event colours.
- A more open event editor with fewer nested boxes and a clear preview column.

The first implementation remains available for comparison. Integrating the chosen direction into the product is a separate next step.

## Validation

- `node e2e/schedule-direction-smoke.mjs`: 21 checks passed; no runtime errors or unexpected application requests.
- `node review/schedule-direction-20260914/phone-shortcut.mjs`: mobile weekly-training shortcut and editor flow passed.
- ESLint passed for `e2e/previews/schedule-direction/main.tsx`.
- `npx tsc -p review/schedule-direction-20260914/tsconfig.preview.json --pretty false`: passed.
- Desktop, 320px and 390px phones, 768px and 1024px layouts checked. Screenshots are stored alongside this document.

## Files

- Entry: `e2e/fixtures/schedule-direction.html`
- Component: `e2e/previews/schedule-direction/main.tsx`
- Scoped styles: `e2e/previews/schedule-direction/style.css`
- Main evidence: `01-week-board.png`, `preview-training-editor.png`, `10-mobile-first-screen.png`, `results.json`
