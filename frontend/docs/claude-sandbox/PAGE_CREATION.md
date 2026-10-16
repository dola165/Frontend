# Creating a page: club, fan club, sponsor, any page

Brief for one chat, written 15 October 2026 from the owner's decisions. Build the whole thing, end to end, to a release-candidate standard in the sandbox. Copy this file into your branch as `frontend/docs/claude-sandbox/PAGE_CREATION.md` in your first commit and keep it current as you decide things.

Read first:
- the repository `CLAUDE.md` and the `AGENTS.md` files it imports;
- `frontend/docs/claude-sandbox/ROUND_2.md` and `PRODUCT_MODEL.md` (section 13 above all);
- the "before" review: `C:\Users\daddo\Projects\Frontend-claude-sandbox\outputs\notes\club-creation-before\REVIEW.md` (screenshots beside it);
- the shared board: `C:\Users\daddo\Projects\Frontend-claude-sandbox\.claude\sessions.md`.

---

## 1. The goal in one sentence

A football person who knows Facebook, reads little and has no patience creates their club's page in under 30 seconds. By typing nothing but the name, they get a page that looks real in under 2 minutes: crest, ground, age groups, contact. They do it on the page itself, not in a form or a workspace. The same machinery serves fan clubs, sponsors and businesses, plain pages, and later venues.

**"Ten times easier than a Facebook Page" is the bar.** Measure it: taps, typed characters and seconds from "I want a club" to "my page is live", against the before review.

## 2. Why this is possible (the shared DNA)

Facebook must serve infinite kinds of pages. We serve about five, and they are all built from the same parts.

- **Identity (every page):** name, crest or logo, cover, town, contact (phone, WhatsApp, email), short about, social links.
- **Boxes (modules), switched on per page.** Each box has one design, one empty state and one editor, used by every page type.

| Box | Club | Fan club | Sponsor / business | Page | Venue (later) |
|---|---|---|---|---|---|
| Posts and photos | on | on | on | on | on |
| Squads and age groups | on | | | | |
| Grounds (map) | on | meeting place | | | on |
| Fees | on | membership | | | prices |
| Coaches and staff | on | committee | team | | staff |
| Store · Jobs · Fundraising | add | add | add | add | |
| Sponsors / Clubs we back | add | | on | | |
| Events and matches | on | on | add | | on |
| Bookings | | | | | on |
| Honours | add | | | | |

"on" = switched on from the start; "add" = available in the "+ Add a box" tray.

**The page type only decides which boxes start switched on.** The existing model already works this way: `organizationType` plus switchable activities (`tournamentEnabled`, `venueEnabled`), created through `POST /organizations/setup` with a `requestId` (idempotency) and draft recovery (`features/organizations/setup/setupRecovery.ts`). Keep the backend model and its enums. Change the surface: the eight organisation types collapse into four tiles (Club · Fan club · Sponsor or business · Other page). Company, Media, Healthcare and Community become a "what kind of business" detail asked later, inside the page, and only if it matters.

## 3. The flow, phase by phase

### Phase A: Finding "create"

One shared entry point (a component and an action, used everywhere, never copied). It should appear:

| Where | Form | When |
|---|---|---|
| Home, left rail | A small "Start your club or page" card | The person has no page of their own |
| Top bar `+` (the pin button area) or the account menu | "Create a page" | Always |
| **My Club tab** | For someone without a club, the tab shows "Find your club · Start your club" (two choices, pictures) instead of disappearing | No club |
| World → `+ Create` | "Create a page" first in the menu, not filed under "Places". Remove "List your venue" while venues are out. | Always |
| Search, no results | "Can't find it? Create it", or "Claim it" when a known club matches | Searching for a club |
| World Clubs list, empty area | "Is your club missing? Add it" | Always |
| "You need a club" empty states (fundraising, store, jobs, arranging a match) | "Start your club" beside "Find a club" | No club |
| First run, "What do you do in football?" | Owner, coach or organiser → offer "Start your club" at the end | Answer given |
| Agent Dola | "Create my club" runs the same action, with a preview first | Asked |
| Own profile | "Add your club" | No club |

Once the person owns a page, hide the promotional entry points (Home card, My Club empty state). Keep the neutral ones (`+`, account menu).

### Phase B: Starting (one small sheet, about 10 seconds)

A sheet over the current page (on a phone, a bottom sheet), not a new page:
1. **"What are you creating?"** Four picture tiles: Club · Fan club · Sponsor or business · Other page. One tap. "Club" is pre-chosen when the person came from a football entry point.
2. **Name**, with the **town** already filled in (from registration or the device), changeable with one tap.
3. **Duplicate check while typing**, fuzzy and transliteration-aware: "Dinamo" = "დინამო" = "Dinamo Tb.". If a known club matches, show its crest and town: **"Is this your club? Claim it"** or "No, mine is different".
4. **Create.** The page now exists as a **draft only the owner can see**, and the sheet closes onto it.

Nothing else is asked here: no category, website, CSV or terms. A club's category (grassroots, academy, amateur…) is inferred later from the age groups chosen, or asked once inside the page.

### Phase C: Landing on your own empty page (edit mode)

