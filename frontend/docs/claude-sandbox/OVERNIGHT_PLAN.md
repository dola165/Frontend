# Overnight overhaul plan — sandbox `claude/overhaul-sandbox`

Started 10 October 2026, 00:30 Tbilisi. Owner: Beqa (sole web developer). Executor: Claude.

## The brief

Full creative control of the web app, judged from a **coach's** point of view (FC Dinamo Tbilisi Academy, `coach@talanti.ge`). Parent, player and referee views come later.

Untouched: the wide layout idea, the basic colour theme, the Home feed style. Everything else may change, but **a change has to be clearly better**, simpler for a normal user, and everything connected to it changes with it. The current club workspace overview is the quality bar.

Nothing here is deployed, merged or pointed at real data. It runs on a synthetic backend in Docker Desktop on the desktop PC. The owner picks what to keep.

## Layout rules (from the owner's screenshots)

- Pages use the full width with small side margins (24–32px). Columns grow with the screen; space between columns is fine.
- No narrow centred column with dead space on both sides (the X / LinkedIn look).
- On very large screens the layout stops growing at a generous maximum and keeps a clean frame (like the zoomed-out Home).
- Profile pages (club, person) may use a narrower frame, never narrower than today's club profile.

## How each sprint is run

1. **One sprint at a time, in order.** Committed before the next starts.
2. **A fresh worker per sprint** gets only its sprint card, the rules and the relevant files.
3. **A separate reviewer** checks the diff and the screenshots against the card, the layout rules, `frontend/AGENTS.md` (UI and code-shape rules) and `docs/product/PRODUCT_MODEL.md`. Findings are fixed before commit.
4. **Done means all of:** `npm run lint`, `npm test`, `npm run build` pass (or failures are pre-existing and listed); every changed page is looked at in the browser at 1440px and 390px, light and dark; nothing that worked before is lost; replaced code is deleted.
5. **Stop rule:** if a sprint does not converge after three serious attempts, revert it to the last commit, write down why, move on.
6. **Progress log:** `docs/claude-sandbox/PROGRESS.md` is updated after every sprint, so the morning report exists even if the night ends early.
7. **No time box overall.** The night ends when the plan is done or the usage limit is reached. Scheduled check-ins resume work from the progress log if the session stops.

## Sprints

| # | Sprint | Done means |
|---|---|---|
| 0 | **Sandbox and baseline** | Synthetic stack and dev server running; enough synthetic data for a coach (squads, staff, events, matches, venues, clubs nearby) created through the real API; "before" screenshots of every page in scope; baseline lint/test/build results recorded |
| 1 | **Design system and layout frame** | Tokens (type scale, spacing, radius, elevation, colour roles on top of the existing theme); shared primitives: app frame, page header, section, panel, stat tile, list row, tabs, empty/error/loading states, form field, dialog. Wide-layout rules built into the frame. Theme check passes |
| 2 | **Navigation** | One header row: Home · World · My Club, plus pins (suggested, never forced), Inbox (requests and notifications), search, Dola, Messages, avatar. Bigger tabs. My work deleted; Schedule and Matches & Competitions leave the tab bar; every page still reachable |
| 3 | **GrassKickz World** | World front page (near you: clubs, matches, tournaments, opportunities, a map block). One directory engine with list / list + map / full-map views, used by Clubs, Venues, Matches, Tournaments and Opportunities (People if the API supports it) |
| 4 | **Map and journeys** | The map becomes World's full-map view, sharing the directory engine's filters. Journey and trip planning redesigned as a first-class flow: plan a matchday or tournament trip, stops, timing, who is travelling, shareable with the squad |
| 5 | **Workspace shell** | One workspace layout for every workspace type (club first, then at least one other): side navigation, page header, overview pattern, responsibilities deciding what a coach sees first, Coach Hub as the personal view |
| 6 | **Club workspace pages** | Squads (including the eligibility panel), people and staff duties, attendance, match preparation, settings split from programmes and fees. Simpler forms, fewer wizards, consistent with the overview |
| 7 | **Matches** | "Arrange a match" as one short form: opponent club autocomplete, their squad, our own venues, no stadium booking. Match Exchange kept for open listings. Matches & Competitions content split between World and My Club |
| 8 | **Schedule** | Club schedule combining squad schedules; personal schedule on the profile; attendance asked only where the coach turns it on (frontend side; backend needs written up) |
| 9 | **Profiles** | Club profile overview leads newcomers to posts and Follow/Join; person profile on the same profile layout |
| 10 | **Consistency sweep and report** | Every page in scope checked against the system; morning report with before/after screenshots, what changed, lines added/removed, checks, and backend work needed |

## Out of scope tonight

Backend changes (they are written up instead), parent/player/referee-specific views, Android, deploying, merging.
