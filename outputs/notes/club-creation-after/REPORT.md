# Club creation: after (15 October 2026)

Branch `claude/page-creation-834687` (from `claude/workspace-and-squads-6755b0` at `89cd387`), the page-creation chat's sandbox on :4306/:5179. Screenshots in this folder at 1920×1080, dark theme unless the name says light or phone (390 px). The same flow runs as a Playwright test, `frontend/e2e/page-creation.spec.ts`, at 1440×960 and 390×844 against the sandbox. The before review is `../club-creation-before/REVIEW.md`.

## 1. The flow as a newcomer sees it

1. **Home.** The left rail has one card for anyone without a page: *Start your club or page · Your page in a minute* (`01`). The same sheet opens from the My Club tab (two picture tiles, Find your club · Start your club; on a phone this is the entry, the rail being folded away), World's + Create ("Create a page" first), the account menu, a person's own profile ("Add your club"), a search with no result ("Can't find it? Create it"), the fundraising and job pages, the first run for someone who coaches ("Run a club? Start it after this") and Agent Dola ("Create my club called Rustavi Lions").
2. **One sheet, no steps** (`01`, `03` on a phone). Four picture tiles; Club is pre-chosen when the entry was about football. The name, with the town already filled in (where the person registered; one tap changes it). From three letters the sheet looks for the same club: a copy of a known name turns Create into **Claim it** (`02`), a near match says "No, mine is different".
3. **Create → the club page itself, in edit mode** (`04`, `05`). It already looks like a club: a generated crest from the name's letters, a football cover, the about written from the type and town. A strip says *Draft · only you see this*; a ring counts *1 of 7* with the next thing named (*Next: Add your crest*); each empty box is a ghost with an icon and three words. Nothing else to read.
4. **Contact, in place** (`06`, `07`): the box opens its own form; the account's phone is one tap; Done saves, a toast offers Undo, the ring moves to *2 of 7*.
5. **The crest designer**, a split panel (`08`): colours, shape and letters on the left, the crest live on the right; *Keep this crest* or *Upload a photo instead* (the app's cropper).
6. **Where do you play?** on a map (`09`): the town's pitches as pins; one tap adds a pitch with its address, a tap on empty ground drops a pin whose address is looked up.
7. **Which ages?**: tiles U6…U18 × boys, girls, mixed; each becomes a squad with its own join link.
8. **Players by sharing** (`13` shows the staff twin): a squad's join link and QR code go to the parents' WhatsApp group; each parent adds their own child; the coach says yes or no in the same panel. Staff get an invitation link by phone number; no account first.
9. **Go live** (`10`): one sheet with the page's link, a QR code, WhatsApp, and the first post written ("Rustavi Lions joined GrassKickZ"), one tap to post or skipped.
10. Light theme (`11`) and a phone (`12`): the panels become bottom sheets, the columns one column.
11. **Rearrange** (`14`): a switch in the bar; every box gets a handle, Move up, Move down and Hide (Contact and Posts cannot hide); dragging only between the drop lines of a box's own column and from the *+ Add a box* tray. No free canvas.
12. **A real club as its owner** (`15`): Dinamo's page in edit mode with its real contact, fees, grounds, squads and staff in the boxes; visitors see the Home chat's page unchanged. The Edit links on the club page now open the box's editor on the page (`?edit=1&panel=…`) instead of the workspace.
13. **A pre-created club** (`16`–`18`): *Is this your club? · Claim it* over Rustavi Metallurgi Kids; the claim sheet asks only who you are and a phone; the claimed page opens in edit mode with what was already known (ground, two age groups, fees): *Claim pending verification*, 5 of 7 done; the page was live before the claim and stays so.

## 2. Before and after

| | Before (14 October) | After |
|---|---|---|
| Finding "create a club" | No link on Home, no My Club tab without a club, World filed it under Places beside "List your venue", the account page only when allowed | Home card, My Club tab, World's + Create first entry, account menu, own profile, empty search, fundraising and jobs, first run, Dola |
| A new account | **Blocked:** "Creation requires a verified adult account", Continue disabled, nothing says what to do | Anyone of 18 creates a club at once (13 for a fan club or a page); verification is asked only when selling, fundraising or a badge is tried, in one sheet, and nothing else waits for it |
| The setup | Three steps: organisation type (8), club category (9), two checkboxes, name, about, website, email, phone, address, "what we do", a CSV; a review that reads like a contract; Done sends to the workspace | One sheet: a tile, the name, the town already filled; then the page itself |
| Taps, characters, seconds from "I want a club" to live | Not reachable for a new account. Read from the three steps as described: about 12 taps and about 200 typed characters over nine fields, and the page would still have no crest, ground, squads, fees or players | **18 taps (19 on a phone) and 43 typed characters** (the name and a phone number), **6 seconds** in the test at both widths (a person reads and thinks; the sandbox does not wait for a network), with crest, ground, two squads, contact and fees on the page |
| Jobs that stay on the page (name, about, crest · contact · fees · ground · squads · staff · players · store, jobs, fundraising, sponsors) | 0 of 7: every Edit leaves for the workspace or a separate page | 7 of 7 edit on the page; the workspace stays for the deep work (sessions, the calendar, the squad workspace) |
| Players | One child at a time, seven fields, only people already in the club; bulk through a CSV in the workspace | A join link and QR per squad; parents add their own child; the coach confirms in the panel; a pasted list is the fallback |
| An empty page | Starts with nothing and nothing says what is missing | Looks like a club from the first second; the ring and the ghost boxes show what is missing and open the editor |

The review's smaller faults: **"Near: Tbilisi" for a Rustavi account** is fixed (the town given at sign-up was only saved when the first run's town screen was confirmed with Next; Skip, or the first run not showing, dropped it; now Skip keeps it too). The first-run screens do show after sign-up in this sandbox (the test goes through them). `/register` now opens `/signup`. The blank World map, the squad page's missing space and the staff list's repeated squads are other chats' pages and are not touched here.

