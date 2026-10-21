# Squads and player management — 14 September 2026

Live at https://app.grasskickz.com as release `squads-redesign-20260914`. Production bundle: `dist/squads-redesign-20260914`.

Open the connected development preview at http://127.0.0.1:5300/e2e/fixtures/squads-preview.html. Its synthetic data and API adapter are scoped to the browser tab. The real workspace, player editors, public squad directory and roster components are rendered. The fixture header/sidebar imitate the app shell; the production ClubProfilePage keeps its existing hero/navigation and gives Teams a full-width content column. Public squad content receives an anonymous preview identity without bootstrapping a real session.

Preview links:
- Default: workspace squads
- `?view=players`: player affiliations
- `?view=player-cards`: player-card management
- `?view=public`: public club Teams directory
- `?view=roster`: public squad roster
- `&lang=ka` or `&theme=light`: optional localized/light appearance

## Changes

- Compact squad chooser, roster-first workspace, search and position filters, clear Roster/Cards choice.
- New/edit squad dialog, simpler account-free player editor with live roster preview, full club-player picker.
- Responsive player status/consent management with existing permissions, actions and pagination preserved. Search here explicitly covers the loaded page; the Add Players picker loads the complete eligible pool.
- Public club Teams cards and squad pages use the same roster presentation. Private registration/trial labels and editing controls are hidden from visitors. Removed fabricated availability and decorative drag handles.
- Stale roster responses cannot overwrite the current team. Role/number saves preserve sibling values and failed saves retain the editor draft.
- Added English/Georgian copy with matching translation keys and interpolation parameters.

## Validation

- Production `npm run build` passed after final source changes; see `build.log`. Existing bundle-size advisory remains.
- Targeted lint passed for all changed squad/player components and locale module.
- 24 focused tests passed: PlayersTab 13, PlayerCardModal 6, shared roster 5. These cover trial decisions, consent delivery state, activated/guardian field authority, public/private display separation and edit-save preservation.
- Browser checks in `results.json`: create/edit/select squad, add existing player, jersey save, filtering, view switching, public/workspace consistency, delayed roster responses, desktop and 320/390px layouts, Georgian light view. No runtime errors or unexpected external requests.
- Card editor/picker separately inspected on desktop and 390px: footer access, keyboard focus, nested creation, dirty-draft keep/discard and no horizontal overflow.
- The final delayed-response scenario was rerun alone after correcting its harness to explicitly select Roster instead of inheriting Cards from local storage; it passed. Earlier harness-only selector mismatches were corrected.

No backend, database, Android, payment or live-data changes are part of this design update. Public roster eligibility remains governed by the existing backend.

## Deployment

Published the previously validated build at the user’s request without further test runs. The release transaction confirmed the local index and public app asset bytes match the build. API, database and Redis containers remained unchanged. The prior web image is retained for rollback. See `release-result.json`.
