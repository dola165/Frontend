# Agent Dola: what exists and the fastest path to real experiments

16 October 2026. Read-only investigation. No code, configuration or services were changed or started, no model was called and no secret value was read.

Sources:
- Backend: `C:\Users\daddo\Projects\GrassKickZ-football-experience`, branch `codex/football-experience-20261009`, commit `2b02bce`. The checkout has uncommitted documentation edits that are not mine, and I left them alone.
- Frontend: this checkout, branch `claude/overhaul-sandbox`, commit `e6bf978`.
- Older backend `C:\Users\daddo\IdeaProjects\GrassKickZ`, branch `main` (8 September). It has **no** `assistant/` package in `src/`. Dola only exists there as release overlays and snapshots under `outputs/agent-dola-*`, so the football-experience branch is the only source checkout of Dola.

Backend paths below are relative to `src/main/java/ge/dola/talanti/assistant/` unless they say otherwise.

---

## 1. How Dola works today

### Request flow

1. The browser posts `POST /api/assistant/dola/messages/stream`, which returns NDJSON events: `ready`, `delta`, `reset`, `complete` and `error` (`DolaController.java:355-377`). There is also a JSON endpoint and an Android fallback (`frontend/src/features/dola/api.ts:42-43`). The body is `Ask`: `conversationId`, `requestId`, `message` (up to 2000 characters), `includePersonalContext`, `timeZone`, `workspaceContext` and `venueId` (`DolaContract.java:174-175`).
2. `DolaService.ask` (`DolaService.java:82-197`) runs these steps:
   - Checks that Dola is enabled. Otherwise it returns 503 `DOLA_DISABLED` (`:85`).
   - Takes a conversation lock (`:86`).
   - Replays the turn if the same `requestId` arrives again (`:93`).
   - Applies the rate gate (`:98`).
   - Reads a fresh **account snapshot**: clubs, squads with `canManage`, allowed destinations and workspaces, all from the domain's own access projections (`DolaAccountContext.java:483-505`).
3. **Intent routing (Jev):** one optional HTTP call to TypeSafe `https://api.typesafe.ai/v1/systemone` with model `jev-1.13.0` (`DolaIntentRouter.java:26-63`).
   - It chooses from a closed list of task, mode, squad and club. There are 27 tasks (`DolaIntent.java:94-123`).
   - A hint is accepted only when confidence is at least 0.75 and the chosen option's probability is at least 0.80 (`DolaIntentRouter.java:78-84`).
   - With no key, an uncertain result, a timeout or an error, the result is `fallback` with confident=false (`:27`, `:54`, `:61`).
4. **If the router was confident**, it shapes the turn:
   - It filters which tools the model may see (`DolaService.java:198-231`).
   - It forces `toolChoice("required")` (`:124`), so the model must read or prepare before it answers.
   - It adds task-specific guidance (`DolaIntent.java:126-161`).
   - An ambiguous squad for a write (more than one managed squad matches) gets a clarifying question **without calling the model** (`DolaService.java:104-115`).
   - **If the router was not confident**, every tool is offered with `auto` choice and generic guidance (`DolaIntent.java:127`).
5. **Prompt:**
   - System text from `src/main/resources/agent-dola/system.txt` (18 KB), plus the current time, workspace preference and venue preference (`DolaService.java:130-132`).
   - The account snapshot, sent as user-role "untrusted data" (`:133`).
   - Up to three product-guide sections chosen by keyword match from `agent-dola/product-guide.md` (`DolaKnowledge.java:25-31`, `DolaService.java:127-136`).
   - The last four dialogue pairs (`:137-140`).
   - Up to three recent action reviews (`:141-142`).
   - A per-turn language rule (`:143-145`, `:236-242`).
   - The message itself.
6. **Tool loop:** at most 3 model calls and at most 2 tool rounds. A round may request at most 3 tools, with at most 6 per question, and tool arguments may be at most 6000 characters (`DolaService.java:153-173`).
   - The loop stops as soon as a review has been prepared (`:153`).
   - If a write was expected and no review exists after round 2, the turn fails with `DOLA_TASK_UNRESOLVED` (`:163-164`).
   - When a confident action is needed in round 2, the `read_*` tools are removed (`:166-168`).
