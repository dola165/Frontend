# Club workspace and My squads: ideas, 13 October 2026

From the club workspace / My squads chat (`local_54169267-3709-42b2-ba4e-37210f7c282c`, branch `claude/workspace-and-squads-6755b0`, servers 4305/5178). Ideas only, no code. Mockup of the new My squads page: `squads-mockup/my-squads.html` (served on http://localhost:8765/my-squads.html while this chat runs) and `squads-mockup/my-squads.jpg`.

## What the two screens are today (seen at 1920×1080 as Luka: owner, head coach of U14 and U16 Boys)

- **Club workspace** (`/clubs/1/workspace`): rail Overview · Calendar · Club updates · Work queue, then six folded areas (Football, People, Club operations, Recruitment, Club business, Settings) holding about 34 tools, plus All tools. The overview is a dashboard: club facts in the header (87 players · 5 trialists · 15 staff), Needs you (the first rows of the work queue), eight squad tiles, Coming up (7 days), Other work, legend. The Work queue is already the one list of everything waiting (grouped Overdue · Next 7 days · Later, with squad and type filters, URL state). Staff is a plain list of 18 people. Squads is the roster tool with pills per squad.
- **My squads** (`/my-squads`): rail Overview · Calendar · Players · Updates · Coaches, footer Club workspace. The overview: squad switcher pills, Next up (photo, countdown, faces ringed by answer), This week (seven columns), two squad cards, Needs you (six rows), Coaches faces, legend. The other four pages are each one thing and are not overviews.

## 1. What the club workspace becomes

**Idea in one line:** tools become record types that hang off the thing they are about (a person, a squad, a session, a match), so the rail holds subjects, not modules. Depth stays (every record keeps its form, status, approvals and history); the navigation gets short.

**Stays visible (the rail, 7 items, 8 for leadership):**

| Rail | What it is | What it absorbs |
| --- | --- | --- |
| **Work** (opens first; count badge) | The work queue as it is: one list, grouped by urgency, filters by squad and kind | Overview's Needs you, Staff appointments needing attention, every club-wide "all expiring X" list (Type filter) |
| **Calendar** | The one calendar, club-wide | Coming up; attendance opens inside a session |
| **Squads** | Squad pills → roster, training times, age rule; a squad opens its players and its week | Squad tiles from the overview; equipment/kit per squad |
| **Players** | DataTable with views: Playing · Trialists · **Joining** · Left | Admissions, Applications, Tryouts, Invites (as the Joining view), Player cards (edit inside the player), Development, Restrictions, Guardians & consent, Registration, Medical, Education, Welfare, Departures (as sections inside the player sheet, each a record list filtered to that person; "+ Add" offers only the kinds the club has turned on) |
| **Staff** | One person per row: job, squads, status; **appointment in one dialog** (person → job template pre-fills access → squads → send; "Adjust access" folded; current access continues while the change waits) | Staff duties, Staff roles (requests), Credentials, Specialists, Invites for staff, Open roles (as views: Staff · Invited · Requests · Hiring) |
| **Club updates** | As is | |
| **Settings** | One page, sections | Club settings, Workspace settings, Ownership & access, Joining policy |
| **Money** (leadership only) | Fees owed, programmes, finance records | Programmes & fees, Finance |

- **Hides until needed:** a record kind shows in a person or squad only when a record exists or the club has turned the module on; "+ Add" is the only way in. Agent approaches appear as a Joining view only when one exists. Travel appears inside an away match (Match preparation and Travel are one "Match day" sheet on the match: squad, kit, bus, readiness). The old `?tab=` addresses keep working: each opens the same list filtered to that kind, so nothing is lost and old links and pins survive.
- **All tools** stays as the search box for the old names ("travel", "credentials") and for pins; it stops being a page of 34 rows.
- **Moves out, to where it belongs (other chats' areas, see section 3):** Store, Campaigns, Open roles, Programmes & fees, Facilities and the public-profile settings leave the workspace for the club page's own tabs, edited in place by staff. Club matches (arrange, results needed, past match) stay reachable from the club page and World; the workspace keeps only the match-day records.
- **Goes:** the overview page and the header facts (the counts live on Players and Staff), the Other work box, the focus switches ("tools first": with a seven-item rail there is nothing to reorder; responsibilities still decide which views and record kinds show).
- **Judge it as three people:** a plain admin with no squads (sees Work, Calendar, Squads, Players, Staff, Settings, Money), a coach with no admin role (My squads only; the workspace link shows only what their responsibilities allow), and Luka who is both.

## 2. What replaces the My squads overview

See `squads-mockup/my-squads.jpg`. One page, two things:

1. **One card per squad I am responsible for** (three across at 1920, like Parent Hub's child cards, built once as a shared "your team" card): crest and name, my job there and the player count, the players as faces ringed by their answer to the next session, the next session or match (symbol in its colour, day, time, opponent or title, ground, the coming/can't/no-reply bar), **one waiting line** in the dot-status-arrow language only when something waits (families waiting → Reply; a restricted player before a match → Decide; no replies → Chase), and two actions: Who's coming (Take register on the day) and Squad chat. The card opens the squad's week in Calendar. A dashed slot says "Ask for another squad on Coaches".
2. **Soon**, the next seven days of my squads, grouped by day, same-time entries merged, each row: time, activity symbol, title, squad and ground, and the status word only where a reply, decision or register is missing. "Calendar ›" at the top. Empty: one line, "Nothing until Thu 18:00, U14 training".

```
My squads                      Tuesday 13 October                 [Post an update]
┌ U14 Boys · Head coach · 11 ┐ ┌ U16 Boys · Head coach · 12 ┐ ┌ · · · · · · · · · · ┐
│ ◉◉◉◉◉◉◉◉◉◉◉ (ringed)       │ │ ◉◉◉◉◉◉◉◉◉◉◉◉                │ │ Ask for another     │
│ 🏆 Sat 11:00 v Saburtalo   │ │ 🏆 Thu 19:00 v Didube       │ │ squad on Coaches    │
│ ▓▓▓▓▓▓▓▓░░ 9 of 11 coming  │ │ ▓▓▓▓▓▓▓▓▓░ 10 of 12 coming  │ └ · · · · · · · · · · ┘
│ ● 2 families waiting Reply›│ │ ● Giorgi restricted  Decide›│
│ [Who's coming] [Squad chat]│ │ [Who's coming] [Squad chat] │
└────────────────────────────┘ └─────────────────────────────┘
Soon · next 7 days                                                     Calendar ›
Tomorrow  18:00 ▲ Finishing under pressure · U14 · Rich 1        ● 1 can't come  ›
Thu 15    19:00 🏆 U16 v Didube Stars · 10 of 12 coming           ● 1 no reply    ›
Sat 17    11:00 🏆 U14 v Saburtalo Youth · 9 of 11 coming         ● 1 no reply    ›
Mon 19    18:00 ▲ Recovery session · U16                          ● Giorgi restricted ›
```

- **Goes:** the Overview tab, the squad switcher pills on this page (the cards are the switch; the pills stay on Calendar, Players, Updates, Coaches), Next up, This week's seven columns, Needs you, the Coaches box, the legend as a strip (a small one-line legend stays under Soon, or moves into the Calendar).
- **Keeps:** Calendar, Players, Updates, Coaches as they are. Post an update stays as the page's one action.
- **Rule for what is "urgent":** only things with a date in the next seven days, or a person waiting on me. Anything later or undated is not on this page; the records and the work queue keep it.
- **Top bar:** the My squads tab shows the number of red and amber lines across the cards (the owner's "badge on the Parent Hub tab" idea, applied to coaches).

## 3. Changes elsewhere (asked the Home and World chats on 13 October)

**Home chat's answer (13 October):** no conflict. The rebuilt club page already has quiet staff-only links (About → Edit, Teams → Edit programmes, Facilities → Manage locations, Coaches & staff → Manage staff, squad page → Squad workspace / Manage sessions), all pointing at the workspace today; nothing edits in place yet and nothing is planned, so in-place editing is open. Either this chat builds it inside `features/clubs/profile/*` (telling the Home chat first) or the Home chat builds the club-page side while this chat removes the workspace tools: the owner's call. Open workspace is already the one way in.

**World chat's answer (13 October):** nothing conflicts; its top-bar edits were only pin entries and labels for World routes (landed at `26e5e8d`), and the Home chat's My Club → club page change is already in its branch. The top bar is this chat's for counts, dots and a Work pin, keeping the World entries in `pinCatalog` and `describeRoute` as they are.

- **Club page (Home chat):** staff edit in place on the tabs that exist: Teams & training (squads, training times, fees), Facilities (grounds), Club store · Club jobs · Club fundraising (add an item, post a job, start a campaign: the Store chat for the store), About and Contact ("Edit" for staff). "Open workspace" stays the one way into the workspace; for coaches, squad rows on Teams & training open their squad in My squads.
- **Home:** nothing. It stays 100% feed.
- **Parent Hub (nobody's area on the board):** the same card as My squads (child card = squad card, one shared design component) and the same "Soon" list; its Overview tab goes the same way when Parent Hub's turn comes. Updates sent from a squad card land on the child card; "can't come" from a child card lands on the squad card (the two ends of one pipe).
- **Top bar (World chat / coordinator):** a count on My squads (above), a dot on My Club for staff when Work has something overdue, "Work" pinnable. My Club keeps opening the club page.
- **Calendar (shared engine):** attendance and who's coming open inside a session everywhere (My squads already does this; the workspace calendar should too).

## 4. Questions for the owner

1. **The picture:** what did you show? It did not reach this chat. If it is a card-per-team layout, the mockup is close; if it is something else, send it before anything is built.
2. **What the workspace opens on:** Work (my recommendation), Squads, or Calendar?
3. **My squads, "nothing else for now":** keep Calendar, Players, Updates and Coaches in the rail (my reading), or is My squads literally this one page, with the cards opening the squad in the club workspace?
4. **"Soon" window:** seven days (mockup) or 48 hours? And which things count as urgent: no reply before a match, a family waiting, a restricted player before a session, an overdue task of mine, a cancelled session? Anything to add or drop?
5. **Where a squad card opens:** the squad's week in Calendar (mockup) or the squad's players?
6. **Records inside the person:** fold Guardians, Registration, Medical, Education, Development, Restrictions, Welfare and Departures into the player sheet, and Credentials, Duties, Specialists into the staff row? Access does not change (welfare stays confidential); only the way in does.
7. **Leaving the workspace:** Store, Campaigns, Open roles, Programmes & fees, Facilities and the public-profile settings move to the club page entirely (no link left in the workspace), or keep a "More" link for a while?
8. **Names:** "Work" for the queue, "Joining" for the recruitment views, "Money" for programmes and finance, "Match day" for preparation plus travel. Football words wanted; say which grate.
9. **Staff appointments in one dialog:** build it in this round, or after the coaches' answers on the club model (scopes such as "GK coach U12–U16" change the squads step)?
10. **Order:** My squads first (small, decided), then the workspace rail and Players/Staff views, then the moves to the club page with the Home and Store chats?
