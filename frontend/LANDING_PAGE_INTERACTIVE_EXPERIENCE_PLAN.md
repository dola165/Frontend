# GrassKickZ Landing Page Interactive Experience Plan

**Status:** In progress — the first landing-only prototype pass is implemented; follow-up polish and evaluation remain
**Scope:** Landing page (`/`) only
**Primary files:** `src/pages/LandingPage.tsx`, new landing-only interaction components, and narrowly scoped landing styles/tests
**Related baseline:** `LANDING_PAGE_MAP_IMPLEMENTATION_PLAN.md`

## 1. Objective

Make the public landing page feel alive and memorable without weakening its primary purpose: letting visitors explore clubs on the map and decide whether to create an account.

The experience will have three layers:

1. **Useful motion** — restrained scroll-triggered reveals that guide the eye through the content below the map.
2. **Atmosphere** — subtle parallax for decorative layers that adds depth without moving important content unexpectedly.
3. **Optional playground** — an opt-in physics layer where footballs interact with selected edges of the landing page, including the map card, login card, headings, and selected content surfaces.

The map, search/filter controls, login form, navigation, and account actions remain the most important parts of the page. The playful layer must always be removable, pausable, and safe to ignore.

## Implementation status — current prototype pass

The first implementation pass is now in place behind the landing-page **Playground** control:

- [x] Opt-in canvas layer with a clear exit control; the feature is inactive by default.
- [x] Page-edge, selected heading/card, login-card, map-card, and feature-card collision surfaces.
- [x] Ball creation, gravity, bounded bounce, click-to-freeze, drag-to-aim, and capped launch impulse.
- [x] Created balls remain visible after the control panel closes; reset is explicit.
- [x] Stick/obstacle creation, drag repositioning, rotation, and visual color selection without moving real page elements.
- [x] Traditional goal and black-hole target creation, drag repositioning, selectable black-hole sizes, and local capture feedback.
- [x] Spray paint with small/large brushes, a waterfall mode, five labelled materials, narrow free-space strips, obstacle contact sampling, and undo/reset controls.
- [x] Supplied playground ball artwork is loaded from a local public asset with a vector fallback.
- [x] The Playground launcher/panel and opted-in content cards can be visually repositioned without changing document flow; login and map remain fixed.
- [x] Reduced-motion handling, protected normal controls, and no persistence or backend/theme mutation.

The remaining plan items are deliberate follow-up work: richer goal/ball artwork, deeper swept-path material sampling, keyboard shortcuts beyond the command palette, visibility-aware pausing, performance telemetry, and a decision on whether the experiment earns a permanent place on the landing page.

## 2. Product principles

- [ ] The map remains the first and dominant interaction above the fold.
- [ ] Nothing moves automatically in a way that hides, shifts, or blocks the map or login form.
- [ ] The physics playground is opt-in; no balls fall on initial page load.
- [ ] Scroll animations are subtle and must not create layout shift.
- [ ] Parallax is decorative only. It must not move the actual map, form, navigation, or important text out of position.
- [ ] Page controls remain usable while the playground is active.
- [ ] Motion respects `prefers-reduced-motion` and has a visible pause/disable path.
- [ ] The first prototype uses temporary/vector visuals if final artwork is not available.
- [ ] No fake statistics, testimonials, or unsupported product claims are introduced.
- [ ] The feature is isolated to the landing page and cannot alter authenticated map behavior.

## 3. Explicit non-goals for the first prototype

- [ ] Do not turn the landing page into a full game or require a score to understand the product.
- [ ] Do not add sound effects, music, login rewards, or forced tutorial steps.
- [ ] Do not make every individual glyph, icon, button, input, or tiny label a collision object.
- [ ] Do not let the playground capture map panning, map zoom, filter input, login input, or normal link clicks.
- [ ] Do not introduce a large physics dependency until a lightweight prototype proves the interaction is worth keeping.
- [ ] Do not build multiplayer, saved levels, leaderboards, or accounts for playground state.
- [ ] Do not let paint alter the real page colors, map tiles, login card, or shared application theme; paint is a physics material only.

