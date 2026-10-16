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

## Plan (16 October, this chat)

Looked first at Parent Hub, the families' squad room, the coach's squad page inside My squads and joining, at 390px, and read the review's phone screenshots. What stands out: Parent Hub's phone opens on workspace chrome (title, intro, Add/Refresh, three tabs, a child strip and a second identity card); the week starts below the fold. The families' squad room and My squads' squad page are two different pages built from different data. The sandbox parent's two children have no club, so nothing past "No club yet" can be judged.

**Sandbox family (new `handlers/family-squads.mjs`, data in `world-family.mjs`; parent mode only, `/__mode/parent`):**
- Saba (12) plays in **U12 Mixed** (Koba Gvazava coaches it; Luka is only a parent there) and plays up in **U14 Boys**, which Luka coaches: a child in two squads and a parent who is also the coach.
- Nino (9) has no club yet: the joining path.
- A second guardian (Tamar) on both children; a recorded fees statement for Saba at Dinamo; coach updates (one asking to be acknowledged), squad chat and a private coach thread in U12.
- The families' answers come from the same squad-communication shapes, with `can_manage: false` where Luka is only a parent. Saba is added to both rosters for everyone (he is a real player there); only the guardian link is parent-mode.

**Phases (each committed and sent for merging):**
1. **The parent's phone (F34, F38, F19, F30 replies).** Parent Hub rebuilt in place: the child switcher as one row of faces (with +), then the next session with Coming / Can't come for that child, then the latest coach update (acknowledge in place), then the child's squads as rows into the squad page, the Fees line by the club, the week (`FamilySchedule` embedded), and below them the card, joining progress, guardians and family settings. No page title block or tabs on top; `tab=children|connections` still opens those parts (other pages link there). Reuse: `FamilySchedule`, `SessionAvailability`'s reply path and `availabilityRecovery`, `SquadMessages`' acknowledge, `PlayerIdentityEditor`, `FamilyRelationships`, `AddChild`. Replace: the hub's own markup and the five stacked hub stylesheets that only it uses.
2. **Joining (F33, F05, refinement 2).** The group page starts with "Who is joining?" as faces (or the child's name and birth date inline when there is none), then a one-line summary (when · where · cost), the form, and consent beside the button it governs; full terms fold away. F05: the form stays mounted while the group refreshes, so the explanation and answers survive. The join link (`/join/:code`) offers the parent's existing children first (agreed with Page creation, which built it).
3. **One squad page, two ways in.** `features/squadCommunication/SquadPage.tsx` at `/squads/:id`: crest, squad, coaches' and players' faces; Updates · Schedule · Players · Grounds in the URL; Squad chat and Message coach as buttons. Parent: their child's answer in the next session, acknowledge, private chat with the coaches, roster as player cards (name, number, position, photo only). Coach: post an update, who acknowledged, chat with one parent, invite (join link to share, direct invite), approve requests, remove from the squad (the card stays the family's). Coaches stop being redirected to My squads; My squads' squad page becomes this page inside its frame (agreed with the Club workspace & My squads fixes chat). The families' room (`FamilyRoom`) and `SquadSchedulePreview` go.
4. **The rest:** Georgian for everything touched (F30), "not acknowledged" (F19), the six refinements checked one by one, "Before release" kept current.

## Decisions taken while building (owner to confirm)

