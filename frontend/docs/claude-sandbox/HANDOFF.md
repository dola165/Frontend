# Handoff: overhaul sandbox → coding workspace

For the next Claude session working on the GrassKickZ frontend on the owner's desktop PC "dola" (Windows). Written 10 October 2026 by the claude.ai session that built the overhaul overnight. That conversation is not available to you; this file and the docs it points to are the context.

## 1. What exists

- **Branch `claude/overhaul-sandbox`** (frontend repository only): 72 commits on top of `5f78c0d` (`codex/football-experience-20261009`). **Not pushed anywhere.** It reaches this PC as the git bundle `grasskickz-overhaul-sandbox.bundle` in `C:\Users\daddo\WebstormProjects\Frontend`.
- It is a full redesign judged from a coach's point of view. It runs completely offline in **the sandbox**: the real app bundled by esbuild, served together with a synthetic in-memory API (`frontend/sandbox/`). No real backend, database or mini PC is involved.
- The backend repository was not changed by the overhaul (see 6 for uncommitted instruction-file edits).
- The owner has viewed it through a prebuilt copy (`GrassKickZ-sandbox\` + `Open GrassKickZ Sandbox.cmd` in the same folder). That copy is for viewing only; do not edit it. It listens on port 4300.

## 2. Set up first

In PowerShell, from `C:\Users\daddo\WebstormProjects\Frontend` (this repository already contains `5f78c0d`):

```
git fetch grasskickz-overhaul-sandbox.bundle "+claude/overhaul-sandbox:refs/remotes/claude/overhaul-sandbox"
git worktree add -B claude/overhaul-sandbox C:\Users\daddo\Projects\Frontend-claude-sandbox refs/remotes/claude/overhaul-sandbox
cd C:\Users\daddo\Projects\Frontend-claude-sandbox\frontend
npm ci
node sandbox/build.mjs
node sandbox/server.mjs 4301
```

If `C:\Users\daddo\Projects\Frontend-claude-sandbox` already exists (the earlier launcher creates it), check `git status` there and fast-forward instead of re-creating it. Never reset a checkout with uncommitted work.

Then open `http://localhost:4301/__guide`. Port 4301 avoids the viewing copy on 4300. After edits, run `node sandbox/build.mjs` (about 5 s) and reload the page. The server serves the new build without a restart. Restarting the server resets the synthetic data. Real `vitest` and Vite work on Windows; the cloud session could not run them.

## 3. Read before changing anything (in `frontend/docs/claude-sandbox/`)

- `PROGRESS.md`: what is done and not done, and the backend endpoints the new screens need.
- `PRODUCT_MODEL.md`: the product direction (the owner's brief turned into a model; section 13 lists decisions).
- `DESIGN_SYSTEM.md`: the rules every redesigned screen follows. The live reference is `/design-system` in the sandbox. Primitives are in `src/design/`.
- `OVERNIGHT_PLAN.md`: the brief and how the sprints ran. `REVIEW_*.md` and `DESIGN_AUDIT.md` are background.
- `frontend/sandbox/README.md`: how the sandbox works. When a screen needs data, add synthetic handlers in `sandbox/api/handlers/`. Response shapes come from the frontend's own types.
- `frontend/sandbox/guide.html`: the owner's test guide, served at `/__guide`.

## 4. The owner's standing preferences

- **Must stay:** wide layout with no empty side margins (the club profile width is the narrowest acceptable); dark theme with the green accent; the Home feed style.
- **Review view:** coach `coach@talanti.ge`, FC Dinamo Tbilisi Academy. In the sandbox the user is signed in automatically as coach Luka Gelashvili; no password exists or is needed.
- The owner judges visually. Show the result (sandbox screenshots, desktop and 390 px, dark and light) instead of describing it.
- The owner is the sole developer. Team rules in `AGENTS.md` are not absolute; an explicit permission from the owner counts.
- **Hard limits:**
  - The mini PC is live production and off-limits.
  - Deploy only when the owner asks in the current task.
  - This frontend repository is public: never commit secrets or private records.
  - Do not touch `C:\Users\daddo\.grasskickz`.
  - Commit to the branch freely. Push or merge only when the owner says so.

## 5. How the next round works

The owner liked many of the changes and wants others back the way they were. Instead of re-explaining, they mark every change in the checklist on `/__guide` as **Keep**, **Revert** or **Change**, then paste the copied review into the chat. Treat it like this:

- **Keep:** leave it.
- **Revert:** restore the look and behaviour from before the overhaul. `git show 5f78c0d:frontend/<path>` and `git diff 5f78c0d -- <path>` show the old version. Rebuild it in the new code shape where that is faithful. Don't bring back deleted files wholesale unless that is the simplest faithful revert. If a revert conflicts with something marked Keep, ask.
- **Change:** follow the note. Ask only when a note is genuinely ambiguous.
- **Not reviewed yet:** leave it.

Order of work:
1. Read the whole review.
2. Send all your questions at once, in a single short batch.
3. Work area by area.
4. After each area, rebuild, screenshot and show the owner.
5. Keep `tsc` and ESLint clean.

## 6. Open items

- **Unit tests were not swept after the final merge.** Run `npm run check` and fix it before any of this is merged into the real branch. About 330 test files; some tests changed with the redesign, and some only run under real vitest.
- Playwright e2e specs were updated by reading only; not run.
- Backend endpoints the new screens need: listed in `PROGRESS.md`.
- **Uncommitted instruction-file changes waiting for the owner's review. Don't discard them.**
  - Backend worktree `C:\Users\daddo\Projects\GrassKickZ-football-experience`:
    - `AGENTS.md` rewritten;
    - new `CLAUDE.md` importing it;
    - content moved to `docs/IOS_GUIDE.md` and `docs/LIVE_HOSTING_AND_DEVICES.md`;
    - old Claude/DeepSeek prompts archived in `docs/archive/claude-deepseek-2026-08/`;
    - `tools/team/install_skills.py --target claude|codex|all`;
    - skills de-dated;
    - `docs/product/PRODUCT_MODEL.md`.
  - Frontend worktree `C:\Users\daddo\Projects\Frontend-football-experience`: `AGENTS.md`, `frontend/AGENTS.md` and a new `CLAUDE.md`.
- **Cleanup once the branch is imported (ask the owner first).** In `C:\Users\daddo\WebstormProjects\Frontend`:
  - `frontend\node_modules\.claude-transfer` (about 370 MB, left from copying packages to the cloud);
  - the bundle;
  - `Start GrassKickZ Sandbox.cmd` / `.ps1`;
  - `Open GrassKickZ Sandbox.cmd`;
  - `grasskickz-sandbox-ready.tar.gz`;
  - `GrassKickZ-sandbox\`;
  - `CLAUDE_SANDBOX_HANDOFF.md`.