## 4. Proposed landing-page experience

### 4.1 Default state

- [ ] Landing page opens exactly as it does today: map-first layout, login panel, and below-map introduction sections.
- [ ] Scroll-reveal animations are enabled only when motion is allowed by the browser.
- [ ] Parallax decorative layers are present only where they improve hierarchy and contrast.
- [ ] The playground is dormant and adds no pointer interception, CPU loop, or visual distraction.
- [ ] A small, persistent top-left control labelled **Playground** (or the final approved label) is visible without competing with the brand logo.

### 4.2 Playground activation

- [ ] Pressing the control explicitly activates the landing playground.
- [ ] Activation shows a small status/control treatment: active state, pause, reset/clear, and close/exit.
- [ ] A short, dismissible hint explains: “Click a ball to freeze it. Drag to aim, then release to shoot.”
- [ ] Initial activation may release a small number of balls, but never floods the page.
- [ ] The state is local to the current landing-page visit; no backend persistence is required.
- [ ] Closing the playground stops its animation loop and releases all temporary pointer handlers.

### 4.3 Ball interaction

- [ ] Balls fall under a deliberately gentle gravity value.
- [ ] Balls collide with registered page surfaces and page boundaries.
- [ ] A click/tap on a ball freezes that ball in place.
- [ ] Dragging from a frozen ball displays a lightweight aim vector.
- [ ] Releasing launches the ball with a capped impulse.
- [ ] Balls bounce with moderate restitution and lose energy through friction so they eventually settle.
- [ ] The number of active balls is capped (initial recommendation: 6–8).
- [ ] Balls can be cleared/reset at any time.
- [ ] Pointer and touch input use pointer capture so aiming does not break if the pointer leaves the ball.
- [ ] Keyboard fallback is provided for the active control state, including pause, reset, and exit.

### 4.4 Goals and targets

Goals are part of the optional physics layer, not part of the actual product map or page layout. The first prototype should support both a familiar football target and a more abstract target so we can judge which direction feels most natural.

- [ ] Add a **Create goal** control that places a target in an available area without changing the underlying page layout.
- [ ] Allow an existing target to be dragged to a new position while the playground is active.
- [ ] Support a traditional goal: a visible rectangular goal mouth with a defined capture area.
- [ ] Support a **black-hole target**: a circular target with selectable small/medium/large radius.
- [ ] A ball entering a goal or black-hole capture area triggers a restrained visual response and records a local success event.
- [ ] Keep goals bounded to the landing viewport/playground world and prevent them from covering important controls.
- [ ] Cap the number of active targets in the first prototype (initial recommendation: 3).
- [ ] Provide a reset/clear action for goals independently from balls where practical.
- [ ] Make target type and size visible in the control state so visitors understand what they created.

### 4.5 Paint and physics materials

Paint is a temporary, local material system for the interactive layer. Spraying a color should change how a ball behaves when it contacts or crosses that painted region, while leaving the real page completely unchanged.

- [ ] Add a separate **Paint** control that opens a compact, labelled color/material palette.
- [ ] Let the visitor spray paint with pointer or touch drag rather than requiring precise single clicks.
- [ ] Support a small brush size for painting narrow strips and mid-air trick-shot routes.
- [ ] Support a larger brush size for painting broader obstacle faces or background zones.
- [ ] Paint only the physics layer: no DOM color changes, no map tile changes, no login/theme changes, and no mutation of shared app styles.
- [ ] Store paint strokes locally for the current visit only; no backend persistence is needed.
- [ ] Make painted regions visible with restrained translucent overlays so the material is understandable without overpowering the landing page.
- [ ] Allow undo-last-stroke and clear-all-paint actions.
- [ ] Label each material by name and behavior; color alone must never be the only signal.

