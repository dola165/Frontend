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
