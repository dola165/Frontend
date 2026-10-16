# Squad page & family

Brief for one chat, written 16 October 2026 from the owner's model. Copy this file into your branch as `frontend/docs/claude-sandbox/SQUAD_PAGE_AND_FAMILY.md` in your first commit, and record decisions in it.

Read first:
- the repository `CLAUDE.md` and the `AGENTS.md` files it imports;
- `frontend/docs/claude-sandbox/ROUND_2.md` and `PRODUCT_MODEL.md` §13;
- the shared board `C:\Users\daddo\Projects\Frontend-claude-sandbox\.claude\sessions.md`;
- the owner's diagram `C:\Users\daddo\Projects\Frontend-claude-sandbox\outputs\notes\squad-page-model.webp`;
- the review ledger `C:\Users\daddo\Projects\Frontend-claude-sandbox\outputs\notes\findings-ledger.md`. Details for each ID: `C:\Users\daddo\.codex\visualizations\2026\10\15\01a140b7-0fd4-75d1-83e6-acb031d9ec3f\grasskickz-product-review\findings.md` (F01–F32) and `...\round-3\findings.md` (F33+), with phone screenshots.

## Why this chat exists

The coach's side has had most of the design attention. The parent's side had no owner, so it fell behind: three of the review's top simplicity problems are the parent's. This chat owns the place where parent and coach meet, the **squad page**, and the parent's whole side.

## The model (the owner's diagram, in words)

**One squad page, two ways in.**
- **The parent** opens it through their child in **Parent Hub**.
- **The coach** opens it through **My squads**.

It is the same page with the same coach updates, chat, training schedule and grounds. Each person sees the controls for their job: **the coach manages the squad, the parent manages their child.**

- **Parent:**
  - creates the child's **player card**;
  - gets the child into a club's squad;
  - then sees, through that child: coach updates, the squad chat, a private chat with the coach, the schedule (with "coming?"), where the squad trains and plays, and the roster as player cards.
- **Child:** not a user and has no account. They go to football; the parent manages everything.
- **Club / coach:**
  - the club creates the squad; the coach gets the squad page at once;
  - the squad chat and private parent–coach chats are created with the squad automatically;
  - the coach posts updates, chats with the whole squad or one parent, and adds or removes players.

## Six refinements agreed with the owner

1. **Removing a player removes them from the squad, never deletes the card.** The card belongs to the parent (photo, history, matches) and can join another club later.
2. **Joining needs both sides.** Either the coach invites (a join link to share in the parents' WhatsApp group, or a direct invite), or the parent asks and the coach approves. Neither side can add a child alone.
3. **No private coach-to-child channel.** "Message a player" means messaging that player's parent or guardian. If older players later have their own accounts, their parents stay included (child safeguarding).
4. **The roster shows little about other children:** name, shirt number, position, photo. Never contact details or personal information. Parent-to-parent private chat is off by default.
5. **Real families are messier:**
   - two guardians per child, both seeing everything;
   - a child in two squads (child switcher, one squad page each);
   - a parent who is also the coach (the coach view plus their own child's parent controls);
   - a teenager who later takes over their own card, with the parents still linked.
6. **This chat owns the whole squad page** (both views), Parent Hub, child cards and joining. My squads (the coach's list of squads) stays with the Club workspace chat. Agree any change to how My squads opens the squad page with that chat.

## Your area

- `features/squadCommunication/**` and `pages/SquadCommunicationPage.tsx` (taken over from the Club workspace chat after it commits);
- `pages/ParentHubPage.tsx` and `features/parents/**`;
- joining and admissions on the applicant side: `features/admissions/applicant/**`, `features/joining*`, `pages/ConsentPage.tsx` where it concerns a child;
- player cards, where the parent creates and edits them;
- the sandbox family, admissions and squad-communication handlers. Put new behaviour in a new handler file; don't grow `club.mjs`.

## Findings to fix (from the ledger)

- **F34:** the parent's phone shows, in order: which child (one line, with the switcher), the next session with **Coming / Can't come**, the latest coach update. Edit, membership and family settings go below.
- **F33:** joining asks "which child?" (or the child's name and birth date inline) first. Time, ground and cost stay together as a short summary; full terms fold away and consent appears at the step it governs.
- **F38:** each child shows a small **Fees** line by their club: amount recorded as due, due date, and a statement or contact action. With no recorded statement it says "Not recorded", never zero. Build the design with sandbox data. Where the real amount comes from is an open owner decision; note it in "Before release".
- **F30 (your parts):** after choosing Georgian, the reply buttons, saved-answer text, **Mark as read**, the family squad room and the public **Join / Arrange a first visit** actions must be Georgian. Coordinate the public club-page actions with the Home chat.
- **F19 (your part):** a missing acknowledgement reads "not acknowledged", never "not read".
- **F05:** a failed joining request keeps its explanation and the parent's answers after the page refreshes. If the fix is large, write it into "Before release".

## How to work

1. Look first: the squad page as coach and as parent, Parent Hub (sandbox parent mode: `http://localhost:4305/__mode/parent?to=/parent`, or your own API's equivalent) and joining, at 390px. Write a short plan into the brief file: phases, files, reuse versus replace.
2. Build phase by phase. Start with what a parent sees on a phone (F34), then joining (F33 plus refinement 2), then the shared squad page and its two views, then the rest.
3. Follow CLAUDE.md's visual language: faces, crests, football cards; one main thing per screen; few words. Use the one calendar (`FamilySchedule` on `ScheduleDirectionWorkspace` + `ScheduleGrid`).
4. Check every screen at 390px and 1920, light and dark, in English and Georgian.
5. Commit each phase. Send the Club workspace chat a merge request so the owner sees it on :5178. Name every sandbox API change for the coordinator (`local_be027ab5-df6f-4d50-b64e-cb21005db19a`), who restarts 4305.
6. Follow the board's rules. Report the ledger IDs you closed. Never push.

## Done when

- A parent on a phone sees which child, the next session with Coming / Can't come, and the latest coach update, without scrolling.
- A parent can create a child's card, join a squad through an invite link or a request, and open the squad page through the child.
- The coach and the parent see the same squad page with their own controls.
- The six refinements hold.
- F33, F34, F38, F19 (squad part) and F30 (your parts) are closed, and F05 is closed or written down.