#### Initial material palette

The material model should be data-driven so more behaviors can be added without rewriting collision code. The following are prototype candidates, not permanent brand rules:

- [ ] **Yellow — Sticky:** high surface friction and stronger velocity damping; the ball slows and can briefly cling to a wall.
- [ ] **Pink — Bouncy:** high restitution; the wall and ball produce a lively rebound.
- [ ] **Cyan — Speed:** low friction plus a controlled tangential speed boost after contact or when crossing a painted strip.
- [ ] **Violet — Slide:** very low friction; the ball glides along the painted wall instead of settling quickly.
- [ ] **Orange — Soft brake:** moderate damping that slows the ball without a sticky stop.
- [ ] Keep the material interface extensible for later effects such as direction deflection, gravity bias, or temporary portals, but do not implement every effect in the first pass.

#### Paint geometry and mid-air trick shots

- [ ] Represent paint as local physics zones: segments attached to walls/obstacles and free 2D patches placed on the interactive background.
- [ ] Sample the material at the ball's contact point and along its movement path so a narrow painted strip can change behavior mid-air.
- [ ] Give paint zones a bounded lifetime or stroke count only if unlimited painting affects performance; the first default should be generous but finite.
- [ ] Ensure overlapping colors have deterministic precedence (initial recommendation: newest stroke wins, with an undo action).
- [ ] Keep a debug-only material overlay/inspector available during development, but do not expose technical coordinates to visitors.

## 5. Collision-surface model

### 5.1 Surface registration

The page should use explicit opt-in markers instead of treating every DOM element as an obstacle. This keeps the page usable and makes the visual result intentional.

Suggested markers:

```tsx
<section data-bounce-surface="intro-heading">...</section>
<div data-bounce-surface="map-card">...</div>
<aside data-bounce-surface="login-card">...</aside>
<article data-bounce-surface="feature-card">...</article>
```

- [ ] Add surfaces to the visible outer edges of the map card and login card.
- [ ] Add surfaces to selected headings or heading wrappers as thin horizontal obstacles.
- [ ] Add surfaces to the below-map feature/audience cards where a broad card edge looks natural.
- [ ] Add the viewport/page edges as invisible safety boundaries.
- [ ] Exclude inputs, buttons, links, search controls, map controls, the logo, and navigation from collision surfaces unless a later test proves a specific edge is safe.
- [ ] Give every surface a stable identifier for debugging and automated checks.

### 5.2 What “text as an obstacle” means

The first prototype will use the bounding rectangle of a text block or heading wrapper, not the outline of individual letters. This produces predictable thin surfaces and avoids balls getting trapped between glyphs.

- [ ] Headings use their measured line box as a horizontal surface.
- [ ] Multi-line paragraphs are either excluded or represented by one broad, low-priority surface.
- [ ] Typography changes, responsive wrapping, font loading, and localization must trigger surface recalculation.

### 5.3 Geometry refresh

- [ ] Collect `getBoundingClientRect()` values only while the playground is active.
- [ ] Recalculate after initial font/layout stabilization.
- [ ] Recalculate on window resize and responsive breakpoint changes using `ResizeObserver` where available.
- [ ] Recalculate on scroll so balls continue to collide with the visible page edges as the visitor moves through the landing page.
- [ ] Use a single coordinate system for viewport/page coordinates; do not mix MapLibre's internal coordinates with DOM coordinates.
- [ ] Keep geometry collection outside React render state to avoid rerendering the landing page every animation frame.

## 6. Physics implementation approach

### 6.1 Preferred first implementation

