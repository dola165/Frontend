# GrassKickZ frontend — project instructions

For every coding assistant on the team (Claude, Codex).

## Shared context lives in the backend

The complete, maintained project guide is `AGENTS.md` at the root of the paired private backend repository, `dola165/GrassKickZ`. Read it before architecture, mobile, cross-repository or deployment work, together with its `docs/TEAM_CURRENT_STATE.md` (current branches and live release). Locate the backend checkout on this machine; do not assume another person's paths. If it is unavailable, say which context is missing and proceed only where the evidence supports the work.

This repository is public. Never copy private operational records, secrets, production exports or personal chat history into it.

Before starting, check the actual branch, commit, uncommitted changes and fetched upstream. Preserve local work; never blindly reset, stash or pull a dirty checkout.

## Application map

- The web app lives in `frontend/`. Entry points: `src/App.tsx`, `pages/`, `features/`, `api/`, `context/`, `components/`. Versions come from the package and lockfiles; Node 24 is the baseline.
- Product areas: identity/accounts, clubs and organizations, squads and joining, family/guardian workflows, schedules/training, match exchange/referees/results, tournaments, maps/venues, posts/media, chat/notifications, jobs/store/campaigns and in-product Agent Dola. Verify each route and API before claiming it is complete.
- Some screens are also packaged into the Android app (`src/android/`). Web edits do not update an installed APK. Android's use of web screens does not decide the iOS architecture.
- From `frontend/`: `npm ci`, then `npm run check` (lint, tests, build) or `npm test -- <paths>` for focused tests. UI and code-shape rules are in `frontend/AGENTS.md`.

## Product standard

- Primary review context: `coach@talanti.ge` and **FC Dinamo Tbilisi Academy**. Other accounts and clubs add permission coverage; they do not replace it.
- Build for the quality expected by UEFA: credible football data, coherent workflows, accessibility, privacy, polished responsive design and clear language. An ambition, not a claim of affiliation.
- Simplify everyday work without removing useful capability. Keep one stable workspace across a person's approved responsibilities; use squad and task context rather than role modes.
- Public football identity is separate from account permissions. Support multiple roles. Never invent careers, accreditation, verification, counts or successful actions.
- Preserve backend authorization, account/session isolation, drafts, uploads, cancellation, mutation conflicts and honest loading/error states.

## Work and publication

- Finish a task with relevant checks, a reviewed diff and a short context update. Commit and push only after the owner accepts the change. Record paired revisions for cross-repository work and keep local, pushed, merged and deployed separate.
- Deploy only when the owner asks for it in the current task, through the guarded release path described in the backend guide. Documentation-only changes never trigger a deployment.
- GitHub Actions is off at the owner's request (8 October 2026). Do not add hosted CI unless asked.
- Each assistant uses the model, settings and subscription the owner chose for it. Do not switch tools, models or billing. Do not run parallel writing agents unless asked; never let two assistants write to the same branch at once.
