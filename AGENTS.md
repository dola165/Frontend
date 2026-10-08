# GrassKickZ frontend — project instructions

## Read the shared project context

The complete, maintained project guide is `AGENTS.md` at the root of the **paired backend repository**, `dola165/GrassKickZ`. Read it before architecture, mobile, cross-repository or deployment work, together with its `docs/TEAM_CURRENT_STATE.md`, `docs/TEAM_WORKFLOW.md` and relevant feature note. It explains the major product areas, actual Android/iOS boundaries, device roles, verification and production safeguards.

Locate the backend checkout on this machine; do not assume the founder's filesystem paths apply. The backend is private and this frontend repository is public. Do not copy private operational records, secrets, production exports or personal chat history into this repository. If the backend guide is inaccessible, state the missing context and proceed only where the available evidence supports the work.

The shared transition branch is `codex/team-baseline-20261008` in both repositories until the baseline is reviewed and merged. Check actual host, branch, commit, local changes and fetched upstream before relying on old chat context. The default branches may still be older. Preserve local work; do not blindly reset, stash or pull a dirty checkout.

## Application map

- The web application lives in `frontend/`; entry points are `src/App.tsx`, `pages/`, `features/`, `api/`, `context/` and `components/` under that directory. React, TypeScript and Vite versions come from the package/lockfiles; Node 24 is the current working baseline.
- Product areas include identity/accounts, clubs and organizations, squads and joining, family/guardian workflows, schedules/training, match exchange/referees/results, tournaments, maps/venues, posts/media, chat/notifications, jobs/store/campaigns and in-product Agent Dola. Verify each relevant route and API before claiming completeness.
- Some web product screens are also packaged into the Android app. Inspect `src/android/` and the backend's Android source before changing native bridge behavior. Updating web source does not automatically update an installed APK.
- Android's use of web surfaces does not decide the iOS architecture. Read the canonical guide's iOS inventory before proposing an app or claiming an existing Xcode target. Preserve user requirements instead of inventing missing features or silently reducing scope.
- From `frontend/`, `npm ci` installs locked dependencies; `npm run check` runs lint, tests and build. Use focused tests where appropriate and report skipped/unverified coverage. Read `frontend/AGENTS.md` for the application's additional instructions.

## Product standard

- Primary review context: `coach@talanti.ge` and **FC Dinamo Tbilisi Academy**. Use other accounts/clubs for additional permission coverage, not as a replacement for the everyday review context.
- Simplify everyday work without removing useful capability. Keep a stable workspace across approved responsibilities; use squad/task context rather than artificial role modes. Access/role requests require the appropriate leadership approval.
- Build for the quality expected by UEFA: credible football data, coherent workflows, accessibility, privacy, polished responsive design and clear language. This is an ambition, not a claim of approval or affiliation.
- Public football identity is separate from account permissions and organization ownership. Support multiple roles. Professional profiles need relevant experience/qualifications; simpler personas remain simple unless they also hold professional roles. Never invent careers, accreditation or verification.
- Preserve backend authorization, account/session isolation, drafts, uploads, cancellation, mutation conflicts and honest loading/error feedback. In-product Agent Dola can help complicated workflows; keep useful functionality discoverable.

## Work, publication and deployment

- Close tasks with relevant local verification, reviewed diffs, useful context updates, commits/pushes and clear handoff. Record paired revisions for cross-repository work. Distinguish local, pushed, merged and deployed; a GitHub commit does not identify the running deployment.
- GitHub Actions is off at the user's request (8 October 2026). Do not add or re-enable hosted test/build/CodeQL workflows without a new request. Keep appropriate local checks and deployment safeguards.
- Host migration is currently deferred for the team skills workshop. For later functional work, deploy to the authorized live demo as part of completion unless the user says otherwise, after appropriate release, backup and migration checks. Pure UI/UX work may remain local unless publication is requested. Read the backend operations guide before any deployment; never use a development reset or cache cleanup on live data.
- Work directly in the current task with the user's selected Codex model and reasoning effort. Do not introduce model-selection machinery or force different settings.
- Work without subagents unless explicitly asked to delegate. Create separate user-visible tasks only when explicitly requested.
- Do not call Jev or another external service to choose development models, allocate work or advise orchestration. In-product Jev/Dola has separate credentials and spending controls.
- Use ChatGPT subscription authentication for OpenAI development models. Do not add a separately billed generative API fallback or silently change models/billing.
- Preserve existing work and use focused verification. Keep necessary correctness, security, migration, backup and deployment checks; avoid repeated investigation without a concrete reason.
