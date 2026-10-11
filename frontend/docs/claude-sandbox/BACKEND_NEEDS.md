# Backend needs of the redesign

Everything the redesigned frontend (branch `claude/overhaul-sandbox`) needs from the backend, collected so we can go through it once the frontend overhaul is done. It is checked against the real backend source (the backend checkout at `806b444`, read only) and the frontend at `c1b0860`, on 11 October 2026. New needs from later rounds are added under "Round 3 and later" as they appear.

This file is the one list. `ROUND_2.md` "Before release" points here for backend items.

**Status words**
- **EXISTS**: the backend already does it; only the frontend (or the sandbox) has to change.
- **PARTIAL**: the data or part of the behaviour exists; something is missing.
- **MISSING**: nothing exists yet.
- **PLANNED**: decided or proposed with the owner, not built on either side.
- **UNVERIFIED**: could not be confirmed from the code alone.

---

## 1. Already in the backend: frontend fixes only

Several older notes asked for backend work that is not needed.

| What | Status | What to do in the frontend |
|---|---|---|
| Squad id on tournament invitations (`/tournaments/invitations/mine` returns `squadId`, `clubId`, `startDate`) | EXISTS | Done in round 3 phase A: invitations are matched by `squadId`, and the sandbox sends it. |
| Coordinates on directory clubs (`/clubs` items carry `latitude`, `longitude`) | EXISTS | Done in phase A: the club directory type carries them. Whether real clubs have coordinates is UNVERIFIED. |
| Radius search on `/competitions` (`latitude`, `longitude`, `radiusKm` up to 500) | EXISTS | Only the sandbox ignores it. |
| `POST /journeys/from-fixture`; `published` on a journey plan | EXISTS | Remove from the to-do lists. |
| `POST /match-arrangements` referee modes `INVITE`, `OPEN`, `EXTERNAL`, `LATER`, `NONE` | EXISTS | The frontend sends only `LATER`, `EXTERNAL`, `NONE` today. |
| "Replies needed" counts only events that ask for replies; per-event "ask for replies" toggle | EXISTS | Remove from the to-do lists. |
| Club kit colours (`homeKitColor`, `awayKitColor` on the club profile and directory rows; editable) | EXISTS | Nothing reads them yet. The sandbox never sends them. |
| Tournament `entryCap` (editable) and `incentives`, `seasonId` at creation | EXISTS | The settings dialog never sends `entryCap`; the setup wizard never sends `incentives` or `seasonId`. |
| Rules and policy edits after creation (`PUT /competitions/{id}/rules`, `PUT /competitions/{id}/policy`) | EXISTS | No frontend caller. |
| Featured competitions and the organiser page (`GET /tournaments/overview`, `/tournaments/host`, `/tournaments/host-tournaments`) | EXISTS | The calls were deleted with the old pages; they can come back for the Tournaments rebuild. |
| Competition cards carry `bannerImageUrl`, `entryCount`, `entryCap`, `profile.rules.entryFee/currency/feeBasis` | EXISTS | Full tournament cards can be rebuilt without backend work. |
| Referee availability window (`GET /referees?from&to` checks availability and existing appointments) | EXISTS | The redesign does not send `from`/`to`; the sandbox ignores them. |
| About text on profiles (`PUT /users/me {bio}`) | EXISTS | — |
| Unused endpoints that may be useful: `GET /tournaments/{id}/stats`, fixture match links, `PATCH /tournaments/{id}/status`, `DELETE /tournaments/{id}`; `POST /match-arrangements/bookings/{id}/allocate`, `/ground-preview`, `/ground` | EXISTS | No frontend caller. |

## 2. Contract mismatches the sandbox hides

These work in the sandbox and break on the real backend.

