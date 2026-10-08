# Overview study 01

A local React design study authorized on 29 September 2026. Open
`http://127.0.0.1:5180/design/overview.html` while the frontend Vite server is running.
Start it from the frontend root with:

```powershell
& node_modules/.bin/vite.cmd --host 127.0.0.1 --port 5180 --strictPort
```

The separate HTML entry does not mount App, AuthContext, API clients or a service
worker. It is not included in the normal application production entry/build.
No backend records, permissions, invitations or account settings are changed.
The Follow button changes transient preview state only. Review selectors change
synthetic fixtures, **not account roles**. Workspace/action drawers explain the
destination; they do not submit forms or claim to complete real work.

## What to explore

- Owner/coach, prospective parent, connected parent, visiting coach, club referee
  and a coach visiting a non-club kit maker. The review bar is outside the product
  experience; users will not have to choose a perspective in the finished app.
- Stable organization identity and sections; Overview followed by Posts for clubs.
- Private relationship section above public information where appropriate.
- Three keyboard-operable scenes: football, place and people. Each uses a different
  short entrance animation; the surrounding section stays in place. Motion stops
  after the transition and respects `prefers-reduced-motion`.
- Programme, person, venue, fixture and workspace details in native modal drawers.
  Escape, initial focus, background inertness and return focus use native dialog
  behavior. Search filters only content available in the current study.
- Sparse content, which removes unpublished programmes, fixtures and posts instead
  of filling the page with invented records. A business without a catalogue uses
  its description and a contact gateway, without football-specific tabs.
- Full cover image with `object-fit: contain`; existing image bytes are unchanged.
  The club source view also has a focused local cover-fit/height correction.

## Design direction

Cool charcoal/slate surfaces, green reserved for key actions, Manrope type,
readable metadata, generous but connected spacing, and a wide main column plus
supporting rail. Content is capped at 1680px on ultrawide screens. On phones,
content becomes one column while My clubs and My work stay reachable.

The photograph is the application's existing illustrative `public/preview/club-ground.png`.
The main GrassKickZ wordmark is unchanged. The simple Dinamo crest and all dates,
prices, appointments and copy are design fixtures, not claims about the real club.
Manrope is loaded from Google Fonts with system-font fallbacks.

## Integration boundary

This is a visual/interaction preview, not completion of the adaptive-overview
implementation. It deliberately does not validate real permissions or resolve the
original invitation/tournament defects. Do not copy fixture-based viewer conditions
into production authorization. Approved production composition must use the source
and access contracts in the backend's `docs/adaptive-overview/` plan.

The shell is a focused study; additional existing discovery, assistant, media,
honours, events and business destinations must remain discoverable during actual
integration. Production workspaces, feeds and action forms will retain their existing
capabilities. All 150 matrix pairs and 52 acceptance scenarios remain implementation
work; six visual examples are not a replacement for that coverage.

**User review precedes live deployment.** No release was made for this study.

## Verification

- Full frontend TypeScript check; scoped ESLint; normal Vite production build.
- Browser review at 1440px desktop, 768px tablet and 390px phone; width bounds
  checked at 320, 768, 1440 and 1920px (1680px cap at the last size).
- Six context compositions and sparse-content behavior inspected in the browser.
- Scene keyboard arrows, scene-to-section navigation, programme details,
  drawer Escape/return focus, search-to-detail navigation and both referee
  workspace gateways exercised.
- Reduced-motion CSS implemented; OS preference emulation was not exercised.
- Real account/API authorization, submissions and live deployment are outside
  this fixture preview's validation.
