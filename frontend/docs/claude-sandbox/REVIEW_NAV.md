# Review: navigation sprint (`sprint/nav`, 4a60087..9ca0cce)

This was a read-only review; nothing in `wt-nav` was edited. HEAD is still 9ca0cce and the tree is clean. The port 4504 server is stopped.

**Checks**
- `tsc -p tsconfig.app.json --noEmit` passes.
- eslint passes on every changed .ts/.tsx/.mjs file.
- `sandbox/build.mjs` passes with 0 errors.
- Vitest could not run in this environment: `@rollup/rollup-linux-x64-gnu` is missing from the shared node_modules. Tests are unverified here.
- Diff: +1,632 / −2,694 lines. Every new file is under 130 lines, and `header.css` is 185 lines.

**Screenshots**
- The standard set is in `wt-nav/frontend/sandbox/shots/review-nav/`: 10 routes × 1440/1024/390 × dark/light. No overflow and no API failures.
- Interaction shots are in `/tmp/claude-0/review-nav-shots/`.

**Verdict.** The header itself is clearly better than before:
- One 64px row instead of the old 100px two-row bar.
- Tabs at 15px with 20px icons, each a 64px-tall target (old: 12px text, 40px tall).
- Clean hierarchy and a good light theme.
- A sensible phone tab bar (Home, World, My Club, Messages, Pins).
- Requests and notifications merged into one Inbox; the duplicate Dola and profile entries are gone. See `hdr-1440.png`, `menus.png`, `light.png`, `phone2.png`.

It is **not ready to keep as is**: on this branch the World tab opens the guest map, guests lose most public destinations, several workspaces are buried, pins collapse at common laptop widths, and there are some menu and count bugs.

---

## Must fix

1. **The World tab sends signed-in users to the guest map, and its "Return" button goes to the marketing landing page.**
   - The tab links to `/world` (`header/AppHeader.tsx:64`). `/world` renders `MapExperience context="guest"` with a "Return" button that calls `navigate('/')` (`pages/PublicWorldMapPage.tsx:7-8`).
   - The guest map has no planning, advanced filters or mode control (`MapExperience.tsx:316-318`, 1018, 1136).
   - The old "GrassKickZ World" button went to the signed-in `/map`. Now `/map` is only reachable through Pin → More places to pin → Explore → Map.
   - `App.tsx:328` now shows the header on `/world` for signed-in users, which makes this the main path.
   - Evidence: `world-signedin-1440.png` (World tab active; "Return" button visible).
   - **Fix:** until the sprint 3 World page lands, point World at `/map` for signed-in users, or have `/world` render the signed-in map. Do not merge this sprint without one of the two.

2. **Guests lose almost every public destination.**
   - The old guest header had Clubs and Matches & Competitions tabs, plus a Shortcuts menu with Store, Stadiums, Campaigns, Tryouts, Events and Roles.
   - The new `GuestHeader` (`AppHeader.tsx:102-126`) has only World. For guests, `/world` has no header at all (`App.tsx:328`), and the landing page links only `/clubs`, `/roles` and `/world`.
   - Result: a guest on a club page cannot reach Matches, Store, Campaigns, Tryouts, Events or Venues from any navigation.
   - Evidence: `guest-club-1440.png`, `guest-club-390.png`; probe2 log shows guest header = brand, World, language, Sign in, Create account.
   - **Fix:** give guests the same "Explore" list (`pinCatalog.exploreDestinations`, filtered to public pages) behind a "More" or "Explore" button, until World has a front page that links them.

3. **Tournament, organization and extra-squad workspaces are hidden behind a collapsed disclosure inside a panel called "Pins".**
   - The old Shortcuts menu listed every `workspaceLinks()` entry, and "My work" listed all workspaces.
   - Now the only header path to `/tournaments/:id/workspace`, `/organizations/:id/workspace` or `/squads/:id` is: "+" → expand "More places to pin" → "Your work" (`pins/PinsPanel.tsx:105-109`).
   - "Suggested" includes only Parent Hub, Officiating, Agent Hub and My venues/organizations (`pins/usePins.ts:19-30`). It never includes squads or tournaments.
   - Home's left rail does not list them either (probe2: no link to `/tournaments/301/workspace` or `/organizations/77/workspace`).
   - For the coach persona, the panel opens with no suggestions at all; U16 and U14 are collapsed away (`pins-1440.png`).
   - This contradicts the brief's "you wouldn't miss out on anything".
   - **Fix:**
     - Add every `workDestinations()` item that isn't already a tab to "Suggested". Start with squads, tournaments and organizations; these are exactly what PRODUCT_MODEL §3 says people pin.
     - Show "Your work" expanded by default.
     - Optionally add a "Your workspaces" section to the account menu.