7. **Answer:** text, verified destination cards, guide sources, tools used, model calls, tokens, action cards and follow-up keys (`DolaContract.java:182-184`). Destinations come only from a fixed allowlist (`DolaTools.java:241-249`). The frontend checks them again (`api.ts:72-96`).

### Model use versus routing

- The model does the reading, the writing and the decision to prepare. Jev only narrows the choice and is "advisory, never authorization" (`DolaIntent.java:91`).
- Search typing never calls a model (`features/dola/navigation.ts:598-609` uses local regexes).

### Tools (28)

| Area | Read tools | Prepare tools (preview only) |
|---|---|---|
| Squads and family (`DolaWorkflowTools.java`) | `read_family_attention`, `read_squad_sessions`, `read_coach_updates`, `read_challenge_options`, `read_public_opportunities`, `clarify_request` | `prepare_coach_update`, `prepare_update_acknowledgement`, `prepare_session_cancellation`, `prepare_session_response`, `prepare_open_challenge` |
| General (`DolaTools.java`) | `offer_destination`, `read_next_squad_matches`, `read_my_club`*, `read_my_calendar`* | none |
| Football (`DolaFootballTools.java`) | `read_referee_workspace`, `read_match_exchange`, `read_agent_workspace`, `read_organization_workspace` | `prepare_referee_decision`, `prepare_referee_availability`, `prepare_match_proposal`, `prepare_match_proposal_decision` |
| Venues (`DolaVenueTools.java`) | `read_venue_workspace`, `read_venue_availability` | `prepare_venue_booking`, `prepare_venue_decision` |
| History (`DolaMatchHistoryTools.java`) | `read_match_history`* | none |

\* Only when the person ticks "Allow my personal calendar" (`DolaService.java:199`).

### Preview and confirm contract (the strongest part)

- **The model can only prepare. There is no confirm tool** (`DolaActions.java:14`, `DolaWorkflowTools.java:331`). "Yes, send it" in chat cannot execute anything.
- A prepared action is a server-held `Pending` record:
  - A random UUID, kind, title, body and details (`DolaActions.java:32-58`).
  - An immutable payload and a fingerprint of the target's state at preview time (`:214-215`).
  - Expiry **10 minutes** later (`:17`, `:38`).
- **One pending review per conversation.** A new one supersedes the old one, and at most 8 are kept (`:127-133`).
- **Confirm** is `POST /conversations/{id}/actions/{actionId}/confirm` (`DolaController.java:383-386`). It works as follows:
  - It accepts only the owner-bound IDs and never model-supplied arguments.
  - It re-checks current access (`DolaActions.java:139-141`).
  - It refuses if the review expired or was replaced (`:143`).
  - Inside a 15-second transaction it takes club-then-squad row locks (`:149-151`) and re-compares the fingerprint (`:165`, `:171`, `:179`).
  - It calls the **existing domain service**: `squads.send`, `acknowledge`, `cancel` or `attendance`, and `challenges.create` (`:153-182`). The action UUID is passed as the domain request ID, so the write happens once even if repeated (`:154`, `:160`, `:172`).
  - A repeated confirm returns the stored receipt (`:142`).
- **Discard** only marks the review (`:189-194`).
- The frontend card refuses unknown kinds or non-UUID IDs (`features/dola/DolaActionCard.tsx:461`) and shows the 10-minute note (`:468`).

### Permissions

- Dola runs as the signed-in person. Every tool asserts the current user (`DolaWorkflowTools.java:414-417`, `DolaTools.java:266`).
- Squad writes require `canManage` (`DolaActions.java:90`, `:108`).
- Parent responses re-check that the child is currently linked (`:117`, `:176`).
- If the account scope changes mid-conversation, the dialogue is cleared and pending reviews are superseded (`DolaConversations.java:304-311`).
- A "recovery scope" signature makes an old conversation unavailable after access changes (`:342-348`).

