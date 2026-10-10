# Review: GrassKickZ World sprint (9ca0cce..ba52610, merged at 3cef8b8)

**Overall.** World is clearly better than the 16 pages it replaces. It has one engine, one look and clear hierarchy, and the front page fits the brief: a big page with search, quick starts, fixtures, a map block, clubs, competitions, opportunities and people. In the sandbox the build is clean, `tsc` is clean and none of the 64 standard captures overflowed or got an API 4xx. The diff removes about 3,000 lines net.

Several things still need fixing before this is done:
- A broken quick start.
- A URL/search state bug that the deleted club-page test used to guard against.
- A misleading People fallback on the real backend.
- A lost mutation-recovery panel.
- Broken e2e tests.
- Georgian is gone from every World page.
- The parent path is weaker than the brief asks for.

**How I checked**
- Sandbox on port 4505 (now stopped). Standard shots are in `frontend/sandbox/shots/rv-world/` (8 routes × 1920/1440/1024/390 × dark/light).
- Full-page shots, phone shots, probe shots and Georgian shots are in `/tmp/claude-0/rvshots/`. Contact sheets are in `/tmp/claude-0/sheets/`.
- Behaviour was checked with Playwright probes. The probe scripts are in my scratchpad and were not committed.
- Signed-out views needed `/api/auth/refresh` stubbed to 401. The sandbox refresh endpoint always signs you in, so `?signedout=1` alone still shows a signed-in page.
- Line numbers refer to the merged tree.

---

## Must fix

### 1. "Football for girls" quick start opens Jobs
- **Where:** `WorldFrontPage.tsx:30` links to `/world/opportunities?tab=groups&gender=FEMALE`, but Opportunities reads its tab from `type` (`OpportunitiesDirectory.tsx:25`, `tabParam="type"`).
- **Evidence:** clicking the chip lands on **Jobs and volunteering** (15 roles), with `gender=FEMALE` ignored in the URL. Shot: `rvshots/girls-1440-dark.png`.
- **Fix:**
  - Change the link to `?type=groups&gender=FEMALE`.
  - Better, use `tab` for every directory so links can't drift (keep `type` as an alias in the redirect).
  - Add a test that each quick start opens the intended tab.

### 2. The directory search box overwrites the URL from stale text
- **Where:** `DirectoryPage.tsx:18-30`. `draft` is seeded once and never re-synced, so any outside change to `q` is reverted by the debounce effect.
- **Evidence (probe):**
  - Type "dinamo" on `/world/clubs`, then click World nav › Clubs. The URL goes to `/world/clubs` and then back to `?q=dinamo` 300 ms later.
  - A push to `?q=saburtalo` while on `?q=riverside` is reverted to `riverside`.
  - Pressing Back after typing in split view restores the typed text onto the previous entry.
  - The deleted `BrowseClubsPage.test` case "restores back and forward URL filters without requests rewriting history" covered exactly this.
- **Fix:** track the last committed value. When `state.query.q` changes from outside, reset the draft (render-time `if (q !== lastQ) { setLastQ(q); setDraft(q); }`) and set `lastQ` before committing. Bring back a back/forward and external-navigation test.

### 3. People degrades wrongly on the real backend (no `GET /people`)
- **Where:** `world/api.ts:40-55`. The fallback sets `searchOnly`, but nothing reads it (grep: only `api.ts`). Role, city, profession and verified are silently dropped.
- **Evidence (probe with `/api/people` stubbed to 404):**
  - `/world/people` shows **"0 people · No public profiles yet"**, which is false. Shot: `rvshots/people-fallback-empty-1440-dark.png`.
  - `?role=COACH&q=ka` shows **"105 people"**, every one a **Player**, under the "Coaches" chip.
  - `?city=Batumi&q=ko` returns people from anywhere.
  - The front-page "People to know" block says **"No public profiles in Tbilisi yet"**.
  - The count includes minors that are filtered out on the client (`api.ts:49` filters after paging).
- **Fix:**
  - When `searchOnly`, hide the role, city, profession and verified filters, or show a notice and return no results while one is active.
  - Replace the empty state with "Search people by name".
  - Hide or reword the front-page People block.
  - Compute the total after the minor filter.
  - Consider treating 405/501 like 404. Spring may not return a plain 404 for an unmapped route; confirm against the real API.
  - Add unit tests for these cases.