4. **Menus stay open after keyboard focus leaves them.**
   - `usePopover` (`header/usePopover.ts:23-43`) closes only on pointer-down outside, Escape or navigation. There is no focus-out handling.
   - Probe: open the account menu, press Tab 14 times. Focus is on the page's "Club operations" button and the menu is still open (`account-tabbed-out-1440.png`).
   - The old TopNav and SettingsChoice closed on blur. A `role="menu"` that ignores Tab breaks the ARIA menu pattern.
   - **Fix:** in `usePopover`, close without returning focus on `focusout` when the new focus target is outside both the panel and the trigger. Do this at least for `role="menu"` (account menu and pin overflow).

5. **The Inbox count claims to be complete when it isn't.**
   - Old `RequestsLink` showed no count when `unavailableSources` was non-empty. `useInboxCounts` now shows `counts.actionable` even when sources failed (`inbox/useInbox.ts:33`). The `needsYouPartial` flag it computes is never read (dead at `useInbox.ts:9,48`).
   - When the requests call fails, `needsYou` is `null`, but the button label says "Inbox: **0** need you, 7 unread updates" (`inbox/InboxButton.tsx:17-21`, `?? 0`).
   - AGENTS.md says "Never invent counts".
   - **Fix:**
     - If any part is partial or unknown, show the badge as "N+" or a dot.
     - Say "some requests could not load" in the label.
     - Never render a null count as 0.

6. **Several controls are below the 44px target the design system requires (rule 10).**
   - Pin, Unpin and "Pin this page" buttons are 32px tall, measured 46×32 and 107×32 (`PinsPanel.tsx:41,68`).
   - Move-up, move-down and remove icons are 32×32 on desktop (`PinsPanel.tsx:81-83`). `header.css:162` enlarges only *icon* buttons, and only on phones. Text Pin/Unpin buttons stay 32px on the phone sheet.
   - Appearance and language radios are 40px (`header.css:147`).
   - Inbox footer links are 40px (`header.css:104`); "Mark all as read" is a small 32px button.
   - Guest "Sign in" and "Create account" are 40px.
   - **Fix:** raise `.gk-pop`/`.gk-sheet` controls to a 44px minimum at all widths.

7. **The phone Pins sheet looks modal but behaves as non-modal.**
   - It draws a full-screen scrim (`header/PhoneTabBar.tsx:54-60`), but the dialog has no `aria-modal` and no focus containment. Tab moves onto page content hidden behind the scrim.
   - With an empty panel, initial focus stays on the trigger: `<summary>` is missing from the `focusable` selector (`usePopover.ts:4`). Probe: "sheet focus: button Pins".
   - **Fix:**
     - Add `aria-modal="true"` and either trap focus or make the background `inert`.
     - Add `summary` to the focusable selector, or fall back to focusing the dialog itself.

## Should fix

8. **Pins collapse into "N pins" at the most common laptop widths, and the behaviour gets worse as the window gets wider.**
   - From 1280 to 1439px, the 240px search field (`header.css:78`) takes the space, so `PinsBar` fits no pins:
     - 1280px, 8 pins: "8 pins", nothing visible.
     - 1100px, same pins: one pin visible, because search is an icon there.
     - 1280px, Georgian, only 2 pins: "2 პინი", nothing visible.
   - At 1440px, 2 of 8 pins show. `VISIBLE_PINS = 5` is only reached on very wide screens.
   - The CSS comment says "Pins get the space first, so the field narrows before a pin is pushed into more", but the code does the opposite.
   - Evidence: `pinbars.png`, `ka.png`, `wt-nav/.../shots/pins2/bar-1280-dark.png`.
   - **Fix:** while any pin overflows, collapse search to its icon (`data-pins='some'` → icon below about 1600px), and drop the fixed `OVERFLOW_BUTTON = 104` / `PIN_TOOLS = 64` reserves (`PinsBar.tsx:12-13,34-44`) in favour of measuring the real buttons.

9. **The Inbox badge double-counts.**
   - The badge is `needsYou + updates` (`InboxButton.tsx:17`) = 26. The same event often appears in both lists: "Membership application · U14, Davit Kvirikashvili" under Needs you, and "New membership application, Davit Kvirikashvili" under Updates (`menus.png`).
   - **Fix:** badge only "needs you", and show unread updates as a dot. Alternatively, dedupe request notifications.

10. **The Inbox preview can contradict its badge.**
    - The preview fetches 10 INCOMING requests and keeps the actionable ones (`useInbox.ts:64-65`).
    - If the first 10 contain no actionable items while `counts.actionable > 0`, it shows "Nothing needs you right now" (`InboxPanel.tsx:62-63`) next to a non-zero badge.
    - **Fix:** base the empty state on `counts.needsYou`, and when the count is above zero but nothing is listed, show "N waiting — open Requests".