- [ ] Build a landing-only `LandingPlayground` component.
- [ ] Use a single canvas or a small canvas plus DOM controls for the prototype.
- [ ] Run a `requestAnimationFrame` loop only while active and visible.
- [ ] Pause the loop when the tab is hidden or the playground is closed.
- [ ] Represent each surface as line segments with a normal, not as a full physics body dependency.
- [ ] Represent each ball as a circle with position, velocity, radius, gravity, restitution, and friction.
- [ ] Resolve penetration before applying bounce velocity to prevent balls from sinking into cards.
- [ ] Cap the simulation timestep to prevent huge jumps after tab switching or frame drops.
- [ ] Keep visual interpolation separate from collision calculations where practical.
- [ ] Add a small target model with type (`GOAL` or `BLACK_HOLE`), position, size, and capture behavior.
- [ ] Add a data-driven material model with friction, restitution, damping, speed modifier, and optional capture/target modifiers.
- [ ] Keep paint strokes and target positions in the physics world rather than mutating DOM styles.
- [ ] Evaluate material zones at collision/contact and along the ball's swept path to support narrow mid-air paint strips.

### 6.2 Interaction layering

- [ ] Decorative parallax layers use `pointer-events: none`.
- [ ] Dormant playground canvas uses `pointer-events: none`.
- [ ] Active ball targets or the active playfield receive only the pointer events needed for ball selection/aiming.
- [ ] MapLibre controls, filters, search fields, login fields, and normal links remain reachable.
- [ ] If full-page pointer capture makes map interaction unreliable, active playground mode must visibly communicate that the visitor is in a playful mode and provide a one-click exit.
- [ ] Test the layering at desktop, tablet, and mobile widths before adding more surfaces.
- [ ] Goal dragging and paint spraying must be active only in the playground state and must not make normal page cards draggable.
- [ ] A paint stroke should never begin when the pointer starts inside a login field, map control, button, link, or command palette.
- [ ] If the active physics layer needs pointer priority, show an explicit active-state treatment and keep the exit control outside the painted/obstacle area.

## 7. Scroll-triggered motion

- [ ] Add a small reusable landing-only reveal wrapper or hook based on `IntersectionObserver`.
- [ ] Animate opacity and `transform` only; avoid animating layout properties such as width, height, margin, or top/left.
- [ ] Stagger cards by a short, bounded delay rather than animating every element independently.
- [ ] Keep the hero/map section static or nearly static so the map is available immediately.
- [ ] Mark revealed content as visible after the first intersection so it does not repeatedly animate while scrolling back and forth.
- [ ] Use a no-motion path that renders all content immediately.
- [ ] Confirm screen readers receive all content regardless of animation state.

## 8. Parallax treatment

- [ ] Use only a few low-contrast decorative layers behind the below-map content.
- [ ] Cap displacement to a small range (initial recommendation: 8–24px depending on depth).
- [ ] Drive updates with `requestAnimationFrame` or CSS custom properties rather than React state on every scroll event.
- [ ] Keep the map tile rendering, map pins, filter strip, login form, and text readability unaffected.
- [ ] Provide a reduced-motion fallback that disables parallax completely.
- [ ] Ensure decorative layers do not create horizontal overflow or unexpected scrollbars.

## 9. Landing command palette

The command palette is useful independently of the playground and should be implemented as a focused, guest-safe navigation aid.

- [ ] Open with `Ctrl+K` / `Cmd+K`.
- [ ] Provide a visible button or accessible hint so keyboard-only users are not required to discover the shortcut.
- [ ] Trap focus while open and return focus to the triggering control on close.
- [ ] Close with `Escape`, outside click, or a selected action.
- [ ] Support keyboard arrow navigation and Enter activation.
- [ ] Include only actions available to guests:
  - [ ] Explore GrassKickZ World
  - [ ] Browse clubs
  - [ ] Find a club or city on the map
  - [ ] Browse tournaments
  - [ ] Browse jobs and volunteering
  - [ ] Open campaigns
  - [ ] Scroll to “how it works” / role introductions
  - [ ] Open or close the Playground
  - [ ] Log in
  - [ ] Create an account
