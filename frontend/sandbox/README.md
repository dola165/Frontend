# GrassKickZ sandbox

Runs the web app on synthetic data with no backend and no Vite native binaries.

```
node sandbox/build.mjs            # bundle src/ into sandbox/dist (≈2 s)
node sandbox/server.mjs 4300      # serve dist + synthetic /api on http://localhost:4300
node sandbox/shots.mjs <label> [--only=substr] [--widths=1440,390] [--themes=dark,light] [--base=http://localhost:4300] [--full]
```

Screenshots and `report.json` land in `sandbox/shots/<label>/`. API calls the sandbox can't answer are logged to `sandbox/.runtime/unhandled-<port>.jsonl`.
Signed-out views: put `signedout` in the route's address (for example `/world?signedout=1`, in its own run, since a run shares one browser session); the harness then skips its sign-in and the synthetic `/auth/refresh` answers 401.

```
node sandbox/vt/run.mjs src/components/layout/header/__tests__/inbox.test.tsx   # run vitest-style tests without vitest
```

`vt/` bundles each test with esbuild and runs it in jsdom with `@vitest/expect` and the jest-dom matchers, because vitest itself cannot start here (its rollup native binary is missing). It supports `describe`/`it`/`each`, hooks, `vi.fn`/`spyOn`/`mock`/`hoisted`/`stubGlobal`; not fake timers or `importOriginal`. A check while offline, not a replacement for `npm test`.

## Synthetic API conventions

- `api/world.mjs` is the shared invented world: coach **Luka Gelashvili** (user 1, `coach@talanti.ge`), **FC Dinamo Tbilisi Academy** (club 1) with eight squads, ~15 other Georgian clubs, venues, events, matches, tournaments, roles, trials and posts. All fictional. Dates are relative to now.
- Domain handlers live in `api/handlers/<domain>.mjs`; domain-specific extra data in `api/world-<domain>.mjs`.
- A handler returns plain data (200 JSON) or `reply(status, body, headers)`. Returning `undefined` passes to the next matching route.
- Response shapes come from the frontend's own TypeScript types and API clients, not guesses.
- Mutations work in memory, so forms can be exercised; a server restart resets the world.