11. **"Inbox" now means two different things.**
    - In the header it means requests plus notifications (26). The club workspace side navigation still has "Inbox 3" and "Unread inbox 3" (`ws-1440.png`).
    - **Fix:** rename one of them, for example the workspace's to "Club updates", or make them the same feature.

12. **Pin labels, suggestions and the catalogue are English-only.**
    - Hard-coded English in `pins/pinCatalog.ts:13-38`, `pins/describeRoute.ts:28-54` and `pins/usePins.ts:19-30` ("Your children and their football", "Joining football", "Workspace · …"). Also `useInbox.ts:98`, and `aria-label="Loading"` in `InboxPanel.tsx`.
    - A pin's label is frozen at pin time (`usePins.ts:54`), so a Georgian user sees "Matches & competitions" forever (`ka-pins.png`).
    - The old navigation translated every destination through `t()`.
    - **Fix:** store a stable key or path, and resolve labels at render time through i18n.

13. **One destination has three names.**
    - `/referees/me` is "Officiating" in Suggested (`usePins.ts:25`), "Referee workspace" in the catalogue and as a pin label (`describeRoute.ts:31`), and "Referee workspace" on Home's left rail.
    - Georgian also differs: the panel title is "მიმაგრებული" but the tab says "პინები"; the hint says "სამყარო" for World but the tab says "მსოფლიო".
    - **Fix:** pick one name per destination.

14. **"My Clubs" survives on surfaces the brief covers.**
    - The `/my-club` page, which sits under the My Club tab, has the heading "My clubs" (`layout/ClubSwitcher.tsx:50`).
    - The Account page has a "My Clubs" section (`pages/AccountPage.tsx:791`).
    - `experience.navigation.myClubs: 'My Clubs'` is now orphaned (`locales/experience.ts:4,62`).

15. **Visit history is a privacy leak on shared devices.**
    - `useVisitRecorder` stores up to 80 paths, each with the visible page title (child names, player profiles, `?tab=medical`), in `gk-visits:v1:<id>` (`pins/pinStore.ts:95-120`).
    - Nothing clears it at sign-out (`App.tsx:271-275`).
    - **Fix:** clear visits on sign-out, or keep path and icon only, without titles.

16. **The deleted tests were not replaced.**
    - Removed: TopNav.test (14 cases, including keyboard menu, focus return and guest destinations), NotificationBell.test (bulk-read blocking and retry), WorkspacesPage and navigation tests.
    - Added: 7 pure-logic cases in `header/__tests__/navigation.test.ts`. The commit message says "pin tests", but `pinStore`/`usePins` have none.
    - **Fix:** add tests for:
      - AccountMenu: Escape and focus return, Tab closes the menu, admin link gating, sign out.
      - Inbox: counts, partial and unknown states, mark-all busy and failure.
      - pinStore: per-user isolation, malformed or throwing storage, the 12-pin cap.
      - PinsBar overflow.
      - GuestHeader.

17. **The unread-messages badge downloads 50 full conversations on every route change.**
    - `useUnreadMessages.ts:24-31` calls `getConversations(0, 50)` on every pathname change, plus every 60s and on focus. Counts beyond the first page are silently missed.
    - **Fix:** refresh on focus and interval only, not on every pathname (inside `/messages` it does not update on read anyway). Ask the backend for an unread-count endpoint.

18. **Pins and workspace shortcuts are two separate stores for the same feature.** PRODUCT_MODEL §85 says "Workspace pins and top navigation pins are the same feature… build it once". This sprint adds `pins/pinStore.ts` beside `features/clubOperations/workspaceStructure.ts:28` (`gk-club-shortcuts-v1`). If unifying them belongs to sprint 5, record that decision explicitly.

## Nice to have

- **Duplicate of the My Club tab can be pinned.** `describeRoute` compares against `myClubPath` exactly (`describeRoute.ts:74`), so `/clubs/1/workspace?tab=overview` is offered as "Pin this page".
- **Tracking parameters end up in pins.** World pins keep *every* query parameter, including `utm_*` and `fbclid` (`describeRoute.ts:16`).
- **Mark-read can fire twice.** `InboxPanel.openUpdate` has no re-entrancy guard: a double-click sends two mark-read calls and two navigations. The old bell had a `busyId` guard.
- **The open Inbox preview goes stale.** It no longer refreshes on `notificationsChanged`.
- **Small ARIA gaps.**
  - Inbox tabs lack `aria-controls`, and the tab panels use `aria-label` instead of `aria-labelledby`.
  - The "+ Pin" button's name "Pins: add or manage your tabs" differs from its visible "Pin".
  - Arrow keys on the avatar trigger no longer open the menu, which the old menu did.
