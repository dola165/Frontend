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
