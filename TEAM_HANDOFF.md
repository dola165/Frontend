# GrassKickZ team baseline — 8 October 2026

The web application is in `frontend/`. The shared source branch for this checkpoint is **`codex/team-baseline-20261008`** in both this repository and [the paired backend repository](https://github.com/dola165/GrassKickZ). The backend is private; each teammate needs access. This frontend repository is public.

Start with the backend's [current state](https://github.com/dola165/GrassKickZ/blob/codex/team-baseline-20261008/docs/TEAM_CURRENT_STATE.md), [shared workflow](https://github.com/dola165/GrassKickZ/blob/codex/team-baseline-20261008/docs/TEAM_WORKFLOW.md) and [office skills workshop](https://github.com/dola165/GrassKickZ/blob/codex/team-baseline-20261008/docs/TEAM_SKILLS_WORKSHOP.md). After merging the baseline, use the current documents on the backend default branch.

This snapshot preserves almost four weeks of accumulated work. It includes the 8 October Commerce R4/R5 repairs and their regression tests. That focused task passed 72 tests and 31 controlled Chromium journeys; it did not deploy. The Mac source copy also passed those 72 tests and a fresh production build. These checks do not establish full-product or live deployment readiness. GitHub Actions quality gates and CodeQL workflows were removed at the user's request on 8 October; use appropriate local checks and do not re-enable hosted automation unless requested.

Before starting work, inspect the actual branch, commit and local changes in **both** repositories, fetch their remotes and read current source. The default frontend branch `master` was behind this baseline at creation. Do not silently work from an older default checkout or treat historical handoffs as current status.

Local setup uses Node 24. From `frontend/`, run `npm ci`, then the appropriate checks; `npm run check` runs lint, tests and build. Backend/service configuration is separate. Copy `.env.example` only as a template; install per-machine settings locally and never commit credentials.

The imported Mac directories contain pre-checkpoint uncommitted source. Preserve any Mac edits and compare against a fresh clone in a separate directory before aligning them. A blind reset or pull can lose work. Source synchronization does not transfer database contents, media, secrets, Docker images or personal Codex chat history.

Keep dependencies, generated review builds and transient output out of Git. Authored source, lockfiles, tests and meaningful handoff notes are shared. Finish each task by updating context, committing, pushing and requesting review; record deployment separately.