- [ ] Do not duplicate the map's own search semantics; selecting “Find a club or city” should focus the existing map search/filter control.
- [ ] Do not expose authenticated-only workspace actions to anonymous visitors.

## 10. Visual assets

### Required for the first real prototype

- [ ] One transparent football PNG or SVG, ideally 128–256px, tightly cropped, with no large invisible padding.
- [ ] A fallback vector/CSS ball so the interaction remains testable if the asset is unavailable.
- [ ] A temporary vector or CSS treatment for the traditional goal mouth and black-hole target; final goal artwork is optional for the first physics pass.

### Optional polish assets

- [ ] Transparent traditional goal artwork with a clearly defined goal-mouth/capture area.
- [ ] Optional black-hole artwork or a dark circular gradient treatment with small/medium/large variants.
- [ ] Optional stick/obstacle artwork. CSS or canvas lines are preferred initially because they can match measured page edges.
- [ ] Two or three subtle transparent parallax layers (pitch markings, stadium silhouettes, abstract football shapes, or similar).
- [ ] Any brand-specific palette or texture requirements.

### Asset acceptance checks

- [ ] Assets have transparent backgrounds where appropriate.
- [ ] Assets do not contain baked-in oversized shadows that make collision size look wrong.
- [ ] Asset dimensions and aspect ratios are documented.
- [ ] Assets are optimized for the web and do not noticeably increase landing-page load time.

## 11. Accessibility and safety

- [ ] Honor `prefers-reduced-motion: reduce` by disabling physics, parallax, and reveal movement while keeping content visible.
- [ ] Provide Pause, Reset, and Exit controls with accessible names.
- [ ] Keep all normal page actions keyboard reachable.
- [ ] Never rely on motion alone to communicate the map, login, or account actions.
- [ ] Maintain readable contrast over all decorative layers.
- [ ] Avoid flashing, rapid bouncing, or continuous motion that could be uncomfortable.
- [ ] Test touch targets at mobile widths.
- [ ] Ensure the playground does not prevent scrolling or trap focus.
- [ ] Respect battery/performance constraints by stopping work when inactive.

## 12. Implementation phases

### Phase 0 — Baseline and feature boundary

- [ ] Record the current landing-page behavior and responsive screenshots.
- [ ] Confirm the map/filter/login flows still work before adding the interaction layer.
- [ ] Add a landing-only feature flag or local development toggle if needed.
- [ ] Define the stable surface markers and component ownership.
- [ ] Add a short rollback note describing exactly which new files/sections can be removed.

**Exit criteria:** The landing page has a documented baseline and an isolated place for the experimental feature.

### Phase 1 — Motion foundation

- [ ] Implement the IntersectionObserver reveal primitive.
- [ ] Add reduced-motion handling.
- [ ] Apply reveals to the below-map sections only.
- [ ] Verify no layout shift, overflow, or map interaction regression.

**Exit criteria:** The page feels more polished while remaining functionally identical when the playground is disabled.

### Phase 2 — Parallax atmosphere

- [ ] Add the first decorative layer(s) using temporary CSS/vector artwork.
- [ ] Implement a capped scroll-driven offset.
- [ ] Add the no-motion path and pause behavior.
- [ ] Verify contrast and readability at all responsive widths.

**Exit criteria:** Parallax adds depth without competing with the map or making the page feel unstable.

### Phase 3 — Command palette

- [ ] Implement the modal/palette shell and focus management.
- [ ] Add guest-safe navigation actions.
- [ ] Connect map-focus and playground-toggle actions.
- [ ] Add keyboard and screen-reader tests.

**Exit criteria:** A visitor can discover the main landing actions quickly without learning the site structure first.

### Phase 4 — Page-surface physics prototype