The owner lands on **the real page in edit mode**: the same layout visitors will see, with **ghost boxes** where content will go. Each ghost box is a soft dashed outline with a picture and three or four words ("Add your crest", "Where do you play?", "Which ages?"), and it fills in place with a tap.
- **A setup ring** in the header: "4 of 7" plus the next ghost box highlighted, with no checklist page. Filled ghosts vanish into real content.
- **A "Draft · only you see this" strip** with **Go live**. Go live becomes available once the page has a name, a crest and either a ground or a contact.
- **Autosave on every change.** A quiet "Saved" appears; there is never a Save button. **Undo** comes as a toast (sonner) instead of confirm dialogs. Edits survive leaving the page (draft recovery).

### Phase D: Filling it (where each thing is edited)

**Rule: edit in place when the thing is small. Open a side panel (split screen on desktop, full-screen sheet on a phone) when choosing needs room, a map or a preview. Automate whatever we can know or guess.**

| Box | Edit how | Automated | Split screen? |
|---|---|---|---|
| Name, about, tagline | Inline, click the text and type | About suggested from type, town and ages ("Grassroots club in Rustavi for boys and girls U8–U14"), editable | No |
| Crest / logo | Tap → panel: upload (drag a file onto the crest works too) and crop (`react-easy-crop`), **or** pick two colours and a shape | A clean SVG crest generated from initials and colours, so the page looks real at once | Yes: options on the left, the live page header on the right |
| Cover | Tap → choose from the app's football photos, or upload | One of the app's photos chosen to match the colours | Small panel |
| Grounds | Tap "Where do you play?" → panel with **an interactive map** centred on the town, nearby pitches as pins, and a list that follows the map | The address, pin and directions come from the pitch (reverse geocoding when a pin is dropped). Indoor/outdoor and surface are pre-filled when known. | **Yes**: map on one side, the chosen grounds as cards on the other |
| Age groups / squads | Tap "Which ages?" → tiles U6 … U19 and Senior, each with Boys / Girls / Mixed | Squads created and named ("U10 Boys"); the club category inferred | Yes: tiles on the left, squad cards appearing on the right |
| Training times | Inside a squad card: pick days and a time | Suggests common slots; the ground is pre-chosen | No |
| Fees | Inline: one range slider "from – to GEL / month", plus "Free" | Currency from the town; shows "Some groups train free" when ranges differ | No |
| Contact | Inline, already filled from the account (phone becomes the WhatsApp button) | WhatsApp link built from the phone | No |
| Coaches and staff | "Invite by phone" or "Share an invite link". No account needed first; they get an SMS or WhatsApp link. | Their role is suggested from the squad they are invited to | Small panel |
| Players | **"Share in WhatsApp"**: one join link per squad (and a QR code via `qrcode.react` for the training ground). Each parent fills in their own child, and the coach approves. Fallback: paste a list of names, one per line. | Squad chosen from the child's birth year; consent goes through the existing guardian path | Yes: link and QR on the left, arriving children on the right |
| Posts | The normal composer, inside the page | "Rustavi Lions joined GrassKickZ" written for the owner at Go live (editable, can be skipped) | No |
| Store · Jobs · Fundraising | Each is a box that opens its own add flow. The Store chat owns those editors: reuse them, don't copy them. | | As their owners built them |
| Sponsors | Inline: crest or logo plus name; links to the sponsor's page if one exists | Logo pulled from the sponsor's page | No |

### Phase E: Arranging boxes (where dragging is allowed)

- **The default layout arranges itself.** Boxes fall into a fixed, good order per page type: visitors always find fees and contact in the same place, as on Facebook. Owners don't have to arrange anything.
- **Drag from the "+ Add a box" tray onto the page** to add a box (drop zones appear between boxes). Tapping a tray item does the same, and so does the keyboard.
- **"Rearrange" mode** (one button, owners only) lets boxes be dragged into a different order within their column, and lets photos in the gallery be reordered. Use `@dnd-kit/core` (already installed) with its keyboard sensor.
- **Every drag has a non-drag alternative:** "Move up / Move down" and keyboard arrows (WCAG 2.2, 2.5.7 "Dragging Movements"). Announce moves to screen readers (live region).
- **No free-form canvas.** No positioning by pixels, and no resizing.
- **Removing a box** hides it, with an undo toast, and its data is kept.

### Phase F: Going live

- **Go live** publishes the page. The page then appears in World (map and list), search and the feed.
- **A share card** comes right after: "Your page is live", with a WhatsApp share, a copy-link button, a QR code and a ready-made image of the page header to post in the parents' group.
- **The setup ring continues** until all seven are done, then disappears for good.

### Phase G: Living with the page (editing later)

- On their own page, owners see a quiet **"Edit page"** switch that turns on the same edit mode. **The page's own content is never edited in the workspace any more.** Replace today's "Edit" links that jump into the workspace (Contact, Training fees, Facilities, Get involved, Sponsors) with in-place editing. The workspace keeps operations: sessions, attendance, approvals, records. Agree this with the Club workspace chat.
- Staff with page permissions get the same edit mode for the boxes they may edit.

### Phase H: Claiming a known club

- Known clubs are pre-created as **unclaimed pages** (in the sandbox, add a few, including some outside Tbilisi). They show "Is this your club? Claim it".
- **Claiming:** say your role, add a phone number. In the sandbox it's accepted at once, marked "claim pending verification". Real verification goes on the backend list.
- After a claim, the person lands on the page in edit mode, with whatever we already knew filled in.

## 4. Verification unlocks, it never blocks