Found by the end-to-end test and fixed on the way: creating from the My Club tab lost edit mode (My Club's two redirects to "your club" fired while the club page's code was still loading; they now hold still while the start sheet is open); the sandbox's identity save crashed on any phone number ("Not saved" for every contact); the page was re-read four times per save (the provider keyed on an object that changed every render); a claimed page did not switch to edit mode until re-read (it is re-read on arrival now).

## 3. Decisions taken where the brief left room

The full list with reasons is `frontend/docs/claude-sandbox/PAGE_CREATION.md` §12; the ones that shape the product:

- **Four tiles on the backend's types:** Club → `CLUB`, Fan club → `PARTNER` + `pageKind`, Sponsor or business → `COMPANY` (what kind, inside the page), Other page → `OTHER`. Venue exists in the model with its boxes, without a tile while venues are out.
- **One page DNA:** identity (name, crest, cover, town, contact, about) plus boxes switched on per type (`BOX_DEFAULTS`): a club starts with contact, fees, grounds, squads, posts, staff and Coming up; sponsors, honours and Get involved wait in the tray. Fixed order, fixed columns, Rearrange moves a box only within its column.
- **The page looks real before anything is configured:** a generated crest (initials on two colours, lettering chosen for contrast), a football cover that suits the colours, an about written from type, town and ages that keeps following them until edited. The crest counts towards Go live once kept or designed (one tap).
- **Go live needs little:** a name, a crest and either a ground or a way to reach the page. The ring counts seven things for a club and nags about nothing.
- **Small things edit in place, big ones in a split panel;** every save is optimistic, autosaved, undoable and carries the version it read (a lost race shows theirs with Keep mine); a failed save is kept in the tab and sent when the page opens next.
- **The URL holds the editor's state** (`edit=1`, `panel=…`, `rearrange=1`, `new=1`, `claimed=1`), so Back closes a panel and a link can open one; the create sheet is `?create=…&from=…` over any page.
- **Claiming:** a copy of a known name never makes a second page; unclaimed seeded clubs are live and findable with "Is this your club?"; a claim asks who you are and a phone, edits start at once, verification follows.
- **Under 18:** a club or a business says "From 18: ask an adult at your club to create it and invite you"; a fan club or a page is allowed with nothing personal pre-filled.
- **A backend without pages changes nothing:** the provider treats a non-page answer like a 404, so older organisations and the club page stay as they are until `/clubs/:id/page` exists.

## 4. The backend list, and what is not finished

**Backend** (also in `ROUND_2.md` → Before release): everything `sandbox/api/handlers/pages.mjs` answers — `POST /organizations/setup` for any adult with `pageKind`; the page read and the versioned identity, box and layout writes (409 on a stale version); Go live; claims; verification requests; `/pages/similar` (transliteration-aware); `/pages/mine`; `/pitches` (Overpass) and `/map/reverse`; squad join links with arrivals; staff invite links; the creation funnel in `POST /feed/events`; Dola's `PAGE_CREATE`; posts by a page (`organizationId`); the fee band and squad ages in the clubs search filters. Saving the sign-up town at registration would be cleaner than the first run doing it.

**Not finished, plainly:**
- The club page in edit mode draws the page DNA's default box views; the Home chat's own blocks are not registered in `features/pages/club/clubBoxes.tsx` (the Home chat did not answer the split; the integration touches `ClubProfilePage.tsx` and six Edit links only).
- Tests: `features/pages` has 33 unit and component tests and `clubs/profile` 4 more, all green; the whole suite is 2444 tests, of which 24 in 13 suites fail on the base branch too (25 there; one is flaky) (header, navigation, LeftSidebar, ExperienceRoutes, ClubWorkspacePage.requests, directory, AppointmentJourney, planning, ClubOverview, WorkspacePolish, useDialogFocus, WorkspaceShell, JobEntryEligibility); the five suites this branch had broken (PostComposer.publication, OrganizationProfilePage, FootballIdentity, OrganizationActivities, campaigns) are fixed. `npm run lint`: 0 errors (4 warnings, all in other chats' files). `tsc -b`: clean. `vite build`: clean. `npm run check` cannot pass on this branch because `check:theme` fails on other chats' stylesheets (store.css, club-profile.css, campaigns.css). The Playwright test passes at both widths against the sandbox (2 passed, 1.3 min); it has no backend to run against yet, and GitHub Actions is off.
- Georgian: every string under `features/pages` has a line in `copy.ka.ts` (382 lines; one key mended); the shared files' new strings are in `locales/ka.ts`.
- Verification is recorded, not performed; the call is a backend and an operations matter.
- Accessibility checked by hand: the sheet's tiles are radios, dialogs trap focus and close on Escape, Rearrange works without a mouse (Move up, Move down, Hide; dnd-kit announces drags); not audited with a screen reader.

## 5. Open questions (where the answer changes the design)

1. **Age groups on an unverified club's public page.** Squad names with ages (U10 Boys) show to visitors from the first minute; children's names and faces never do until verified. Keep ages public, or hide them too until verified?
2. **Two claims for one club.** Today the first claim holds the page and the second person is told it is pending. Should the second claim queue for the same call, or should a club be claimable by several people (co-owners) from the start?
3. **A fan club's club.** A fan club is a free page today. Should it be tied to the club it supports (a link the club accepts), so the club's page lists its fan clubs and the fan club's posts can reach the club's followers?
4. **New clubs in the town's feed.** Going live posts to the club's own followers (none yet). Should a new club also appear once in Home's local feed for its town ("New in Rustavi"), or is World's directory enough?
