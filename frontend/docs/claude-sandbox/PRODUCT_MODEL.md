# GrassKickZ product model

Status: **draft for owner review**, started 9 October 2026 from the owner's overhaul brief. This is the north star for the redesign. Every UI or structural change should fit it; when it doesn't, change this document first. Decisions are recorded at the bottom.

## 1. What we are building

One place where everyone in football can do their own job without being shown everyone else's. A parent finds a good club and stays informed without digging through 100 WhatsApp messages. A coach runs their squads. A player keeps their schedule, chooses trips and shares highlights. A casual user can treat GrassKickZ as a simple football social network and never meet the tools.

People who invest in the workspace are rewarded: everything they currently track across dashboards, Excel, the calendar on the wall, Facebook groups and WhatsApp chats lives in one place, and the app does the repetitive work for them.

The founders benchmark is SAP as German clubs use it: one connected system for people, roles, seasons and processes. GrassKickZ matches that depth underneath, with a consumer-simple surface on top. SAP is powerful and confusing; GrassKickZ is powerful and obvious. The social side is the other half of the same system: the workspace produces the content (results, schedules, squad news), and the social side brings the people who make the workspace worth using.

## 2. Principles

1. **Built around what people came to do, not around features.** Each screen answers "what does this person need right now?"
2. **Complexity is hidden, never removed.** Simple by default; depth one click away, in a predictable place.
3. **Every level is useful on its own.** Nobody needs advanced tools to use a basic feature.
   - Social: feed, follow, profile, World
   - Member: my club, my squad, schedule, announcements
   - Staff: club workspace, focused on my responsibilities
   - Power: Coach Hub, templates, automation, Agent Dola
4. **Features appear where the need arises.** "Create a training session" lives in an empty squad schedule, not in a global menu.
5. **Every empty state shows the one next action.**
6. **The app does the bookkeeping.** Defaults, templates, recurrence and reminders instead of manual entry. If a person types the same thing twice, that's a bug. Every answer narrows the next question, and the most likely answer is already chosen: inviting a club starts at your own ground, because clubs almost always host at home; choosing to host shows only your facilities.
7. **Every action is Dola-ready.** Actions are structured operations with clear inputs, so Agent Dola can perform them on a person's behalf (see section 10). Dola works like the agents now built into admin dashboards: it uses the same actions as the screens, within the person's permissions, shows a preview before it changes anything, and its name stays in the history ("done by Dola for Luka").
8. **One place per destination.** A destination appears once in the navigation; personal shortcuts are pins, chosen by the person.
9. **SAP depth, consumer surface.** Underneath: one record per person with many roles, positions with dates, seasons, every process a record with a status, approvals and history, one inbox, no double entry. On top: plain football words and actions. Nobody ever sees the data model.
10. **One pattern everywhere.** Every record works the same way: a list, the record with its status in words, the one next action, and its history. Learn it once, use it everywhere.
11. **Learning pays off at the moment it would help.** When someone repeats work, the app offers the power tool right there ("You have added Tuesday training four times: make it weekly?"). Bulk actions, templates, saved views, automation and Dola reward people who go deeper without cluttering the simple path.
12. **Safe to explore.** Previews before big changes ("this moves 12 players to U15 next season"), undo, drafts and history, so nobody is afraid to try.
13. **Measured, not argued.** A new coach does a first real task in under a minute without help. A parent can do everything from a notification. A club admin rolls a season over in ten minutes.

## 3. The four places

| Place | Purpose | Who sees it |
| --- | --- | --- |
| **Home** | The social feed, exactly like the real app ("this week" and announcements live in the hubs) | Everyone |
| **World** | Discovery and public football: directories, map, matches, tournaments, opportunities | Everyone; works signed-out *(decision pending)* |
| **My Club** | My club's private side: squads, schedule, workspace tools for staff | Club members and staff |
| **Me** (avatar) | Profile, personal schedule, children, settings | Everyone |

### Navigation

- Fixed tabs: **Home · World**. Role tabs (**My club**, **My squads**, **Parent Hub**) arrive as default pins for the people they apply to (section 13, `ROUND_2.md` section 1). Matches & Competitions is not a tab: discovery moves to World, the club's own matches to My Club.
- Right side: search, Agent Dola, **Inbox** (requests and notifications merged into "things that need you"), Messages, avatar.
- Removed: My work (deleted), Shortcuts (replaced by pins), Schedule tab (moves to profile and club), the duplicate Agent Dola, Parent Hub and schedule entries on Home's left rail.
- **Pins:** a person can pin a squad, a child, Coach Hub, a tournament or a saved World search as extra tabs. The app suggests pins from usage but never adds them on its own. Around five pins, then an overflow menu. Same model as the workspace overview shortcuts, so build it once and use it in both places.
- One header row; bigger tabs with icon and label, at least 44px.