| Mismatch | Effect on the real backend | Fix |
|---|---|---|
| The club directory sends `playerJoinPolicy`; the frontend read `joinPolicy` | Club cards never showed "Open trials / Apply to join" and never offered Join or Apply | **Fixed in phase A:** the frontend reads `playerJoinPolicy`; the sandbox and the test mocks send it as the backend does. |
| Directory rows have `relationshipState: null` (only `isMember`, `isStaffMember`) | "Applied" and "Trialist" never show on World Clubs | **"Member" fixed in phase A** (the frontend reads `isMember`; the sandbox sends rows as the backend does). Still MISSING: the backend filling `relationshipState` in directory rows, for "Applied", "Invited" and "Trialist". |
| `GET /competitions` takes `minFee`/`maxFee` as integers; the frontend passed free text | "12.5" would have been rejected with a 400 | **Fixed in phase A:** the frontend asks for whole numbers and says so instead of sending anything else. |
| Tournament rows in `/match-history` have `title` = the tournament name and null `ends_at`, `timezone`, `location_name` | Fixture lines read "Tbilisi Community League" instead of "A v B", with no ground or time zone | Backend fills them (see 3.5), or the frontend builds the pairing title from the club names. |
| `/match-history` ids are `event:N` / `fixture:N`; the sandbox uses `TOURNAMENT:N` | Keys and deep links differ | Align the sandbox with the backend. |
| `GET /venues`: `city` is an exact match (sandbox: substring); filters by the venue's own currency; sorts by name (sandbox: Tbilisi first, then id) | Results and order differ from what the owner reviews | Align the sandbox. |
| `GET /competitions`: the sandbox ignores `country`, `eligibilityCategory`, `from`, `to`, `minFee`, `maxFee`, `currency`, `feeBasis`, `openPlaces`, `latitude`, `longitude`, `radiusKm` | Those filters cannot be judged on fake data | Align the sandbox. |
| Sandbox `GET /match-arrangements/{id}/official-request` always returns `null` (a duplicate route shadows the real handler) | The referee request panel looks empty in the sandbox only | Fix the sandbox route order. |
| Sandbox never returns the 409 "change needs attention" on match edits; invited referees are accepted at once; families can never reply | Those flows cannot be tried in the sandbox | Sandbox. |

## 3. Needed by World

### 3.1 World overview (front page, Customize, role fields)

| Need | Why | Status |
|---|---|---|
| A per-person preference store (World page layout, default World tab, pins, workspace focus) | Customize follows the person across devices; World welcome; pins sync | MISSING. Today it is browser storage. |
| `GET /clubs?age=N` (clubs with a published programme for that age) | Clubs near you and places to train for the chosen child | MISSING. `/clubs` takes `type`, `country`, `city`, `joinPolicy`, `search`, `sort`, `page`, `size`. |
| Sponsors: `promotionBlocked` and `contentClassification` on public sponsors, or filter them on the server | "From the clubs" must never show blocked or restricted sponsors | PARTIAL. Classification exists for sponsor subjects but is not returned or applied in club presentation. |
| Match-exchange listings: squad gender on each listing and a `gender` filter | "Opponents for your squads" | PARTIAL. `squads.gender` exists; the listing query omits it; no filter. |
| Tournament fixture times with a time zone | Coach competition fields, cup runs, next fixture | PARTIAL. `scheduled_at` has no zone; competitions have a time zone, legacy tournaments do not. |
| Availability for several venues in one request (or a "next free" summary in `/venues`) | Free pitches this week, indoor pitches, Venues list | MISSING. One request per venue today. |
| A squad's playing format (for example 9-a-side) | Pitch size for free pitches, referee formats | MISSING. Squads have `category` and `gender` only. |
| `GET /competitions` with several `ageGroup` values | "Tournaments for your age groups" | MISSING. One age group per request. |
| Structured gender on competitions | Gender-checked tournaments for my squads | MISSING. `eligibility_category` is free text. |
| Competition cards: `registrationOpensAt`, `registrationClosesAt`, `hostClubId`, `organizerOrganizationId`, `visibility`, `incentives` | "Opening soon", amber closing dates, map placement | MISSING on the card; the data exists in tournament summaries. |
| `GET /match-exchange?refereeNeeded=true` | "Matches that need a referee" | PARTIAL. `referee_status` is computed per listing; no filter. |
| `/match-history` items: both club logos, both squads' age group and gender | Score lines with crests; "Your next opponent" form | MISSING. |
| `GET /tryouts/discovery` filters `ageGroup`, `gender`, `position` | "Trials in your age groups"; keepers first for goalkeeper coaches | PARTIAL. The fields are returned; no filters. |
| Club crest per tournament entry | Crests in tables and fixtures | MISSING (low priority). |

### 3.2 World › Clubs

| Need | Status |
|---|---|
| `near` (a centre) and a distance sort on `/clubs` | MISSING on `/clubs`; `/map/nearby` has distance |
| Boys or girls filter | MISSING on `/clubs`; `/map/nearby` has a club gender filter |
| Fee ceiling | MISSING on `/clubs`; `/map/nearby` has `trainingMaxPrice` |
| `age` | MISSING (3.1) |
| Country filter | EXISTS (`country`); the World list dropped it, a frontend fix |

