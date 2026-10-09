# GrassKickZ product model

Status: **draft for owner review**, started 9 October 2026 from the owner's overhaul brief. This is the north star for the redesign. Every UI or structural change should fit it; when it doesn't, change this document first. Decisions are recorded at the bottom.

## 1. What we are building

One place where everyone in football can do their own job without being shown everyone else's. A parent finds a good club and stays informed without digging through 100 WhatsApp messages. A coach runs their squads. A player keeps their schedule, chooses trips and shares highlights. A casual user can treat GrassKickZ as a simple football social network and never meet the tools.

People who invest in the workspace are rewarded: everything they currently track across dashboards, Excel, the calendar on the wall, Facebook groups and WhatsApp chats lives in one place, and the app does the repetitive work for them.

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
6. **The app does the bookkeeping.** Defaults, templates, recurrence and reminders instead of manual entry. If a person types the same thing twice, that's a bug.
7. **Every action is Dola-ready.** Actions are structured operations with clear inputs, so Agent Dola can later perform them on a person's behalf (see section 10).
8. **One place per destination.** A destination appears once in the navigation; personal shortcuts are pins, chosen by the person.

## 3. The four places

| Place | Purpose | Who sees it |
| --- | --- | --- |
| **Home** | What's happening for me: this week, announcements, feed | Everyone |
| **World** | Discovery and public football: directories, map, matches, tournaments, opportunities | Everyone; works signed-out *(decision pending)* |
| **My Club** | My club's private side: squads, schedule, workspace tools for staff | Club members and staff |
| **Me** (avatar) | Profile, personal schedule, children, settings | Everyone |

### Navigation

- Default tabs: **Home · World · My Club** (My Club only for club members). Matches & Competitions is not a tab *(decision pending)*: discovery moves to World, the club's own matches to My Club.
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
   - Referee: optional, can be requested afterwards.
   - One short form, not a three-step wizard.
2. **Match Exchange** (open listing): "we need an opponent for this slot." Other squads propose; we choose.

**Renting a stadium is not part of match creation.** Rented stadiums are for training. Remove "Find and book a stadium" from the match flow.

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
3. **Matches & Competitions as a tab:** drop it (recommended) or keep it as the fourth default?

### Made (9 October 2026, owner)

- GrassKickZ World becomes a major part of the app: directories, map, matches, tournaments and opportunities for discovery and work.
- Top navigation shrinks to 3–4 default tabs with bigger icons and labels, plus personal pins.
- My work is removed.
- Schedule moves to personal profile and club profile; each squad has a schedule and the club has a combined one.
- One club per person; the UI says "My Club" (strictness open).
- Renting a stadium is for training only and is removed from match creation.
- Match creation lets the club pick its own venues and search the opponent club with autocomplete, separate from Match Exchange.
- People can change roles; professions are free text, labelled later and searchable.