- [ ] Build `LandingPlayground` with a capped canvas loop.
- [ ] Add page boundary collision.
- [ ] Add map card and login card edge surfaces.
- [ ] Add selected heading/card surfaces.
- [ ] Add ball freeze, aim, launch, pause, reset, and exit behavior.
- [ ] Add create/drag target behavior for a traditional goal and black-hole target.
- [ ] Add target capture feedback and local success state without requiring a scoreboard.
- [ ] Add responsive geometry refresh and scroll synchronization.
- [ ] Keep normal controls functional and provide an immediate exit if layering feels intrusive.

**Exit criteria:** The page itself visibly behaves as the obstacle course, but the map, login, and normal navigation remain usable.

### Phase 5 — Visual tuning and assets

- [ ] Replace temporary ball artwork if final assets are supplied.
- [ ] Tune gravity, bounce, friction, ball size, and surface selection.
- [ ] Add the Paint control and labelled material palette.
- [ ] Implement spray strokes, brush size, undo, and clear actions.
- [ ] Apply material properties to wall/obstacle contacts and narrow background paint zones.
- [ ] Verify yellow sticky, pink bouncy, cyan speed, violet slide, and orange soft-brake behaviors are distinguishable but bounded.
- [ ] Tune goal/black-hole sizes and capture feedback.
- [ ] Tune parallax speed and reveal timing.
- [ ] Add subtle success feedback for a goal/hole only if it improves the experience.
- [ ] Remove any surface that causes repetitive sticking or blocks content.

**Exit criteria:** The experiment feels intentional and branded rather than like an unrelated demo.

### Phase 6 — Verification and decision gate

- [ ] Run TypeScript, ESLint, unit tests, and production build.
- [ ] Test desktop mouse, touch, keyboard-only, reduced-motion, and narrow mobile layouts.
- [ ] Test map search/filter, login inputs, links, scrolling, and command palette while playground is off and on.
- [ ] Check CPU usage while active and confirm it stops when inactive.
- [ ] Capture before/after screenshots and a short demo recording if useful.
- [ ] Decide whether to keep, simplify, or remove the playground.

**Exit criteria:** The team can make a deliberate keep/refine/revert decision based on a working prototype.

## 13. Acceptance checklist

### Experience

- [ ] The landing page still communicates “explore clubs on the map” within the first screen.
- [ ] The login panel remains visible and usable.
- [ ] Scroll-down introductions remain optional context rather than a competing hero.
- [ ] The playground is clearly optional and easy to exit.
- [ ] Balls visibly bounce/slide against meaningful page edges.
- [ ] Clicking, aiming, and shooting a ball feels predictable.
- [ ] Visitors can create or reposition a traditional goal and a black-hole target without moving real page elements.
- [ ] A goal/black hole captures a ball predictably and gives restrained feedback.
- [ ] Visitors can spray a labelled paint material onto a wall, obstacle, or small background patch.
- [ ] A narrow painted strip can change a ball's behavior during a trick shot.
- [ ] Paint changes physics only; the real page, map, and application theme remain visually unchanged.
- [ ] Yellow, pink, and at least one speed/slide material are visibly distinguishable in behavior.
- [ ] Paint can be undone or cleared without resetting the rest of the landing page.
- [ ] The page does not become visually noisy after a few seconds.

### Functional regression

- [ ] Landing map search still works.
- [ ] Landing filter submit still closes the filter and updates markers.
- [ ] “Explore GrassKickZ World” still opens `/world`.
- [ ] Login, signup, browse-clubs, and footer links still work.
- [ ] Authenticated `/map` is unchanged.
- [ ] No physics code or styles load/run on unrelated routes.

### Accessibility/performance

- [ ] Reduced-motion users receive a stable static page.
- [ ] Playground controls have accessible names and keyboard support.
- [ ] There is no keyboard trap.
- [ ] No horizontal overflow is introduced.
- [ ] Animation stops when inactive or hidden.
- [ ] Production build size and runtime remain acceptable.