- **Parent Hub has no title block or tabs** (phase 1): the bottom bar already says where you are. The child row is the header; `?tab=children` and `?tab=connections` still open adding a child and family connections, each with a way back. The workspace rail (Joining football · Find groups · Parent Hub) is gone from Parent Hub; "Find a group" shows where it applies (a child with no club).
- **Next up picks what the coach asked first**, else the soonest session in the next two weeks; Parent Hub always answers as the parent, also in a squad the parent coaches (Luka with U14 Boys).
- **The latest update is the newest across the child's squads**, acknowledged in place ("I've read it"; until then "Not acknowledged").
- **Fees** sits under the child's squads per club: the amount and due date when recorded, a statement that unfolds, "Ask the coaches about fees" (the private coach chat). "Not recorded" otherwise.
- **The player card** shows as a football card with "Yours to keep" under it (refinement 1); guardians show as faces on the Family row (refinement 5).
- **Joining a group is one page, child first** (phase 2, F33): who is joining as faces that say whether each child fits the group (or the child's name and birth date inline when there is none, "New child" otherwise), the group's when · where · cost as three pills under its name, then the request. The sibling request folds under "Joining with a brother or sister?"; the consent checkbox appears only for a direct place, right above its button; the full terms fold away. The workspace rail and the three tabs (Overview · Training & terms · Join) are gone from this page.
- **F05:** the page keeps its form while the group refreshes, so a failed send keeps its explanation and the parent's answers (the draft was already kept in session storage). In the sandbox, a message containing `#fail409` answers as if the group changed, to check it.
- **The parent asks, the coach approves** (refinement 2): a sent request is a case in the club's admissions (sandbox: `POST /admissions/cases` in parent mode adds it to the club's list and the child's Joining row in Parent Hub).
- **One squad page at `/squads/:id`** (phase 3, `features/squadCommunication/page/`): crest, squad, the club, the coaches' faces; Squad chat for everyone, "Message the coaches" for a parent. Tabs in the address: Updates (the coaches' updates as cards; beside them the child's next session with Coming / Can't come for a parent, the next session with faces ringed by their answer for a coach, and the parents to talk to one by one), Schedule (the one calendar fixed to the squad; coaches drag sessions), Players (football cards: name, number, position, photo; the parent's own child marked "Yours"), Grounds (each ground once with what happens there and Directions). Old `tab=announcements|sessions|chat|coach` links still land.
- **Coaches are no longer sent on to My squads** from `/squads/:id`; the page has `embedded` for My squads to frame it (proposed to the Club workspace & My squads fixes chat, not changed in coachHub yet). The back link follows the way in: Parent Hub when the address carries the child, My squads otherwise.
- **A parent who coaches** (Luka in U14 Boys) gets the coach view plus their child's next-up reply on the same page.
- **Inviting is the coach's; joining needs both sides** (refinement 2): Players › Invite players shows the squad's join link (copy, WhatsApp) and who is waiting (from the link or a group request) with Add / Decline. Removing a player takes them off the squad only: "Their card stays with the family" (refinement 1).
- **No private coach-to-child channel** (refinement 3): the coach's one-to-one list is "Parents & guardians"; the sandbox still lists a player without a linked parent by the player's own name (Before release).
- **"/squads"** (the old list of squad rooms) now goes to My squads for coaches and Parent Hub for everyone else; the families' room, its schedule preview and the squad space list are deleted.
- **Georgian (F30, this chat's parts):** the family reply (Coming / Can't come, reasons, "Saved. The coach sees your answer."), "I've read it" / "Not acknowledged", the squad page and its updates feed (pinned until, acknowledged by, comments), Parent Hub and joining. Proper names, club-entered schedules and squad names generated by the page builder (Page creation's part) stay as entered. The public Join / Arrange a first visit actions are asked of the Home chat.

## Status (16 October)

| Done when | State |
|---|---|
| A parent on a phone sees which child, the next session with Coming / Can't come, and the latest coach update, without scrolling | Done (390×844: child row, next session with the reply, the update with "I've read it", all above the bottom bar) |
| A parent can create a child's card, join a squad through an invite link or a request, and open the squad page through the child | Done: card in Parent Hub (+) or inline on a group; a group request lands with the coach; the squad's join link (coach › Players › Invite players) lands in "Waiting for you"; Parent Hub's squad rows open `/squads/:id?player=`. The join link page offering existing children waits on the Page creation chat |
| The coach and the parent see the same squad page with their own controls | Done at `/squads/:id`; My squads framing it waits on the Club workspace & My squads fixes chat |
| The six refinements hold | 1–5 hold in the sandbox; "a teenager takes over their own card" is not built (Before release) |
| F33, F34, F38, F19 (squad part), F30 (our parts) closed; F05 closed or written down | F33, F34, F38, F05, F19 (squad part) closed; F30 our parts closed, the public club actions asked of the Home chat; F38's source of truth is an open owner decision |
