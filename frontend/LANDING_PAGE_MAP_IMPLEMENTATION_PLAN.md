# GrassKickZ Landing Page and Public Map Implementation Plan

Status: **Phase 3 complete — Phase 4 ready**
Scope: `C:\Users\daddo\WebstormProjects\Frontend\frontend\src`
Primary entry points: `src/pages/LandingPage.tsx`, the authenticated route adapter `src/pages/MapPage.tsx`, the shared surface `src/components/map/MapExperience.tsx`, and `src/components/map/*`

This plan turns the agreed landing-page direction into small, reviewable frontend increments. Each phase should leave the app buildable and the existing authenticated map usable. The landing page will become a public introduction to GrassKickZ, with the map as its main product surface and optional context below it.

## 1. Product decisions already agreed

- [ ] Replace the old landing-page map with the newer map experience used by the authenticated map page.
- [ ] Let visitors explore the public club map before logging in or creating an account.
- [ ] Keep the landing-page shell and authentication controls dark, while using the clearer light map treatment by default.
- [ ] Reuse one map implementation instead of maintaining a separate landing map and authenticated map with drifting behavior.
- [ ] Give guests access to public club discovery only. Actions that change state—following, messaging, applying, or club management—must lead to sign-in or account creation.
- [ ] Keep the first screen simple and map-led, then offer optional, scrollable context below it.
- [ ] Add role-oriented explanations for players/parents, coaches/volunteers, club staff, and supporters/partners.
- [ ] Use real records for featured content and real counts only. Hide empty or unavailable sections rather than inventing content.
- [ ] Preserve existing routes and authenticated behavior unless a specific compatibility fix is required.

## 2. Target landing-page structure

The finished page should follow this order. Sections below the map are intentionally concise; they should explain the product without turning the page into an oversized marketing site.

1. **Header and hero**
   - GrassKickZ branding, log-in, and create-account actions.
   - A direct promise: explore clubs first, join when ready.
   - Useful live map/verification counts only after their source and fallback behavior are confirmed.

2. **Public interactive map**
   - New map styling and marker behavior.
   - Public club search, country/city search where supported, map movement, zoom, and visible-club browsing.
   - Clicking a pin or browse result opens the public club profile.
   - A clear sign-in prompt appears only when a visitor tries an account-only action.

3. **“What are you looking for?” role chooser**
   - Players and parents: find a suitable nearby club.
   - Coaches and volunteers: discover roles and opportunities.
   - Club admins and coaches: create/claim a club and use the workspace.
   - Supporters and partners: follow clubs and support campaigns.
   - Each option has one short benefit statement and one relevant CTA.

4. **How GrassKickZ works**
   - Explore clubs.
   - Connect with the football community.
   - Build or manage a club.

5. **Featured content (conditional)**
   - A few real featured clubs.
   - A few current jobs or volunteer roles when available.
   - A few campaigns when campaigns are ready and connected.
   - Every card links to a real destination; the entire section is hidden when there is not enough trustworthy data.

6. **Club-admin call to action**
   - “Your club should be on the map.”
   - Create a club, claim an existing club, or learn about the workspace.

7. **Trust, privacy, and short FAQ**
   - Public-club and verified-club facts only when backed by data.
   - Explain what can be viewed without an account and what requires sign-in.
   - Answer the four highest-value first-visit questions without repeating the hero copy.

8. **Footer**
   - Keep the current direct links and add only destinations that are actually usable.

## 3. Phased implementation checklist

### Phase 0 — Baseline, safety, and contracts

Goal: establish a clean starting point and prevent unfinished work from being mistaken for a map regression.

- [x] Record the current working-tree state and avoid overwriting unrelated user changes.
- [x] Run the existing frontend type check, production build, and test suite before editing.
- [x] Capture the current landing page and authenticated map at desktop and mobile widths for visual comparison.
- [x] Inventory the current map responsibilities: data loading, filter state, map style, pins, selected-club behavior, browse rail, controls, and role access.
- [x] Identify the public data contract currently used by `LandingPage` (`/clubs?size=100&sort=NAME`) and the richer map-search contract used by `MapPage`.
- [x] Review the public map payload and access boundary. Landing work must still select only public summary fields and must not expose staff-only, private, or account-specific actions.
- [x] Document the backend/API availability and the remaining guest-policy decision before changing frontend behavior.
- [x] Add the implementation evidence and contract notes below.

Acceptance criteria:

