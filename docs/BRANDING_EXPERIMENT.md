# Branding experiment

22 October 2026. Local work on `branding/experiment`, based on `b961138f`.
No commit, push, merge or deployment has been performed.

## References and implementation

- Primary: Grasskickz Brand Book edition 01, pages 9-11, 14-19 and 22.
  The approved Home layout remains the layout reference.
- Shared product header now uses the pitch mark and outlined Archivo Expanded
  Black Italic wordmark extracted from page 9, with Volt/Turf Z per appearance.
  Search shrinks within its column; compact desktop navigation avoids overlap.
- World uses the compact outlined map pin inside the pitch frame: 24px in the
  header, 22px on phones and 24px in its Map tab.
- Theme roles in `src/styles/theme.css` now serve the shared design system,
  legacy pages, workspaces, schedules and portals. Replaced the competing
  slate/neutral palettes with Chalk, Pitch, Floodlight and Volt. Forced light
  and dark scopes remain available. Status and calendar categories remain distinct.
- `components/layout/branding.css` promotes the approved Home presentation into
  the shared product shell. Archivo is the UI family; DM Mono handles compact
  numbers/metadata. Existing page layouts and behaviour are retained.
- Store, Jobs and Fundraising use the kit-bag, briefcase and half-circle marks,
  with Tangerine, Sky and Rose tiles on Home, marketplace navigation and club
  shortcuts. Light-theme text/action shades are darker for readable contrast.
  Marketplace navigation styles moved out of the large store stylesheet and
  are imported by the component that owns them.
- Your football shortcuts use larger framed icons derived from pitch geometry;
  these are adaptations, not additional supplied brand assets.
- Secondary: Kick-off Brand Book pages 13-16 supplies George's G ring, lime node
  and maroon AI bubble. Owner-requested name: Agent George. Header, search and
  assistant UI use it; API/session identifiers remain unchanged.

## Verification

- Production build, TypeScript and theme colour guard passed. Existing bundle-size
  warnings remain. Focused ESLint and `git diff --check` passed.
- 107 tests passed across seven existing header, sidebar, route, World, Store and
  club-profile suites. The initial attempt failed before tests ran because Windows
  denied temporary-cache renames; rerunning with a writable temp folder succeeded.
- Earlier assistant annotation pass passed 61 tests, including search, assistant
  recovery and session-authority suites. No backend/auth/mutation logic changed.
- Reviewed the live synthetic sandbox: Home, World/matches, club profile/workspace,
  My squads, personal schedule/profile, messages, account settings, joining football,
  Store, Jobs and Fundraising.
  Checked desktop and 390px layouts, both appearances, long/populated lists and
  empty schedule/chat states, active navigation, keyboard focus and lazy-route return.
- New light marketplace action/label contrast pairs exceed 6.4:1 against Chalk;
  secondary text is 5.59:1 and Volt/Floodlight is 14.34:1.
- This is a branding rollout, not certification of every route or workflow.
  Live assistant availability and chat realtime connections are unverified in the
  synthetic sandbox. No messages, posts or other business mutations were submitted.
- Shared Git metadata fetch was denied earlier; upstream freshness is unverified.
  Dependencies were recovered earlier using a matching lockfile and local npm cache;
  lockfiles remain unchanged.

## Local preview

Reachable at `http://localhost:5180/home` using the owner's existing local servers.
From `frontend/`, the commands for separate local terminals are:

```powershell
node sandbox/server.mjs 4310
node sandbox/web.mjs 4310 5180
```

The sandbox uses synthetic data. All changes remain local and uncommitted.
The preceding rollout changed 447 added / 328 removed source lines.
The compact navigation and map refinement below changes a further 75 added / 72 removed lines (excluding this note).

## Compact navigation and map refinement

- Restored the smaller outlined World/map mark; removed enlarged icon overrides.
- Reduced the desktop header to 64px, navigation/search text to 14px, wordmark to
  164px, Home shortcut rows to 56px and mobile marketplace tabs to 66px.
  Header controls retain their 44px targets; the phone header remains 56px.