### Conversation history

- Conversations are **in memory only**: a `HashMap` (`DolaConversations.java:222`).
- They expire after 45 idle minutes and are swept every minute (`:220`, `:323-326`).
- Limits: 200 conversations in total and 4 per account (`:253`), 32 displayed turns, 4 dialogue pairs sent to the model, and 8 replay IDs (`:273-277`, `:302`).
- A server restart erases everything.
- An earlier answer that used live reads goes back to the model only as "historical, re-read before using" (`:296-299`).
- The browser keeps nothing in storage. It offers "Continue last chat" within the 45 minutes (`frontend/src/features/dola/AgentDolaPage.tsx:413`).

### Budget and limits

- `DolaBudget.java:463-483`:
  - **A single global semaphore allows only one Dola turn at a time across the whole server.**
  - There is a 3-second interval per account.
  - **There are no daily allowances.** They were removed on 23 September (`docs/AGENT_DOLA.md:71`).
  - The `dailyModelCalls` and `userDailyTurns` properties still exist but nothing reads them (`DolaProperties.java:449-450`, `application.yaml:63-64`).
- Provider limits:
  - 600 output tokens, clamped to 64–1200, and thinking disabled (`DolaConfiguration.java:426-428`).
  - Zero retries (`:429`).
  - A 40-second stream limit per call (`DolaService.java:283`) and a 150-second browser timeout (`api.ts:27`).
- Jev has its own persistent pilot allowance of $0.10 (`docs/AGENT_DOLA.md:41`).

### Provider and model configuration

- **Provider:** Spring AI 2.0.1, DeepSeek adapter. The `DeepSeekChatModel` type is hard-coded in `DolaService.java:30`, `:269` and `:280`, and in `DolaConfiguration.java:417-431`. The bean exists only when `app.agent-dola.enabled=true` (`:416`).
- **Model:** `AGENT_DOLA_MODEL`, default `deepseek-flash` (`application.yaml:61`, `DolaProperties.java:447`). I could not confirm that this is still a valid DeepSeek model ID. The September releases record real DeepSeek runs with it (`docs/AGENT_DOLA.md:118`).
- **Jev:** `DolaProperties` has `jevEnabled`, `jevApiKey` and `jevModel`, but **`application.yaml` on this branch maps none of them from `TYPESAFE_API_KEY`**. Only the pilot deployment's secret file sets `app.agent-dola.jev-api-key` (`deploy/compose.pilot.yaml:69-71`).
  - So a local run from `.env` has Jev **off**, and every turn takes the less strict unconfident path.
  - The environment name that would bind it is `APP_AGENT_DOLA_JEV_API_KEY`.

### Georgian support

- Language is chosen per turn by counting script characters (`DolaService.java:236-242`).
- The squad clarification is in Georgian when the message is (`:107-108`).
- Jev's task list includes Georgian examples (`DolaIntent.java:99-100`, `:111`, `:115`).
- Starters and follow-ups exist in both languages (`features/dola/suggestions.ts`).
- The September corpus had 51 English and Georgian routing scenarios (`docs/AGENT_DOLA.md:45`).
- **Gap:** the Georgian copy on the Dola page side panel is older text that does not match the English (`AgentDolaPage.tsx:396-400`). Examples: "Find the right page / learn the next step" against "Find answers. Get things done.", and "Your calendar, optional" against "Family, squads, refereeing and organisations".

### Real versus stubbed