- [x] Baseline checks pass or existing failures are recorded with file and command.
- [x] The authenticated `/map` route remains unchanged at the end of this phase.
- [x] Guest-visible fields and allowed actions are explicitly listed.

#### Phase 0 execution record — 2026-09-05

**Working-tree safety**

- Repository: `C:\Users\daddo\WebstormProjects\Frontend\frontend`
- Branch: `master`
- HEAD at baseline: `c3c6580 feat(clubs): use dedicated followed-clubs endpoint for follow surfaces`
- The worktree already contains unrelated, user-owned UI changes in club, layout, map, and locale files. Those changes were preserved. Phase 0 did not reset, revert, or overwrite them.
- The implementation plan is a new untracked file at the repository root. Generated screenshots are stored under `test-results/phase0/`, which is ignored by git.

**Baseline checks**

- `npx tsc -b` — passed.
- `npm run build` — passed. Vite reported existing non-blocking warnings about a large bundle, the dynamic/static `tryouts.ts` import, and chunk size.
- `npx vitest run` — passed: 24 test files passed, 2 skipped; 167 tests passed, 2 skipped.

**Visual baseline captures**

- `test-results/phase0/landing-desktop-before.png` — 1440×900 landing page.
- `test-results/phase0/landing-mobile-before.png` — 390×844 landing page.
- `test-results/phase0/map-desktop-before.png` — 1440×900 map route.
- `test-results/phase0/map-mobile-before.png` — 390×844 map route.

The captures were taken against the local mock-enabled dev server, so the browser restored the mock persona in the header. They are still valid visual baselines for the map surface and layout; Phase 2 must add explicit signed-out coverage. The captures show that `LandingPage.tsx` still owns a separate dark, tilted MapLibre implementation, while `/map` already renders the newer light map surface with the simple filter, public/role-aware map controls, and visible-club rail. These screenshots are the before-state for Phase 3 visual comparison.

**Current responsibility inventory**

- `LandingPage.tsx` fetches `/clubs?size=100&sort=NAME`, filters a local list by club name/type/address/description, selects a highlighted club, and renders its own map markers, navigation/geolocate controls, club search, and four-card visible-club list. Its marker/profile destination is `/clubs/:id`.
- `MapPage.tsx` owns committed vs draft filter state, place search, map viewport/query center, map loading/errors, marker selection, club profiles, the simple/advanced filter mode, the optional visible-club rail, map modes, marker assets, and account-role access.
- `MapPage.tsx` delegates UI to `SimpleMapFilters`, `MapFilterSidebar`, `VisibleClubsRail`, `MapModeControl`, `MapLegend`, and the map-layer helpers. `fetchNearbyMap` calls `/map/nearby`; `geocodePlace` calls `/map/geocode`.
- The authenticated route uses `hasFullMapAccess` and clamps restricted viewers to `CLUB` in the frontend. Staff roles/memberships can additionally see matches and tournaments.

**Public contract and access findings**

- Backend `PublicPaths` explicitly permits `GET /api/map/nearby`, `GET /api/map/geocode`, `GET /api/clubs`, and `GET /api/clubs/*` without a JWT.
- `MapController` documents `/map/nearby` as a public, role-aware endpoint and `/map/geocode` as a public city/country lookup. The endpoint accepts the richer filters, but the guest experience must still apply its own explicit allowlist.
- `MapService` server-side clamping currently gives anonymous users, `PLAYER`, and `FAN` accounts the restricted type set `CLUB + TRYOUT`; full account roles or club staff can additionally receive `MATCH + TOURNAMENT`. The current React map intentionally clamps restricted viewers to `CLUB`. Phase 2 must make the landing choice explicit rather than inheriting either behavior accidentally; the current recommended landing default remains public clubs only.
- `MapMarkerDto` contains public discovery fields such as entity type/id, title, club identity, coordinates, distance, verification, date/status, address, city/country, logo, category, and join-policy metadata. Landing UI should select only the fields needed for public discovery and never render membership context, application controls, staff operations, or private contact data.
- No missing anonymous map endpoint blocks the frontend work. The remaining dependency is a product decision about whether guests should ever see public tryouts/events; it is recorded for Phase 2 and will not be guessed during extraction.

**Phase 0 conclusion**


- Baseline is green and the current map/landing implementations are separable.
- No application source code was changed during Phase 0. Only this plan was updated; the four visual captures are ignored test artifacts.
- Phase 1 can begin with shared-map extraction while preserving the authenticated `/map` route and its current role behavior.

### Phase 1 — Extract a shared map experience

