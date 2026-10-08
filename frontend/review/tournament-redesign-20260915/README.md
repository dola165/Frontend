# Tournament workflow redesign — 15 September 2026

## Final inline workflow and real app shell

The founder's follow-up removes the Settings and Matches/results management tabs. Participants and Bracket remain. Scores can be typed or incremented with + in a match card, saved provisionally, and finalized with the adjacent Advance button or by dragging the winner into its legal next-round spot. The final has a Declare winner action. Edit tournament is a header dialog. The existing app navigation and dark/light theme are retained.

The fixture now imports the **actual App MainLayout**, including its real routes, navigation, theme controls and authentication boundary. `App.tsx` only exports its existing MainLayout for this harness; product behavior is unchanged. The former synthetic preview header/toolbar have been removed. MemoryRouter keeps refresh/navigation in the isolated fixture. `?active=1&tab=bracket` starts a fully placed eight-team draw for inline results.

- `node e2e/tournament-inline-smoke.mjs`: **44 focused checkpoints passed** in the real source App shell. Includes typed scores, +, provisional save, score/advance failure retention and retry, legal winner drag, rejection of unrelated destinations, guest placement/swaps, pending rounds, complete semifinal/final/champion flow, empty draw creation, header editing, actual app theme menu, English/Georgian, 320/390px dark/light controls, and anonymous public views. Evidence: `inline/results.json` and screenshots.
- TypeScript for source plus fixture and focused ESLint for the fixture/MainLayout export pass.
- **Exact scoped candidate `web-r3`: 8 packaged workflow/screenshot checkpoints passed**, loading 29 real candidate assets, using HTTP route mocks rather than replacing the packaged Axios client. The prior live App runtime, authentication and navigation stay in use. Coverage includes inline score/+save, failed advance/retry, native winner drag, name-only guest, header editor, organization-hosted three-step creation, EN/light and KA/dark mobile and anonymous public refresh. Evidence: `packaged-r3/results.json`. No page errors or unexpected API/network requests; console network noise is limited to deliberately blocked Google/fonts and the injected 503 response.
- The first package trial (`packaged-r1`) found a real runtime export mapping error and was rejected. The parent corrected translation and params exports before `web-r3` passed. Its failed evidence is retained and does not count as a passing release check.
- `web-r4` passed **11 packaged checkpoints**, adding 320px editor-header occlusion, lifecycle backdrop and direct +/save controls. Its scoped stylesheet URL is versioned. Evidence: `packaged-r4/results.json`. A later operational preflight discovered that the running web image was newer than the recorded baseline; r3/r4 are therefore historical candidates pending a rebase onto the actual running image, not approved deployment artifacts.
- **Rebased `web-r5`: 11 packaged checkpoints passed against the actual running cart-images baseline**, loading 28 candidate assets. Zero browser page errors, application console errors, unexpected requests or unhandled fixture API calls. The complete editor header and lifecycle backdrop are visible above the existing navigation at 320px, and inline score/+save controls fit. Evidence: `packaged-r5/results.json` and screenshots. This supersedes r3/r4 as candidate UI evidence; deployment remains separately recorded by the parent release process.
- **Legacy-label correction `web-r6`: 6 narrow packaged checks passed.** The checker fetched actual public tournament 1 with GET and replayed its public DTO only into local HTTP mocks. Its older knockout stages have null round numbers and 2/1/1 fixtures despite being named Quarter Finals/Semi Finals/Final. The board now retains those organizer-provided stage names; newly generated complete draws still label the final correctly. Evidence: `packaged-r6/results.json` and desktop/mobile screenshots. This check does not alter live data.

### Live read-only verification

After the parent successfully released **`tournament-workspace-20260915`**, the public check against https://app.grasskickz.com passed: **32 release files** match the reviewed `web-r5` bytes, including the root HTML, versioned tournament overlay and dependencies. The existing browse page renders with its preserved “Find your next competition” heading. Creation/workspace routes redirect anonymous visitors to login. Existing public **Tbilisi Youth Cup 2027 (ID 1)** renders its knockout stage (ID 2) and match cards, and anonymous Refresh results completes while retaining the selected bracket. The 390px public page has no document overflow. There were zero browser page errors and zero attempted business mutations; automatic Cloudflare analytics POSTs were blocked separately. Evidence: `public-release/results.json`, `tournament-public-desktop.png` and `tournament-public-mobile.png`. No tournament or account data was created or changed by this verification.

The follow-up web-only release **`tournament-round-label-20260915`** (`web-r6`) also passed its narrow live check: **32 release files** match, and actual tournament 1 now displays the stored **Quarter Finals, Semi Finals and Final** headings correctly. The mobile screenshot was inspected; no document overflow or page errors occurred. Evidence: `public-release-r6/results.json`, `legacy-stage-desktop.png` and `legacy-stage-mobile.png`. The parent records the unchanged API/database release state; this check performed no business mutations.

The independent packaged runner is `e2e/tournament-packaged-smoke.mjs --build <exact candidate directory>`. `e2e/tournament-public-release.mjs --build <exact deployed directory>` prepares **read-only** postrelease byte comparisons (including the scoped overlay), protected-route guest checks and actual public bracket/mobile/refresh checks. Creating or editing live tournaments is outside both checks. Deployment status belongs to the parent release record; this directory alone is not proof of deployment.

