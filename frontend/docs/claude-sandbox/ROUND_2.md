# Round 2: the owner's review of the overnight redesign

On 10 October 2026 the owner reviewed the sandbox. Many changes stay; some go back to the real app (commit `5f78c0d`, called "the real app" below). This is the brief for round 2. The decisions are also logged in `PRODUCT_MODEL.md` section 13.

## How we work this round

- **Fast and efficient over perfect.** The owner, repeatedly: be fast and efficient; don't write perfect, foolproof code. The sandbox exists to improve the design and the main philosophy behind the app. Hardening comes when a change moves to the real branch.
- **Live and fast.** `.claude/launch.json` starts `sandbox-api` (synthetic API, port 4301) and `web` (real Vite with hot reload, port 5174, `frontend/vite.sandbox.config.ts`). The owner watches the browser pane and critiques each change as it lands. Real map tiles load here; the esbuild sandbox build is only needed for the old viewing copy.
- **Minimal testing while designing.** No per-step test runs, screenshot matrices or review agents. Pages must render without console errors. Run `npm run check` once, before anything is merged into the real branch.
- **One area at a time,** in the order below. Discuss a big area before coding it; small fixes go straight ahead. Ask questions in one short batch.
- **Commit each piece the owner accepts** to `claude/overhaul-sandbox`. No push.
- **"Like the real app"** means the look and behaviour at `5f78c0d`: `git show 5f78c0d:frontend/<path>`.
- The owner's internet is unreliable around 10 October (phone tether). Keep steps short; the app itself runs offline except for map tiles.

## Priority order

1. Top bar and Home (live, with the owner). Role tabs wait for the club model.
2. The club model: what a club is. Validate it with experienced coaches before designing anything that depends on it.
3. My club, My squads (Coach Hub) and Parent Hub (live, with the owner).
4. GrassKickZ World: welcome, overview, directories (can run overnight from this brief).
5. Map and Journeys (with the owner; needs map tiles).
6. Opportunities (needs the safety and money decisions first).
7. Club profile and squad page fixes (small; can slot in anywhere).

This round covers coach, parent and player. Referees, organisers and other user types come later.

## 1. Top bar and Home

The owner's verdict: the redesign's top bar "has crazy good potential"; the real app's Home is much better than the redesign's.

- **Home is 100% feed, exactly like the real app:** post composer, Discover / Following and posts. The left column keeps the profile card with club and Workspace, the Agent Dola card and Your football. The right column keeps Opportunities and Recent contacts.
- **Remove the redesign's "This week / Waiting for you / Announcements" block** (`features/home/`, `HomeTop` in `FeedPage.tsx`). Its content moves into the hubs (section 3): reuse what fits there, delete the rest.
- **Duplicates:** if anything in the side columns then duplicates the new top bar, show it to the owner live; don't decide alone.
- **Top bar: one row, beefier.**
  - Logo and search on the left; the owner wants search close to the logo, left of centre, as in the real app.
  - Tabs in the centre, taller, with bigger icons and labels.
  - Actions on the right: Agent Dola, Inbox (requests and notifications), Messages, avatar.
  - This is the familiar Facebook arrangement (proposed; confirm live).