Goal: make the new map reusable without copying the entire authenticated page into the landing page.

- [x] Separate map rendering/state from authenticated page chrome in `MapPage.tsx`.
- [x] Create the shared `MapExperience` component that owns the map canvas, markers, selected-club state, viewport behavior, and browse-area interaction.
- [x] Keep filter and rail components composable rather than hardcoding landing-specific layout into them.
- [x] Introduce an explicit experience configuration:
  - `guest` vs `authenticated` behavior;
  - allowed entity types;
  - default light/dark map style;
  - whether advanced filters, account actions, or app chrome are shown;
  - destination behavior when a club is selected.
- [x] Preserve the existing `/map` route, URL state, role access, and controls while switching it to the shared implementation.
- [x] Keep map tile attribution and loading/error behavior in the shared surface.

Acceptance criteria:

- [x] `/map` looks and behaves as it did before this refactor.
- [x] The shared component exposes a guest configuration that can render the same map surface without importing the authenticated route adapter; guest-only visibility hardening remains Phase 2 work.
- [x] The shared component owns the new map’s rendering/state; the existing landing-only implementation remains intentionally deferred to Phase 3.

#### Phase 1 execution record — 2026-09-05

- [x] Moved the map rendering and interaction implementation into `src/components/map/MapExperience.tsx`.
- [x] Added the explicit `MapExperienceContext` (`authenticated`/`guest`) and optional `allowedEntityTypes` configuration so later landing work can narrow discovery without duplicating map state.
- [x] Kept `/map` as an authenticated route through `src/pages/MapPage.tsx`, which now acts as a thin adapter and preserves the existing `ProtectedRoute` boundary.
- [x] Updated `MapModeControl` to consume the shared `MapMode` type directly from the shared experience, avoiding a page-to-component type dependency.
- [x] Preserved the existing map-owned behaviors: draft/committed filters, role-aware entity access, marker selection, viewport/search state, browse-area rail, marker assets, map modes, loading/error states, and tile attribution.
- [x] Deliberately did not replace the landing page’s old map in this phase; that migration is the scoped work for Phase 3 after guest behavior is hardened in Phase 2.
- [x] Verification: `npx tsc -b` passed; `npx vitest run src/components/map src/pages --reporter=dot` passed (7 files, 66 tests passed, 2 skipped).
- [x] Verification: `npm run build` passed (existing bundle-size and dynamic-import warnings only); the full Vitest suite passed (24 files, 167 tests passed, 2 skipped); a post-extraction desktop `/map` capture was saved at `test-results/phase1/map-desktop-after.png`.

### Phase 2 — Guest-safe public map mode

Goal: make map exploration genuinely useful before authentication without leaking protected functionality.

- [x] Show public clubs by default for guests.
- [x] Reuse the new map’s light basemap, marker assets, selected-marker treatment, and browse-area rail.
- [x] Expose only guest-appropriate controls initially: pan, zoom, locate, club search, country/city search when supported, and public-club browsing.
- [x] Do not expose role-gated matches, tournaments, staff operations, player-fit filters, or club-management actions to anonymous users.
- [x] If public matches or tournaments are later approved, add them through an explicit allowlist rather than inheriting authenticated permissions.
- [x] Make every public pin and browse result open the correct public club profile route.
- [x] Guest mode renders no follow, message, apply, or management controls; Phase 3 will add the landing conversion CTA and preserve its intended return path.
- [x] Handle loading, empty results, API failure, missing coordinates, and tile failure without trapping the visitor or redirecting unexpectedly.
- [x] Ensure country/city search cannot kick the visitor out of the application and that autocomplete is resilient when no suggestions are available.

Acceptance criteria:

- [x] The shared guest configuration is ready to render a signed-out visitor’s club-only map; mounting it on the landing page is intentionally Phase 3 work.
- [x] No protected data or staff-only control is visible in guest mode, including when the API response contains an unexpected entity type.
- [x] Guest surfaces do not initiate membership/private requests and keep all public profile navigation predictable.
- [x] Existing authenticated role filtering still passes its current tests.

#### Phase 2 execution record — 2026-09-05

