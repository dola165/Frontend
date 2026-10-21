# Schedule performance — 14 September 2026

Published at https://app.grasskickz.com/calendar as `schedule-speed-20260914`.

## Changes

- Share a bounded set of date/time formatters by language and options. Dates remain freshly formatted, and language changes use a different formatter.
- Reuse unchanged event cards across view changes and minute updates; translate repeated card labels once per board.
- Group events by day once per data/date change.
- Retain the board DOM, hidden and inaccessible, while the hourly calendar is open. Returning to the board reuses its cards.
- Build hourly-calendar content only when it is selected. Reuse each day's accessible slot description rather than formatting it 24 times.
- Isolate card layout/painting and the schedule's stacking context without changing dimensions or scrolling semantics.
- Reuse recently loaded surrounding schedule dates for up to 30 seconds while the page stays open. Every successful event mutation invalidates reuse through the existing revision counter; club changes and failed requests invalidate it too. Cancel superseded requests during quick date navigation.

## Measurements

`e2e/schedule-performance.mjs` builds the real schedule with production assets and deterministic local API fixtures. Measurements use Chrome, a 1440×900 viewport and 4× CPU slowdown, with two samples per workload and six view switches per sample. No live event data is read or changed. These are controlled local measurements, not timings from the user's device or CDN.

| Workload | Mean before | Mean after | Reduction |
| --- | ---: | ---: | ---: |
| 7 events | 88.5 ms | 54.9 ms | 37.9% |
| 217 events | 455.5 ms | 229.8 ms | 49.6% |

After warm-up, view switches construct zero date formatters; the previous board/agenda switches constructed 32 for a small week and 452 for a busy week. The busy scrolling workload had 3 frames over 32 ms in each baseline sample, compared with 2 and 1 in the final samples. Final samples recorded no browser runtime errors.

Source reports: `before/results.json`, `release/results.json`, and `comparison.json`. Intermediate `after` and `final` directories document tuning iterations. Content-visibility with estimated card heights was rejected because it worsened scrolling; it is not in the release.

## Deployment

- TypeScript + Vite production build passed. See `build.log`.
- No broad test suites were run; work was limited to focused performance measurements and the deployment build.
- Web image: `sha256:c275b1293f5b99d00ed421cc12a2c9d548b34e0f91f786988337c5d1990758eb`.
- The web-only transaction confirmed public app assets against the build and preserved API/database/Redis container identities. Prior web image retained for rollback.
- Release script and transaction evidence: backend project `outputs/schedule-speed-20260914/`.