| | State |
|---|---|
| Backend Dola | Real and tested: 21 test classes in `src/test/java/.../assistant/`, plus a paid live smoke test gated by `DOLA_LIVE_TEST=true` (`DolaLiveSmokeTest.java:17`). It was released as overlays in September. It is **off by default** (`AGENT_DOLA_ENABLED=false`). |
| Sandbox Dola (`frontend/sandbox/api/handlers/social.mjs:739-841`) | **Canned.** It matches keywords with regexes and gives four fixed answers (create a page, a coach update, matches, jobs) plus a "your week" default. It ignores `subject` and `page`. It can create a page or post one fixed U16 update. |
| **Sandbox bug** | Sandbox action IDs are `act-${Date.now()}` (`social.mjs:784`, `:793`), but the card requires a UUID (`DolaActionCard.tsx:461`). **No sandbox action card ever renders**, so the page-creation and coach-update reviews are invisible. The sandbox also uses a 30-minute expiry, which disagrees with the card's 10-minute note. |
| Request fields | The frontend sends `subject` and `page` (`api.ts:8`, `DolaProvider.tsx:249-250`). The backend `Ask` record has neither field, so it ignores them; Spring's default is to drop unknown JSON fields. |
| Obsolete copy | The frontend still has `DOLA_DAILY_LIMIT` text (`DolaProvider.tsx:262`), but the backend no longer sends that code. |

---

## 2. What Dola can do now (real backend)

| Person | Reads | Prepares (confirm on the card) | Quality |
|---|---|---|---|
| **Coach** | Next match across squads (90 days); training sessions (30 days) with response totals; coach updates (latest 6) and who acknowledged; open challenges and proposals; match history (opt-in) | Coach update to the whole squad, with optional acknowledgement; cancel one session (notifies participants and guardians); publish an open challenge; propose to a challenge; accept, decline or withdraw a proposal | The strongest area: heavily guarded, tested and released. Writing is text-only. There is no move or reschedule, no bulk action, no parents-only audience (`DolaActions.java:94`) and no inviting opponents. |
| **Parent / player** | "What needs my attention" across children (sessions, cancellations, unanswered RSVPs, updates to acknowledge); child schedules | RSVP Going / Not going / Unsure for one child and one session; acknowledge one update | Good and permission-careful. One action per answer, so "say yes for all three" takes three reviews. |
| **Club staff / organisation** | Organisation summary: leadership clubs, venue bookings (14 days), tournament statuses, managed matches with pending proposals | None at organisation level | Read-only and bounded. No admissions, invitations, staff or finances. |
| **Venue owner** | Requests, arrivals, closures, calendar, real free slots | Manual or academy booking (1–12 weekly occurrences), closures; accept, decline or cancel one booking | Deep and careful (DST, conflicts, idempotency). |
| **Referee** | Accepted appointments, invitations, availability | Accept, decline or withdraw; add or remove availability | Bounded, with explicit limits. |
| **Football agent** | Engagements, listing interest, portfolio (minors redacted) | None | Read-only. |
| **Fan / anyone** | Public open roles and volunteering (at most 5); public open challenges; product-guide questions; navigation cards | None | Fine for discovery. No posting, following or club search beyond the guide. |

Not connected anywhere: tournament invitations, applications, imports, payments, private messages, page creation, and everything new in the sandbox. The new sandbox features include announcements with expiry and read receipts, the Requests inbox, admissions, the FamilySchedule drag-to-move, squad player cards and World.

---

## 3. Running a real Dola locally

### What the backend needs

- Java 25 (installed: 25.0.4.1).
- Docker for PostgreSQL/PostGIS 16 on `127.0.0.1:5433` and Redis 7 (`compose.yaml`). `application-dev.yaml:2-5` has Spring start them itself. **Docker Desktop is not running now.**
- `./gradlew bootRun` loads `.env` from the backend root (`build.gradle.kts:224-227`). The football-experience checkout has **no `.env`** yet.
- **Data:** `app.seed.enabled=true` with the `dev` profile runs `config/DataSeeder.java`, which creates `coach@talanti.ge` and Dinamo. More synthetic SQL is in `src/main/resources/db/seed/`, for example `squad_communication_demo.sql`. The new checkout has no `postgres-data/`, so it starts fresh.
  - **Never point it at `C:\Users\daddo\IdeaProjects\GrassKickZ\postgres-data`.** That is preserved real rollback data.
