# GrassKickZ design system

This is the canonical design brief for the Matches & Competitions refactor and its connected workflows. Prepared on 2 October 2026 from the maintained frontend source and the user's explicit reference choices. Use it with the [implementation handoff](C:/Users/daddo/IdeaProjects/GrassKickZ/docs/workstreams/matches-competitions-2026-10-02/HANDOFF.md).

The user wants the quality and visual language of **Home feed, club workspace, Store, Stadiums, Campaigns, and Jobs & Volunteering**. Preserve those foundations. The supplied old Tournament and Match Exchange screenshots identify problems; they are not the desired visual direction. This document records source-derived values and proposed usage rules. It is not a claim that new screens have been generated, rendered, user-approved, or accessibility-certified. Validate the live/current reference screens and new implementation during the handoff's browser review; refine this document in place if the cascade or rendered result differs.

The installed EngineeringSuite StitchDesign 2.0.0 plugin supplies a semantic design-document skill. Its generic taste defaults are subordinate to the user's existing-product direction: **retain Inter, the established green, useful symmetric grids, quiet motion, and existing component geometry**. Do not import forced asymmetry, perpetual animation, random image placeholders, an arbitrary new typeface, or a new component framework. No Google Stitch MCP generation tools were exposed when this document was created; it can guide the coding agent directly or be supplied to the Google Stitch web app.

## 1. Visual theme and atmosphere

GrassKickZ is a practical football platform used repeatedly by coaches, players, families, officials, and organisers. It should feel professional, calm, credible, and populated with useful football information. Use a balanced daily-work density: clear hierarchy, enough room to scan, and compact metadata without turning every screen into a dense control panel.

Green identifies primary actions and selected context. Neutral surfaces carry the content. Photography adds football context on discovery and public event surfaces; operational views prioritise readable fixtures, decisions, eligibility, and readiness. Avoid promotional hero layouts on ordinary work pages.

Home is a social reading experience with a narrower central feed. Club work is a stable workspace with a sidebar and contextual actions. Store, stadium, campaign and jobs discovery use structured search, filters, and media-led records. Share typography, surfaces, controls, and navigation conventions while retaining those useful layout differences. Matching the family does not mean forcing every page into the Home feed's exact columns.

Use one page title, a short useful description when needed, explicit club/squad context, and one dominant next action in each task region. Place secondary actions nearby at lower emphasis. Advanced tools remain discoverable in consistent menus or panels. Do not make users switch the entire application into a role mode.

## 2. Color palette and roles

The source of truth is [theme.css](C:/Users/daddo/WebstormProjects/Frontend/frontend/src/styles/theme.css). Consume semantic CSS variables in implementation. The values below document the current `product-design-active`/private-work palette for design tools; they are not permission to scatter literal colors through component styles.

| Role and token | Light | Dark | Use |
| --- | --- | --- | --- |
| Page canvas `--color-page` | `#F3F5F4` | `#0A0D0F` | Quiet surrounding page background. |
| Main surface `--color-surface` | `#FFFFFF` | `#13181D` | Cards, filters, work panels. |
| Elevated surface `--color-elevated` | `#E9EEEC` | `#1C232A` | Raised/contextual surfaces where the component calls for them. |
| Inset surface `--color-inset` | `#F7F9F8` | `#0E1216` | Input wells, selected support regions and recessed areas. |
| Structural border `--color-border` | `#C7D1CD` | `#222B35` | Thin separation and component edges. Verify contrast where a border is the only control boundary. |
| Primary text `--color-text` | `#17251E` | `#F2F4F6` | Titles, content, values and important labels. |
| Supporting text `--color-secondary`, `--color-muted` | `#4B5F54` | `#A5AFB8` | Supporting descriptions and metadata, still readable. |
| Football green `--color-accent` | `#146B3C` | `#00E676` | Primary actions, current selection and useful emphasis. |
| Text on green `--color-on-accent` | `#FFFFFF` | `#06110B` | Button text/icons on filled primary actions. |
| Danger `--color-danger` | `#B62E43` | `#EC8DAF` | Errors and destructive consequences. |
| Warning `--color-warning` | `#815609` | `#E8BA62` | A condition needing attention, with text explaining it. |
| Information `--color-info` | `#245CAA` | `#83B9EF` | Informational status, not a second primary action brand. |