- Recoloured the shared basemap to Chalk, muted Turf and teal water in light mode,
  and Floodlight/Pitch greens in dark mode. Roads, labels, terrain, data sources
  and marker semantics retain their existing behavior. Map panels are more opaque
  and attribution follows the theme.
- Verified dark/light maps at desktop and 390 CSS-pixel phone width, map expansion,
  Home route return, and wide-header search clearance. Focused map, header, World
  and Store suites passed: 72 tests across four files. Production build and theme
  guard passed; existing bundle-size warnings remain.

## Dark appearance hierarchy

- Adapted the Brand Book palette into distinct green-charcoal page, card, inset
  and raised-control surfaces. Pitch remains the header colour; Volt remains the
  action colour. Ordinary links use a quieter sage, with separate secondary and
  muted text roles. Marketplace tiles keep their recognisable section colours.
- Dark World panels are opaque with visible borders. Dark map water is blue-teal,
  parks stay green, and roads/labels are lighter against charcoal land. Light
  palette declarations and every light basemap colour were checked unchanged.
- Checked Home, club profile, club workspace, Matches and World in the browser;
  checked 390px workspace/map layouts and both appearances. No horizontal page
  overflow. Shared muted text is at least 5.67:1 against all three dark surface
  levels; secondary text at least 7.18:1.
- 71 tests passed across the map paint, product-design and World suites. Production
  build and theme guard passed, with the existing bundle-size warning.
- This dark-only refinement changes 31 added / 26 removed source lines.

## Open George while unavailable

- The signed-in assistant shell now opens independently of service-session
  readiness. Missing service sessions show an explicit unavailable notice,
  suggestions and an editable local draft; Send remains disabled.
- Welcome, status and history requests still require a service session. Existing
  request/session guards, recovery isolation and backend authorization are intact.
- Added regression coverage for opening without a session, no assistant requests,
  draft preservation on close/reopen, focus return, full-page viewing and a server
  reporting unavailable. All 30 focused assistant/recovery tests, focused ESLint,
  theme guard and production build passed (existing bundle-size warnings only).
- Browser review covered sidebar/full-page switching, suggestion drafts, close
  and reopen, dark/light desktop and the 390px phone layout. The test draft was
  cleared; no message was sent.
- This change adds 47 source lines and removes 13; all work remains local.

## Optional G Mark style

- Account menu / phone You sheet now includes Brand style: Pitch or G Mark.
  Pitch remains the default and preserves the current artwork. This preference
  is independent of light/dark appearance, persists locally and syncs across tabs.
- G Mark follows the section-lockup reference: shared G ring and lime node,
  cyan Map, red Store, blue Jobs, green Fundraising, gold Workspace and maroon
  George symbols. Shared navigation, Home shortcuts and section marks switch
  in place without remounting pages or clearing drafts.
- Verified both styles and appearances, persisted selection after reload,
  desktop Home/World and 390px Home/Store. Fixed dark Store ring contrast.
- All 35 focused branding/header/assistant tests, focused ESLint, theme guard
  and production build passed. Existing bundle-size warnings remain.

## Warm-up section logo follow-up

- Reviewed the supplied Warm-up image against the existing local section artwork:
  gold Workspace, orange Store, rose Fundraising, lavender Jobs, cyan Map and
  purple George. The G Mark family remains a separate preference.
- Completed compact marketplace shortcut colour tiles and workspace header pins;
  preserved dark map ink in active navigation. This follow-up adds 10 source
  lines and replaces 1 (11 added / 1 removed), on top of the existing local work.
- Branding preference tests (3), focused ESLint and theme guard passed.
  Browser verification remains blocked by localhost connection failures.
- Upstream refresh could not write FETCH_HEAD in the paired Git directory.
  No commits, pushes or deployment.
- Production build also passed (existing large-chunk warnings).