### 3.3 World › People

The real backend has **no people directory**. The frontend falls back to `GET /users/search`, which searches names only, so on the real backend People shows a name search with nothing on the map.

| Need | Status |
|---|---|
| `GET /people` with total and paging, signed-in only | MISSING |
| Several roles per person (`roles[]` in results, `role[]` filter), from published role profiles, club appointments, referee profiles and memberships | Data EXISTS, query MISSING |
| Sub-role / specialisation filter (goalkeeper coach, physio, analyst, scout…) with one taxonomy for people at and outside clubs | Taxonomy EXISTS for club appointments, query MISSING |
| Availability on a date or window | EXISTS for referees only; nothing for coaches or specialists; players have a status only |
| A base location per published role (centre + radius), `near=lat,lng&radiusKm`, distance sort, `distanceKm` in results | MISSING (people have no location; referee service area is free text) |
| Structured licences (UEFA C/B/A/Pro, GFF referee category, FIFA list) with issuer, expiry and verification state | MISSING (free-text qualifications only) |
| Formats, languages, rates for non-referees | MISSING (referees only) |
| "Open to volunteer" on role profiles | PARTIAL |
| Honest "recorded by a club" (from published club appointments and memberships) instead of the invented "confirmed" flag | Data EXISTS; a document-checked state needs a new record |
| `isFollowedByMe` in results; `following=true` filter; a viewer-is-a-minor flag | PARTIAL (per profile only) |
| Club, age groups and gender filters; club name, crest and squads in results | Data EXISTS, query MISSING |
| Last active (opt-in) | MISSING (`last_seen` is never written) |
| Avatar on referee results | MISSING |
| Professions (`GET /users/{id}/professions`, `PUT /users/me/professions`) | MISSING (sandbox only) |
| Agents | Frozen in the backend; the Agents filter has nothing behind it |
| Privacy rules for the directory: adults only, public and active profiles only, published roles only, never parent-only accounts, block-aware, messaging offered only when contact is allowed | The predicates EXIST; the directory must apply them |
| Referees on the map: service area as a centre and radius | PARTIAL (free text and `travel_km`) |

### 3.4 World › Venues

| Need | Status |
|---|---|
| `near` (centre and radius) and a distance sort on `/venues` | MISSING (`city` only; map markers have distance) |
| Structured amenities (floodlights, changing rooms…) and a filter | PARTIAL (free-text amenities, no filter) |
| Availability for several venues in one request, or `nextFree` in the list | MISSING |
| Venue kind (stadium, training ground, indoor, community) and capacity | MISSING (sandbox only) |
| Ratings, reviews, "clubs that play here" | MISSING |
| Link fixtures to a venue (venue id on match-history items) | MISSING |

### 3.5 World › Matches