- [x] Added `resolveMapExperienceOptions` and `resolveMapExperienceEntityTypes` to make guest defaults explicit: light map, flat mode, no advanced filters, no mode switcher, no route-back control, and `CLUB` only.
- [x] Guest requests skip `fetchMyClubMembershipContext` and remain stable while `AuthProvider` bootstraps, avoiding private calls and duplicate public fetches.
- [x] Added response-side allowlist filtering as defence in depth so protected marker types cannot be painted if a stale or malformed response includes them.
- [x] Added guest-specific filter presentation: public discovery copy, no “Accepting players” player-fit toggle, and no advanced-filter escape hatch.
- [x] Preserved public club profile links, browse-area selection, geocoding error handling, loading/empty/error states, and map attribution.
- [x] Added regression coverage for guest light/control defaults, fail-closed entity allowlisting, staff narrowing, and authenticated overrides in `src/components/map/__tests__/MapExperience.test.ts`.
- [x] Verification: full Vitest suite passed (25 files, 175 tests passed, 2 skipped); `npx tsc -b` passed; `npm run build` passed with existing bundle-size/dynamic-import warnings; scoped ESLint passed; authenticated `/map` browser smoke capture saved at `test-results/phase2/map-authenticated-after.png`.
- [x] Landing page remains unchanged in this phase; Phase 3 will mount this guest configuration and remove the legacy landing-only map implementation.

### Phase 3 — Replace the landing-page map

Goal: make the new map the first-class map on the landing page while keeping the landing page understandable.

- [x] Replace the bespoke `LandingPage` MapLibre block with the shared guest map experience.
- [x] Remove duplicate landing-only marker and focus-controller logic once the shared component is verified.
- [x] Keep the landing header, hero copy, authentication panel, and footer independent from authenticated navigation bars and sidebars.
- [x] Use a map height that feels substantial on desktop without forcing the visitor through a full-screen app shell.
- [x] On small screens, stack the map and visible-club list in a usable order with controls reachable by touch.
- [x] Keep the visible-club list synchronized with map selection and search results.
- [x] Make the landing “Explore GrassKickZ World” destination and individual club links consistent with the new map.
- [x] Reconsider the right-side login panel only after the new map is in place; it remains intentionally unchanged for this phase because the map now has its own contained conversion-friendly surface.
- [x] Keep the landing map’s default theme independent from the global authenticated app theme: dark landing shell and dark map canvas for this landing-specific composition. The authenticated `/map` route remains unchanged and continues to support the recommended dark-UI + light-map mode.
- [x] Present the guest simple filters in a compact horizontal top strip on the landing map instead of the authenticated side drawer. The authenticated `/map` route keeps its existing side-drawer layout.

Acceptance criteria:

- [x] The landing page displays the new map, not the old dark tilted map implementation.
- [x] Map selection, browse results, search, and profile links work while signed out through the shared guest contract.
- [x] The map does not introduce authenticated nav, role filters, or a hardcoded fake edge-to-edge container.
- [x] Desktop, tablet, and mobile layouts remain stable by containing the guest drawers and selected-club panel inside the map surface.

#### Phase 3 execution record — 2026-09-05

- [x] Replaced the legacy landing-only MapLibre canvas, dark basemap, tilted camera, marker loop, focus controller, search chips, and four-card visible-club rail with `MapExperience` configured as `context="guest"`, `mapTheme="dark"`, `filterLayout="top"`, and `allowedEntityTypes={['CLUB']}`.
- [x] Replaced the landing directory CTA with “Explore GrassKickZ World”, which opens the public `/world` map without authenticated top navigation. The public world map defaults to light mode and provides a map-only light/dark toggle without changing the app-wide preference.
- [x] Preserved the landing shell: branding, hero copy, live club/verified counts, directory CTA, sign-in panel, and footer remain outside the shared map and do not inherit authenticated route chrome.
- [x] Added an `embedded` map configuration. In embedded mode the simple filter drawer, browse-area rail, backdrop, and narrow-screen selected-club panel use absolute positioning within the map surface instead of fixed positioning against the browser viewport. This prevents the landing map from covering the login panel or the rest of the page.
- [x] Added the landing-only top filter composition: the guest filter is open by default, stacks its controls within the map surface, and moves the map toolbar below it while open. Closing the filter returns the toolbar to the map’s upper edge; authenticated filter behavior is unchanged.
- [x] Set a substantial responsive map surface (`520px` minimum, `560px` phone height, `620px` small-screen height, `700px` desktop height) so the map remains usable without pretending the full landing page is an immersive route.
- [x] Retained the public `/clubs` request only for live hero count chips; the shared map owns all map discovery data, filters, autocomplete, markers, browse selection, loading/error states, and public profile navigation.
- [x] Browser smoke: loaded `/` in the local preview, confirmed the shared guest filter copy and public-only controls, verified the guest filter is a top strip, checked the dark landing map canvas, and verified the embedded filter/rail remain bounded to the map section on a narrow viewport. The local preview used mock discovery data for visual validation; live marker/profile clicks still require the configured API environment.
- [x] Verification: `npx tsc -b` passed; `npx vitest run src/components/map src/pages --reporter=dot` passed (8 files, 74 tests passed, 2 skipped); full Vitest passed (25 files, 175 tests passed, 2 skipped); `npm run build` passed with the existing large-bundle and dynamic-import warnings.