- **Variables:** I list names only and read no values.
  - Core: `SPRING_PROFILES_ACTIVE=dev`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `TWO_FACTOR_ENCRYPTION_KEY`, `APP_CORS_ORIGINS`, `APP_WEBSOCKET_ALLOWED_ORIGINS`, and the seed switch (`APP_SEED_ENABLED=true` by relaxed binding).
  - Dola: `AGENT_DOLA_ENABLED=true`, `DEEPSEEK_API_KEY`, `AGENT_DOLA_MODEL`, `AGENT_DOLA_MAX_OUTPUT_TOKENS`.
  - Optional Jev: `APP_AGENT_DOLA_JEV_API_KEY`. `TYPESAFE_API_KEY` does not bind on this branch.
- **Keys:** the old checkout's `.env` has non-empty `DEEPSEEK_API_KEY` and `TYPESAFE_API_KEY`. I checked only that they exist, not their values or whether they still work or have credit.

### The three options

| Option | Effort | What it proves | Risks |
|---|---|---|---|
| **A. Real app against a local backend.** Normal `vite.config.ts` on :5173 with `VITE_API_BASE_URL=http://localhost:8080/api`, synthetic seed, real DeepSeek key. | About half a day: start Docker, write `.env`, migrate up to V174, seed, sign in as `coach@talanti.ge`. | The real pipeline end to end: permissions, the preview/confirm contract, idempotency, Georgian, real latency and cost per question. | The new sandbox screens call API shapes the backend does not have yet, so much of the new UI shows errors. Dola can only act on the old domain. You review Dola in the old app shell. Small paid spend. |
| **B. Sandbox proxy.** The sandbox server forwards `/api/assistant/dola/*` to the local backend. | 1–2 days, mostly auth. The sandbox's cookie session is not a backend JWT, so the proxy would need its own backend login. | Real reasoning inside the new screens. | **Data disagreement:** Dola answers about backend seed IDs while the screen shows sandbox data (squad 105 and so on), so answers and screens contradict each other. All of A's backend setup is still needed. Least useful. |
| **C. Sandbox-only Dola calling a model directly.** The sandbox Node server runs a small tool loop. The key stays in the server environment, never in the browser. The tools are an allowlist of the **sandbox's own API routes**, called through `handleApi()` (`sandbox/api/router.mjs:23-35`). Writes become previews, and confirm replays the stored call. | 1–2 days for coach and parent with about 8 tools. | The real UX question: does Dola feel powerful and obvious on the screens the owner judges? It is literally "the same actions as the screens". You can compare models and test Georgian quality fast. It keeps the real `Ask` / `Answer` / `ActionView` contract, so the UI is unchanged. | It is a second implementation that the backend must later match. Keep the tool names, inputs and preview shape as the spec for that. The owner's key is on the local machine, so set a spending cap at the provider. Synthetic data only, so no privacy issue. |

**Recommendation:** use C for product experiments now, and A once, briefly, as a reality check of the existing Java Dola and the chosen model before any backend work. Skip B.

---

## 4. Gaps that matter most

### Already fixed (frontend and sandbox, `092f07d`, 16 October, F20)

- A failed status check now says "Could not reach Agent Dola" with **Try again**, and checks again when the window regains focus (`DolaProvider.tsx:184-212`, `AgentDolaPage.tsx:421`).
- Each question carries the **record on screen** (`subject`: squad, child, job, club and so on) and the **page** to return to. A chip above the composer can leave it out (`subject.ts`, `DolaProvider.tsx:137-149`, `AgentDolaPage.tsx:425`).
- `/my-squads` now chooses the coach context.
- **Still open from this fix:** the backend `Ask` has no `subject` or `page` field, and the sandbox ignores them. They have no effect yet. No tests have been added yet (`ROUND_2.md:600`).

### Gaps, most important first