Today a new account sees "Creation requires a verified adult account…" and cannot continue. Remove that gate for creating a page. Instead:
- **Anyone (adult) can create and run an unverified page:** profile, posts, squads, schedule, inviting parents and coaches, arranging friendlies.
- **Verification unlocks:** taking money (fees, store, fundraising payouts), public pages for players under 18, trials open to the public, and the "Verified club" badge.
- **Ask for verification only at the moment a locked thing is tried,** in one sheet ("To sell kit, verify your club: about 2 minutes"), never up front.
- **Under-18 accounts** can't create a club or a business page. They can be invited to one.

## 5. Automation principles (use these words in code comments and the doc)

- **Smart defaults / pre-chosen answers.** The likely answer is already selected, and every answer narrows the next question.
- **Convention over configuration.** A page looks right before anyone configures it.
- **Progressive disclosure.** Advanced fields (registration number, legal name, bank details) appear only when a box or an unlock needs them.
- **Empty states are editors.** A ghost box is both the explanation and the form.
- **Optimistic UI with autosave.** Show the change at once, save in the background, and keep the existing `version` fields for conflict detection (two staff editing the same box: the second gets "Someone just changed this. Keep theirs or yours?").
- **Idempotent writes.** Reuse the `requestId` pattern so a retry on a weak connection never creates two pages. The owner's internet is often a phone tether.
- **Undo over confirm.** No "Are you sure?" except for truly permanent things.
- **The same action everywhere.** The create action, box editors and Agent Dola call the same functions, within the person's permissions, and history is signed.

## 6. Data and API (sandbox now, backend later)

- Keep `POST /organizations/setup` and its request shape. In the sandbox, add handlers so **any signed-in adult** (the demo coach and registered newcomers) can:
  - create a draft page;
  - read and update its identity and boxes (per box, with `version`);
  - go live;
  - list nearby pitches for a town;
  - search known pages for duplicates;
  - claim one.

  Put them in a new handler file. Don't grow `club.mjs`.
- **A newly created club must work across the app,** not only on its page: World map and list, search, My Club tab, My squads, Home feed (its first post), the workspace (empty but working).
- **Nearby pitches:** in the sandbox, a fixed list of a few dozen pitches across Georgian towns. For real use, OpenStreetMap through Overpass (`leisure=pitch` + `sport=soccer`). The app already has an Overpass stand-in at `/sandbox-overpass`.
- Put every backend need under "Before release" in `ROUND_2.md`, with enough detail for the backend team: endpoints, fields, states (draft, live, unclaimed, claim pending, verified), permissions and the verification unlock list.

## 7. Quality bar (all of it, not some)

- **Visual language:** follow `CLAUDE.md`. Show, don't tell; compact like Home; dark theme with green accent; no dashboard theatre; football words. Ghost boxes are calm, not loud.
- **Every screen at 1920×1080 and 390px wide, light and dark.** Check it in the browser pane yourself.
- **Accessibility:**
  - keyboard for everything;
  - visible focus;
  - focus moves into a sheet when it opens and back to where it came from when it closes;
  - 44px touch targets;
  - a live region for "Saved" and for moves;
  - reduced motion respected;
  - colour contrast for generated crests (text on colour must stay readable).
- **Language:** English and Georgian for every string, following the existing pattern (`copy.ka.ts` files).
- **States:** loading (skeletons), empty, error with retry, offline / slow network, permission denied (a non-owner never sees edit mode).
- **Performance:** load the map and the cropper only when opened.
- **Privacy and safety:**
  - minors' details are never public by default;
  - the join link puts children through guardian consent;
  - page names that copy a known club go to the claim path, not a second page.
- **Analytics:** record the creation funnel with the event recording the feed already uses:
  - create opened (and from which entry point);
  - type chosen;
  - page created;
  - each box filled;
  - went live;
  - shared;
  - claim started and claim finished.

  These answer "where do people give up" for the 500 test users.
- **Delete what you replace:** the three-step wizard on `CreateOrganizationPage`, its "Open workspace" finish, the page-content "Edit" links into the workspace, the "Fill details from Excel or CSV" step in creation (imports stay in the workspace). No `*V2` copies.
- **Code shape:** follow `frontend/AGENTS.md`. Split files over about 400 lines. Shared building blocks, not per-feature copies. Data fetching in `api/` and hooks.

## 8. Tests

- **Unit (Vitest):**
  - the page model and box defaults per type;
  - duplicate matching, including Georgian ↔ Latin transliteration and abbreviations;
  - crest generation contrast;
  - fee range text;
  - Go-live rules;
  - the verification unlock rules.
- **Component (Testing Library):** the start sheet, ghost box to filled box, autosave and undo, the rearrange keyboard alternative, edit mode hidden from non-owners.
- **End to end (Playwright, `e2e/`):**
  1. register a new adult;
  2. create a club from Home, with a crest from colours, a ground from the map, two age groups and a fee range;
  3. go live;
  4. see the club in World, search and the My Club tab;
  5. claim a pre-created club as a second new user.

  Run it at desktop and phone widths.
- Run `npm run check` once at the end. Report failures honestly. Failures already on the "already fail" list in `ROUND_2.md` are not yours.

## 9. Working with the other chats