Status colors supplement the green action accent; they must not be deleted because a generic design recipe permits only one color. Pair status color with text or an icon. Never use green for a dangerous action merely for consistency. Use `--color-accent-soft`/other existing soft tokens for low-emphasis fills, and `--color-hover` for neutral interaction feedback. Product scope currently uses a 9% accent mix; base/theme consumers may use 12%. Reuse the appropriate scope rather than flattening these indiscriminately.

Home's approved dark scope intentionally differs: canvas `#090D12`, surface `#131821`, elevated `#1C222D`, inset `#0E131B`, border `#28313F`, text `#EEF3F7`, and supporting text `#ADB7C4`. Its final action green is `#00E676` with `#06110B` text. Home's light action green is `#146B3C`. The user's October 3 annotations request consistent green navigation and public club surfaces, now using the neutral product palette. The geographic map retains its separate palette. The newer Home feed is the typography, border, grouping and spacing reference; its remaining cyan background cast is explicitly not a design reference.

Use the existing theme preference and route-owned scope, including portals and dialogs. A root-wide palette change is not a substitute for correct scope ownership. Check computed styles after navigating between Home, club work, hub, and Map. Do not derive colors from the older screenshots when the maintained reference source has changed.

## 3. Typography rules

Retain the application sans-serif stack. [index.css](C:/Users/daddo/WebstormProjects/Frontend/frontend/src/index.css) imports **Inter** and contains `Inter, Segoe UI, sans-serif` and a scope with `Inter, IBM Plex Sans, Segoe UI, sans-serif`. Inherit the active application font in controls. Preserve Georgian glyph support and test fallback rendering. Do not add another font service or replace Inter for stylistic novelty.

Existing product page headings use `clamp(28px, 2.6vw, 38px)`, line-height `1.2`, weight `750`, and letter-spacing `-0.035em`. Club workspace uses closely related values with line-height `1.16` and `-0.04em`. Preserve this scale; the imported font declaration lists 400/500/600, so verify actual loaded/synthesised weights rather than assuming every requested weight has its own font file.

For new components, use this proposed hierarchy consistent with those references:

- Page titles: approximately 1.75–2.375rem (28–38px at the default 16px root), following the shared fluid heading rule.
- Section titles: 1.125–1.375rem (18–22px), with weight providing distinction.
- Record/card titles: 0.9375–1.0625rem (15–17px), normally 600–700; permit wrapping.
- Main body and form content: 0.875–1rem (14–16px), comfortable line-height around 1.5–1.65. Mobile text-entry fields should render at least 16px to avoid unwanted browser zoom.
- Supporting metadata: normally 0.75–0.8125rem (12–13px). Small uppercase eyebrows may follow existing 10–11px styling only for nonessential orientation, never for instructions, errors, permissions, or the main action.

Numbers in comparable columns should align using tabular numerals; do not force a separate monospace font on all metadata. Keep long prose around 60–70 characters per line where useful, without constraining tables or short record metadata to that width. Avoid all-caps body text, exaggerated letter spacing, and oversized titles that displace the first useful content.

## 4. Component styling and behavior

Reuse existing primitives and sound patterns before adding new ones. Relevant starting points include [MediaImage](C:/Users/daddo/WebstormProjects/Frontend/frontend/src/components/ui/MediaImage.tsx), [actions.css](C:/Users/daddo/WebstormProjects/Frontend/frontend/src/styles/actions.css), [DiscoverySectionTabs](C:/Users/daddo/WebstormProjects/Frontend/frontend/src/components/discovery/DiscoverySectionTabs.tsx), [StoreFilters](C:/Users/daddo/WebstormProjects/Frontend/frontend/src/features/store/StoreFilters.tsx), [useFilterDisclosure](C:/Users/daddo/WebstormProjects/Frontend/frontend/src/hooks/useFilterDisclosure.ts), and the directory/filter components already in `src/components/discovery`. Reuse behavior without carrying unrelated store, jobs, or tournament data semantics into the new components.