### 4. Recovery for interrupted referee decisions is lost
- **Where:** the old hub rendered `<CompetitionRecoveryPanel/>` with no `id` (MatchesHub). Without an `id`, the panel exists only to surface journaled `/competitions/:id/resources/referees/:id/decision` commands.
- **What happens now:** `CompetitionOfficialAssignments` moved to `RefereeWorkspace.tsx:76` and still journals through `useCompetitionCommand`, but nothing renders the recovery panel there.
- **Effect:** after a dropped request, a referee who picks a different action gets "An earlier submission still needs confirmation. Recover it before changing this action." (`useCompetitionCommand.ts:20`) and has no way to recover. This breaks the AGENTS.md rule to retain existing mutation safeguards.
- **Fix:** render `<CompetitionRecoveryPanel/>` next to `<CompetitionOfficialAssignments/>` in RefereeWorkspace. The journal is scoped by pathname, so it must sit on the same page.

### 5. e2e suite broken by the deletions
- **Global setup:** `e2e/global-setup.ts:41-42` (mock mode) opens `/clubs` and waits for heading `/club directory/i`, which no longer exists. Every Playwright spec fails in setup.
- **Specs:**
  - `e2e/smoke.spec.ts:26-27` expects the same heading.
  - `e2e/layout.spec.ts:14-15,34,251-255,393,447` expects the club directory views and `/map`.
- **Fixtures and scripts:**
  - `e2e/fixtures/match-history-fixture.tsx:6` imports the deleted `src/pages/MatchHistoryPage`, which breaks `vite.match-history.config.ts`.
  - `e2e/tournament-public-release.mjs:49` lists `BrowseTournamentsPage`.
- **Fix:** move these to the `/world/*` routes and headings, delete the match-history fixture or point it at World › Matches, then rerun `qa:smoke` and `qa:layout`.

### 6. Georgian removed from every discovery page
- **Where:** no file under `features/world` uses i18n (`useTranslation` / `copy(en, ka)`). All strings are hard-coded English, and `fixtureDay` returns "Today"/"Tomorrow" in English beside localised weekday names.
- **What was there before:** MatchesHub, CompetitionDirectory, BrowseTournamentsPage, MatchHistoryPage, TryoutBrowsePage, OpportunityBrowsePage, TournamentInbox and BrowseClubsPage (`t()`) were all bilingual.
- **Evidence:** with `i18nextLng=ka` the app header is Georgian and the World page is entirely English. Shot: `sheets/ka.png`.
- **Fix:** route World copy through `t()`, with ka strings for titles, chips, empty states, badges and `fixtureDay`. Many of the old translations can be reused. If the overhaul is meant to be English-first, the owner should decide that and it should go in PRODUCT_MODEL §13.

---

## Should fix

### 7. The parent path is weak, though the brief makes it central
- **"Searching for <child>" works only in Opportunities › Places to train,** which is the third tab, behind Jobs.
  - The logic itself is correct. In the probe (minor children stubbed), choosing Nino sends `birthYear=2016&gender=FEMALE`, hides Category, and results link to `?player=501`. Switching child clears a dependent gender.
- **`player` is carried by WorldNav to every page but ignored outside that tab.** Clubs, the front page and the club cards never mention the child.
- **The old remembered selection (`usePlayerSelection`, sessionStorage) is no longer honoured.**
- **`ClubCard` offers a parent one-click "Join as trialist"/"Apply as player" for their own account** (`ClubCard.tsx:39-56`). That registers the parent, not the child.
- **Fix:**
  - When the account has minor participants, show "Searching for" on the front page and on Clubs.
  - Show programme ages and fees on club cards (`presentation.programmes[].ageMin/ageMax`) and mark the ones that fit.
  - For parents, send "Join" to the club enquiry flow (`ClubEnquiryModal`) instead of self-registration.
  - Fall back to `readSelectedPlayer()`.

