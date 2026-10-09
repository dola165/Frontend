# Overnight progress log

## Sprint 0 — sandbox and baseline (done, 02:45)
- npm was unreachable from the cloud workspace, so dependencies were copied from the desktop checkout and the app is bundled with esbuild + Tailwind's JS compiler (`sandbox/build.mjs`, ~3 s).
- Synthetic backend (`sandbox/api`, ~4,300 lines) answers all 85 coach routes with invented, coherent data. Built by three parallel workers (social / club / football).
- Screenshot harness signs in as coach Luka and captures every route. Baseline: 170 captures (1440 + 390 px), 0 failed API calls.
- Gates available here: TypeScript (clean at baseline), ESLint (clean), colour guard. Unit tests (Vitest) cannot run without Vite's native bundler — run `npm run check` on Windows.
- Design audit: `DESIGN_AUDIT.md` (7 palettes, 47 font sizes, 33 page widths, no shared Button/Card/PageHeader).

## Sprint 1 — design system foundation (done, 02:50)
- `src/design`: one canonical palette (`.gk` in theme.css), type/space/radius/frame scales, and shared primitives; reference page at `/design-system`. Rules in `DESIGN_SYSTEM.md`.

## Wave 2 — in parallel worktrees (started 02:55)
- `sprint/nav`: one-row header (Home · World · My Club), pins, Inbox, mobile tab bar; My work removed.
- `sprint/world`: GrassKickZ World front page and directories with list / split / map views.
- `sprint/workspace`: one workspace shell, Overview, Coach Hub, responsibilities, worst workspace pages.