**Buttons and links.** Use solid green with the theme's on-accent text for primary actions. Secondary controls use a neutral surface/border or the shared text-action treatment. Existing action radii are around 8–10px; product input minimum height is 42px. For new touch-facing controls ensure an effective non-overlapping target of at least 44px. Icons supplement useful labels; standalone icon buttons require accessible names. Loading actions retain their dimensions and show progress without allowing duplicate commands. Disabled styling must be legible; explain relevant prerequisites in accessible text. Use real link semantics for navigation.

**Cards, lists and tables.** Product cards/panels use a 1px semantic border, 14px (0.875rem) radius, neutral surface and usually no shadow. Home contains 12px cards and some 14px emphasis panels. Preserve this restrained family rather than introducing oversized 40px corners or glass effects. Use cards for distinct browsable records and meaningful groups; use rows/tables when comparison is more useful. Two- and three-column grids are both legitimate when content width supports them. Do not wrap every paragraph in another nested card. Provide meaningful hover/focus states without layout jumps.

**Search and filters.** Match the store/jobs/stadium pattern: a clearly labelled search, sort, filter access, visible active chips and result count. Use one visual border around a search with an embedded icon. On wider layouts a filter sidebar is appropriate; on narrow layouts use the existing accessible disclosure/drawer behavior. Reset criteria consistently and restore focus after dismissal. Give unavailable location or conflicting criteria a useful recovery path. Distinguish loading, failed requests, no matching results and an entirely empty collection. Counts must reflect the real authorised API result.

**Forms and complex setup.** Labels sit above fields; hints explain consequential choices and errors sit next to their fields. Related inputs share a row only when they fit. Organise competition creation by meaningful steps such as identity, eligibility/rules, structure, schedule and review. Preserve entered data after validation failures. Advanced rules remain accessible through labelled disclosure; do not make the main form a wall of every possible option. The final review must state the actual configuration and consequences.

**Navigation and context.** Use consistent selected/active indicators and visible focus; keep the existing `SelectionIndicator` behavior where suitable. The proposed hub is Overview, Find a match, Competitions, Fixtures & results, Officials. Competition family choices are subordinate to Competitions. Keep management tools and My work distinct from public discovery. Show the selected club/squad and who the action affects. Hide irrelevant private workspace actions while retaining legitimate public referee discovery; do not render private data and then cover it with a permission notice. UI visibility follows current capabilities and does not replace server enforcement.

**Detail pages.** Lead with identity, real status, essential eligibility/time/place information and the next useful action. For an unconfirmed match, prioritise proposing/agreement. For a confirmed fixture, prioritise preparations, venue and officials. For a completed match, prioritise result and reports. Broadcast, history, and optional sections should appear when meaningful or remain reachable through predictable secondary navigation. Avoid large empty score/broadcast panels above an opponent proposal.

**Feedback and accessibility.** Use layout-matched skeletons for collection loading and compact progress for an in-flight action. Display errors with retry/recovery and preserve valid form state. Give an empty view a clear explanation and an available next step; do not imply a failed request is empty data. A restricted view should explain the permitted next step without revealing hidden records. Use the shared 2px focus outline with roughly 3px offset where applicable; verify it against the actual surface. Aim for WCAG 2.2 AA on affected interfaces, with keyboard/focus and contrast review beyond automated scans.

## 5. Layout, responsive behavior and imagery

The product scope in [product-design.css](C:/Users/daddo/WebstormProjects/Frontend/frontend/src/styles/product-design.css) bounds common discovery pages at **1520px**, with `28px clamp(16px, 3vw, 40px) 64px` padding. Club workspace has a **1424px** inner content width and `clamp(20px, 3vw, 48px)` gutters. Home has a **1920px** outer frame but a **680px** central reading column. These are different useful compositions; do not copy the broad application max-width as the width of every content region.