| Need | Status |
|---|---|
| `/match-history`: area filter, ground coordinates and venue id, club logos, `ageGroup` and `gender` filters | MISSING |
| `/match-history` tournament rows: pairing title, `ends_at`, time zone, ground; `stageName` and `roundNumber` | MISSING |
| A per-row "mine" flag | MISSING |
| Opponent logo on listings | MISSING |
| Events discovery: ids, logos and coordinates; area instead of free-text `location` | PARTIAL |
| A live state or minute | MISSING (only a broadcast state per match) |
| Direct match invitations as an Inbox request family | MISSING (the sandbox fakes it) |
| Schedule challenges (the map's "Respond to this match"): a request family and an answer action, or merge them into Match Exchange | MISSING; decide |
| A match page for club-schedule fixtures (today they open the calendar) | MISSING; decide |
| Public access to fixtures, open matches and referees if World opens to signed-out visitors | MISSING; open decision |

### 3.6 World › Tournaments (today "Competitions")

See 3.1 for the card fields, several age groups and gender. Also:

| Need | Status |
|---|---|
| Server-side search of invitations | MISSING (low priority) |
| Tournament series (`/tournament-series/*`) | MISSING (no controller; predates the redesign) |
| Referee appointments per tournament fixture (`/tournaments/{t}/fixtures/{f}/referees`, `/referees/me/tournament-appointments`) | MISSING (mock only); the competition resources path is the production one |

### 3.7 World › Opportunities

| Need | Status |
|---|---|
| `/jobs` filters (terms, category, club, country, city, age group, level, posted) and paging | MISSING (one unfiltered list) |
| Trials filters | PARTIAL (3.1) |
| Places to train: send `city` as a plain repeated parameter | Frontend fix (axios sends `city[]`) |
| Opportunities as one listing kind, open to parents and players, both directions | PLANNED |

### 3.8 Map and placing results

| Need | Status |
|---|---|
| Coordinates on every listed record (competition cards, match-history items, trials, jobs at their club), or an id-based place lookup | PARTIAL. The fallback `/map/nearby` is capped at **100 per kind** within 400 km, not 400 as noted before |
| MATCH markers: confirm `events.id` is used for both ids on real data | UNVERIFIED (looks like a sandbox artefact) |
| The Map tab as a planning workspace | PLANNED |

## 4. Navigation, Inbox and messages

| Need | Status |
|---|---|
| Pin sync across devices | MISSING (preference store, 3.1) |
| A capability separating "approved squad responsibility" (My squads) from "club-wide responsibility" (My club) | PARTIAL |
| An unread-messages count endpoint | MISSING (the header downloads 50 conversations) |
| Notifications in three levels (urgent, normal, digest) | PLANNED |

## 5. Club workspace, My squads, Parent Hub, calendar, journeys

| Need | Status |
|---|---|
| Workspace tables: `sort`, `dir`, a total and per-view counts on the work queue and every list rolled out as a table (players also need `q` and a consent filter) | MISSING |
| Staff appointments on one screen; current access continues while a change waits for acceptance | PLANNED (changes a backend rule) |
| Drag club events, with a preview naming who is told | PARTIAL (`PUT /schedule/events/{id}` exists, no preview) |
| Squad sessions report friendlies as `FRIENDLY` | PARTIAL; UNVERIFIED on real data |
| A batched "my squads" endpoint (overview, sessions, announcements, open records, crests) | MISSING (several requests per squad) |
| The opponent on squad sessions (club id, name, crest, match link) | MISSING |
| Announcement expiry (`expiresAt`) | MISSING (the frontend sends it; the backend drops it) |
| Read status for every announcement (beyond asked-for confirmations) | MISSING; decide |
| Opt-out attendance: "Can't come" on sessions that do not ask, an optional reason (up to 140 characters, coaches only), training does not ask by default (data decision for existing rows) | MISSING / PARTIAL |
| Parent Hub: children's squad ids; announcements across a parent's squads with unread state | MISSING |
| Journeys: `staff[]`, `vehicles[]`, `bring[]` in drafts, `bring` copied to the family itinerary | MISSING (dropped silently today) |

## 6. Profiles, matches, injuries

| Need | Status |
|---|---|
| Professions on profiles (3.3) | MISSING |
| Stadium booking out of match creation (owner decision): should the server enforce it? The backend still accepts `bookingId` | Decide |
| Injury case (report record, return-to-play stages, restrictions, medical-lead scope, care plans, first aider per session, audit and retention, insurance) | MISSING (see `SCENARIOS.md`) |

## 7. Parameters and fields the frontend sends that the backend ignores

| Sent | Backend |
|---|---|
| `GET /clubs?age=` | not a parameter |
| `GET /admissions/opportunities?city[]=…` (also `country[]`, `category[]`) | binds `city`, `country`, `category` |
| Announcement `expiresAt` | not in the request |
| Attendance `reason` | not in the request |
| Journey `draft.staff`, `draft.vehicles`, `draft.bring` | not in the draft |
| `GET /people`, `/users/{id}/professions` | routes do not exist |

## 8. Decided or proposed, backend work when built

- The club model: sections, seasons, teams by birth year with A/B levels, staff scopes, several roles per person.
- One club per person (membership and staff, not guardianship): a server rule, a transfer flow, a plan for existing multi-club users.
- Opportunities as one listing kind (direction, category, paid or unpaid, place, dates, expiry, filled state), verification for people offering services to children.
- Saved searches with alerts.
- World without sign-in (needs public paths for fixtures, open matches, referees, people).
- Children's safety: no adult-to-unrelated-child private messages; limits on a child's public data; contact through opportunities.
- Registration "what brings you here"; Agent Dola as structured actions.

## 9. Could not verify

- Whether real clubs have coordinates.
- The status code of the unmapped `/api/people` (the frontend falls back only on 404, 405 or 501).
- Whether arranged friendlies become squad sessions; which match-history sources fill `timezone`.
- The MATCH id space on real data.
- Whether existing squad sessions need a migration for opt-out attendance.

---

## Round 3 and later

New needs are added here as each phase of `ROUND_3_PLAN.md` is built, with the screen that needs them.