- **Home chat** (`local_04c716a6-2666-4023-a24a-369078893155`): owns the club profile's visitor layout. Agree the split before touching club page files. You own **edit mode, ghost boxes, the box framework and creation**; they own how a finished page looks to visitors. Message them first, and record the agreement on the board.
- **Club workspace chat** (`local_54169267-3709-42b2-ba4e-37210f7c282c`): owns the workspace and holds the combined view on :5178. It merges other branches in. Tell it when page-content editing moves out of the workspace, and send it merge requests for your commits so the owner sees them on :5178.
- **Store chat** (`local_88e54f54-3b06-47b1-a12f-fe162cf20b83`): owns the store, jobs and fundraising editors. Reuse its add flows inside boxes.
- **World chat** (`local_5bed1333-dc71-43ae-b72f-bd29aeb579bc`): owns World. Changing the `+ Create` menu and the Clubs list entry is a small shared edit; tell it.
- **The coordinator** (`local_be027ab5-df6f-4d50-b64e-cb21005db19a`) runs the servers on :5178 / 4305. Name any sandbox API change in your messages so the API can be restarted.
- Follow the board's rules: a line in "Landed" after every commit, never push, and your own dev servers on free automatic ports for your own checks.

## 10. What to hand back

A short report for the owner:
1. **The flow as a newcomer sees it,** step by step, with screenshots saved to `C:\Users\daddo\Projects\Frontend-claude-sandbox\outputs\notes\club-creation-after\` (same viewport as the before shots).
2. **Before and after,** against `REVIEW.md`: taps, typed characters and seconds from "I want a club" to "live", and which of the review's findings are fixed.
3. **Decisions you made** where this brief left room, and why.
4. **The backend list,** and anything not finished, plainly.
5. **Open questions** for the owner, only where the answer changes the design.

---

## 11. Plan (the page creation chat, 15 October 2026)

Branch `claude/page-creation-834687` (from `claude/workspace-and-squads-6755b0` at `89cd387`), own servers API 4306 / web 5179. One commit per phase; after each, a line for the board and a merge request to the Club workspace chat (:5178); every sandbox API change is named to the coordinator so 4305 can restart.

### What exists and what happens to it

| Today | Becomes |
|---|---|
| `pages/CreateOrganizationPage.tsx`: three-step wizard, "Open workspace" finish, "Fill details from Excel or CSV" | **Deleted.** `/organizations/create` and `/clubs/create` open the start sheet over Home (`?create=club`), so old links keep working. `features/organizations/setup/ImportMapping.tsx` stays for the workspace imports only. |
| Creation gated by `organization.create` ("verified adult account…") | Gone for creating. Anyone adult creates at once; verification is asked only when a locked action is tried (section 4). |
| Club page Edit links into the workspace (Contact, Training fees, Facilities, Get involved, Sponsors, About, Edit programmes, Manage locations, Manage staff) | One "Edit page" switch; each link becomes "edit this box here" (`?edit=1&panel=…`). Operations links (squad workspace, sessions, calendar, Open workspace) stay. |
| `ClubInfo` / `ClubSide`: fixed blocks | The same blocks as **boxes** in an ordered column (`PageColumn`), the Home chat's look unchanged. New small boxes where a page had none: Teams (age groups), Coaches (faces), Coming up, Honours. |
| `/organizations/:id`: its own page | The same page DNA as a club (identity + boxes) for fan clubs, sponsors and businesses, and plain pages. |
| Dola has no create action | `PAGE_CREATE`: preview first, then the same create function. |

### The shared DNA in code (`features/pages/`)

- `model/`: page kinds and their backend mapping, the box catalogue (key, column, default per kind, words per kind), setup items, the Go-live rule, the verification unlock rules, fee text, the About suggestion, the crest generator and the name matcher. `crest.ts` and `nameMatch.ts` have no imports, so the sandbox imports the very same files (Node 24 strips the types): one generator, one matcher.
- `api.ts`: the typed calls; components never call the API themselves.
- `create/`: `CreatePageHost` (reads `?create=` anywhere in the app), `StartSheet`, `ClaimSheet`, `useCreatePage`, `CreateEntry` (the one entry point in its forms: rail card, menu row, tab choices, empty-state line).
- `edit/`: `PageEditProvider` (load, optimistic state, autosave queue with versions, undo toasts, conflicts, draft recovery, permissions), `EditBar` (Edit page switch, setup ring, draft strip with Go live, "Saved"), `PageColumn`, `BoxFrame`, `GhostBox`, `AddBoxTray`, rearranging.
- `boxes/`: one folder per box with its ghost and editor; inline editors for small things, `SplitPanel` (split screen on desktop, full screen on a phone) for crest, grounds, age groups and players.
- `live/`: Go live, the share card (WhatsApp, copy link, QR, header image), the first post.
- `verify/`: the unlock sheet and `useUnlock(action)`.
- `copy.ts` + `copy.ka.ts`: English is the key, Georgian beside it (World's pattern).

Reused, not copied: `design/profile/ProfileLayout` and `SideBlock`, `design/Dialog` and `useDialogFocus`, `Crest`, `useIdentityImageEditor` + `ImageCropperModal` (react-easy-crop, lazy), `react-map-gl/maplibre` with the app's map style (lazy), `qrcode.react`, `sonner` toasts, `@dnd-kit/core` (keyboard sensor), `features/start/towns.ts`, `features/feed/feedEvents.ts` batching, the app's football photos, the Store chat's add flows for store, jobs and fundraising.

### The API (sandbox now, backend later)

- `POST /organizations/setup`: unchanged shape, plus `pageKind`. Clubs send a club category the page infers later (`COMMUNITY_CLUB` until the age groups say more).
- `GET /clubs/:id/page`, `GET /organizations/:id/page`: identity, layout, boxes (each with `version`), status (DRAFT, LIVE), claim state (UNCLAIMED, PENDING), verification, setup and what the viewer may edit. Non-owners never get edit rights; a draft answers 404 to everyone else.
- `PUT …/page/identity`, `PUT …/page/boxes/:key`, `PUT …/page/layout`: each with the `version` it read; a stale one gets 409 with the current value.
- `POST …/page/live`, `POST …/page/claim`, `POST …/page/verification`.
- `GET /pages/similar?name=&town=`: known pages for the duplicate check.
- `GET /pitches?lat=&lng=`: nearby pitches; `GET /map/reverse?lat=&lng=`: a dropped pin's address.
- Join links and arrivals for players, invite links for staff.

All in a new `sandbox/api/handlers/pages.mjs` (its data in `sandbox/api/pages-data.mjs`), registered before `club.mjs` so a new club answers everywhere the app asks (World list and map, search, My Club, My squads, the feed, the workspace).

### Phases (each a commit)

1. This plan, the brief, the decisions in `PRODUCT_MODEL.md` §13; agreement with the Home chat.
2. Sandbox API and `features/pages/api.ts` + model (with unit tests for the model).
3. Creating: the entry point everywhere in section 3A, the start sheet, the duplicate check with Claim it; the old wizard deleted.
4. Edit mode on the club page and the organisation page: ghost boxes, setup ring, draft strip, autosave, undo, recovery, conflicts.
5. Filling: identity inline, crest designer, cover, contact, fees; grounds on a map, age groups and training times, players by WhatsApp link and QR, staff invites, sponsors, honours, coming up, store · jobs · fundraising.
6. Arranging: the tray, Rearrange with the keyboard alternative, hiding with undo.
7. Going live and living with it: share card, first post, Edit page, the Edit links replaced; claiming; verification only when a locked action is tried; under 18.
8. Analytics, Georgian, states, accessibility.
9. Tests: Vitest units and components, Playwright end to end at desktop and phone width; `npm run check`.
10. The report with after screenshots and measurements.

## 12. Decisions taken while building (owner to confirm)

Where the brief leaves room. Each follows the product philosophy: the likely answer pre-chosen, nothing published about a person without their tap, the page looking real before anyone configures it.

- **Four tiles, the backend's types kept:** Club → `CLUB` (club category `COMMUNITY_CLUB` until the age groups or one question inside the page say otherwise); Fan club → `PARTNER` with `pageKind FAN_CLUB`; Sponsor or business → `COMPANY`, and "What kind of business?" inside the page sets `SPONSOR`, `MEDIA` or `HEALTHCARE`; Other page → `OTHER`. Venue exists in the model with its boxes, but no tile while venues are out.
- **The generated crest** (initials on two colours, text colour chosen for contrast) shows from the first second, so the page looks real; it counts towards Go live once the owner keeps it (one tap) or designs their own.
- **Contact:** the account's phone and email are offered as one tap ("Use 599 12 34 56 for calls and WhatsApp"), never published without it.
- **About** is written for the owner from the type, town and age groups and keeps following them until the owner edits it.
- **Cover:** one of the app's football photos, picked to suit the crest colours; changing it is a small panel.
- **Under 18:** Club and Sponsor or business are locked ("From 18: ask an adult at your club to create it and invite you"); fan clubs and plain pages are allowed, with nothing personal pre-filled.
- **Copies of a known name** go to that page (Claim it when unclaimed, else Open it), never to a second page; a similar name shows the match with "No, mine is different".
- **The setup ring for a club counts seven:** name, crest, ground, age groups, contact, fees, players (a join link shared). A fan club, a business and a plain page count their own, fewer.
- **The URL keeps the editor's state:** `edit=1` and `panel=grounds`, so Back closes a panel and a link can open one.
- **The fee band** (from, to, currency, per month, "some groups free") is stored on the page; the fees box and World's fee filter read it while the club has no priced programmes.
- **One sheet, no steps** (phase 3): the four tiles, the name with the town chip beside it, and Create sit on one sheet; a tap on a tile reveals the name. It opens over whatever page the person is on (`?create=club|fan-club|business|page|any&from=…`, mounted once in the app shell), so Back closes it and old links (`/organizations/create`, `/clubs/create`) simply redirect to Home with the sheet open.
- **The My Club tab stays for someone without a club** and opens two picture tiles, Find your club · Start your club, with any invitations under them (the old "No club yet" page with its heavy band is gone).
- **The first run** offers "Run a club? Start it after this" only to someone who chose "I coach"; it finishes the start and opens the sheet on Club.
- **Agent Dola** creates through the same action (`PAGE_CREATE`): "Create my club called Rustavi Lions" previews the draft, Confirm creates it and links to the page in edit mode. Without a name Dola asks for one; under 18 it explains.
- **The duplicate check** runs from three letters, a breath after the last key; an exact copy of a known name turns Create into Claim it / Open it (the server refuses too); "No, mine is different" hides a near match for that name.
- **Unanswered creates are retried with the same request id** (saved before sending), and the sheet's own draft (type, name, town) survives leaving the page.
- **Edit mode lives in the address** (phase 4): `?edit=1` turns it on for the owner (a non-owner never gets it, whatever the address says); `panel=crest|cover|identity|grounds|squads|players|staff|live` names the open editor and is a step in history, so Back closes it. `new=1` / `claimed=1` show the one arrival hint.
- **Small things edit in place, big ones in a split panel.** Contact, fees, sponsors, honours and Get involved open their form inside the box with Done; the name and the about are typed where they are (Enter or leaving saves, Escape puts the old text back); crest, cover, identity, grounds, teams and the share card are `SplitPanel`s (choices left, live result right; one column on a phone, where the dialog is already a bottom sheet).
- **Every save is optimistic, autosaved and undoable**, and carries the version it read: a lost race shows theirs with "Keep mine"; a failed save offers "Try again" and is kept in the tab (`page-pending`) and sent when the page opens next; "Undo" on the toast re-saves the earlier values with the version then current. The funnel records a box the first time it fills.
- **Boxes are a registry** (`features/pages/edit/boxRegistry.ts`): each has a view, a ghost (icon, three or four words, a hint) and either an inline editor or a panel. `defaultBoxes` draws every box; a club page may replace views with its own blocks and keep the ghosts and editors.
- **The organisation page** (`/organizations/:id`) renders fan clubs, businesses and plain pages on the page DNA (`PageDocument`: identity header, edit bar, two box columns, posts between); organisations the sandbox knows from before keep their old presentation. `ProfileLayout` gained two additive props (`nameNode`, `summaryNode`) for the inline name and about.
- **The generated crest counts once kept**: one tap on "Keep this crest" (or a change of colour, shape or letters) makes it the club's; uploading a photo goes through the app's existing cropper.
- **Players by sharing** (phase 5): every squad has its own join link from the moment it exists (`/join/:code`), copied or sent to the parents' WhatsApp group, with a QR code for the training ground; a parent adds their own child (first name, boys or girls, date of birth, the guardian's word) and the coach says yes or no in the same panel. The child lands in the squad the birth year fits. Pasting names, one per line, is the fallback. Sharing a link is what the setup ring counts as "players".
- **Staff by link** (phase 5): an invitation is a name, a phone and a role (coach, assistant, admin; a squad pre-fills coach); it becomes a link (`/invite/:code`) sent in WhatsApp to that number or copied. No account first: the link signs them in or up, then one button joins. Who joined shows beside the invitations.
- **Grounds on a map** (phase 5): the panel's map is centred on the town with the pitches nearby as pins (the list under it follows the map); a tap on a pin adds the pitch with its address, a tap on empty ground drops a pin whose address is looked up. The map and the cropper load only when their panels open.
- **The first post** is written at Go live ("{name} joined GrassKickZ"), editable on the share card, one tap to post or skipped. Pages that are not clubs post as themselves (the composer's `organizationId`).
- **Rearranging** (phase 6): a "Rearrange" switch in the bar (`?rearrange=1`) puts a handle, Move up, Move down and Hide on every box (Contact and Posts cannot be hidden); dragging with `@dnd-kit/core` works only between the drop lines of a box's own column and from the "+ Add a box" tray onto the page; every move is saved, undoable and announced (a live region per move, dnd-kit's announcements for drags). No free canvas, no resizing.
- **The club page** (phase 7): `ClubProfilePage` is wrapped in the page provider. Visitors see the Home chat's layout unchanged; the owner gets the edit bar (and, on an unclaimed club, every visitor the "Is this your club? Claim it" strip); in edit mode the two side columns are the page DNA's boxes (`features/pages/club/clubBoxes.tsx`, today the default views; the club page's own blocks can be registered there), the name and the about are edited where they are, the crest and cover open the designer and the picker. The club page's Edit links no longer jump into the workspace: each opens edit mode with its box's editor (`?edit=1&panel=…`); "Open workspace", the squad workspace, sessions and the calendar stay. On a backend without `/clubs/:id/page` the page is absent and nothing on the club page changes.
- **Verification unlocks, in one sheet** (phase 7): switching the store or fundraising on in Get involved on an unverified page opens "To sell kit, verify your club · about 2 minutes" (legal name, a registration number if any, a phone to call); the request is recorded and the part stays off until verified. Jobs, posts, squads, grounds, contact, staff and players never ask.
- **Coming up** is a club's box fed by the one calendar: its next three entries with their activity symbols; planning stays in the calendar ("Plan" opens it). Fan clubs, businesses and plain pages have no calendar, so no events box.
- **A backend without pages changes nothing** (phase 9): the page provider treats an answer that is not a page (no `kind`, `identity` and `boxes`) like a 404, so `/organizations/:id` keeps its older presentation and the club page stays as it is until `/clubs/:id/page` exists. The composer sends `organizationId` only when posting as a page; a club post's body is unchanged.
- **Found by the end-to-end test** (phase 9): the town given at sign-up was saved only when the first run's town screen was confirmed with Next; Skip (or the first run not showing, as in the before review) dropped it, so World said "Near: Tbilisi" and the sheet filled Tbilisi for a Rustavi account. Skip on that screen now saves the sign-up town too (`features/start/StartPage.tsx`, one line). Creating from the My Club tab lost edit mode: My Club's two redirects to "your club" (`ClubAccessEntry`, `MyClubPage`) fired while the club page's code was still loading (React keeps the old page on screen during a lazy navigation), so both hold still while the start sheet is open over them (`?create=`). The sandbox's identity save crashed on a phone (`phoneText` was never defined: "Not saved" for every contact); a stored phone is shown grouped (`+995 599 12 34 56`, `model/phone.ts`). The page provider refetched the page on every render of its parent (the `pageRef` object changed identity; four reads per save): it now keys on type and id. `/register` opens `/signup`.
- **The owner's first look (15 October):** "phenomenal", with five asks. (1) The Coaches & staff tab crashed on a club made through the sheet: the sandbox gave its coaches a responsibility without `specialisations`; fixed in the sandbox (the backend's `PublicResponsibility` has every field). (2) The creation process needs guidance that shows what is needed and what can be ignored, and where things can be added: every empty box now carries one chip, *Needed to go live* (green, with a slow dot) or *Optional*; the box the ring points at breathes; the crest button breathes while the crest is missing; a box that just filled or moved glows for a second and the ring's count bumps; a new page opens with a three-bubble walkthrough anchored to the ring, the next box and Go live (Skip, Next, Got it; Escape; once per page). (3) Switching the store on felt odd and we cannot call anyone: the unlock sheet now says a check answered by message within a day, the locked chips show a lock with *after verification* and one line says why (nobody takes money in your name; jobs are open now). (4) Facilities above squads: the default order is contact, fees, grounds, squads; the owner's club had the squads box out of its column (hidden or moved in Rearrange), so what moves now glows and the order is documented; if the owner saw squads above facilities without touching Rearrange, that is still to find. (5) The join link stays, and later a player makes their own card from it or a parent makes a parent account and the card for the child, whichever the family prefers; logged in `ROUND_2.md` → Before release and `PRODUCT_MODEL.md` §13.
- **The end-to-end test** (`e2e/page-creation.spec.ts`, against the sandbox) registers a newcomer, creates a club from Home's card, keeps the crest, picks a ground from the map's list, two age groups, a phone and the fee range, goes live, finds the club in World, in search and under My Club, then registers a second newcomer who claims the first seeded club still unclaimed. It runs at 1440×960 and 390×844 and prints taps and seconds from "I want a club" to "my page is live".

## 13. The owner's list (15 October 2026, after the first look) — not to be forgotten

Each item with its feasibility and where it lives. "Here" means this branch on the sandbox; "backend" means the real API must grow something first.

1. **A reference image of a full club page.** Easy, here: a "See a full page" link on the empty page and in the walkthrough, opening a finished example (Dinamo), plus a small picture in the ghost tray. Do.
2. **Agent Dola walking the screen with suggestions, never overwhelming.** Feasible (Dola already acts through the same actions and previews), but last in the queue by the owner's wish: after the finished version is deployed.
3. **Autofill writes the saved name into the search bar** when a phone is autofilled in a box. A browser-autofill bug: the fields need honest `autocomplete` values (`tel`, `email`, `name`) and the search bar `autocomplete="off"`. Small, here. Do first.
4. **Opening a squad kicks you out of edit mode.** The squad card links to the squad's workspace page; in edit mode it should open the squads panel, and a link away should return with `edit=1`. Small, here. Do.
5. **"Invite the players" is hidden** (only in the ring and a small link in the Teams box). Put it in the Teams & training tab, on each squad card and on the Go live share card. Small, here. Do.
6. **"Invite the staff" as its own thing.** Staff invitations exist (the "Who is in the team?" box, link by phone) but under a different name; make two clear doors: *Invite players* (a parent makes a parent account and the child's card in Parent Hub, or a player or parent makes the card; an adult player can make an account from there) and *Invite staff* (an account, because staff act). Frontend here; the player card without an account and the age rule per country need the backend.
7. **Facilities say "Near Vale-Saburtalo"; the owner wants exact street names.** The frontend shows whatever the reverse geocoder answers; the sandbox fakes it with the nearest known street. Real street names need the backend's `/map/reverse` on Nominatim or Google. Backend.
8. **A split-screen creation process to choose when pressing "Create a page"**, both professional, with a short video and explanations on each box. Feasible here with `SplitPanel` (steps and their explanation left, the live page right); the videos are content to make. Medium. Later, after 3–6.
9. **A very clear way to edit after creation.** "Edit page" is in the bar; make the owner's pencils always visible on the page and name the bar's button more plainly. Small, here. Do.
10. **"About" missing from the club's setup steps.** Add it: eight steps. Trivial, here. Do.
11. **Three levels, not two:** store, jobs and fundraising are *advanced* options; about and most boxes are *recommended*; a few are needed. Chips: Needed · Recommended · Advanced. Trivial, here. Do with 10.
12. **Fill from the person's own saved data, with permission** (saved emails, numbers; never cards): offer the choices as a list to tick, then Next; most of Contact fills itself. Partly feasible: the account's own details already fill with one tap; the browser's saved addresses come through autofill (3); the phone's contact book only through the Contact Picker API (Android Chrome). Medium, here, platform-limited; no backend.
13. **Import honours, schedules and such lists from Excel or anywhere.** Feasible: the workspace already imports CSV for squads and venues; add an "Import a file" door on Honours and the calendar with a column-matching step. Medium here; storing it is backend (the same endpoints as typing it).
14. **Squads: the days and time mean nothing** (they appear on no schedule). Either they create the recurring training sessions in the club's and squad's calendar (the right answer; the sandbox's schedule plus the backend's sessions), or they go. Medium; model the sessions first. Also applies to imports (13).
15. **Rearrange works badly:** a box should move by grabbing anywhere on it, and while it hovers the page should show where it lands (the others sliding apart) so it can be put back. Feasible with `@dnd-kit/sortable` (whole-box handle, animated placeholder). Medium, here. Do after 3–6.

Order proposed: 3, 4, 5, 10+11, 9, 1, 6, 15, 14, 13, 12, 8, 7 (backend), 2 (last).

**Verdicts (owner's question: do any of these cost simplicity?)** None is bad in itself. Clearly good: 1, 3, 4, 5 (three places at most), 7, 9, 10, 15. Good if kept to one gesture: 6 (two buttons with football words, *Invite players* and *Invite coaches & staff*; the link asks "Who are you?" when opened, nothing explained up front), 11 (three levels is the ceiling; the word on the chip only), 12 (one tap "Use my saved details", a tick-list only when there is more than one match, never a wizard), 13 (a side door "Import a file", never the main path). 14 is currently wrong: days and times promise a schedule and deliver nothing; build the sessions or remove the fields. 8 would cost simplicity as written (a second creation process is a mode to choose before the first tap): keep one process and put a "Show me" on each box that plays a ten-second clip in the split panel. 2 only if quiet: one suggestion at a time, dismissable, never a tour. The purpose now is a showcase for colleagues: the pages a link opens may be mock pages; backend and paid services (SMS, WhatsApp) come later.

**Sprint one on the list (15 October, evening), done on this branch:** 3 (the box editors sit in their own `<form>`, so the browser's autofill stays inside the box; honest `autocomplete` on every field), 4 (a squad or ground row keeps `edit=1`), 5 and 6 (two doors with football words, *Invite players* and *Invite coaches & staff*: under the Teams and staff boxes for the owner in view mode too, on the Teams & training tab, on the Go live share card; the join link first asks *Who are you?* — a parent adds the child and is sent to Parent Hub, the player makes their own card and, if an adult, can create an account from it; under 18 a parent or the coach confirms), 9 (Edit page is the green button in view mode), 10 (eight steps: about counts), 11 (chips *Needed to go live · Recommended · Advanced*; money is advanced), 1 (*See a full page* beside the ring opens Dinamo), 12 (one tap *Pick from my contacts* where the browser has the Contact Picker API — Android Chrome; the account's own details were already one tap), 13 (*Import a file* on Honours: a CSV or lines from a spreadsheet, name and year in either order), 14 (a squad's days and time now create its training sessions for the next four weeks in the club's calendar and in Coming up; sandbox `football.mjs`, the backend would do the same from the squad's schedule), 15 (Rearrange: a box is grabbed anywhere, the nearest gap opens to the box's height so the others slide apart and show where it lands; the grip stays the keyboard handle). Left for the next sprint: 8 in its reduced form (a "Show me" clip per box: the clips do not exist yet), 7 (a real reverse geocoder: backend), 2 (Dola, last), and the walkthrough's and chips' Georgian wording review by a native reader.

**Owner, 15 October, later:** three more. *Say what you are* is now a dashed green call under the name (it breathes until written). The example is a pop-up: a dimmed picture of a finished page sits where the posts will be while the page is a draft, one tap opens Dinamo's page live and tappable in a dialog, always the same 1280×836 framing scaled to the screen (`public/examples/club-page.jpg` is a capture of the sandbox's Dinamo page as a visitor sees it: a placeholder until a designed example exists). The walkthrough was skippable and said nothing worth reading; it now has four bubbles that each lead with the payoff and say what differs from a Facebook group or a LinkedIn page: every box does a job (calendar, join link, map, searches); nobody sees the page until Go live; players come through a link, not accounts; only money waits for a check.

**Owner, 15 October, the steps:** the ring is now the steps list. Hover or press it and every step of the page is listed (eight for a club), ticked when done, the next one lit, each with one line of what it gives the club and each opening its editor; "Any order. Tap a step to do it." The guide for whoever wants one, no guide for whoever does not. The example is named for what it is, *What a finished club looks like*, beside the ring and over the dimmed picture where the posts will be.

**Owner, 15 October, the steps as the main character:** the ring's list became a card, *Set-up steps*, at the top of the main column, always open (a chevron folds it): the ring at 48 px, the count, every step a tall row with its picture, its words and what it gives the club, ticked when done, the next one lit and breathing; a tap opens the step where it is done, and when a step gets done the card glows and the light moves on. The bar's ring scrolls to the card. The example got a plain invitation on top ("Curious what a finished club looks like? Tap here to see one") and a gradient edge with depth. Rearrange is a real sortable list now (`@dnd-kit/sortable`): the box is grabbed anywhere, the others slide out of its way as it moves, as icons do on a phone; in that mode a box's own links and buttons do not take the pointer.

**Owner, 15 October, the final shape of the steps:** the steps live in the bar. "1 of 8 · Set-up steps" drops the list down from the bar (open from the start on a wide screen, folded on a phone, a little translucent so the page stays visible under it); the middle of the bar shows the *Current step* as a green pill that opens it; the big card left the main column, so *What a finished club looks like* is the first thing in the posts again.

## 14. The coordinator's brief after the retest (16 October 2026)

- **F37, a new club works beyond its own page:** the sandbox's football handlers now answer for the person asking. `handlers/football.mjs` sets the viewer's clubs once per request (Dinamo for coach Luka, a page owner's own clubs, none for a plain fan); `world-football.mjs` reads them for "mine", "your team" (`can_manage`, `can_arrange`, `can_respond`), proposals and participants; `/match-exchange/squads` lists the viewer's squads. Checked: a new owner posts a friendly with their own squad and sees one "mine" listing; a fan sees none and no manage rights. Shared files: `sandbox/api/handlers/football.mjs`, `sandbox/api/world-football.mjs` (World reads both): restart 4305 after merging.