### 8. Guests opening Matches land on a sign-in wall
- **Where:** the first source (`fixtures`, `matchSources.tsx:21`) is gated, so `/world/matches` for a guest shows the search box plus "Sign in to see fixtures & results". The public **All events** tab sits fourth. Shot: `rvshots/so-world-matches-1440-dark.png`.
- **Before:** the old hub overview showed public competitions to guests.
- **Fix:**
  - Default guests to `events`. A per-source `defaultFor: 'guest'`, or ordering sources by `signedIn`, would do it.
  - Hide the search and sort controls when a source is gated.

### 9. "Show more" loses its place on Back
- **Evidence (probe):** People with 48 rows → open a profile → Back gives 24 rows and scroll 2545 → 13.
- **Before:** the old pages kept `page` in the URL.
- **Fix:** keep the number of loaded pages in the URL (for example `shown=2`) and reload up to it, or cache the result per key and restore scroll.

### 10. `/competitions` now always receives `currency=GEL`
- **Evidence:** the browser request is `/api/competitions?currency=GEL&page=0&size=12`.
- **Cause:** the `currency` fallback is materialised in `query.values` even when its `when` (`maxFee`) is false. `CompetitionsDirectory.tsx:55` then forwards every value. The old directory sent only the keys present in the URL.
- **Risk:** on the real backend this could hide free or non-GEL competitions.
- **Fix:** in the engine, drop values of filters whose `when` is false and only apply fallbacks to filters that apply. Add a test on the outgoing params.

### 11. List + map consistency
- **Inconsistent club ids:** `ClubsDirectory.tsx:53` keys markers by `entityId`, but `FrontBlocks.tsx:72,95` uses `clubId ?? entityId`, and MapExperience uses `clubId`. If CLUB markers are per location, split view will misplace or drop clubs. Use `clubId ?? entityId`.
- **Context ignored:** clubs `loadPoints` uses a fixed Tbilisi centre and the map `query` text, which matches differently from the directory's `search`. It ignores the area and refetches on every filter change.
- **Selection is one-way:** clicking a pin shows a small card, but list items are never highlighted. The old Stadiums page synced hover and selection with the list.
- **The directory "Map" view is not the full map.** It is a 60 dvh map above the same cards, and **"Open full map" goes to `/world/map` with no filters** (`DirectoryPage.tsx:84`). PRODUCT_MODEL §4 makes the full map one of the directory's views. Carry `type`, `q` and filters into `/world/map`.
- **The full map breaks World's look.** `/world/map` forces light theme (`theme.ts:18`), so the whole app flips to light when you click the Map tab, and it keeps legacy all-caps eyebrows ("EXPLORE THE AREA", "AMATEUR CLUB"). Shot: `sheets/map.png`.

### 12. Capabilities lost from the deleted pages (with no redirect or equivalent)
Every listed redirect was exercised in the browser and lands on the right page and tab; detail pages are still reached from results. What fell out:

| Capability | Was in | Now |
|---|---|---|
| "Near me" radius (`lat`/`lng`/`radiusKm=50`) for open matches | MatchExchangePage | Gone. The redirect keeps the params but nothing reads them. |
| "Near me" radius, `minFee`, `feeBasis`, `eligibilityCategory` for competitions | CompetitionDirectory | Gone |
| Host deep links `?hostKind=CLUB&hostId=4` | CompetitionDirectory | Ignored. Map them to `host=CLUB:4` in `LegacyMatchesRedirect`. |
| `/jobs?job=5` selected role | JobsDirectoryPage | Ignored. Redirect to `/jobs/5`. |
| `/matches?section=fixtures` defaulted to Results (HISTORY) | MatchHistoryPage default | Now Upcoming |
| Invalid date-range guard (from > to), 30 s and on-focus refresh, scope chips named after the club, squad or tournament | MatchHistoryPage | Now no guard, no refresh, and generic "One club" / "One squad" chips |
| "Ask about an existing club group" (clubs with no published group) | ExistingClubGroups in OpportunityBrowsePage | Only on the club profile now. Acceptable if intended. |
| Pick a club from a list (Places to train) | OpportunityBrowsePage club `<select>` | Only as a scope from a link |
| Club list view, follower count | BrowseClubsPage | Cards only |
| Listing readiness (pitch and official status), "They host" / "They travel" | MatchExchangePage cards | Not shown in rows |