1. **Sandbox action cards never render**, because the ID is not a UUID (see section 1). Every action experiment in the sandbox is blocked until this is fixed. It is about a five-minute fix.
2. **Dola acts through bespoke code, not a shared action layer.** Each capability is hand-written Java: a `prepare_*` tool, a `DolaActions` builder and a `switch` case on confirm (`DolaActions.java:152-184`). These call the same domain services as the screens, which is good, but "every action is Dola-ready" (`PRODUCT_MODEL.md` §10) needs each domain action to declare its inputs, permission check, preview and execution once. Screens and Dola would then share that declaration. Without it, Dola's coverage always lags behind the screens.
3. **Nothing new is connected.** Pages, announcements with expiry, the Requests inbox, admissions, FamilySchedule moves and player cards have no Dola tools. Dola's real coverage is the September domain.
4. **No signed history.**
   - Receipts live in memory for 45 minutes and disappear on restart (`DolaConversations.java:222`).
   - Domain records show the person as the actor with no "via Agent Dola" mark, and no history view exists.
   - The action UUID is reused as the domain request ID, which is the only trace.
5. **Previews are text, not pictures.** The card is a title, a body and label/value rows (`DolaActionCard.tsx:462-472`). The owner's rule is "show, don't tell", so a session move should show on the week board and an announcement should show the faces it will reach.
6. **Not built for more than a demo.** One turn at a time for the whole server, in-memory chats, no spending cap per person or per day, and one action per answer.
7. **Locked to one provider.** `DeepSeekChatModel` is hard-coded (see section 1). The design relies on forced `toolChoice("required")` (`DolaService.java:124`, `:168`). Claude Opus 5.5 and Sonnet 5.5 **reject forced tool choice**, so a switch to them needs `auto` plus the server-side checks that already exist (`requireDecision`, `:149`, `:243-245`). The privacy note names DeepSeek and TypeSafe (`AgentDolaPage.tsx:429`) and must change with the provider.
8. **Depends on Jev.** Routing goes through a third party (TypeSafe) on a $0.10 pilot allowance, and the key does not bind locally on this branch. Modern models with a good tool list may not need it. That is an owner decision (see below).
9. **Dola only answers and never offers.** Nothing proactive exists yet, such as "3 families haven't replied — chase them?" in the Inbox or on Home, which is the "automate" goal.
10. **Copy:** the Georgian side panel does not match the English, and the `DOLA_DAILY_LIMIT` copy is stale.

---

## 5. Experiment plan, in order

Each step is small, and the owner judges each one in the browser before the next.

**E0: make the sandbox cards real (hours, no model).**
- Use UUID action IDs, a 10-minute expiry and `mode: 'REVIEWED_ACTIONS_PILOT'`.
- Let the canned answers use `subject` ("this squad").
- This proves the review card UX on the new screens. It is the baseline for everything after it.

**E1: sandbox Dola on a real model (option C, 1–2 days).**
- Coach and parent only. About 8 tools over existing sandbox routes:
  - Read: squad, sessions, announcements, family schedule, requests.
  - Prepare: post an announcement, move or cancel a session, RSVP for a child, acknowledge.
- Same contract, server-held previews, and confirm replays the stored API call.
- Run 20–30 scripted prompts in English and Georgian (reuse the backend corpus themes) on two models. Score:
  - Did it choose the right action?
  - Did it ask only for what was missing?
  - Is the Georgian natural?
  - How long did it take, and what did it cost per question?
- This proves whether Dola is genuinely useful on the new product and which model to use.

**E2: show, don't tell, for previews and history (1–2 days, sandbox).**
- The preview card draws the change:
  - The session moving on the week board.
  - The faces who will be told, ringed by whether they have answered.
  - The announcement as it will look.
- After confirm, the record shows a small "Done with Dola · you approved · 14:05" line, with a history entry on the squad or session.
- This defines the provenance field and the history view the backend needs ("signed history").

**E3: Dola offers the next step (1 day, mostly rules, with the model only for drafting).**
- Waiting work (unanswered RSVPs, missing acknowledgements, a match with no referee) appears as one-tap "Dola can do this" previews in the Inbox and on the squad page.
- This proves the "automate, the likely answer pre-chosen" philosophy, where Dola reaches the people who never open a chat.