### Phase 4 — Role chooser and conversion paths

Goal: help different audiences understand their next useful action without adding noise to the hero.

- [ ] Add a visually distinct but compact role-chooser section below the map.
- [ ] Write audience-specific copy for players/parents, coaches/volunteers, club staff, and supporters/partners.
- [ ] Link each CTA to an existing real destination, sign-up flow, club-creation flow, jobs page, or clubs directory.
- [ ] Do not create placeholder routes just to fill a card.
- [ ] Add English and Georgian translation keys together and keep labels short enough for mobile cards.
- [ ] Verify keyboard focus, semantic headings, and clear link names.

Acceptance criteria:

- [ ] A visitor can identify the most relevant path within a few seconds of scrolling past the map.
- [ ] Every CTA has a working destination or a clearly labeled authentication redirect.
- [ ] The section remains readable at narrow widths without four cramped columns.

### Phase 5 — “How it works” explanation

Goal: explain the product model in three simple steps.

- [ ] Add the three-step Explore → Connect → Build/Manage explanation.
- [ ] Use short supporting copy tied to real product behavior.
- [ ] Avoid repeating the hero, role chooser, or FAQ language.
- [ ] Keep this section static and lightweight; it does not need another API request.

Acceptance criteria:

- [ ] A first-time visitor can explain the product after reading this section once.
- [ ] The section does not push the map below an unnecessarily long first viewport.

### Phase 6 — Conditional featured clubs and opportunities

Goal: demonstrate activity without fabricating network health.

- [ ] Define the minimum data quality and count thresholds required before showing featured content.
- [ ] Reuse existing public club, jobs, and campaign APIs where possible.
- [ ] Add a small number of featured club cards with public profile links.
- [ ] Add jobs/volunteer previews only from published, visible records.
- [ ] Keep campaigns behind the current campaign-readiness decision; do not imply fundraising is fully connected if it is not.
- [ ] Provide a useful hidden state when there are too few records, rather than showing blank cards.
- [ ] Add loading, error, and stale-data behavior that does not block the map.

Acceptance criteria:

- [ ] Every displayed item is real, public, and clickable.
- [ ] No empty “featured” section appears in a sparse environment.
- [ ] The map remains usable if any optional featured-content request fails.

### Phase 7 — Club-admin CTA

Goal: make the landing page valuable to the clubs that populate the network.

- [ ] Add a focused “Your club should be on the map” section.
- [ ] Link “Create a club” to the current supported flow.
- [ ] Link “Claim a club” only if the claim flow exists; otherwise label the action as planned or omit it.
- [ ] Explain the practical value of the workspace: people, jobs, schedules, opportunities, and public presence.
- [ ] Ensure club-admin copy does not promise unfinished CSV import, automated scraping, or unsupported operations.

Acceptance criteria:

- [ ] Club staff have a clear path that is distinct from player discovery.
- [ ] No CTA leads to a mock or dead page.

### Phase 8 — Trust, privacy, FAQ, and footer

Goal: remove uncertainty without bloating the page.

- [ ] Add only data-backed counts such as public clubs and verified clubs.
- [ ] Explain anonymous browsing vs account-only actions in plain language.
- [ ] Add a short FAQ covering browsing, signing up, club management, and public information.
- [ ] Keep FAQ interaction accessible (native details/summary or equivalent keyboard-friendly controls).
- [ ] Review footer links and remove destinations that are not ready for public use.
- [ ] Add English and Georgian translations for all new copy.

Acceptance criteria:

- [ ] Privacy and sign-in expectations are clear before a visitor submits credentials.
- [ ] The page has a complete ending without a second competing navigation system.

### Phase 9 — Responsive, accessibility, and visual polish

Goal: make the long-form landing page feel intentional on every supported viewport.

