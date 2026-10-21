# Map search consistency review

Open http://127.0.0.1:5187/world for the current local map.

The preview API is the current backend `bootJar`, running in `gk-map-review-api` on **127.0.0.1:8187**. Its database `gk-map-review-db` contains an isolated copy of the synthetic demo data (67 clubs); Redis is `gk-map-review-redis`. All three use the private `gk-map-review` Docker network. The original `gk-synthetic-demo-*` stack and its data are unchanged. No production credentials or email integration were copied. Media requests still read from the original local gateway on port 8080.

To resume existing review containers after stopping them:

```powershell
docker start gk-map-review-db gk-map-review-redis
docker start gk-map-review-api
node review/atlas-preview.mjs
```

Run the Node command from `C:/Users/daddo/WebstormProjects/Frontend/frontend`. The preview defaults to the review API on 8187; `ATLAS_API_TARGET` can select another current backend. The jar is mounted read-only from `C:/Users/daddo/IdeaProjects/GrassKickZ/build/libs/talanti-0.0.1-SNAPSHOT.jar`. Rebuild it with `./gradlew.bat bootJar` and restart only `gk-map-review-api` when backend changes require it. Readiness: http://127.0.0.1:8187/health/ready.

Verification:

```powershell
node e2e/map-search-consistency.mjs
```

This suite uses actual club and geocoder responses from the review API, real MapLibre tiles, and browser-provided test coordinates. It checks radius → map area → apply consistency, all three counts, country/city searches with a distant start, location fallbacks, tilt/rotation and mobile. `results.json` records the latest successful run; PNGs show the reviewed states.

The separate `e2e/map-atlas-smoke.mjs` suite uses controlled data on the port-5186 fixture for 230-club pagination, walking graph behavior, pin changes during animation, mobile, reduced motion and retry states. Its results are in `review/atlas-v2-verification/`.

The original floating filter is still preserved in `review/design-snapshots/atlas-filter-v1-20260912/`.