## 4. GrassKickZ World

The public football layer: as big as, or bigger than, the rest of the app.

- **World front page:** personalised. Clubs near you with open trials, matches this weekend nearby, opportunities that fit your profile, new tournaments. The map is one block on the page, not the whole page.
- **Directories:** Clubs, People (players, coaches and specialists, referees, agents, scouts, professionals), Venues, Matches & results, Tournaments, Opportunities.
- **One directory engine** for all of them: search, filters, cards, and a view switch of list / list + map / full map. The current full-screen map becomes the "full map" view. This replaces today's separate map, club directory and venue implementations.
- **Saved searches with alerts**, for example "tell me when a U10 academy within 5 km opens trials."
- **Discovery leads to action.** Find a referee → request them. Find a club → apply or ask for a trial. Find a club → propose a match. The follow-up lands in My Club or the Inbox.

## 5. People, roles and profiles

Three separate layers, which the app must never blur:

1. **What you do in football** (roles): player, coach, referee, agent, scout, parent, fan, club or organization staff. Several at once. Change them any time. Adding a role adds profile sections and suggestions; it never grants permissions.
2. **What you are professionally** (skills and professions): free text first ("sports psychiatrist", "physiotherapist", "video analyst", "photographer"). Admins, and later Dola, map free text to searchable labels. Experience, qualifications and an "about me", similar to LinkedIn.
3. **What is verified:** self-reported versus confirmed by a club, an organization or a document. Always shown differently. Never invented.

Permissions inside a club are a fourth thing, granted by club leadership, never by choosing a role.

### Registration

- Minimal sign-up: name, email or Google, and **"what brings you here?"** (multi-choice: find a club for my child, I play, I coach, I referee, I work in football, I follow football).
- The answer sets the starting Home, the suggested pins and which profile sections are offered. It does not lock anything.
- The profile grows over time through prompts at the right moment, for example "add your coaching licence" when applying to a coaching role.
- LinkedIn: official API access is limited, so the realistic route is importing the profile PDF that LinkedIn lets people export, parsed into experience entries the person confirms.
- People and professionals become searchable in the World People directory, and are matched to Opportunities by role, profession, location and verification.

## 6. Clubs

- **One club per person** *(strictness pending, see decisions)*. The UI always says "My Club", never "My Clubs". Children each have their own club. Referees belong to associations, not clubs. Needs a backend rule, a transfer flow (leave one club, join another) and a plan for existing users in several clubs. The club switcher goes.
- **Club profile overview:** a newcomer should immediately see the club's posts and a clear Follow / Join action, like a page they recognise from Facebook. Details such as programmes, venues and staff come after.
- **Club schedule:** each squad has its own schedule; the club schedule combines them.
- **Programmes, fees and venues** are club business, not "settings". Settings holds configuration only.

## 7. Club workspace, responsibilities and Coach Hub

The workspace is the strongest part of the product today. Keep its structure and fix its finish.