## 14. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Balls block map controls or login inputs | Explicit surface registry; pointer events disabled until activation; immediate exit control |
| Text wrapping changes collision behavior | Measure wrappers, refresh geometry on resize/scroll/font readiness |
| Physics feels chaotic or childish | Cap balls, lower gravity, add friction, remove bad surfaces, keep no score/sound |
| Motion distracts investors or first-time visitors | Playground off by default; map and product explanation remain visually dominant |
| Mobile performance drops | Small ball cap, bounded timestep, pause when hidden, test on touch widths |
| Accessibility discomfort | Reduced-motion path, pause/exit controls, no flashing or forced motion |
| Future layout edits break the scene | Stable `data-bounce-surface` markers and a small geometry-debug mode during development |
| Paint effects become unpredictable or overpowering | Bounded material coefficients, labelled palette, newest-stroke precedence, undo/clear, and no real style mutation |
| Painted background patches are too expensive to sample | Use a capped stroke/zone count and a coarse spatial lookup before considering more advanced geometry |
| Goals cover important content or become impossible to move | Clamp target positions to safe regions and keep a reset/clear action available |
| Prototype is difficult to remove | Keep all playground code in landing-only files and avoid changes to shared map/auth components |

## 15. Decisions to confirm before implementation

Recommended defaults are marked below.

- [ ] **Playground name:** `Playground` (recommended) / `Street game` / another label.
- [ ] **Activation behavior:** release 3–4 balls on activation (recommended) / release one ball / release none until “Drop balls” is pressed.
- [ ] **Active-area behavior:** preserve map interaction where possible (recommended) / playground mode temporarily takes pointer priority over the landing surface.
- [ ] **Goal behavior:** visual pulse only (recommended) / score counter / no goals in the first prototype.
- [ ] **Target types:** traditional goal plus black-hole target (recommended) / traditional goal only until the interaction is proven.
- [ ] **Target placement:** create and drag targets (recommended) / drag only after one target is placed automatically.
- [ ] **Paint activation:** a separate Paint button with a labelled palette (recommended) / one combined Playground menu.
- [ ] **Paint scope:** wall/obstacle surfaces plus small free background patches (recommended) / wall and obstacle surfaces only.
- [ ] **Paint palette:** 4–5 bounded materials (recommended) / start with Yellow sticky and Pink bouncy only.
- [ ] **Paint overlap:** newest stroke wins with undo (recommended) / blend material values.
- [ ] **Audio:** silent (recommended) / optional user-enabled sound.
- [ ] **Ball visual:** temporary vector first (recommended) / provide final football asset before implementation.
- [ ] **Parallax style:** abstract football/pitch shapes (recommended) / stadium layers / another visual direction.
- [ ] **Persistence:** reset on every page visit (recommended) / remember that the visitor enabled the playground locally.

## 16. Rollback plan

If the experiment feels distracting, confusing, or technically fragile:

- [ ] Disable the playground activation control and remove the landing playground component.
- [ ] Remove the landing-only surface markers; they must not be required by normal layout.
- [ ] Keep the scroll-reveal and command-palette work if those remain useful.
- [ ] Remove parallax layers independently if they compete with the map.
- [ ] Re-run the full landing regression checklist and production build.
- [ ] Do not revert unrelated map, auth, workspace, or profile changes.

## 17. Current recommendation

Proceed in this order:

1. Scroll reveals and reduced-motion foundation.
2. Command palette, because it has clear product value even without the playful layer.
3. Subtle parallax below the map.
4. The full-page collision prototype behind an explicit Playground toggle.
5. Add goals/black holes, then the paint/material system after the basic ball physics feels stable.

The physics concept is worth testing, but it should earn its place through a small, controlled prototype. Goals and paint make the sandbox more expressive, but they also multiply state and collision edge cases, so they should follow the basic ball/surface pass. The map-first landing page remains the product; the playground is the invitation to explore it.
