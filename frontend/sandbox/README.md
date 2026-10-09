# GrassKickZ sandbox

Runs the web app on synthetic data with no backend and no Vite native binaries.

```
node sandbox/build.mjs            # bundle src/ into sandbox/dist (≈2 s)
node sandbox/server.mjs 4300      # serve dist + synthetic /api on http://localhost:4300
node sandbox/shots.mjs <label> [--only=substr] [--widths=1440,390] [--themes=dark,light] [--base=http://localhost:4300] [--full]
```

Screenshots and `report.json` land in `sandbox/shots/<label>/`. API calls the sandbox can't answer are logged to `sandbox/.runtime/unhandled-<port>.jsonl`.

## Synthetic API conventions

- `api/world.mjs` is the shared invented world: coach **Luka Gelashvili** (user 1, `coach@talanti.ge`), **FC Dinamo Tbilisi Academy** (club 1) with eight squads, ~15 other Georgian clubs, venues, events, matches, tournaments, roles, trials and posts. All fictional. Dates are relative to now.
- Domain handlers live in `api/handlers/<domain>.mjs`; domain-specific extra data in `api/world-<domain>.mjs`.
- A handler returns plain data (200 JSON) or `reply(status, body, headers)`. Returning `undefined` passes to the next matching route.
- Response shapes come from the frontend's own TypeScript types and API clients, not guesses.
- Mutations work in memory, so forms can be exercised; a server restart resets the world.
