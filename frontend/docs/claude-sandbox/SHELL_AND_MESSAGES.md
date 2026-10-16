# Shell, navigation & messages

Brief for one chat, written 16 October 2026. Copy it into your branch as `frontend/docs/claude-sandbox/SHELL_AND_MESSAGES.md` in your first commit, and record decisions in it.

Read first:
- the repository `CLAUDE.md` and the `AGENTS.md` files it imports;
- `frontend/docs/claude-sandbox/ROUND_2.md` and `PRODUCT_MODEL.md` §13;
- the shared board `C:\Users\daddo\Projects\Frontend-claude-sandbox\.claude\sessions.md`;
- the review ledger `C:\Users\daddo\Projects\Frontend-claude-sandbox\outputs\notes\findings-ledger.md`. Details for each ID are in `C:\Users\daddo\.codex\visualizations\2026\10\15\01a140b7-0fd4-75d1-83e6-acb031d9ec3f\grasskickz-product-review\findings.md`.

## Why this chat exists

The parts every page shares had no owner, so their review findings had nowhere to go: the top bar, the phone tab bar, global search, Messages, the Inbox and the way into Agent Dola.

## Your area

- `components/layout/header/**`: the top bar, phone tab bar, pins, account menu, inbox;
- `components/search/**`: global search;
- `pages/MessagingPage.tsx` and the direct-message parts of chat. The squad chat inside the squad page belongs to the "Squad page & family" chat;
- `features/dola/**`: availability, context and the entry points (not Dola's answers);
- the phone Home's quick-link strip.

Other chats have added entry points to the header and account menu ("Create a page", pins). Keep them working, and tell those chats before you move them.

## Work

1. **F11: phone navigation, as a decision for the owner, not a change.** A coach who is also a parent gets Home, World, My squads, My Club, Parent Hub, Messages and Pins: seven tabs at 390px, with labels cut off. Do not just pick one. Build **two or three clickable alternatives** at 390px, for example:
   - My squads replacing My Club for staff (My Club is reachable from the squad or the account menu);
   - one "My football" tab that switches between squads and children;
   - Pins moved out of the bar.

   Use one combined role state, and show each alternative for these role mixes: ordinary, coach, parent, coach plus parent, and multi-club. Keep them separate from application source, or behind a sandbox-only switch. Show them to the owner through the coordinator. The owner decides; then implement the chosen one.
2. **F19: Messages tells the truth.** Show the green "online" dot only when presence is actually known; otherwise show nothing.
3. **F18: search works with a keyboard and screen reader.** Choose a coherent pattern (a proper combobox and listbox with an active option, or moving focus into the results). Adding a role alone is not a fix.
4. **F20: Dola.**
   - If its first status check fails, offer a retry.
   - Pass the page's current object (the squad, child or listing on screen) and recognise `/my-squads`.
   - Keep its human-reviewed action cards exactly as they are.
5. **Phone Home quick links** still say "Stadiums · Campaigns · Roles". Use the current names (Store · Jobs & volunteering · Fundraising), and drop Stadiums while venues are out.

## How to work

- Check at 390px and 1920, light and dark, English and Georgian.
- Commit each item separately. Send the Club workspace chat a merge request for :5178.
- Name any sandbox API change for the coordinator (`local_be027ab5-df6f-4d50-b64e-cb21005db19a`), who restarts 4305.
- Follow the board's rules. Report the ledger IDs you closed. Never push.

## Done when

- The F11 alternatives have been shown to the owner (and the chosen one is built, once decided).
- F19, F18 and F20 are closed.
- The phone Home strip uses the current names.

## Decisions and notes

- Branch `claude/shell-messages-f6698d`, from `claude/integration` at `c9ed946`. Servers 4321 (API) and 5191 (Vite).
- Updates from the coordinator (16 October): merge requests go to the coordinator, who merges into `claude/integration` (:5178) and restarts 4305 for named sandbox API changes. The F11 alternatives go to the owner through the coordinator; the chosen one is built only after the owner picks. The "Club creation fixes" chat may add a "Start your club" card to the phone Home: placement is agreed through the board.

## Built (16 October)

| Item | Commit | What changed |
|---|---|---|
| Phone Home quick links | `36f701d` | Store · Jobs & volunteering · Fundraising in the store switch's order and colours (`components/layout/HomeOpportunities.tsx`), Georgian included; Stadiums gone. Also inside the Dola panel on Home. |
| F19 | `2820c0c` | Messages shows the online dot only when a participant carries `online: true` (`api/chat.ts`); the server sends none today, so nobody is shown online. The tick already said "Saved", not "Read". |
| F18 | `94015b5` | Global search is a combobox with a listbox: `aria-expanded`, `aria-controls`, `aria-activedescendant` over real options with `aria-selected`; focus stays in the field. Options hold no nested controls, so the organisation's Contact / View venues and the venue's Availability & booking links under a row are gone (the page has them; venues are out). A polite status says Searching, the count, no results or a failure. Escape closes, then clears; Tab away closes. |
| F20 | `092f07d` | A failed first status check says "Could not reach Agent Dola" with Try again (and rechecks on window focus) instead of "not available on this server". Each question carries `subject` (the squad on My squads or `/squads/:id`, the child on Parent Hub, a job, fundraiser, product, tournament, match, person, club or page, with its name) and `page` (where to return). A chip above the composer names it and can leave it out. `/my-squads` chooses the coach context. Action cards untouched. |
| F11 study | `95597a7` | `frontend/design/navigation.html`: Today and alternatives A, B, C as clickable 390px phones for five role mixes. Not built into the app until the owner chooses. |

## F11: decided and built (16 October)

The owner chose C with one change: "like C but instead of 'You' on bottom, we have 'You' only in form of profile picture on top, while 'You' on bottom turns into 'My club' if we have it." Built on phones (under 900px):

- **Bottom bar** (`PhoneTabBar`): Home · World · My squads (coaching) · Parent Hub (a linked child) · My Club (only with a club). Ordinary: 2 tabs; coach: 4; parent: 3; coach + parent: 5. A long Georgian label takes a second line ("ჩემი / გუნდები"), icons stay on one row.
- **Top bar**: search, Agent Dola, Inbox, **Messages** (icon with its count) and the **profile picture**, which opens **You** (`YouSheet`, a modal sheet under the header): the profile, "Find or start your club" when there is no club, the pins panel (this page, your pins, suggestions, your work, create a page, more places), then the account (schedule, settings, workspaces, appearance, language, sign out). The account items are shared with the desktop menu (`AccountItems`).
- **Wide screens are unchanged**: the tabs (My Club kept for someone without a club, offering Find/Start), the pins bar and the avatar menu.
- One club per person (PRODUCT_MODEL §13): no club switcher; the "coach at two clubs" case is gone.
- The study (`design/navigation.html`, `src/design-preview/navigation/`) is deleted.

### The alternatives that were shown

Open `/design/navigation.html` on the Vite server (`http://localhost:5178/design/navigation.html` once merged; `http://localhost:5191/...` on this branch). Two views: **Compare layouts** (one role mix, Today + A + B + C side by side) and **One layout, every role** (`?view=alt&alt=a`). Language (EN/ქა) and theme switch at the top right; everything is in the address.

Tab counts at 390px:

| Role mix | Today | A | B | C |
|---|---|---|---|---|
| Ordinary | 5 | 4 | 5 | 4 |
| Coach | 6 | 4 | 5 | 4 |
| Parent | 6 | 4 | 5 | 4 |
| Coach + parent | 7 (four labels cut) | 5 | 5 | 5 |
| Coach at two clubs | 6 | 4 | 5 | 4 |

- **A · Role tabs replace My Club.** My squads and Parent Hub take My Club's place; My Club only for someone with neither. Pins move to an icon in the top bar. The club is one tap from My squads (its crest heads the squads; with two clubs, one heading per club).
- **B · One "My football" tab.** Always five tabs (Home, World, My football, Messages, Pins). My football opens with a row of faces and crests to switch: My squads, each child, each club.
- **C · Messages up top, a "You" tab.** Role tabs as in A; Messages becomes a top-bar icon with its count; pins, the club and settings live in You.
- In the alternatives a long Georgian label takes a second line instead of being cut ("ჩემი / გუნდები"); Today shows the bar as it renders now.

## Notes

- The sandbox's implicit sign-in (no `gk-session-id`) leaves Agent Dola's panel closed: sign out and in at `/login` (any password for the demo coach) to judge Dola. Sandbox only; a real sign-in always has a session id.
- Sandbox switches added for Dola (`sandbox/api/handlers/social.mjs`): the cookie `gk-sandbox-dola=down` makes the status check fail; a parent (family cookie) gets the `family` context in welcome.
- Not mine, passed to the coordinator: My squads' `coachNeeds.ts` still calls a missing acknowledgement "not read" (the other half of F19, Club workspace); the Android-only Opportunities strip in `FeedPage.tsx` still says Campaigns (Home).