Use the discovery composition for the new hub and browse pages, and the club-workspace composition for management. Align heading, navigation, toolbar and results to the same grid. A store-style starting point has a 240px filter rail and 28px gap; adapt it to content, rather than fixing that width on mobile. Typical source gaps are 12, 16, 20, 24 and 28px. Use this rhythm and existing shared spacing; new 4/8px increments can serve compact subgroups. Avoid arbitrary one-off margins and large empty bands.

Let content dictate grid collapse using the existing approximately 1100px and 760–767px patterns as starting points. On phones, stack major columns, keep search/actions usable, move filters into an accessible disclosure, and wrap long titles and chips. Dense fixtures/tables/brackets may use a deliberately labelled contained scroll region or alternate list view; the entire document must not overflow horizontally. Do not truncate the only available description of an action or error. Test at 360/390px, tablet, 1280/1440px desktop and with zoom/text expansion.

Use relevant football stock photography or genuine uploaded media to make discovery legible and credible. A 16:9 event cover follows the campaign pattern; compact lists may use a smaller stable crop. Store's portrait product photos are not a reason to make every fixture card tall. Keep event information as accessible text adjacent to imagery. Photos must not be inserted between title words merely to create a fashionable hero.

Prefer genuine event/club uploads when present. Use licensed stock only as generic football imagery or clearly synthetic/demo illustration; record source/license/attribution and crop in a media manifest. Do not imply stock subjects are the actual coach, referee, squad or event participants. Use stable media paths, responsive image sizes, reserved aspect ratios, appropriate `object-fit`, and meaningful alt text or empty alt for decorative imagery. Missing media gets a coherent fallback, not a broken image or a random image service. Check text contrast over any actual cover/scrim.

## 6. Motion and interaction

Reuse [app-motion.css](C:/Users/daddo/WebstormProjects/Frontend/frontend/src/styles/app-motion.css). Source tokens are `--app-motion-fast: 180ms`, `--app-motion-arrival: 320ms`, `--app-motion-ease: cubic-bezier(.22,1,.36,1)` and `--app-motion-soft: cubic-bezier(.16,1,.3,1)`. Existing route arrivals use a short fade, with small translation/scale for panels and dialogs.

Motion should communicate state and continuity. Use brief feedback, restrained selection movement and normal dialog/panel transitions. Do not add perpetual pulse/typewriter/float animations to active dashboard controls. Do not delay a long results list with a dramatic cascade. Preserve the source's reduced-motion handling and avoid persistent transforms that interfere with fixed portals. Prefer transform/opacity for movement, and do not introduce an animation dependency just for this refactor.

Hover is supplementary; all information and actions remain available on touch and keyboard. Keep focus stable through updates, restore it after a dialog, announce important asynchronous results appropriately, and prevent stale requests from replacing the currently selected context.

## 7. Anti-patterns and user-specific overrides

- Do not redesign the approved reference pages to match a plugin's generic defaults. Retain Inter and the current strong green. Black-valued legacy shadow/contrast tokens are not a reason for an unrelated palette rewrite.
- Do not import the old tournament page's visual weaknesses, create a parallel CSS theme, or globally restyle every `section`, `button` or `h1` to repair one route.
- Do not force asymmetry, equal card grids, or a sidebar everywhere. Use the layout suited to the task; symmetric grids are allowed.
- Avoid decorative neon glows, oversized gradients, endless motion, custom cursors, stock-photo headline collages, and enormous marketing heroes on work pages.
- Do not invent statistics, verification, career facts, available places, fees, fixture status or sanctioning badges for visual effect. Representative synthetic fixtures must be clearly identified.
- Avoid nonsense titles, repeated generic trophy placeholders, lorem ipsum, unreadable low-contrast metadata and vague actions such as "Manage" when a specific action is known.
- Do not use emoji as the application's control icon system; reuse Lucide and the existing visual primitives. User-generated text is not subject to a blanket emoji ban.
- Do not hide capabilities simply to simplify a screenshot, or show an action that cannot complete. Correct task/context organisation and permissions must determine what is present.
- Do not treat colour, a padlock graphic, hidden navigation, or a generated screenshot as proof of security or accessibility.