- **Everyone on the staff is a coach** in the broad sense: head coach, nutritionist, fitness coach, analyst, goalkeeper coach. Each specialty has its own tools.
- **Responsibilities decide what you see.** A staff member picks the responsibilities they take on, and the workspace shows those tools first; everything else stays reachable but out of the way. The current version of this is weak; the idea is right.
- **Coach Hub is the personal view of the workspace,** not a separate product: my squads, my responsibilities, today's sessions, attendance, my players' notes, my announcements. The club workspace is the club-wide view for leadership and admins. Both use the same tools.
- **Workspace pins** (the existing overview shortcuts) and **top navigation pins** are the same feature.
- Specialties grow with partners. Example: an analyst role gains video tools if a camera partner such as Veo comes on board.
- **Finish problems to fix across the workspace:** unstyled panels (for example the squad age-eligibility block renders as plain white text), multi-step wizards for simple records (a staff duty doesn't need three steps), dense settings walls with tiny text, and work screens using marketing copy.

## 8. Matches

Two different jobs, kept separate:

1. **Arrange a match** (direct): I know who I want to play.
   - Search the opponent club with autocomplete, then pick their squad.
   - Our squad is prefilled when it's obvious.
   - Time, with a default duration from the age group's format.
   - Ground: our own venues (from the club's venue relationships), their venue, another venue from the map, or "to be arranged".
   - Referee: optional; "later" by default, or invite one or ask referees nearby as the match is sent (round 3, decision 6).
   - One short form, not a three-step wizard.
2. **Match Exchange** (open listing): "we need an opponent for this slot." Other squads propose; we choose.

**Renting a stadium is not part of match creation.** Rented stadiums are for training. Remove "Find and book a stadium" from the match flow. Once a match exists, its page may use a reservation the club already holds (link one at the match's ground, or the host moves the match to a reserved ground); creating a match never books (owner, round 3, decision 7).

Discovery of fixtures, results and tournaments lives in World; the club's own matches in My Club.

## 9. Schedule, attendance and announcements

- **Attendance is opt-out by default.** Players are assumed to be coming. A parent or player taps "can't come" when needed.
- **Coaches turn on confirmation only where it matters:** matches, trips, events with limited places. Only then do people get asked, and the coach sees an availability summary.
- No more walls of "No reply yet" dropdowns on every training session.
- **Announcements are separate from chat.** A coach marks a message as an announcement; it appears on parents' and players' Home and the squad page, stays pinned until it expires, and the coach can see who has read it.
- **Home shows "This week":** my sessions and matches, my children's, and anything waiting for me.

## 10. Agent Dola

Dola is meant to become the hero of the app by automating everyday work and helping people decide. To make that possible, every feature is built so Dola can drive it:

- Actions are structured operations with clear inputs, permission checks and results, not logic buried inside a page.
- Dola works under the person's own permissions; it never gains access the person doesn't have.
- Early candidates: build the week's training schedule from a template, chase missing match confirmations, draft announcements, find and propose opponents, fill in a match report.

## 11. Opportunities

Jobs, trials, volunteering and services, posted by clubs, organizations and individuals. Matched to people through roles, professions, location and verification (section 5). Lives in World. Detailed design is a separate conversation.

## 12. Build order

Round 2 (from 10 October) follows the order in `ROUND_2.md`. The list below is the original plan.

Each step: proposal and mockup → owner decision → build plan → small slices → old code deleted in the same change.

0. Quick wins: delete My work; hide demo markers from user-facing content; remove the duplicate Agent Dola card.
1. Design foundation: tokens and shared components (page header, context nav, card, empty/error/loading state, form field). Fixes unstyled panels everywhere.
2. Navigation shell with pins, and the World front page with the shared directory engine.
3. Home: "This week" and announcements; schedule moved to profile and club; opt-out attendance.
4. Matches: direct "Arrange a match"; booking removed from match creation.
5. Registration, roles and profiles; People directory.
6. Clubs: the one-club rule and transfers; club profile overview.
7. Workspace polish, responsibilities and Coach Hub.
8. Opportunities.
9. Automation and Dola pass.

## 13. Decisions

### Open

1. **One club per person:** strictly one, or one per football role (a coach at two academies, a player at a club and a school)?
2. **World without sign-in:** public front door for the open demo and search engines?
3. **What a club is:** sections, academies, seasons, staff scopes, several roles per person, and what My club opens for each person. Validate with experienced coaches first (`ROUND_2.md` section 2).

### Made (9 October 2026, owner)

- GrassKickZ World becomes a major part of the app: directories, map, matches, tournaments and opportunities for discovery and work.
- Top navigation shrinks to 3–4 default tabs with bigger icons and labels, plus personal pins.
- My work is removed.
- Schedule moves to personal profile and club profile; each squad has a schedule and the club has a combined one.
- One club per person; the UI says "My Club" (strictness open).
- Renting a stadium is for training only and is removed from match creation.
- Match creation lets the club pick its own venues and search the opponent club with autocomplete, separate from Match Exchange.
- People can change roles; professions are free text, labelled later and searchable.

### Made (10 October 2026, owner's review of the sandbox; brief in `ROUND_2.md`)

These replace the older lines above and in sections 3, 7 and 12 where they disagree.

- **Home** stays 100% feed, exactly like the real app. The "This week / Waiting for you / Announcements" block moves into the hubs.
- **Top bar:** the redesign's one-row bar with pins, made beefier, with search beside the logo. Matches & Competitions is not a tab.
- **Tabs:** Home and World are fixed. Role tabs come as default pins for the people they apply to:
  - My squads: opens Coach Hub, for coaches.
  - Parent Hub: for anyone with a linked child.
  - Later hubs (referee, organiser) follow the same rule.
  - What **My club** is and opens is on hold until the club model is settled (Open, item 3).
- **Coach Hub** is a separate page like Parent Hub, labelled "My squads". Experienced coaches found "My Club" confusing and responded to "My squads". It owns no tools or data; its items open the workspace's records.
- **One account, many roles.** Parent Hub follows a linked child, not the registration choice. Parents may be club members and staff. The one-club rule covers membership and staff roles, not being a guardian.
- **Map:** keep the real app's map, and drop the redesign's map panel. Journeys stay and become much stronger.
- **"Propose a match"** stays.
- **Opportunities** are open to everyone (clubs, parents, players) and work in both directions. Venues move out of Opportunities.

### Made (10 October 2026, World review sprint, under the owner's delegation)

- The club's own match work (arrangements, competitions it runs or enters, invitations to enter, results still needed, adding a past match) belongs to My Club. Until My Club has its own home for it, it stays reachable as World tabs, and the club workspace links to it (All tools › Club matches). Discovery stays in World.
- World is bilingual like the rest of the app: every World string has a Georgian translation (`features/world/copy.ka.ts`).
- A parent searches World for a child: the chosen child follows them across World pages (and Parent Hub), clubs show which programmes fit the child's age, and club actions ask the club through its enquiry for that child instead of joining the parent.


### Made (13 October 2026, owner, after the founders' briefing)

- **The new version is the work** (decided 14 October, replacing "main app first"). The deployed app is not being changed; all effort goes into the sandbox version, perfected page by page. Foundational pieces that should land at once (first: sign-in, basic permissions and the new user's start, brief in `AUTH_AND_START.md`) may be handed to another model in their own worktree.
- **Out for now:** venues, stadium renting, individuals on the map and similar heavy features leave the frontend until the product is ready for them. Details to follow.
- **The audience is decided by data.** Launch to about 500 volunteer users the team already knows, follow analytics (what people use and come back for), then settle the audience and evolve from there.
- **No role at registration** (decided 13 October). One sign-up for everyone; what a person does is chosen later, easily, and changed any time. Permissions come from links someone else confirms (club staff, squad coach, guardian), never from a chosen or self-described role.
- **New users get a simple, good start:** they pick what they want to see, and the feed is mostly local. A fan in Tbilisi sees Dinamo Tbilisi hosting a tournament, not registration for an Estonian one. The feed gets a solid rule-based foundation first; a learning algorithm (YouTube-style) comes later on top of it.

- **The store copies Fanatics' football page** (owner, 13 October, with a brief and screenshots): a storefront that helps people find what they want before the full catalogue, then a catalogue with the filters already applied. **GrassKickZ sells its own equipment** as a seller beside the clubs (the team may have its own manufacturer), so no club is handed the front page by default. Fundraising and jobs follow with the same GrassKickZ DNA, with GoFundMe and a jobs site as their references.
- **Fundraising copies GoFundMe and hands it the headache** (owner, 14 October): creating a fundraiser is as simple as GoFundMe's, and the money, receipts and refunds are taken on the club's GoFundMe page, linked from the fundraiser. GrassKickZ shows the projects, sends supporters there and keeps the same DNA as the store.
- **Jobs and fundraising are for everyone, the store for clubs and GrassKickZ** (owner, 14 October): a parent may raise money for a child's kit or post a job for a personal trainer; coaches, referees and specialists may list themselves as available. Most people in grassroots football want a stable job, so jobs is one of the most important pages. The jobs home copies LinkedIn Jobs and lives beside World's map, which stays the way to browse by place.

### Made (15 October 2026, owner: creating a page; brief in `PAGE_CREATION.md`)

- **Anyone creates a page instantly.** A club, fan club, sponsor or business, or any other page starts from one small sheet (what it is, the name, the town already filled) wherever the person thinks of it, and exists at once as a draft only its owner sees. No forms, categories or files up front.
- **Editing happens on the page itself.** The owner lands on the real page in edit mode, fills ghost boxes in place and goes live from there. A page's own content is never edited in the workspace any more; the workspace keeps operations (sessions, attendance, approvals, records).
- **Verification unlocks, it never blocks.** Any adult can create and run an unverified page. Verification is asked only when a locked thing is tried: taking money (fees, store, fundraising payouts), public pages for players under 18, trials open to the public, the "Verified" badge.
- **One shared page DNA: identity plus boxes.** Every page has the same identity (name, crest, cover, town, contact, about) and switches boxes on (posts, squads, grounds, fees, staff, store, jobs, fundraising, sponsors, events, honours, bookings). The page type only decides which start switched on; the backend's organisation types stay.

### Taken while building the start (13 October 2026, `AUTH_AND_START.md`; owner to confirm)

- **Sign-up is one screen:** name, email or phone, password (shown or hidden, no second field), date of birth and town. The town is pre-filled with Tbilisi, found from the device when allowed, else picked from a list of 20 Georgian towns. It travels with the sign-up to the first run, which saves it as a preference, so the registration request keeps the backend's shape.
- **The neutral role is `FAN`** until the backend makes the role optional. A new account's `/users/me` says `FAN`; nothing in the frontend reads it.
- **Everyone is a normal user at sign-in** (owner, 13 October). Someone who skips "What do you do in football?" still gets the right start automatically the day a link is confirmed: coaching a squad or working for a club (a club they created included) → coach, a linked child → parent, a place as a player → player. The links then set the football role, World's page and the pin as the answer would have (`features/start/useAutomaticActivity.ts`), only while the person has answered nothing and has no football role; what they chose themselves is never overwritten, and it can be changed on the profile.
- **The first run (`/start`)** is three screens with "Skip" on each: Where are you? (town already filled), What do you want to see? (seven picture tiles; Local clubs, Youth & academies and Matches & results already ticked), Follow a few clubs (the six nearest, the three nearest ticked). Then one optional question, asked only on a new account's first run: What do you do in football? (I play, I coach, I am a parent, I just watch). It sets the primary public football role (`PUT /users/me/roles`), World's page and one pin (Trials, Jobs, Places to train or Matches); nothing else. Every save is best effort: a failed save notes it and the start goes on.
- **Home's Discover is ranked**, in the brief's order, with one addition so Home is never empty: posts near the person on topics they did not choose come last (tier 6). Own posts rank with linked ones. Following stays newest-first. "Popular" is 40 reactions or more; a regional notice (tournament entries, jobs) never travels on popularity, and a followers-only post (store notices, personal posts) never leaves followers.
- **Reach by kind of post:** results, fixtures, training, trials and club news are local (40 km); tournament entries, jobs and people looking for a club are regional (120 km); advice from referees, specialists and agents and a professional club's news are national; store notices and personal posts reach followers.
- **"Show less like this"** demotes that author's posts on that topic to the end for the person (not a hide); "Why am I seeing this?" shows the sentence and the post's topic, place and reach, with the same action.
- **Recorded:** what the person saw (half a card in view), opened, hid and asked less of, from the device in small batches; follows and unfollows by the server.
- **Links decide, roles never:** Home's left rail shows Following and Followed clubs to anyone nobody has linked to a club, squad or child yet (and only once the server has answered); the club page's lead, My squads' back link, My Club and Account read links or the server's own records. My Club for someone without a club is one page for everyone: Find a club, Create a club when the server allows it, invitations.

### The owner's first look at creating a page (15 October 2026, `PAGE_CREATION.md` §12)

- **Guidance on the page, not a tour:** every empty box says in one chip whether it is *Needed to go live* or *Optional*; the next thing breathes; what just filled or moved glows; a new page opens with three small bubbles (the ring, a box, Go live) and never again. Words stay few; pictures and motion carry the meaning.
- **Verification promises no call.** We cannot phone anyone yet: a request is reviewed and answered by message, usually within a day; until then the store and fundraising stay off and jobs are open. The owner agrees the check must exist, against scams in a club's name.
- **Players arrive through the join link, two ways:** a player makes their own card from the link without an account, or a parent makes a parent account and the card for the child, whichever the family prefers. Built later; the model keeps a player card that exists before any account and can be claimed by one.
- **Order of the club's boxes:** contact, fees, grounds, squads, fixed by default; Rearrange is the only way they move, and a move shows itself.

### Made (16 October 2026, owner, after the waves of review fixes)

- **One club per person, strictly** (settles the "strictness pending" in section 5). A person is a member, player or staff of **one** club at a time; a coach is never part of two clubs. Moving means leaving one and joining another (the transfer flow).
- **Fan clubs are the exception:** a person can belong to any number of fan clubs.
- **Not membership, so not limited:** being a guardian of children in other clubs; working for a sponsor or business page (a job, not a club); serving many clubs as a referee, agent or scout without joining them. The owner asked whether sponsor pages need another exception; none is known yet.
- **Navigation:** the owner reviewed the three phone layouts (A, B, C) and found them good; the "coach at two clubs" case is dropped because it can no longer happen, and there is no club switcher.
- **Phone navigation: C, with "You" as the profile picture** (owner, 16 October: "like C but instead of 'You' on bottom, we have 'You' only in form of profile picture on top, while 'You' on bottom turns into 'My club' if we have it"). The bottom bar is Home · World · the person's role tabs (My squads, Parent Hub) · My Club, the last only for someone with a club. The top bar carries Messages as an icon and the profile picture, which opens "You": the profile, pins, finding or starting a club when there is none, settings and the account. Wide screens keep their header as it was.

### Made (23 October 2026, owner: roles and registration; replaces every earlier plan for them)

- **Nobody chooses who they are; links decide.** A person has one account and links: *plays for* a squad (the coach approves), a *job* at a club (Head coach, Assistant coach, Team manager, Fees, Admin; whole club or chosen squads), *parent of* a child, *follows* a page. Profile roles fill themselves from links and never grant anything. Each door already knows why someone came, so nobody is asked what the link told us.
- **Inside a club everything is a job.** Admin is the job with every tool; the **Owner** is one admin nobody else can remove. Jobs map onto the backend's appointments and tool bundles; ticking single tools stays under **Custom**. Members are players; parents link to their child, never to the club; fans follow.
- **Giving someone a job is the Team work invite.** The admin types name, email, job and where it applies; an account without a password is made and the admin gets a one-time link (7 days, New link replaces it) to send themselves, with Copy and WhatsApp beside it, emailed too once sending is set up. The person opens it, chooses their own password, gives their date of birth, sees "Nino invited you: Assistant coach · U12", accepts and lands in My squads. An existing account is invited in the app. A head coach can do the same for helpers in their own squad; the admin gets a notice and Undo. Everything else is "Ask the admin", one tap.
- **The person owns the account, the club owns the work.** When someone leaves, their job ends and the club keeps every session, attendance record and note; their profile and career go with them. A club that wants a shared office login invites its office email as Admin; it can never be the Owner.
- **Sign-up is one screen** (name, email, password, date of birth, town filled in) and ends inside whatever the person came for. Google and email codes come later as extras.
- **Joining a squad:** one link and QR code per squad, shared anywhere. "Who's joining? Me · My child" (a child: name and birth date). The coach approves from one notification ("7 want to join U12 · Approve all").
- **Starting a club:** the one create sheet everywhere; the creator becomes Owner and is asked "Do you coach here too? Which age group?" (head coach job and first squad in one tap), then "Invite your coaches". Someone at another club sees "Leave it to start a new club" with the button. **Leaving:** one Leave everywhere; an Owner first picks who takes over; the last person can close the club; if an Owner vanishes, the admins ask GrassKickZ, the Owner is told, and after 30 days we hand over.
- **Ages:** no account under 13 (the parent, or a coach with the parent's phone, holds the card). 13–17 can look, follow and talk to their own squad; joining a club and messages from adults outside it need a parent's one-tap approval; "Give Luka his own account" turns a parent's card into his account. Control ends at 18 and both are told.
- **Guard rails for confused people:** an adult joining a kids' squad is asked "Joining for your child?"; the same child added twice is offered as a merge; a known email signs in instead of making a second account; a child using a parent's email is sent to the parent; an invite accepted under a different name shows to the admin with Undo; every "no" carries the button that fixes it; everything is undoable for 30 days with history; nobody types a club name to join; approvals happen in the notification.
- **Thrown away:** profile types that grant things (Organiser to receive a club; Club admin and Organiser as profile types), claiming clubs, a second admin login or Manage mode, a suggest-and-wait queue, self-changed jobs within limits, three separate lists of club roles in the backend (they become one list of jobs).
- **Order:** (1) remove claiming and stop profile types granting; (2) jobs on the surface and a People screen (person → jobs → where); (3) the Team work invite for jobs; (4) squad QR join, batch approval and the first guard rails; (5) teens' parent approval and "his own account"; (6) Owner hand-over, leaving and one club for staff, with today's multi-club staff sorted first; (7) page staff links merged into the same jobs; later, Google and email codes.