- **Tabs.** Home and World are fixed. Role tabs are added automatically as default pins: they can be moved and removed. The person's own pins follow after a divider, then "+ Pin". Keep the redesign's pin behaviour; the owner likes it.
- **Role tabs** (on hold until the club model, section 2, is settled; this is the current proposal):

  | Tab | Who gets it | Opens |
  | --- | --- | --- |
  | My club | Staff with a club-wide responsibility (admins, leadership) | The club workspace, with an obvious link to the club page |
  | My club | Players (members who aren't staff) | The club page overview. Latest posts come first, as a horizontal strip with a clear "See all posts" button to the Posts tab. The rest follows, closer to the real app's overview |
  | My squads | Anyone with an approved squad responsibility ("coach" in the broad sense) | Coach Hub |
  | Parent Hub | Anyone with at least one linked child | Parent Hub |

  People with several roles get every tab that applies. Squad-only coaches don't get My club: My squads links to the club page and to the workspace tools they may use.
- **Why "My squads":** experienced coaches the owner showed the app to were confused by "My Club" and responded strongly to "My squads".
- **Later hubs** (referee, organiser) use the same mechanism: one list of who qualifies for which tab. Tab visibility is a convenience; the server decides what anyone may see.

## 2. The club model (settle before sections 3 and 4)

The owner, 10 October: the app has a fundamental misunderstanding of what a club is. It looks right to people who never worked or trained in a club, and confuses people who did. Nothing shows which squads a coach is responsible for, while parents clearly see their children and their children's squads.

The owner, later on 10 October:
- FC Dinamo Tbilisi and FC Dinamo Tbilisi Academy are not unrelated. Anyone should see that the academy is part of the club, or one of its side businesses.
- The pro club wants different things on its page and advertises differently. The academy wants the attention of children and teens, and payment for training.
- Academies are the target audience, but every type of organisation must exist in the app.

The app today, compared with how clubs usually work (coaches to confirm):

| | In the app today | In a real club |
| --- | --- | --- |
| Academy | Its own club page, of kind "Football academy". Linked to the pro club by an affiliation both clubs confirm (backend `ACADEMY_OF`: one parent; no access unless the academy opts in). The link only shows in a side panel, and every kind of club gets the same ten tabs | Part of, or a side business of, the pro club, with a different purpose: the pro club advertises to fans and partners; the academy sells training to children, teens and parents. Some academies are independent |
| Structure | The club, then a flat list of squads | The club, then sections (first team, academy, women, futsal, football school), age groups, teams |
| Teams | A name and an age label ("U14 Boys") | Belong to a season, often named by birth year ("the 2012s"), sometimes several per age group (A/B). They move up every season |
| Staff scope | Whole club, or a list of squads | A team, an age range (GK coach for U12–U16), a section (academy director), or the whole club |
| Roles per person | One: owner, admin, coach or player | Several: plays for the seniors, coaches the U10s, parent of a U12 |
| A coach's own view | A line of role types ("Club administration, Squad coach") | "Head coach of the 2012s; GK coach for U12–U16" |

**Direction (draft, to validate)**
- **Relationships first,** as Parent Hub does: coach, my teams (with my role in each), players, families.
- **My squads opens with "your teams" cards,** the coach's version of Parent Hub's child cards. Each card shows the team (age group and birth year), your role there, the next session, players, and unread messages from families. The same information appears on the staff profile and in the club's staff list.
- **The link shows at the top, not in a side panel.** Under the academy's name: "Academy of FC Dinamo Tbilisi", with the club's crest. On the pro club: "Our academy" as a prominent card. The same goes on every World card and search result.
- **One profile engine, a page per kind:**
  - **Academy** (the target audience) is built to turn a parent into a trial booking. Programmes by age with prices come first; the main button is "Arrange a first visit". Then coaches and their licences, where and when they train, graduates, and what parents say.
  - **Pro club** is built for fans and partners: next match and latest result, first team, news, store, sponsors, and "Our academy".
  - **Community club** is built for joining: teams, when and where, how to join.
  - **Other organisations** (federations, organisers, venues, sponsors) keep their organisation pages.
- **Each organisation keeps its own workspace and staff.** Keep the backend's rule: affiliation alone grants no access.
- **Other parts of a club that advertise differently** (perhaps women's or futsal teams later) can get their own linked page, the way the academy does.
- **Prototype in the sandbox first.** Build it with synthetic data and show it to coaches before changing the real backend. Seasons, sections, scopes and multiple roles are all backend changes.
- **World's Clubs directory isn't blocked.** Kinds, links and programme ages already exist, so parents can filter academies by their child's age.

**Questions for experienced coaches**
1. Sketch your club: which departments does it have (first team, academy, women, futsal, football school), and who leads each?
2. What do you call the group you coach: team, squad, group? By age (U14) or by birth year (2012)?
3. How many teams per age group? Do they have levels (A/B, elite/development)?
4. What happens at the start of a season: who moves up, who decides, and when?
5. Who runs your academy day to day, and what does the pro club decide for it?
6. What does a goalkeeper coach, fitness coach or physio cover: one team, an age range, everyone?
7. Can a player train or play with two teams? Can a coach work for two clubs, or a club and a school?
8. When you open the app in the morning, what do you want to see first?

## 3. My club, My squads (Coach Hub) and Parent Hub

**The owner's notes**
- **Likes:**
  - My club takes staff straight into the workspace.
  - The "coach" umbrella, with responsibilities that hide what you don't need.
  - The workspace overview, which is the quality bar.
- **Wants:**
  - My squads instantly visible.
  - "Coming up" less intimidating: the colours help, but readability and hierarchy don't.
  - Simpler staff management. In the real app it runs staff list, then person, then responsibilities, then a three-step "Change appointment" wizard. Too heavy.
- **Coach Hub is a separate page like Parent Hub.** A coach focuses on themselves and their squads, not the whole club. It needs a strong link to the workspace and to parents (chat, Parent Hub) and players.

**Agreed direction**
- **Access vs focus:** the responsibilities setting only reorders and hides. Access comes only from what a club admin approved. `ResponsibilitiesPanel` already works this way; keep it a rule.
- **What each one is:**
  - The workspace is the club's tools, organised by function.
  - Coach Hub is your day and your squads, organised by time: today, this week, my squads, messages from families, things waiting on you.
  - Parent Hub is the same, organised by child.
- **Hubs own nothing.** Items open the same records the workspace uses. Small actions (attendance, reply, approve) work in place.
- **Coach Hub and Parent Hub are two ends of one pipe.** An announcement sent from one arrives in the other, and a parent's "can't come" lands back with the coach.
- **The redesign's Home content lives here now:** this week, waiting for you, and announcements with read status. Unread announcements show as a badge on the Parent Hub tab.
- **"Coming up":**
  - Group rows by day.
  - Merge rows at the same time, e.g. "4 friendlies · 11:00 · U12, U14 G, U16 G, Youth A".
  - Your squads first, at most five rows.
  - `FixtureRow` in `src/design/primitives.tsx` draws most event lists in the app; fix it there.
- **Squad cards at the top** for anyone who coaches: next session, unread from families, one quick action.
- **Number tiles by responsibility.** Player, staff and trialist counts suit admins, not squad coaches.
- **Appointments on one screen:**
  - Person, then a role template that pre-fills access, then squads, then send. Access details sit under "Adjust access".
  - Current access continues while a change waits for acceptance (the real app pauses it).

**My squads, the coach's own workspace** (decided 11 October)
- **Coach Hub left the club workspace.** The owner: having it there is redundant. My squads (`/my-squads`) is the coach's own workspace, with the same rail as the club workspace: Overview, Updates, Schedule, Players, Coaching team, one page per squad, and the club workspace one link away. Old Coach Hub links open the matching My squads page.
- **Built around a coach's week:** who's coming (replies per session; matches ask, training is opt-out), updates to families with who has read them, players to plan around (restrictions, consent, reviews), and the colleagues and duties on the same squads. Every item opens the same squad spaces and records the club uses.
- **Pictures over words** (11 October): the owner asked for images, visual formats and a real interactive calendar, with everything extremely simplified. My squads now has five pages (Overview, Calendar, Players, Updates, Coaches) and one squad switcher instead of a page per squad. The overview leads with the next session or match (photo, both crests, a countdown and the squad's faces ringed by their answer), then the week as seven columns. Players are cards, Updates a feed with read rings, Coaches faces.
- **Player cards** (11 October): football cards like FIFA's, without ratings. A photo sized for real profile photos (portraits stand in), the shirt number and position code, the club crest, and signs a coach plans around (restriction, consent, review). Who's coming is shown only inside a planned session, never on the player list.
- **One calendar** (11 October): the owner likes the old schedule (week board, calendar, agenda), so it is the calendar everywhere. The duplicate built in this round was deleted.
  - Drag a session to move it. A confirmation shows the old and new time, asks this one / following / all for a series, and says how many families are told.
  - Click an empty slot to plan.
  - Entries at the same time sit side by side.
  - Colours and symbols are the activity ones.
- **The squad room folded into My squads** (11 October): it was a page cut off from everything. Coaches opening `/squads/{id}` land on the matching My squads page, and its own parts moved there:
  - Coaches: the head coach of each squad.
  - Updates: chat notifications, deleting your own posts, reactions and comments.
  - Players: joining requests.
  - Families keep their squad room.
- **Work never leaves the page** (11 October; the owner: "I can't have a very useful page which just forces you away with every button").
  - A player's tools, "View all" and records open in a drawer that slides in from the left and fills the space up to the player sheet, instead of jumping to the club workspace.
  - It is the same club tool, filtered to that player, with its search, filters and open record in the URL under `tool.`.
  - Escape closes the drawer first, then the sheet. Unsaved records still ask before closing.
  - The public profile opens in a new tab.
  - Built into the shared player sheet, so My squads and the club workspace's squads both have it.
- **Responsibilities:** asking for another one is one short form in a dialog on Coaches; the "tools first" switches moved to All tools in the club workspace, because they only order that workspace's rail.

**A parent who is also staff** (decided 10 October, delegated by the owner)
- **One account, many roles.** Being a parent is a relationship (a linked child), not an account type. Parent Hub appears for anyone with a linked child, whatever they registered as; the registration answer only shapes the first experience.
- **Don't block parents from clubs or ask for two accounts.** Parent-coaches are a large part of grassroots football.
- **The one-club rule covers membership and staff roles, not being a guardian.**
- **No echo:** someone who sends an announcement as a coach doesn't receive it again as a parent.

## 4. GrassKickZ World

**The owner's notes**
- **Likes:**
  - The secondary navigation under the top bar.
  - The map block on the overview.
  - The lower part of the overview: club cards, open for entries, opportunities, people to know. The overview should be more of that, with the most important and prettiest things first.
- **Dislikes:** the top of the overview was "instantly too much" and boring. People glance for seconds and move to the tabs, so it must impress.
- **Wants:** a welcome on first entry, a mini landing page that tells you what to expect.
- **Directories** (Clubs, People, Venues, Matches, Competitions, Opportunities) all look different, and all look bad.
  - Stronger filters: country and city on top, plus autocomplete name search.
  - Each directory serves different people and needs its own care.
  - Venues are mostly rented by clubs for training; matches are usually at the club's own ground.

**Proposed** (the welcome's format is still open, see below)
- **Welcome as one question:** "What are you looking for?" (a club for my child, a team, a job, a match, a pitch). It takes you straight there and sets your default World tab. Skippable and reopenable.
- **One location for all of World,** set once and used by every tab. When an area has little data, fall back to a wider radius or the whole country.
- **Overview order depends on who's looking:** a parent sees clubs with trials for the child's age first; a coach sees matches, referees and pitches.
- **Filters per directory:**
  - Clubs: age group, girls/boys, level, open trials, price, training days.
  - People: role, licence, availability, verified, language. No under-18s; at most guardian-approved minimal details.
  - Venues: surface, size (5v5 to 11v11), indoor, lights, free slots, price per hour.
  - Matches: age group, competition, date, teams looking for a match.
  - Competitions: age, format, entry deadline, fee.
- **If built overnight:** make two overview versions behind a switch, so the owner picks.

**Overview: the person's own page, by role** (11 October; the owner: "uselessly lot of lists"; every user type, and every kind of coach, wants different things).
- **One header row:** title, search (its results drop down over the page), the area and Customize. The big search band and the shortcut chips are gone: the top bar already searches, and each role's fields link into the directories.
- **The map is the hero** (the owner: it should feel luxurious and look more massive than it is): it runs the page's width and fills the first screen. The open field floats over its right side as a compact glass panel; its counts and "Open full map" float on it as glass chips (no footer bar). A vignette, soft shadows and slow motion give it depth: the map eases in, the panel slides in, clubs pulse, fields rise in as you scroll and their photos drift closer on hover; all of it stops for reduced motion. The person's other fields follow under "For you as a …"; lists share rows, club cards take a row of their own.
- **The field over the map folds:** a click on its header folds it to the header so the whole map shows, and unfolds it again (kept in the URL, `panel=folded`).
- **Lists in the score-site shape** (the owner: "familiarity needs to be everywhere we can have", like Flashscore):
  - Matches under a header per competition or day: the time on the left, the two teams stacked with crests, the score on the right ("–" before kick-off), one quiet tag.
  - Results show "FT" with the winner in bold.
  - Teams looking for a match read as a fixture with "Opponent wanted".
  - Competitions, trials and pitches are single lines with one fact on the right; competitions are grouped by age, with the closing date in amber when it is within a week.
  - Clubs are lines in columns, each with a star to follow (the real follow).
- **Choose who you are** (Customize, then Save): 16 roles in four groups.
  - **Coaching staff:** head coach, assistant coach, goalkeeper coach, fitness coach, analyst or scout, team manager, academy director.
  - **At a club:** club administrator, physio or specialist.
  - **Families and players:** parent, player.
  - **Around the game:** referee, fan or supporter, agent, competition organiser, pitch or venue operator.
  - Each role decides the page you start with (a field beside the map and four to six below) and the fields offered first. Every other field stays one click away under "Every other field".
  - The page behind shows the draft; Save keeps it, Cancel goes back. Until someone saves, the role follows their relationships (coaching, a chosen child, playing for a club).
- **21 fields,** all from data the app already serves:
  - **Matches:** teams looking for a match, matches near you, matches that need a referee, open for entries, competitions on now, latest results, your match arrangements.
  - **People:** people to know, referees, specialists.
  - **Clubs and places:** clubs near you, academies, clubs taking new players, places to train (for the chosen child), pitches to hire.
  - **Opportunities:** open trials, jobs and volunteering, coaching jobs, jobs off the pitch, volunteering, support a club (fundraisers).
- The page is kept per browser for now (backend needed: a per-person preference).

**Coaches' World, built for what they selfishly want** (11 October; the owner: "think selfishly as a coach", and coaches use World as much as My squads once the flow gets going; chores stay in My squads, linked).
- **The score column is fixed:** the score is always the last column, so the dashes line up whatever the tag says.
- **Everything follows the coach's squads.**
  - Squads come from the ones they manage; an academy director sees the whole club's.
  - "For: All squads · U14 Boys · U16 Boys" in the header narrows every field to one squad (`for` in the URL).
  - The subtitle says who the page is for ("For U14 Boys and U16 Boys, near Tbilisi").
  - Signed out, or with no squad, each field says so once, with a way forward.
- **A new group, "Your squads",** first in Customize:
  - **Your next opponent:** a match header (date, both crests), then their form as W/D/L squares, goals, and when you last met. The goalkeeper coach reads goals first; the analyst gets five results.
    - Form comes from their squad, or from their club's teams of the same age and gender, and says which.
    - A proposed, disputed or missing score is never a result, and never a draw.
  - **Your squads' matches:** the last two results and next three; a played match without a result says "No result yet" in amber.
  - **Match load:** two weeks per squad as day cells. Under 72 hours' rest, or a third match in a week, gets a warning ring and a note; each coming match shows the rest before it.
  - **Watch them before you play:** your next opponents' other matches before they meet you.
  - **Invitations to play:** one waiting list: requests to answer first (red within three days), then offers on your listings, then listings still waiting. Answering stays on the match page.
  - **Opponents for your squads:** other clubs' open listings for your ages and genders within 50 km, as "their squad vs yours". "You play that day" warns of a clash.
  - **Referees for your matches:** your listings still needing a referee, then referees who take those formats: local first, then volunteers, then the cheapest.
  - **Your competitions:** the table around your row (places that go through marked), the cup run ("Quarter-final W 3–1 · Semi-final W 3–1 · Final Sat 17"), or the festival day, then your next match in it.
  - **Results in your competitions,** **Competitions for your age groups** (invitations first, gender-checked, those you are in left out) and **Trials in your age groups** (other clubs').
- **Free pitches this week** (and **Indoor**): free evening slots (17:00–21:00) at the four nearest venues, for pitches at most one size smaller than your smallest side. Each chip opens the venue's calendar on that slot; 60 or 90 minutes is kept in the URL (`slot`).
- **From the clubs** (the owner chose a labelled rail over ads):
  - one row of tiles, always labelled "Club shop", "Fundraiser" or "Sponsor of …";
  - your own and followed clubs come first, then the newest, the ending soonest, the biggest;
  - at most two products per club and two sponsors in all;
  - never paid placement; unpublished, blocked or restricted sponsors are never shown; sponsor links are marked `sponsored`.
- **The seven coaching pages:**
  - Head coach: next opponent beside the map; invitations, competitions, opponents, free pitches, referees.
  - Assistant coach: next opponent; squads' matches, watch them, competition results, free pitches, coaching jobs.
  - Goalkeeper coach: next opponent (goals first); indoor pitches, match load, trials in your ages, coaching jobs.
  - Fitness coach: match load; free and indoor pitches, squads' matches, specialists.
  - Analyst or scout: next opponent (five results); watch them, competition results, your competitions, trials, competitions on now.
  - Team manager: invitations; referees, free pitches, squads' matches, arrangements, competitions to enter.
  - Academy director: your competitions (the whole club); competitions to enter, results, coaching jobs, trials, academies.
  - Every page ends with From the clubs. Jobs and specialists list what suits the role first (keepers for the goalkeeper coach), without hiding the rest.
- The field beside the map is as tall as its content (up to the map's height), so a short list shows more map. Lists below sit three to a row on a full-HD screen.
- Saved pages from before start again from the new role pages (`gk-world-overview:v2`).

**The World tabs, built the same way** (11 October; the owner: "the map should stay in every single tab in World", the results stay big and useful, the map closes to use the tab as a directory).
- **Agreed for later:** the Map tab becomes a planning workspace. It is not designed yet.
- **The recipe** for every World page is written in `WORLD_RECIPE.md`.
- **One World bar:** "For" and "Near" sit beside the tabs on every World page.
  - **For:** the coach's squads on the overview; a parent's child on the overview, Clubs and Opportunities.
  - **Near:** the area, or Anywhere.
  - The overview header kept its title, search and Customize. Choices follow the person between tabs.
- **The map on top of every tab,** in the overview's glass look:
  - **Pins:** the results on screen are its pins, one to one. Results at one place share a pin with a count. A result placed at its club is a ring, and the count says how many have no place.
  - **Linking:** hovering a card lights its pin and the other way round; a pin's card offers "Show in list".
  - **Folding:** it folds to a slim strip and the choice is remembered (`map=open|closed`; phones start folded). The List / List + map / Map switch is gone, and old `view=` links open the map.
  - **Moving it:** moved over another city, the map offers "Search Rustavi".
- **Defaults by role:** a tab opened without filters starts on the likely answer for who is looking, as ordinary chips that Clear removes. A link's own filters always win.
- **One frame for every World page** (11 October; the owner: tabs must not "jump up and down", no forced return to the top, and "the same map as we have in overview everywhere"):
  - **The header row:** the title (and a short subtitle), the page's lists as a small segmented row, the search, the filters and the page's actions, on one line at full HD.
  - **Filters are pills that show their value** ("Upcoming", "Academies +1"). Choices open in a small glass panel over the map, so nothing below moves. More filters opens a larger panel. Clear filters sits at the end.
  - **One map for all of World.** The overview's map stays alive from tab to tab and only its pins change, so it never reloads. The World bar and the header keep the same height on every tab, so the map never moves, and switching tabs keeps the scroll position.
  - **Browse area:** a glass panel over the map's right side, as on the full map. It shows the count, the sort and the results as score-site lines linked to their pins: pointing at either lights the other, and choosing a pin brings its line into view. It folds to its header. On a phone, or with the map folded, the count and the sort sit above the results.
  - **Every list is on the map:**
    - Clubs, venues, open matches, arrangements and places to train are placed by their own coordinates.
    - People are counted on their club's pin, never named on the map.
    - Fixtures use their match (checked against their clubs), else the competition's ground, else the home club.
    - Events use their match, competition or trial; a club's training is placed at the club.
    - Competitions, organisers that are clubs, invitations, jobs (counted per club) and trials are placed too.
    - Anything placed at its club is a ring, and anything without a place is counted.
    - Referees stay off the map for now (see Before release).
  - "Arrange a match" uses the same header.
  - **Kept on purpose:** pages with nothing to pin ("Arrange a match", My reservations) still show the map, so nothing jumps between tabs. They should get pins of their own (the opponents near you, the reserved venues).
  - **Header sizes:** one line at full HD, two fixed lines on laptops (1100–1599px), so every tab keeps the same height.
- **Clubs:**
  - It lists clubs near the area. "Anywhere" lists them all, and an empty area offers "Search everywhere".
  - Four kinds: Academies, Football schools, Community clubs, Pro clubs.
  - "Taking new players" is a chip; the detailed way to join sits under More filters.
  - The child comes from the World bar.
  - **Cards** show "Academy of FC Dinamo Tbilisi" / "Academy: …", the distance, and for coaching staff "Propose a match" (never on their own club).
  - **Defaults:** a player opens on "Taking new players"; an academy director, analyst or agent on Academies.

## 5. Map and Journeys

**The owner's notes**
- **The redesign's map panel is "by far the worst page".** It shows 34 places at once, with no thought about how, where or when they should appear.
- **Keep the real app's map,** which is better in almost everything:
  - it asks first what you're looking for ("What brings you here?");
  - you search from a starting location;
  - it has a results panel and the Map / Globe / Tilted modes.
- **Journeys ("Plan journey" from a fixture) is one of the best ideas.** It's for everyday away days, not just trips abroad. Make it at least ten times better: map format, filters, layout.

**Proposed**
- **Fix the real map's clutter:** two results panels, raw coordinates shown to users (41.71000, 44.82000), four separate control areas.
- **Where journeys live:** they're created from the fixture (My squads, schedule) and shown to families in Parent Hub. The map displays them. World's map keeps "plan a journey to here".
- **What would make it ten times better:**
  - departure time worked out from kick-off and the route;
  - meeting point, and who travels (players, staff, drivers), with seats;
  - kit list, and consent where needed;
  - "same as last time" for venues you visit again;
  - on the day, simple check-ins: "left 08:35", "arrived".
- **Track the trip, not children:** coach or driver check-ins, or the driver's location shared only for the trip. Only approved adults drive.

## 6. Opportunities

**The owner's notes**
- Store is clear.
- Venues (stadiums) leave Opportunities.
- Campaigns and jobs & volunteering (wrongly called "roles" in places) are club-only today. Parents and players need them too: a personal coach for a child, a fundraiser for a broken hand.
- Everyone creates, browses and uses them. Referees find jobs, and clubs find referees.

**Proposed**
- **One kind of listing:** a direction (Looking for / Offering), a category, paid or unpaid, place, dates, an expiry date and a "filled" state.
- **Verification** for people offering services to children.
- **Individual fundraisers come later,** behind identity checks and payout rules. A child's medical story isn't public by default.

## 7. Club profile and squad page

- **Keep "Propose a match"**; the owner calls it one of the best changes.
- **No schedule on the club profile** (11 October; the owner: schedule work belongs somewhere more appropriate). The club calendar is now Calendar in the club workspace, after Overview; coaches plan in My squads. The profile keeps "Coming up" on its overview and each squad's training times on its Teams & training page. Old `/calendar?clubId=` links open the workspace calendar; an old `?tab=schedule` link opens the profile overview.
- **The squad page** (Teams & training, then a squad) is too long and busy. Its readers are outsiders, mostly parents deciding whether to join.
  - The first screen answers: who it's for, when and where, who coaches, cost, how to join.
  - One main button ("Arrange a first visit") and one secondary.
  - Replace the empty week grid with a line such as "Trains Tue & Thu 18:00".
  - Merge the three info boxes into one short "What to expect".

## Across the app

- **Children's safety:**
  - no private one-to-one messages between an adult and an unrelated child;
  - limit what's public about a child;
  - control who can contact children through opportunities.
- **Notifications in three levels:** urgent (cancellations, time changes, journey updates), normal (announcements), and a digest for social activity.
- **Phones first for parents and players** (hubs, journeys). The workspace can stay desktop-first.
- **"Player" is three people:**
  - a child, whose parent runs everything;
  - a teen, with their own account and a linked guardian;
  - an adult.
- **Georgian labels are longer.** The beefier top bar must fit them.
- **Lists (10 Oct):** every record list follows one pattern (`design/DataTable.tsx`), better than both the old GrassKickZ tables and the first sandbox lists:
  - views with counts, then one toolbar (search, filter pills showing their value, Clear filters, result count);
  - a table with sortable column headers; status as a dot and a word; dates in words ("3 days overdue", "Tomorrow");
  - open work grouped by urgency (Overdue, Today, Next 7 days, Later, No date), finished records last;
  - the next step stays in view, quieter actions appear on hover, rarer and destructive ones (release, status changes) open under the row;
  - view, search, filters, sort and page live in the URL, so server-side querying plugs in later.
  - Built here on the Work queue, every operations tool and Players. The other lists follow when this branch moves to the real app ("Before release" below).

- **Landing and schedule colours restored** (11 October; the owner: both were "caught in the fire" of the global colour change).
  - The 8 October rewrite (`f9037e3`) had swapped every hex colour for a theme token, and many swaps inverted roles: dark veils became the text colour (grey slabs), glows became black, gold became sand, the grid's hairlines nearly vanished, and the month view's quiet days became light-grey slabs.
  - **Landing:** the six stylesheets are back to their 26 September colours (`82d6c8c`), keeping the 10 October map. It is a fixed dark scene, so the colour guard now treats its stylesheets as art, like `visualColors.ts`.
  - **Schedule:** its original dark paint is declared on the engine's own roots in `styles/theme.css`: near-black neutral surfaces, a lighter board with visible hairlines, a three-step text hierarchy, and pink, purple and green accents. Token fixes cover the light theme and the event editor's selected states. The activity colours (matches green, training blue) stay.

## Before release (do it in the real branch, not here)

This branch is the real frontend code on fake data, so what is built here ships after hardening. The owner is fine making changes, rollouts included, right away (11 October); this list keeps what is still to do so nothing is forgotten when the branch moves into the real app.

- **Every workspace list as a table** ("Lists" under Across the app):
  - Full lists still on the old look: Staff (`ClubStaffTeam`, unless the one-screen staff work in section 3 redoes it here first), staff invitations (`ManagementInvites`), Club updates (`InboxTab`), Staff roles (`RolesTab`), Joining (`ClubAdmissionWorkspace`), Applications, Tryouts, Jobs & volunteering (`OpenRolesPage`, `RoleApplicants`), Store, Fundraising (`ClubCampaignsPage`), Player cards, Squads (`WorkspaceSquads`) and the squad roster.
  - Previews that open a full list speak the same row language and link to it: Needs you (My club, to the Work queue), players needing attention (My squads), staff appointments needing attention (Work queue), and the record sections of the player panel.
- **Tests:** run `npm run check` and fix it.
  - The squad-focus test in `WorkspacePolish.test.tsx` fails because My club dropped its squad chips. Bring a squad focus back, or drop the test.
  - Tests from earlier rounds that already fail:
    - `ClubWorkspacePage.requests`: its i18n mock lacks `resolvedLanguage`.
    - `ExperienceRoutes`: `/tryouts` now opens World `?tab=trials`.
    - `jobs` and `jobs-presentation`: the Opportunities list.
    - `TournamentOrganizationFlow`.
    - `ClubOverview`: "Open calendar".
    - `clubProfile`: ways to get involved.
    - `WorkspaceShell`: the phone menu button.
    - `world/people`: "does not fall back on other errors" (seen 11 October).
- **Backend:** the records query (`/workspace-roles/work`) should take `sort` and `dir` and return a total. Until then the table sorts only the loaded page and record views show no counts.
- **My squads:** Georgian copy for its new pages (written in English for now); tests for its pages; unused `coachHub` locale keys removed. Squad sessions should report friendlies as `FRIENDLY` (the sandbox marks them in the description).
- **One calendar everywhere:**
  - The personal schedule (`ScheduleBoard`, the profile's Schedule tab) still uses the older board. Move it onto the shared calendar like My squads and the club workspace.
  - Dragging club events needs the club event API; only squad sessions move today.
  - Changing the end time by resizing is not supported yet.
  - Initials avatars now take soft colours app-wide; check the screens that relied on grey ones.
- **World overview:** save each person's field layout on the server (today it is per browser); Georgian copy for the new fields (about 180 strings from the overview fields and Customize still have none; the World stage, map and directory strings do).
  - Tests still to write: role defaults (written once, never over a link's filters, never again on Back).
  - **Backend parameters the coach fields need:**
    - squad ids on tournament invitations (matched by squad name today);
    - gender on match-exchange listings (read from the squad name today);
    - a time zone on tournament fixture times (read as Georgian time today);
    - availability for several venues in one request (four requests today);
    - a squad's format (taken from its age group today).
  - **Check with the coaches:** the 72-hour and three-in-a-week rest rules, and the evening window (17:00–21:00) for free pitches.
  - **Sponsors:** confirm `promotionBlocked` covers every restricted category before the rail goes live.
- **World tabs, backend parameters:**
  - `/clubs`: coordinates on directory clubs (until then the map search places them), `near` with a distance sort, boys/girls, a fee ceiling.
  - `/people`: `isFollowedByMe`, a viewer-is-a-minor flag.
  - `/venues`: amenities, availability for several venues in one request.
  - `/match-history`: area, ground coordinates, club logos.
  - Listings: `refereeNeeded`.
  - `/competitions`: several age groups at once, structured gender, a radius in the sandbox.
  - `/tryouts/discovery`: age group, gender, position.
  - `/jobs`: filtering and paging on the server.
  - Parent Hub children: their squad ids.
  - Also: `city[]` is sent with brackets and the server ignores it; MATCH markers mix two id spaces (check the club); the places lookup is capped at 400 per kind.
  - **Referees on the map** (the owner wants "who is available nearby" soon): referees need a service area the map can draw, such as a centre and radius, instead of free text.
  - People, Venues, Matches, Competitions and Opportunities do not follow Near yet (their own steps). Their old City, Place and "Near me" filters go then.
  - The overview and the tabs share the World stage. A detail page (a club, a venue) could take the same map later.
- **Injuries** (`SCENARIOS.md`): the backend pieces listed there, starting with an injury report record.
- **Colours after the restore:**
  - Check the schedule in the light theme (only its tokens were fixed there).
  - Decide whether the landing's literal palette should become named tokens; today it is exempt from the colour guard.
  - Other screens converted by the same rewrite may hide the same inversions (a text colour used as a background, black glows); look for `color-mix` over `--color-ink`, `--color-shadow` and `--color-muted` used as fills.

## Open questions

- **Previews of a list** (proposed): the first rows of the same table in the same words (a dot and the status, "3 days overdue"), each row opening the same record, and one link at the bottom naming the list and what is left ("Open work queue · 46 more") instead of a link in the heading and another at the bottom.

- **Injuries:** the questions in `SCENARIOS.md` (medical lead, insurance, calling parents, the age a player sees their own plan, how long to keep reports).
- **World welcome:** one question (proposed) or an explanatory pop-up?
- **Journeys:** managed from fixtures and My squads, with the map as the view (proposed)?
- **Individual fundraisers:** now, or after jobs and requests?