- **Dead code left behind.**
  - `needsYouPartial`.
  - The `[data-header-portal]` check (`usePopover.ts:31`): nothing sets that attribute.
  - The `useUnreadMessages(enabled)` parameter, which is always `true`.
  - `'/workspaces'` in `isFullScreenPage` (`App.tsx:290`).
  - 16 `nav.*` i18n keys orphaned by this sprint in `locales/en.ts` and `ka.ts`: signOut, menu, openMenu, closeMenu, menuDescription, accountSettings, recommended, everywhere, useEnglish, useGeorgian, mobileNavigation, explore, preview, hideNavigation, showNavigation, languageLabel.
- **Duplication and shared-module boundaries.**
  - `requestIcon` is duplicated in `InboxPanel.tsx:15` and `RequestsCentre.tsx`.
  - Shared navigation imports `useJourneyCopy` from `features/squadCommunication`. Move it to a shared i18n utility.
- **The header turns light on `/map`.** With dark preference, `/map` forces the document light, and the header now follows it. The old header was deliberately kept dark there. Decide which is intended.
- **Guests on phones lose the direct "Create account" button** (`header.css:184`).
- **The workspace "Hide navigation" collapse was removed** on workspace, calendar and messages pages. It is defensible now that the header is 64px, but it was not in the brief, so mention it to the owner.
- **The My Club link can change after load.** It is computed before `fetchMyClubMembershipContext` resolves, so its target can flip; for a staff member whose membership is a different club, it switches from the workspace to the member club's page. Wait for the membership state, or prefer the workspace.

---

### Functionality check (old destination → new location)

| Old destination | Now | Status |
|---|---|---|
| Home | Home tab | OK |
| Map (`/map`), "GrassKickZ World" | World → `/world` guest map; `/map` only via Pin → More → Map | **Regressed** (#1) |
| Clubs, Matches & Competitions tabs | Signed-in: Pin → More → Explore. Guests: nowhere | **Regressed** for guests (#2); buried for signed-in |
| My Club (or "My Clubs", "Following" fallback) | My Club tab (staff → workspace, member → club page); hidden with no club; Followed clubs in the catalogue | OK per brief |
| Parent Hub, Officiating, Agent Hub, My Venues, My Organizations activity tabs | Pins "Suggested" and Home's left rail | OK |
| Tournament, organization, venue, squad workspaces (Shortcuts menu, My work) | Pin → More places → Your work only | **Buried** (#3) |
| Schedule tab | Account menu → My schedule; pin catalogue | OK per brief |
| My work (`/workspaces`) | Redirects to `/home` | Deleted per brief |
| Store, Stadiums, Campaigns, People, Tryouts, Events, Roles, Followed clubs, My squads (Shortcuts) | Pin catalogue for signed-in users; none for guests | Signed-in OK (deep); guests **lost** |
| Messages | Header icon (desktop), tab bar (phone), now with unread count | OK |
| Requests and NotificationBell | Inbox (Needs you / Updates; All requests, Sent by you, All updates, Mark all as read). Same endpoints: `/requests?view=INCOMING&size=1`, `/notifications/unread-count`, `/notifications?size=6`, `PATCH …/read`, `…/read-all` | OK, with count issues (#5, #9, #10) |
| Agent Dola (3 entries) | One header button | OK (duplicates removed) |
| Profile shortcut and account menu | Avatar menu: profile, My schedule, Account & settings | OK |
| Admin console | Account menu, gated on `admin.console` | OK |
| Appearance (map-light / light) | Dark / Light segment (Dark = `map-light`) | OK |
| Language | Account menu (signed-in); EN/ქა toggle (guests) | OK |
| Sign out | Account menu → `handleLogout`; sessions still isolated by `AuthSessionBoundary key={sessionId}` | OK |
| Guest sign in / sign up | Sign in; Create account (hidden on phones) | OK (minor) |
| Hide-navigation toggle | Removed, except map planning's own toggle | Deliberate? (nice to have) |
| WorkspaceConnectionBar, LeftSidebar Workspace picker | Removed; covered by pins (#3) | Buried |
| Android | Header and tab bar not rendered (`!isAndroidApp`); unchanged | OK |
| Pins keyed per user | `gk-pins:v1:<userId>`; reads and writes wrapped in try/catch; malformed or unsafe paths dropped (verified with esbuild: `//evil.com` rejected, bad JSON → `[]`, separate users isolated) | OK |
| Tab bar vs. modals | Hidden when `[aria-modal=true]` is present; map rails end above it; content padding is 56px | OK |
