# GrassKickZ sandbox

Runs the web app on synthetic data with no backend and no Vite native binaries.

## Try it on your own computer (Windows, macOS or Linux)

From `frontend/` after `npm ci`:

```
node sandbox/build.mjs
node sandbox/server.mjs 4300
```

Open http://localhost:4300/home. You are signed in as coach Luka Gelashvili of FC Dinamo Tbilisi Academy; everything is invented and nothing touches a real server. Restart the server to reset the data.

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
- Parent view: a browser with the cookie `gk-sandbox-family=1` sees coach Luka as the parent of two children (`api/world-family.mjs`, `api/handlers/family.mjs`); without it nothing changes.
- New accounts: registering on `/signup` creates an account of its own in memory (`api/viewer.mjs`); its bearer token or the `gk-sandbox-user` cookie makes every request theirs. Nobody has confirmed a link with them, so their lists are empty (`api/handlers/newcomer.mjs`) and Home is ranked for their town and topics (`api/feed-rank.mjs`). Sign in with any other email to be Luka again. Restarting the server forgets the accounts.
- Two sessions side by side: `node sandbox/server.mjs 4302` and `node sandbox/web.mjs 4302 5175` run a second API and Vite on their own ports (`.claude/launch.json`: `sandbox-api-start`, `web-start`).
