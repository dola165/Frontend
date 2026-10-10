@AGENTS.md
@frontend/AGENTS.md

## Claude-specific notes

The shared rules live in the paired backend repository's `AGENTS.md` (private `dola165/GrassKickZ`). Read it before architecture, cross-repository or deployment work. If it is not available on this machine, say so. Put team rules in the `AGENTS.md` files, not here.

- For changes that span several files or a whole screen, propose a plan (and, for UI, a mockup) first and wait for the owner. Small, clear fixes can go straight ahead. In the redesign sandbox below, the owner has said to build directly and show the result.
- Do not read `dist/`, `node_modules/`, `outputs/` or `review/` output; search `src/` instead.

## Redesign sandbox (branch `claude/overhaul-sandbox`): what we are doing

We perfect UI/UX on synthetic data. We do not write backend code here, but every screen is built on the real API shapes and keeps its state (view, search, filters, sort, page) in the URL, so the backend connects later without redesign. The brief, decisions and open questions are in `frontend/docs/claude-sandbox/ROUND_2.md` and `PRODUCT_MODEL.md`: read both before designing, and log new owner decisions there.

**Working style**
- Fast and efficient over perfect. Change, let Vite hot-reload (`.claude/launch.json`: `sandbox-api` on :4301, `web` on :5174), let the owner look, iterate. No per-step test runs or screenshot matrices; `npm run check` once before anything is merged. Commit each piece the owner accepts; never push.
- The owner judges visually: check the page in the browser pane at 1920×1080 before reporting.

**Product philosophy (never lose these)**
- SAP-level depth underneath (one person with many roles, positions with dates, seasons, every process a record with status, approvals and history, one inbox, no double entry) under a consumer-simple surface. SAP is powerful and confusing; GrassKickZ is powerful and obvious. Hidden complexity rewards those who learn it.
- Two audiences, one data model: lazy users get a Facebook-familiar social app, power users get the workspace; the workspace produces the social content automatically.
- Automate: every answer narrows the next question and the likely answer is pre-chosen (inviting a club starts at your own ground). Agent Dola acts through the same actions as the screens, within the person's permissions, previews first and signs the history.
- Places: Home (100% feed) · World (discovery) · role tabs as default pins: My club (club-wide staff → workspace), My squads (Coach Hub), Parent Hub. Academies are the target audience; every organisation type exists; an academy and its pro club are linked (`ACADEMY_OF`). The club model (sections, seasons, staff scopes) is still being validated with the owner's coaches.
- Football words, not system words (coaches responded to "My squads", not "My Club"). Jobs & volunteering, never "roles". This round covers coach, parent and player.

**Visual language**
- Compact like Home (13px body, quiet greys): one bright thing per row; no dashboard theatre (big stat tiles, pill rainbows, coloured side lines). Wide layout without empty side margins; dark theme, green accent; centred top-bar tabs.
- Sections: `Section boxed` is one calm surface with the title over a grey hint and a line under the heading; add an icon only where it helps (Coming up: calendar).
- Activity symbols and colours live in `features/schedule/activityIcons.ts`: every match green (trophy for league/cup/tournament, handshake for friendlies), training blue (cone), club event violet, trial pink, outing cyan; `ActivityLegend` explains them.
- Waiting items: a dot in front, the status in words (red urgent, amber decide), an arrow behind.
- Lists (`design/DataTable.tsx`, sorting in `design/tableSort.ts`): views with counts → one toolbar (search, filter pills that show their value, Clear filters, count) → a table with sortable column headers, a primary cell (icon or avatar, a title that links to the record, subtitle), status as dot and word, relative dates, the next step in view and quieter actions on hover, rarer and destructive actions in the row's details, open work grouped by urgency. View, search, filters, sort and page live in the URL.
