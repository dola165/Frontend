# Round 3 plan: World does the work, not just shows it

Written 11 October 2026 for the owner to read before anything is built. It answers the owner's message after the World stage was accepted ("perfect", commit `c1b0860`).

**Status:** accepted on 11 October ("begin"): every default in section 3 stands. The owner asked for one phase at a time, each finished with full focus and shown before the next starts with the owner's go-ahead.

## 1. What you asked for

1. **Browse area:** pressing a result flies the map to it; the pressed row is highlighted (less transparent) and its distance and place give way to one action, "Open club", "Open profile", "Open venue", "Open job"… On every tab.
2. **People** looks bad: worthless filters, a Browse area that does nothing, no distinction between kinds of people. Make it make sense and look good; write the backend queries it needs down.
3. **Venues and Matches** are good but should look better and be easier to understand. Experimental ideas welcome.
4. **Competitions becomes Tournaments**, with the old hub's sections back (without Match exchange), an extra layer (overview and the rest) that does not confuse, and work in pop-ups and slide-in panels so nothing disrupts the person.
5. **Creation and management belong in World:** arranging matches, creating tournaments and the rest, with the complexity hidden. Nothing important may be lost. "Arrange a match" lost fields the original had.
6. **Every backend change** the redesign needs, written down to go through later.

## 2. What the research found (seven research agents, a critic, then fifteen design concepts and five judges)

The full reports are kept locally in `.claude/round3/` (not committed: they quote the private backend).

- **Your image 3 is the old "Matches & Competitions" hub** (commit `5f78c0d`): Overview, Tournaments & leagues, Match exchange, Fixtures & results, Officials, plus Arrangements / Competitions / Invitations links and Create tournament. Everything behind it (the public tournament page, the workspace, the competition engine, the setup wizard) still exists and is unchanged; what was lost is the hub itself: the overview, featured tournaments, the organiser page, the format chooser with pictures, rich cards with banners and fees, and the host picker. The backend still serves all of it.
- **Arrange a match lost nine original fields:** choosing the opponent's age group, home/away separately from the ground, an end time (matches longer than 120 minutes are impossible now), inviting a referee or asking referees nearby with a fee at creation, the meeting point of a listed ground, paged venue search; and reservations were removed from the match page too, beyond the decision to remove them from creation. Two edit bugs were found (a "We travel" match turns into "Either ground" when edited; a ground without a city is rejected by the server).
- **People has no backend at all.** The real backend has no people directory; on production People is a name search with nothing on the map. In the sandbox, 77% of "people" are players, the "Confirmed" filter is invented (90% pass it), and the Browse area repeats the list below it. Referees, the one part with real data, are kept off the map.
- **Several "backend needs" already exist** in the backend (squad ids on invitations, club coordinates, tournament radius, referee availability, kit colours, entry caps, featured tournaments). Two sandbox differences hide production bugs: club cards on the real backend never offer Join/Apply and never show "Member".
- **Nothing became a dead end** (every old address redirects), but about ten capabilities were dropped and eight are harder to find (section 6).
- Everything the backend must do is now in **`BACKEND_NEEDS.md`**, checked against the real backend code.

## 3. Decisions I need from you

Each has the default I will use if you just say "go". Change any by number.