## 8. Reference map and implementation acceptance

Inspect these current source references together with their rendered routes before finalising new screens:

| Reference | Source | What to carry forward |
| --- | --- | --- |
| Home | [FeedPage](C:/Users/daddo/WebstormProjects/Frontend/frontend/src/pages/FeedPage.tsx), [home-feed.css](C:/Users/daddo/WebstormProjects/Frontend/frontend/src/components/layout/home-feed.css) | Reading hierarchy, useful context, restrained cards and established identity. |
| Club workspace | [ClubWorkspacePage](C:/Users/daddo/WebstormProjects/Frontend/frontend/src/pages/ClubWorkspacePage.tsx), [workspace theme](C:/Users/daddo/WebstormProjects/Frontend/frontend/src/components/workspace/workspace-design-theme.css), [workspace scope](C:/Users/daddo/WebstormProjects/Frontend/frontend/src/styles/workspace-design.css) | Stable work navigation, contextual actions, meaningful density and bounded panels. |
| Store | [StorePage](C:/Users/daddo/WebstormProjects/Frontend/frontend/src/pages/StorePage.tsx), [store.css](C:/Users/daddo/WebstormProjects/Frontend/frontend/src/features/store/store.css) | Search/filter/chip/pagination patterns and media presentation. |
| Stadiums | [StadiumsPage](C:/Users/daddo/WebstormProjects/Frontend/frontend/src/pages/StadiumsPage.tsx), [StadiumProfilePage](C:/Users/daddo/WebstormProjects/Frontend/frontend/src/pages/StadiumProfilePage.tsx), [venue-organizations.css](C:/Users/daddo/WebstormProjects/Frontend/frontend/src/features/venues/venue-organizations.css) | Venue identity, actionable location information and purposeful imagery. |
| Campaigns | [CampaignsPage](C:/Users/daddo/WebstormProjects/Frontend/frontend/src/pages/CampaignsPage.tsx), [campaigns.css](C:/Users/daddo/WebstormProjects/Frontend/frontend/src/features/campaigns/campaigns.css) | Event-like covers, title/description hierarchy and clear status. |
| Jobs and volunteering | [JobsDirectoryPage](C:/Users/daddo/WebstormProjects/Frontend/frontend/src/pages/JobsDirectoryPage.tsx), [VolunteerPage](C:/Users/daddo/WebstormProjects/Frontend/frontend/src/pages/VolunteerPage.tsx), [jobs-opportunities.css](C:/Users/daddo/WebstormProjects/Frontend/frontend/src/features/clubs/jobs-opportunities.css) | Discovery versus personal-work separation, eligibility, filters and application actions. Verify currently enabled routes. |

The first visual journey is `coach@talanti.ge` with FC Dinamo Tbilisi Academy in the owned test environment. Review both themes, mobile/desktop, long and short content, with and without images, and loading/empty/error/denied states. Compare new screens side by side with the named reference pages. Verify permissions and actual persisted workflows separately under the handoff.

For Google Stitch, provide this document plus sanitised screenshots and a concrete screen/state brief. Ask it to extend the existing GrassKickZ system, not redesign the brand. Keep generated artifacts and project/screen IDs separate from production components. If a connected workflow needs `.stitch/DESIGN.md`, derive that copy from this file; do not maintain competing manuals. Using Stitch's web app is optional, and lack of MCP tools is not a reason to stall source-based implementation.

The implementation chat should read this document first, validate it against current rendered reference pages, and refine it only where justified. It should not restart the design extraction from scratch. Keep the theme check enabled and use the handoff's visual/accessibility and release evidence requirements as completion criteria.