### 13. "Arrange a match" opens the open-listing wizard
- **Where:** `ArrangeMatchPage.tsx:14-16` titles the page "Arrange a match", but it hosts `ListingEditor`. That is Match Exchange's three-step open listing, nested inside the World page header with its own breadcrumb and a narrow centred card. Shot: `sheets/arrange.png`.
- **Rules it conflicts with:**
  - PRODUCT_MODEL §8 says "Arrange a match" means direct arrangement, in one short form and not a wizard.
  - DESIGN_SYSTEM rule 2 forbids a narrow column with dead space on both sides.
- **Fix:** label it "Post an open match" now, and reserve "Arrange a match" for the direct form.

### 14. Raw API codes shown to users
`rows.tsx:36` and `FrontBlocks.tsx:135` print `trial.ageGroup` and `trial.position` unformatted, so rows show "SENIOR" and "GOALKEEPER" (`rvshots/opps-trials-1440-dark.png`). Pass them through `sentence()` or a label map.

### 15. Phone issues
- **Active World tab off screen:** RouteTabs does not scroll the active tab into view. On `/world/map` and `/world/opportunities` at 390 px, no underline is visible (`sheets/map.png`). The old hub had `revealActive`.
- **Truncated titles with no full text:** fixture titles truncate ("FC Dinamo Tbilisi Academy vs B…") with no `title` or wrap (FixtureRow). Let them wrap to two lines on phones.
- **Small touch targets:** chips are 32 px, `gk-btn--sm` 32 px, the segmented control 36 px and quick-start chips 36 px. DESIGN_SYSTEM rule 10 requires 44 px; at least bump them at ≤640 px.

### 16. Dead code and CSS left behind
- **Orphaned selectors** (each was referenced only by a deleted page):
  - `venues.css`: `venue-card*`, `venue-card-grid`, `venue-discovery-*`, `venue-directory-*`, `venue-search-main`, `venue-extra-filters`. The file is 1,708 lines and was touched in this sprint.
  - `competition-directory.css`: 13 of its 14 classes (`mc-cards`, `mc-families`, `mc-formats`, `mc-event`…).
  - `tournament-hub.css`: `tc-directory*`, `tc-hub-tabs`, `tc-invitation`.
  - `match-history.css`: `mh-hero`, `mh-page`, `mh-periods`, `mh-card*`, `mh-scoreline`, `mh-team`.
  - `match-exchange.css`: `mx-exchange`, `mx-listing-*`.
  - `tryout-discovery.css`: `tryout-filters`, `tryout-results`.
  - `requests.css`: `event-filters`.
- **Dead code:**
  - JobsDirectoryPage's public (non-`fixedClubId`) branch: shortcuts, DiscoverySectionTabs and the engagement guide.
  - `fetchTournamentDiscovery`, `fetchTournamentHost`, `fetchTournaments` and `TournamentDiscoveryOverview`, used now only by a test mock.
  - Redirected paths still listed in `App.tsx:291` (`/map`, `/clubs`, `/tournaments`, `/jobs`, `/roles`, `/people`), plus `/events` and `/tryouts` in `isFullScreenPage`.
  - `theme.ts` `'/map'`.

### 17. Test coverage dropped sharply
- **Numbers:** 1,069 test lines deleted, 86 added (`world.test.tsx`, 68 lines: groups and events loaders and the redirects).
- **Untested:** the engine's URL state, debounce and stale handling, load-more, gating and tab reset; ClubCard follow and join; the People fallback; WorldSearch; the front blocks.
- **Guarantees that went with the deleted tests:** stale-response, account-switch and URL back/forward behaviour from BrowseClubsPage, BrowseTournamentsPage, CompetitionCollection, TournamentDiscovery and MatchActivity.
- I could not run vitest here (`@rollup/rollup-linux-x64-gnu` is missing, as the sandbox README warns).

### 18. Personal and club work now lives in World
"My arrangements", "My competitions", "Invitations", the "Needs a result" period and "Add past match" (`PastMatchTool`) are all in World. PRODUCT_MODEL §8 says the club's own matches belong in My Club. My Club has no home for them yet, so keeping them in World avoids losing them, but the owner should decide and the decision should be recorded.

