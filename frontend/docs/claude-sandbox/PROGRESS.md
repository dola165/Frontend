# Overnight overhaul — status (10 October 2026)

**Next session: start with `HANDOFF.md`.** The owner reviews with the Keep / Revert / Change checklist on `/__guide`.

Branch `claude/overhaul-sandbox` (frontend only). Sandbox: `node sandbox/build.mjs && node sandbox/server.mjs 4300`, guide at `/__guide`; on Windows double-click `sandbox/windows/Start GrassKickZ Sandbox.cmd`.

## Done and merged
1. Sandbox toolchain + synthetic backend (`sandbox/`), screenshot harness, test shim (`sandbox/vt/run.mjs`).
2. Design system (`src/design/`, rules in `DESIGN_SYSTEM.md`).
3. Header: Home · World · My Club, pins, Inbox, phone tab bar; My work removed (+ review fixes).
4. GrassKickZ World: front page + Clubs/People/Venues/Matches/Competitions/Opportunities directories, list/split/map, Georgian, parent child-aware search (+ review fixes).
5. World map + journey planner rebuilt (`features/world/map`, `features/mapPlanning/planner`).
6. Club workspace: WorkspaceShell (also tournament workspace), Overview, Coach Hub, responsibilities, all legacy workspace pages rebuilt (+ review fixes).
7. Profiles (club/person/organization), club schedule, personal schedule (replaces /calendar), opt-out attendance, roles & professions.
8. Arrange a match (one form, no stadium booking) + Post an open match + match page rebuilt.
9. Home: This week + pinned announcements; squad announcements with expiry and read summary.

Gates at merge: TypeScript clean, ESLint clean on all of `src`, sandbox build ok, colour guard ok.

## Not done
- **Unit tests not swept after the final merge.** Each sprint ran its own touched tests in the shim; the full suite (~330 files) has not been run against the merged branch. Run `npm run check` and fix before merging into the real project. Some tests only run under real vitest (the shim lacks `importOriginal`).
- Playwright e2e specs updated by reading only; not run.

## Backend needed (details in each sprint's sandbox handler file header)
- `GET /people` public directory (`sandbox/api/handlers/world-extra.mjs`); `GET /clubs?age=N`.
- Pins sync endpoint (pins are per device today).
- Journey plan draft fields `staff`, `vehicles`, `bring`; `published` on `GET /map/plans/:id`; from-fixture semantics (`map-extra.mjs`).
- Professions API and opt-out attendance (`response_requested` defaults, NOT_GOING with reason) (`profile-extra.mjs`).
- Announcement `expiresAt`; active announcements across my squads; match invitations in `/requests`; confirm `POST /match-arrangements` accepts the new referee modes (`matches-extra.mjs`).
- Unread messages count endpoint; batched Coach Hub endpoint.

## Reviews
`REVIEW_NAV.md`, and the World/workspace reviews (fixed in later sprints). Product direction: `PRODUCT_MODEL.md`.