## Original first-design evidence (historical)

The earlier 50-check run below predates the founder's follow-up; its separate Settings and Matches/results workspace tabs and old preview shell have been superseded. Use the inline and packaged evidence above for the final workflow.

## Interactive preview

Open http://127.0.0.1:5186/e2e/fixtures/tournament-preview.html while the Vite server is running.

- Default: tournament workspace with six confirmed teams and one pending entry.
- `?tab=bracket`: open the workspace directly on its bracket tab.
- `?view=setup`: real three-step tournament creation and organization creation.
- `?view=public`: anonymous public page with the shared read-only bracket.
- `?empty=1`: confirmed teams before the draw is created.
- `?view=public&results=1`: results and an eliminated team retained in the public history.
- `?view=public&results=1&groups=1`: additional group standings.
- `&lang=ka&theme=light`: Georgian and light appearance.

The fixture uses the real AuthProvider, tournament creation, organization creation, workspace, public page, bracket, editors and actual App shell. An Axios adapter is installed before application clients are imported, including authentication utilities. Every application request and mutation stays in memory; reload restores the samples. No live API, account, database or deployment is used by these browser checks.

The sample organizer is a healthcare organization. Guest clubs have names and ACTIVE entries, with no club account, user account, draft-team ID or player roster requirement. Fixture mutations simulate returned API data; server validation, permissions, concurrency and persistence need their separate backend tests.

## Public-page changes

- Organization identity leads the compact tournament header. An optional host club is supporting information under About.
- The shared bracket is the default view; multiple stages have a selector. Group stages use the existing read-only standings endpoint.
- Matches expose upcoming, completed and cancelled filters, scores, round, date and kickoff time.
- Teams are searchable. Eliminated teams remain visible; pending, rejected, waitlisted and withdrawn entries are omitted. Guests do not link to fabricated club profiles.
- Description, rules, rewards and entry details are organized under About.
- Copy link has a selectable fallback. Explicit Refresh results keeps the active tab and existing content on transient failures, refreshes standings and clears protected content if access is denied.
- Existing registration, club entry requests and protected withdrawal behavior are retained. The entry dialog now traps focus, handles Escape, restores focus and fits short screens.
- English/Georgian labels and narrow layouts are included. The old “brackets will be added later” preview notice is removed.

## Verification

- `node node_modules/vitest/vitest.mjs run src/pages/__tests__/TournamentDetailPage.test.tsx`: **28 passing tests** after the refresh implementation. Includes anonymous bracket rendering without private requests, guest/eliminated visibility, search, stage/results filtering, clipboard fallback, refresh/retry and the retained registration/withdrawal cases.
- Focused ESLint passes for TournamentDetailPage, its tests and the standalone public copy module.
- `node node_modules/typescript/bin/tsc -p review/tournament-redesign-20260915/tsconfig.preview.json --pretty false`: passed for product source plus fixture.
- `node e2e/tournament-redesign-smoke.mjs`: **50 browser checkpoints pass**, no page errors, no unexpected network requests, no unhandled fixture requests. Results are in `results.json`.
- Browser actions cover organization creation with setup-draft return; tournament creation to workspace; name-only guest addition; pending-entry confirmation; native drag from the team pool; native drag to swap opponents; button swap across matches; returning a team to the pool; automatic placement; scheduling; starting; final-score entry with advancement; creating an empty knockout draw; settings saves; anonymous bracket, group standings, search/results/history; 320px/390px layouts; Georgian/light views.
- Screenshots were visually inspected for desktop public bracket and workspace, phone public/participants/guest editor, Georgian light public bracket and creation review. All captured layouts passed the page-overflow check. The bracket has its own scrolling region.
- After the workspace header was compacted and stale bracket notices were retired, updated desktop/390px/320px bracket captures passed again. These replace the corresponding screenshot files; the earlier 50-check behavioral run is not represented as a second full run.

Earlier attempts stopped on in-progress source imports/HMR, one strict typed fixture and harness selectors; those were corrected. `results.json` is the final full browser result, not an earlier interrupted attempt. This evidence is a local UI rehearsal, not a deployment or a live backend sign-off.

## History and research behind the design

- `docs/WEB_OPPORTUNITIES_RELEASE_2026_09_13.md` (backend): compact searchable lists, clear actions, three-step editors, preserved drafts and validation focus.
- `review/squads-redesign-20260914/README.md`: roster-first management, account-free creation, shared public/management presentation, real interaction controls.
- `review/schedule-redesign-20260913/README.md` and `review/schedule-direction-20260914/README.md`: progressive disclosure, persistent editor actions, fewer nested boxes, readable dates and narrow-screen alternatives.
- [Challonge participant management](https://kb.challonge.com/en/article/participant-management-1m6ooqe/): display-name-only entrants, manual/drag seed changes, and button equivalents.
- [Toornament placement](https://help.toornament.com/placement/how-placement-works): direct placement preview, automatic placement and preserving played results.
- [Toornament participant fields](https://help.toornament.com/organizer/participants-custom-fields): organizer-created entrants can omit email, and public/private fields are distinct.
- [Toornament first-tournament guide](https://help.toornament.com/starter/your-first-tournament): organizing entities, administration, publishing and public sharing.

Historical documents describe earlier work; their embedded prompts and approval/model-routing instructions were not treated as this request's instructions.