### Render validation, 2 October 2026

The active `tournament-overview-20261002` app/web pair was reviewed in an owned PostgreSQL/media copy, first as `coach@talanti.ge` in FC Dinamo Tbilisi Academy. Home, club work, Store, Stadiums, Campaigns, Jobs and the volunteering route were captured at 1440px and 390px in both themes. The route/colour/overflow record and screenshots are under `C:/Users/daddo/IdeaProjects/GrassKickZ/outputs/matches-competitions-20261002/references-populated`.

The rendered product scopes confirm the semantic palette and hierarchy above. Club work stacks context and responsibilities before upcoming activity on phones. Campaigns uses a bounded search row, a filter rail, compact counts and a two-column event-card grid; its covers reserve their ratio. Carry those alignment and density choices into competition discovery. Home keeps its separate central reading column and theme scope.

The standalone volunteering extension is disabled in this release; the enabled Jobs directory is the reference for ongoing volunteer roles. Keep its discovery/work separation without enabling an unrelated extension. Some synthetic reference records point to media absent from the initial disposable volume. Record and repair owned review-media delivery before treating populated-photo screenshots as visual acceptance. A missing photo is not a design instruction to add an oversized empty banner.

This validation refines the existing brief. No new design extraction or connected Stitch generation was used. It is reference evidence; candidate visual acceptance still requires the handoff's complete responsive and accessibility review.

### User-directed hierarchy revision, 3 October 2026

Use the new Home feed's Inter/sans-serif typography, compact controls, clear bordered groups and deliberate gaps. The older feed's loose ungrouped tools and the proposed mockup's serif typography are rejected references. Dark neutral backgrounds may carry a restrained green influence; blue belongs to match activity, amber to tournament emphasis, purple to officials/ladders and green to principal actions. Labels and structure must communicate the same meaning without colour.

The Matches overview has two compact task panels: the next real fixture and a real featured competition. Put personal arrangements, competitions and invitations beside the header actions. Use one underline section navigation, including **Match exchange** with the lightning icon. Preserve Officials and Fixtures & results. Avoid a third full-width navigation row, a marketing slogan and duplicate generic action panels.

Below the task panels, four concise format cards directly filter one competition collection. Entry type, format, search, advanced filters and grid/list layout retain URL state and server-authorized counts. Keep full eligibility/location/fee filters discoverable. Show actual published football metadata; never infer sanctioning, prizes, capacity remaining, surface or registration availability from presentation alone. Use genuine uploaded event artwork first, with locally served licensed football stock as the fallback. Keep the stock disclosure small and clear; do not imply it depicts the named venue or participants. Host follows remain functional and host identities open their event collections.

Apply the same type scale, neutral panel surfaces, spacing, borders, controls and section accents to Match exchange, Tournaments & leagues, Fixtures & results, Officials and personal/host views. Review on the exact release candidate with primary coach/Dinamo, both themes, narrow layouts, keyboard/focus, error recovery and real API filters.

### Detail and catalog refinement, 3 October 2026

Match details lead with the two-club scoreboard, match-day facts and eligible proposal controls; narrow screens also expose an immediate proposal shortcut. Keep result reporting accessible to authorised actors, with secondary broadcast and coordination details below. Tournament details use a compact split photo/header, a four-fact strip and consistent underline tabs. Preserve entry and organiser permissions. Home shares the product canvas with no atmospheric gradient. The global Switch club control is removed; My Clubs remains available.

Discovery shortcuts are Leagues, Knockout cups, Groups & finals and Football festivals. These map directly to existing family/structure contracts; Swiss, split leagues, futsal and other playing rules remain available. Ranked challenges remain an advanced supported workflow, not a prominent tournament type. The demo catalog uses real profiles, eligibility, entry windows and generated schedules; records are explicitly labelled Demo. The reviewed data refresh removes obsolete examples from public discovery without deleting their identities or sporting history.