**E4: backend reality check (option A, half a day, then a decision).**
- Run the existing Java Dola locally on synthetic seed with the chosen model.
- Replay the E1 prompts in the old app.
- Spike a provider adapter behind an app-owned interface, which `docs/JEV_SPRING_AI_RESEARCH_2026-09-23.md:46` already recommends.
- Decide between extending the bespoke workflows and building the shared action layer (gap 2) before porting E1–E3.

### Cost notes (rough)

- **Prompt size, measured from source:** the system prompt is 18 KB, the tool descriptions about 14 KB, plus up to three guide sections. Each model call is roughly 10–12 thousand input tokens, and Georgian text uses more tokens.
- **Per question:** with up to 3 calls, about 20–35 thousand input tokens and about 1–2 thousand output tokens.

At Anthropic list prices (cached 6 October 2026, input/output per million tokens):

| Model | List price | Per question |
|---|---|---|
| Claude Haiku 5.5 | $0.10 / $0.50 | about **$0.003** |
| Claude Sonnet 5.5 | $2 / $10 | about **$0.05–0.08** before caching |
| Claude Opus 5.5 | $4 / $20 | about **$0.10–0.15** |

- **Caching:** reading a cached prompt costs $0.20 per million tokens on Sonnet and Opus. Caching the fixed system prompt and tool list would roughly halve the Sonnet cost. Today the prompt puts the current time inside the first system message (`DolaService.java:130`), which would defeat caching, so it would need to move later in the prompt.
- **The E1 comparison** (30 prompts on two models) should cost a few dollars at most.
- **DeepSeek:** I could not check its current price. The August notes say DeepSeek prices rose about 5× (`docs/archive/claude-deepseek-2026-08/CLAUDE.md:7`). Look up the current price before choosing.
- **Claude API constraints:** Opus 5.5 always thinks, so use low effort. Sonnet 5.5 can turn thinking off with `between_tools`. Neither accepts forced tool choice.

---

## Decisions for the owner

1. **Where to experiment first:** the sandbox Dola on a real model (C, recommended) or the existing Java Dola locally (A)?
2. **Model and key for the experiments:** DeepSeek (already wired; an old key exists but is unverified) or Claude (Haiku 5.5 is cheapest, Sonnet 5.5 is likely better at Georgian and judgement), or both in the E1 comparison? Whose key, and with what spending cap at the provider?
3. **Keep Jev/TypeSafe routing,** or let the main model route with the server checks?
4. **First jobs to automate.** My suggestion: coach (announcement, move or cancel a session, chase missing replies) and parent (RSVP, "what needs me"). Anything else first?
5. **Signed history:** should each record show "Done with Dola · approved by you", and should the person see a Dola history list?
6. **Proactive Dola:** may Dola place suggestions in the Inbox and on pages (E3), or only answer when asked?
7. **Data sent to the provider** in the real app: children's names in family reads, and provider data retention. Is that acceptable for a pilot, and under which provider terms?
8. **Architecture before porting:** after E1–E3, move to a shared action layer (every action declared once for screens and Dola), or keep adding bespoke Java workflows?

---

## Owner's direction (16 October 2026, after reading this plan)

- **Who:** a colleague of the owner is taking over Agent Dola. This sandbox workstream does no Dola work for now; this file is the start of his handoff (a fuller handoff to the new frontend will be written when he asks).
- **Model and key for now:** keep **DeepSeek** and its existing key; about $2 of credit remains and should be used first. **Claude Haiku 5.5** is probably the better long-term option (cheap, and it accepts the backend's forced tool choice; Opus 5.5 / Sonnet 5.5 do not).
- **The first thing Dola should be great at: guiding page creation.** Dola as a small, cute robot that moves around the page, points at what to press and explains the next step, at least 100× easier than today's set-up steps and walkthrough. If it does this well, the owner will remove the steps list and the walkthrough and let Dola handle guidance entirely. (This is for page registration first.)
- **After that, everything else:** helping in the workspace and dashboard, and automating tasks, for example writing a coach update from one sentence and sending it to the whole squad.
- **Known sandbox issue for whoever starts:** experiment E0 above (review cards never render in the sandbox because of the action-ID format) is still open, deliberately left for the Dola owner.
