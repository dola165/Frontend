# Tournament creation and settings — 15 September 2026

Integrated frontend changes for the tournament redesign. This work has not been deployed.

## Follow-up: direct editing and the existing app theme

The founder requested fewer workspace sections after reviewing the first version. The workspace now has only **Participants** and **Bracket**. Match scheduling links point to the bracket. The former settings section opens through a compact **Edit tournament** header button instead.

The editor is an accessible dialog: focus stays inside while open, returns to its opener on close, and incomplete edits remain mounted for the next opening. Escape, backdrop and close-button dismissal are disabled during a pending save. The underlying save/validation and planning-only restrictions remain in place. Score entry follows the backend operator policy: active admins and staff can score; referees retain viewing access. Only admins receive the tournament editor.

Tournament workspace, bracket, editor and creation surfaces now use the actual app theme variables (`--bg-*`, `--text-*`, `--accent-primary`, semantic state colors), with existing FC tokens as fallbacks. This is required because FC tokens alone default to dark outside the club workspace's explicit light wrapper. The custom lime/charcoal palette was removed. Public no-cover headers use the current app surface; photo covers retain their readability overlay. Application navigation is not changed by this work.

Six workspace tests and nine editor tests passed. They cover the two-section navigation, schedule-to-bracket path, editor draft preservation and focus return, save dismissal guard, saved heading update, and active staff/referee/inactive staff permissions. Scoped ESLint passed. Real-shell review identified the actual top navigation at z-index 1500; tournament editors now use 1600 and tournament-scoped shared confirmations use 1700 so the header and close button remain reachable on narrow screens. The parent task and browser agent own final combined validation in the real application shell.

## Design pattern

The previous opportunities design/release records and squad workflow review established the pattern: neutral surfaces, a short sequence of decisions, optional details out of the initial view, a useful preview, persistent actions, and preserved unfinished work.

Creation now follows **Basics → Details → Review**:

- Basics asks for a name, organizing organization, required tournament dates, and participant type.
- Details contains optional description, rules, registration dates, and host club.
- Review shows the chosen details and visibility, followed by one creation action that opens the workspace.

An organization is the organizer. Companies, healthcare providers, sponsors and sports organizations do not need a host club. An eligible host club can still be attached. Organization creation keeps the account-scoped tournament draft through cancellation, browser Back, and successful creation; the returned organization must still have current server creation capability.

Dates are entered explicitly and validated against the actual backend contract: tournament dates are required and future when creating; end must not precede start; registration close must follow open and cannot exceed tournament start. Host-club loading failure does not prevent organization-only creation.

Settings keeps common fields visible and puts dates/registration and rules/prizes/cover under disclosures. Only changed fields are sent. Optional strings use an empty string to clear; registration dates use `clearRegistrationOpensAt` / `clearRegistrationClosesAt` flags. Edited fields survive workspace refreshes while untouched fields adopt newer server values. Failed saves preserve edits and pending requests block duplicate submissions.

All new creation/settings copy is available in English and Georgian in dedicated locale modules.

## Visibility and lifecycle

Creation defaults to private. Public tournaments are discoverable; unlisted tournaments are available by link. Settings must be finalized before starting: the existing backend permits tournament settings changes only during planning. Active, completed and cancelled settings are shown as read-only. The private visibility hint explicitly directs organizers to choose public visibility before starting.

## Verification

- 16 organization/setup behavioral tests passed individually at the normal timeout.
- 9 settings tests passed, covering changed-field PATCH, actual clearing payloads, preservation through server refreshes, invalid date focus, failure/duplicate handling, stale response isolation, and read-only lifecycle states.
- Final combined focused run: 25 tests passed with one worker. One earlier concurrent run timed out in the long organization roundtrip while other agents were building/testing; it did not reveal an assertion failure. The original default timeout is retained for the final source.
- Scoped ESLint passed. Project TypeScript checks passed before the final small lifecycle/read-only and copy adjustments; the parent task owns the final combined build.
- Setup desktop and 390px screenshots were inspected: `setup-desktop.png`, `setup-mobile.png`. Sticky actions remain reachable, and later fields remain accessible by scrolling. Input color scheme, accent and error colors follow the app's light/dark theme.
- Settings desktop, 320px, and Georgian screenshots were inspected: `workspace-settings-desktop.png`, `workspace-settings-mobile-320.png`, `workspace-settings-georgian-light-mobile.png`. Labels wrap within the panel and the save action remains reachable. The parent workspace currently uses its dark tournament surface in either shell theme.
- The browser agent reports 50 combined checkpoints passing, including organization creation with draft preservation and tournament creation through to the workspace, with no page errors or unhandled fixture requests.
- Integrated browser fixture: `http://127.0.0.1:5186/e2e/fixtures/tournament-preview.html?view=setup`. It uses the real components and tab-local synthetic API data.

## Main files

- `src/pages/TournamentSetupPage.tsx`
- `src/pages/tournament-setup.css`
- `src/features/tournaments/tournamentSetupCopy.ts`
- `src/features/tournaments/components/TournamentSettings.tsx`
- `src/features/tournaments/tournamentSettingsCopy.ts`
- `src/pages/__tests__/TournamentOrganizationFlow.test.tsx`
- `src/features/tournaments/components/__tests__/TournamentSettings.test.tsx`

Independent review also identified the stale standings refresh signature, stale default bracket size after adding participants, empty opening fixtures before starting, and the need to explain private visibility before lifecycle start. The parent task addressed those in its owned workspace/competition components.