| # | Question | Default |
|---|---|---|
| 1 | **Browse "Open …":** the selected row hides both its detail line and its fact, showing only the title and "Open …". Pressing the selected row again flies back to it (never deselects). Escape clears. | Yes |
| 2 | **What "Open …" opens:** a slide-in sheet inside World for matches, tournaments, venues and people (with "Full page ↗" in it), and the full page for clubs, jobs, trials and groups (their pages are rich already). | Yes |
| 3 | **People in four views:** Referees · Specialists · Coaches & staff · Players. Drop "Everyone", the invented "Confirmed" filter and the Agents chip (the agents backend is frozen). | Yes |
| 4 | **Referees on the map now,** counted at the city they state, and only the selected referee draws a dashed "their stated area" ring. This reopens "referees stay off the map for now". | Yes |
| 5 | **The Dugout (People › Referees, coaches only):** your coming match days with an empty referee seat; pressing a seat turns the Browse area into the referees who fit that match; inviting is one more press with a preview. | Yes |
| 6 | **Arrange a match gets back:** home/away apart from the ground, changing the age group, any length up to 12 h, the referee at creation (folded, "Later" stays the default: invite one or ask referees nearby, with fee). Not back: a required title; reservations at creation. | Yes |
| 7 | **Reservations on the match page** (link a reservation, change the ground through one, share it with the other club) were removed beyond the decision. Bring them back as a management step on the match page. | Yes |
| 8 | **One "+" button per tab** (a split button: the tab's likely action, e.g. "+ Arrange a match", and a menu with drafts first) instead of the five different create buttons. "Post a role" becomes "Post a job". | Yes |
| 9 | **Where work opens:** over the map in the panel slot when the map is on screen (the map then picks places); otherwise as a sheet from the right, so the page never scrolls back up. One question at a time opens as a small centred pop-up. | Yes |
| 10 | **Tournaments sections:** This season · All tournaments · Matchday · Referees · My tournaments. ("Matchday" avoids repeating Matches › Fixtures & results.) | Yes |
| 11 | **Tournaments are drawn as their format:** every tournament gets a small picture of its shape (bracket, table, groups, festival wheel, ladder) that fills in with results, your team's path lit. | Yes |
| 12 | **Create a tournament inside World** ("Draw room": questions on the left, the tournament's shape live on the right) replaces `/tournaments/setup` once it has every field. Created private by default; the required rules are offered as "the usual wording", visible and editable. | Yes |
| 13 | **Venues as a Pitchboard** under the map: one wide photo row per venue with its pitches drawn to scale and the chosen day's free time as a quiet ribbon; a time line runs through every row and across the map; booking slides in from the right. Phones keep stacked photo cards. | Yes |
| 14 | **Matches opens on the next matchday** with a day strip floating over the map; your teams starred and grouped first; open matches show "Your U14 Boys?" in the empty opponent slot when it fits. | Yes |
| 15 | **The map's "Respond to this match"** (schedule challenges nobody can answer) merges into "Offer to play" on open matches. | Yes |
| 16 | **Organiser chores** (approving entries, appointing referees) stay in the tournament workspace; World shows them as waiting rows that open it. | Yes |

## 4. The phases

Each phase is finished, reviewed and shown to you before the next starts. Nothing is left half-done: when a phase replaces something, the old code, styles and copy go in the same phase.

### Phase A · Shared foundations and "Open …" on every tab (your item 1)

What you will see: on every tab, pressing a Browse row flies the map to it, the row turns more opaque, and its line becomes the action ("Open club", "Open profile", "Open venue", "Open match", "Open tournament", "Open job", "Open trial", "Open group"…). Pressing a pin selects its row without moving the camera. The selection is in the address, so Back and shared links return to it.

Built in this phase:
- The selection model (`selected=` in the address, one result rather than one pin, a reverse index from pins to results), `BrowseLine.action`, rows as buttons with a separate "Open" link, Escape, focus return.
- A focus request on the shared map (`flyTo` with an offset clear of the panel), reduced motion, a "Show all" pill while focused; the map's own card hides while the panel shows the choice and says "Open club" (not "Open") when it shows.
- **Frontend fixes the backend already allows, with the sandbox sending what the real backend sends:** club cards read `playerJoinPolicy` and `isMember` (Join/Apply and "Member" on the real backend), invitations read `squadId`, club coordinates are read instead of cast, tournament fees are whole numbers, the closing date shows the last day you can enter.

Moved to the phase that first uses them (so nothing is built before it is needed): map layers and the generic left drawer (D); group headers, `line(item, places)`, the shared score-line pieces and deleting the fake "Live" style (C); a leading overview segment, segment counts and icons and a default segment per role (B, E); `WorldMapPoint.chip` and `.dim` (C, F); sheet widths (C); and each sandbox fix (referee routes and modes, referee availability, invited referees, venue order and city, tournament filters, scopes and invitation review) in the phase whose screens it affects.

Size: M.

### Phase B · People, rebuilt (your item 2)

Direction "Touchline" (judged 39/50 against two alternatives; full spec in `.claude/round3/design/verdict-people.md`).

- **Four views with counts and symbols:** ⚑ Referees · ✚ Specialists · ▤ Coaches & staff · ▣ Players. Each view has its own two or three filters that change results: Referees by match, format and terms (volunteer or paid) and "free on"; Specialists by service; Coaches & staff by job, ages and licence; Players by position (picked on a small pitch), status and age. City, "Profession or skill", "Confirmed" and "Everyone" go. People follow Near from the World bar.
- **One card family** (the football card, generalised) with a corner mark per kind: a referee's level, a coach's licence shield, a specialist's service, a player's position, all marked "as stated" when people wrote them themselves. One bright fact and one action per card (Invite, Message, Follow).
- **The map does something:** people are counted on their club ("FC Dinamo Tbilisi Academy · 12 staff"), people without a club on their city, referees at the city they cover; nobody is ever named on the map.
- **The Browse area groups by place** (each group header is a pin) and its selected row says "Open profile", which turns the panel over into the person's peek so the map stays live.
- **The Dugout** for coaches (decision 5): your match days with an empty referee seat; a seat turns the Browse area into the bench of referees who fit; Invite is a short step with a one-sentence preview.
- Parents are never shown independent specialists by default until verification for people working with children exists. No one under 18, no parent-only account, no private profile is ever listed.

What works on the real backend today: Referees fully. The other views need `GET /people` (`BACKEND_NEEDS.md` §3.3); until then they search by name with their filters marked as waiting for the directory.

Size: L.

### Phase C · Matches, "Matchday" (your item 3)

- **A day strip floating over the map** (± 7 days, counts, ★ where your teams play, "Results" and "Upcoming" at the ends); Fixtures open on the next matchday.
- **Score-site lines everywhere:** two stacked crests, a fixed score column, your teams starred and grouped first, then tournaments (trophy), friendlies (handshake), club fixtures. Every state is worked out honestly: FT, a time, "On now" only by the schedule and labelled as such, "Confirm score", "Add result", cancelled, postponed. A proposed score is never shown.
- **The Browse area groups by where** (each ground is a pin with its kick-off range) while the list groups by when and what, so they never repeat each other. The selected match draws its **away-day line** on the map ("≈ 10 km", straight line, labelled as such).
- **Open matches** show your fitting squad as a faint crest in the empty slot ("Your U14 Boys?") and "You play that day" when it clashes.
- **My arrangements as lanes:** Needs you · Waiting on them · Coming up · Played, each match with a four-dot track (Opponent · Ground · Referee · Result). Completed arrangements show their score (today they read "Arranged").
- **The match sheet** slides in from the right: form of both sides, last meeting, the table, the track, and the one action you can take (confirm a result, choose an offer, pick players, plan the journey). Rare and destructive work stays on the full match page.
- "Add a past match" is no longer hidden behind the Results view.

Size: L.

### Phase D · Creating things in World, "Set Pieces" (your item 5)

- **One "+" per tab** (decision 8), drafts first in its menu, shown only to people who can do something (by real permissions, never by the role picked in World; this also fixes club administrators never seeing "Propose a match").
- **Every flow starts from the thing it is about** and opens filled in: Propose a match from a club, Offer to play from an open match, Find a referee from your match, Invite to a match from a referee, Book from a venue, Enter from a tournament, Answer from an invitation. With a Browse row selected, "+ Arrange a match" opens with that club as the opponent.
- **Where it opens** (decision 9): over the map in the panel slot (the map picks the ground: "Press a club to play them", "Choose the ground or press the map"), otherwise as a sheet. One-question things are small pop-ups.
- **Arrange a match** keeps one short form, with the restored fields (decision 6), a live preview that looks exactly like the row it will become (crests, kick-off, ground with "You host / You travel", the club's arrival note, kit colours when the clubs have them), one honest sentence above Send ("Invites Locomotive · U14 Boys. Nothing is agreed until they accept."), rest and clash notes from your squads' calendars, and "Before you post: 3 teams near you want a U14 game that weekend · Offer to play instead".
- After sending, the form turns into the record it created, with one next step ("Find a referee", "Plan the journey").
- Drafts are kept per flow, no duplicate sends, nothing personal in the address. `/world/matches/arrange` redirects into this.
- Reservations come back on the match page (decision 7). The two edit bugs are fixed.

Size: L (in three steps: sheet first, then the panel over the map, then the remaining flows).

### Phase E · Tournaments (your item 4)

Direction "Wall Chart" (39/50).

- **Renamed Tournaments** (`/world/tournaments`; every old address, tab and filter redirects, nothing breaks). Trophy pins in match green.
- **Five sections** (decision 10): **This season** (the overview layer: waiting for you, your squads' tournaments as pictures, entries and dates, who runs them), **All tournaments** (cards grouped by age), **Matchday** (tournament fixtures by tournament and round, with the table or bracket beside each), **Referees** (appointments, matches without a referee, the referee list), **My tournaments** (waiting, playing in, running, finished).
- **Every tournament drawn as its format** (decision 11), from fields the real backend already returns; your path lit.
- **Cards come back:** banner, organiser crest, age and side, dates, places ring, fee ("paid to the organiser"), one bright fact (Answer / U14 Boys in / Closes 14 Oct / Final Sat 17 / On now / Full).
- **Everything happens in panels over World:** the tournament sheet (Bracket/Table · Matches · Teams · About, a Final poster when the final is next), Enter as a step inside it (squads that fit first), Answer an invitation as a pop-up (no more detour through Requests), the organiser drawer from the left (their tournaments, Follow), Add to calendar. Running a tournament stays in its workspace (decision 16).
- **The format chooser with pictures** comes back as the Format filter, and the host picker under More filters.
- **The Draw room** (decision 12) creates a tournament in World with every field the setup page has.

Size: L+ (four steps: discovery and panels; the overview layer; Matchday and Referees; the Draw room).

### Phase F · Venues, "Pitchboard" (your item 3)

Direction "Pitchboard" (38/50).

- One "When" pill (day, time, length), a size pill ("7-a-side and up", or the number of players) and Indoor. Coaches open on the next evening at 18:00 for 90 minutes and their squad's size.
- **The board under the map:** one wide photo row per venue: pitches drawn to scale (covered ones with a roof), "Run by {club}" with its crest, distance, Instant or "Venue confirms", the day's free time as a quiet ribbon that tells "taken" from "too short to start" from "closed", your own bookings marked, and one bright action ("Book 18:00", "Request 18:00", "Again · Tue 18:00").
- **A time line** runs through every row and over the map; venues not free at that time fade on the map.
- **Booking slides in from the right** with the pitch and time chosen, repeat weekly, the policy in plain words ("Pay at the venue", "Cancel up to 24 h before"); afterwards the ribbon shows it as yours.
- **My reservations** as lines (waiting, coming up, past) with their venues on the map.
- Request volume is kept low (only rows in view, cached) until the backend can answer for several venues at once.

Size: L.

### Phase G · Everything else that was lost, and the final sweep

- The dropped capabilities in section 6 that you want back (club country filter, "Ask about an existing club group", the referee opportunities deep link, "Open schedule", volunteer shifts where the extension exists), and stale old addresses in Dola, global search, the store and campaign tabs ("Roles" → "Jobs & volunteering").
- The Arrange page and match page in Georgian (they are English only today), the overview fields' Georgian copy, focused tests that are still missing (role defaults, selection, lanes, ribbon maths, glyph shapes).
- A full multi-agent review of the whole round, `npm run check`, `ROUND_2.md`, `WORLD_RECIPE.md` and `BACKEND_NEEDS.md` brought up to date.

## 5. How each phase is built and checked

1. Build in this session, one writer on the branch (no two agents ever write at once). Independent read-only work (research, reviews, verification) runs in parallel subagents.
2. Checks every time: TypeScript, lint, the colour guard, focused tests, then the browser at 1920×1080, 1366 and 390, as coach@talanti.ge and as a parent, light and dark, keyboard, reduced motion, no console errors, nothing jumping between tabs.
3. A multi-agent review per phase (correctness, honest data and privacy, accessibility, visual rules and code shape), each finding checked by an adversarial verifier, then fixed and re-checked.
4. `ROUND_2.md` (decisions), `BACKEND_NEEDS.md` (new backend needs, "Round 3" section) and `WORLD_RECIPE.md` updated.
5. You look; I commit after your OK, never push.

The recipe skill (`world-page-recipe`) is extended with the new patterns (selection and "Open …", sheets and the panel over the map, the "+" button) so every phase follows them.

## 6. Nothing lost: where each capability lands

| Capability | Today | Phase |
|---|---|---|
| Browse result → map, "Open …" | Rows navigate away | A |
| Club Join/Apply and "Member" on the real backend | Never shown (field name mismatch) | A |
| People by kind, with filters that work; referees on the map | One mixed list | B |
| Invite a referee from People | Not possible | B |
| Fixtures with crests, grouped, honest states | Flat rows, no crests | C |
| Completed arrangements show their score | Read "Arranged" | C |
| Add a past match visible | Hidden on the default view | C |
| Arrange a match: hosting, age group, long matches, referee at creation, meeting note | Missing | D |
| Reservations on the match page | Removed | D |
| Answer a match invitation, offer to play, find a referee from World | Only on the match page | D |
| The map's "Respond to this match" | Nobody can answer it | D (merged, decision 15) |
| Featured tournaments, the tournaments overview | Gone | E |
| The organiser page and host picker | Gone (only a filter) | E |
| Format chooser with pictures; tournament cards with banner and fee | Text rows | E |
| Fixtures & results and Officials beside tournaments | Moved to Matches and People | E (Matchday, Referees) |
| Answer a tournament invitation in World | Detour through Requests | E |
| Enter a tournament with squad choice | Full page only | E |
| Create a tournament | Old wizard page | E (Draw room) |
| Tournament series | Demo-only extension, no backend | Stays as is; `BACKEND_NEEDS.md` |
| Venues near you, free times, booking in place | Cards, booking on the venue page | F |
| My reservations on the map | No pins | F |
| Club country filter | Dropped | G |
| "Ask about an existing club group" in places to train | Dropped | G |
| "Open schedule" from fixtures; referee opportunities link | Dropped | G |
| Volunteer shifts from jobs | Dropped (extension only) | G |
| Arrange and match pages in Georgian | English only | G |

## 7. Bold ideas kept for later prototypes

Each judge kept one experimental option you can choose instead of, or after, the recommended one:
- **People · Crew sheet:** the Dugout grows into a match-day team sheet with seats for a referee, a physio, a photographer and kit help.
- **Matches · Floodlights clock:** drag a clock hand through the day and every ground with a match under way lights up while the map dims to dusk.
- **Tournaments · The map plays the tournament:** entrants' crests at their clubs and each round's ties as arcs converging on the final's ground, with a replay scrubber.
- **Venues · Every Tuesday:** a season view of the same slot over the next 8 weeks ("Every Tuesday 18:00 at Vake, 8 of 8 weeks free").
- **Creating · Play them:** drag a club pin onto your squad to propose a match, or type one sentence ("U14 v Locomotive, Sat 11:00 at home") that fills the form.

## 8. Backend

Everything is in `BACKEND_NEEDS.md`. Each phase adds what it uncovers under "Round 3 and later", with the screen that needs it. The biggest items for this round: a people directory (`GET /people`), availability for several venues at once, logos and grounds on fixtures, the fuller tournament card, and a referee's area as a centre and radius.