### 19. Enter in the front-page search can open the wrong result
- **Where:** `WorldSearch.tsx:55-61`. Enter goes to `firstHit` from the previous debounced query.
- **Evidence (probe):** with results showing for "ri", typing "saburtalo" and pressing Enter at once opened **/clubs/3 (Riverside Academy)**; Saburtalo is club 4.
- **Fix:** only act on Enter when `q === text.trim()` and the data belongs to that key. Otherwise flush the debounce or go to `/world/clubs?q=…`.

---

## Nice to have

**Duplication and structure**
- Pull out shared pieces:
  - `SCOPE_LABEL` (`rows.tsx:41`, `CompetitionsDirectory.tsx:21`).
  - Age-option labels (`CompetitionsDirectory.tsx:38`, `matchSources.tsx:10`).
  - Competition status badges (`rows.tsx:44-52` vs `CompetitionsDirectory.tsx:72`).
  - `.gk-world-verified`, defined twice (`world.css:7`, `cards.css:11`).
  - The error-plus-retry notice (`DirectoryResults.tsx:27`, `FrontBlocks.tsx:23,80`) and skeleton rows (`DirectoryResults.tsx:15`, `FrontBlocks.tsx:24`). These should become an `ErrorNote` primitive in `src/design/`.
  - The local `ProtectedRoute` in `WorldRoutes.tsx:26`, which copies `App.tsx:117`.

**Smaller behaviour issues**
- **`near` is carried but unused:** WorldNav and `CARRIED` carry it to every directory, but none of them reads it. The front page's "Open for entries" and "Opportunities" blocks also ignore the chosen area even though the subtitle says "near Telavi".
- **People sort:** the Sort select stays visible for Referees, but `fetchReferees` never receives it (`PeopleDirectory.tsx:54-59`).
- **Invitations search:** filters only the current page on the client, so "Showing 3 of 3" can appear next to "Show more" (`CompetitionsDirectory.tsx:179-184`).
- **Venues "Free on" a past date:** silently ignored while "More filters · 1" stays lit (`VenuesDirectory.tsx:34`). Add `min={today}` or show a notice.
- **Map refits on every render (plausible, not visible in the tile-less sandbox):** `WorldLiveMap` `FitPoints` runs on each new `points` array, and `useDirectoryData.ts:52` rebuilds it every render, so the user's pan or zoom resets. Key the effect on a joined id string.
- **Map theme:** `WorldMap.tsx:42` reads the theme once and doesn't follow a theme change.
- **Places to train with `player` in the URL:** the first request goes out before participants load, without birth year. Wait for the admission home before loading.

**Design polish**
- **Open matches:** every row repeats "Needs an opponent", which is the tab's definition. Show "They host" / "They travel" there instead.
- **Fixture lists:** at 1920 px they run edge to edge. Group by day, or add a side column.
- **Front page:** "Coming up near you" is mostly the signed-in coach's own club friendlies. For discovery, leave out the person's own club or show it separately.
- **Saved searches with alerts:** PRODUCT_MODEL §4 asks for them and they are not started; even "pin this search" would help.

---

## What is good (keep)
- One engine (`directory/*`, about 520 lines) drives six directories. Each file is under 210 lines and CSS is scoped and token-only. `check-theme-colors` passes.
- Honest states almost everywhere: skeletons, retryable errors, filtered versus true empty, and stale responses never shown (probe: "din" delayed 2.5 s, then "dinamo tbilisi academy" → only the final result).
- Redirects keep the query and hash and are tested.
- Club, venue, people, match and competition rows and cards are consistent, and the dark and light themes both hold up.
- The parent birth-year and gender logic for training groups is correct and tested.

## Checks run
| Check | Result |
|---|---|
| `tsc -p tsconfig.app.json --noEmit` | Clean |
| eslint on the 66 changed files | 1 error, `design/Tabs.tsx:32` react-refresh. It was already there (`useUrlTab` exported beside `Tabs`); this sprint added more exports to the file. |
| `scripts/check-theme-colors.mjs` | Passes |
| vitest | Could not run (native rollup binary missing) |
| Sandbox build | 0 errors |
| Standard shots (64 captures) | No overflow, no API errors |