- [ ] Validate desktop widths at 1280px, 1440px, and 1920px.
- [ ] Validate tablet and mobile widths, including a narrow phone width and landscape orientation.
- [ ] Check that the map, browse rail, role cards, featured cards, and auth panel do not create accidental horizontal scrolling.
- [ ] Verify visible focus states, button/link semantics, labels, alt text, color contrast, and reduced-motion behavior.
- [ ] Confirm the dark landing map remains legible against the dark landing shell and preserves clear pin/control contrast.
- [ ] Confirm map controls do not cover search, attribution, or the selected-club summary.
- [ ] Keep optional sections lazy or lightweight enough that the map becomes interactive quickly.

Acceptance criteria:

- [ ] No horizontal overflow at supported widths.
- [ ] Keyboard and screen-reader users can reach all meaningful controls.
- [ ] The new page visually matches the established GrassKickZ theme without reintroducing the hardcoded “fake edge” container problem.

### Phase 10 — Verification and handoff

Goal: finish with evidence that each layer works independently and together.

- [ ] Add or update unit tests for shared map configuration, guest entity allowlisting, selection/link behavior, empty states, and CTA destinations.
- [ ] Add integration coverage for signed-out landing-map exploration.
- [ ] Add/extend Playwright coverage for desktop and mobile landing-page flows.
- [ ] Test signed-out, signed-in player, coach, club-admin, and incomplete-profile states.
- [ ] Test API failure, empty clubs, missing coordinates, slow map tiles, and optional featured-content failure.
- [ ] Run scoped lint on changed files.
- [ ] Run `npx tsc -b`.
- [ ] Run the full Vitest suite.
- [ ] Run the production build.
- [ ] Perform a final visual review against the screenshots captured in Phase 0.
- [ ] Update this checklist with completed items, known limitations, and any deferred backend work.

Definition of done:

- [ ] A visitor can arrive at GrassKickZ, explore the new public map, search for clubs, open a club profile, and understand what to do next without an account.
- [ ] Players/parents, coaches/volunteers, club staff, and supporters each have a clear next step.
- [ ] Authenticated `/map` behavior and role access remain intact.
- [ ] The page contains no fake counts, dead links, mock destinations, or unfinished-looking placeholder sections.
- [ ] The map becomes usable quickly and optional content never prevents map exploration.
- [ ] Type check, build, tests, and the relevant browser checks pass.

## 4. Suggested implementation order for focused work

Work in these independently reviewable chunks:

1. **Chunk A:** Phase 0 audit and baseline evidence.
2. **Chunk B:** Phase 1 shared-map extraction, with no visual landing change yet.
3. **Chunk C:** Phase 2 guest-safe map configuration and tests.
4. **Chunk D:** Phase 3 landing map replacement and responsive layout.
5. **Chunk E:** Phases 4–5 role chooser and how-it-works content.
6. **Chunk F:** Phases 6–8 optional content, club CTA, trust, FAQ, and footer.
7. **Chunk G:** Phases 9–10 visual/accessibility polish and verification.

Each chunk should end with a buildable app and a short note in the final handoff describing what was completed, what was intentionally deferred, and which checks passed.

## 5. Risks and explicit non-goals

### Risks to resolve early

- The existing public `/clubs` response may not contain everything needed by the richer map. If so, the backend needs a clearly public map contract; the frontend must not infer private access from a failed request.
- Reusing `MapPage` wholesale could bring role-gated controls, app navigation, or authenticated assumptions into the landing page. Shared map extraction is required before migration.
- Map tiles and geocoding/autocomplete may fail independently of the application API. These failures need calm inline states, not route changes or forced redirects.
- A long landing page can dilute the map’s purpose. Keep sections compact, conditional, and ordered by decision value.
- Live counts and featured items can make the page look broken when the database is sparse. Every optional section needs a hideable state.

### Explicitly out of scope for this landing-page pass

- Rebuilding the authenticated map’s business logic or role model.
- Connecting campaigns to fundraising before that product decision is finalized.
- Full store, jobs, or social-feed implementations on the landing page.
- CSV club import, scraping bots, payment flows, or automated club creation.
- A new marketing CMS or a large content-management system.
- Rewriting authentication or onboarding beyond clear redirect/return-path handling.

## 6. Deferred decisions to confirm during implementation

- [ ] Which public map endpoint should be the source of truth for guest search and country/city results?
- [ ] Should anonymous users see only clubs, or also a limited set of public matches/tournaments?
- [ ] What exact thresholds make featured clubs/jobs/campaigns useful rather than sparse?
- [ ] Which club-creation and claim flows are production-ready enough to link from the landing page?
- [ ] Which languages must be complete before the landing page is considered showcase-ready?
