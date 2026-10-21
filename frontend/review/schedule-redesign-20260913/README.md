# Schedule redesign review — 13–14 September 2026

Status: implemented locally for visual review. This schedule revision has not been deployed. The previously approved Store/Campaigns/Jobs release remains the live baseline.

## Open the preview

http://127.0.0.1:5300/e2e/fixtures/schedule-preview.html

The fixture renders the real CalendarPage and editor. Club-owner membership, squads and schedule reads/writes are handled by an in-memory Axios adapter; saving, editing and cancelling affect only the current preview tab. Reload resets its sample data. It opens a future week based on the browser clock. Optional query parameters: `scope=personal`, `theme=light`, `newEvent=1`, `lang=ka`, `lang=en`.

Start the preview from the frontend application directory if needed:

```powershell
npx vite --host 127.0.0.1 --port 5300 --strictPort
```

The existing map picker uses public map tiles if opened. The map is collapsed by default. The fixture is not part of the production entry point.

## Design and behavior

- A clear initial choice: One-time event or Weekly training.
- Three steps: Plan, When & where, Review & share. A live card previews the result; weekly plans show the actual first three sessions.
- Weekday selection, duration shortcuts, optional end date, squad, notes and venue. The map and scheduled publication are optional disclosures.
- Neutral dark surfaces retain the app identity, with semantic event accents. Full-screen editor on phones, with persistent footer actions and internal scrolling.
- Club-members/public visibility uses the existing server meanings. Squad assignment does not restrict visibility to that squad. Personal events remain private.
- Simplified calendar header, date navigation and view controls. Weekly training cards group by eventId and open the next available session of the series.
- Empty calendars retain a clickable date grid. Timelines initially scroll toward daytime or an earlier event, preserving manual scrolling on ordinary updates.
- Recurring events in edit mode open the whole-series editor. They no longer pretend a drag can change one occurrence. One-time event dragging is retained.
- Validation, unsaved-change confirmation, single-flight save/cancel, retry after errors, keyboard focus and background restoration after nested discard confirmation.
- English and Georgian editor labels, validation and date previews are supported, including a Georgian date fallback for browsers without that locale data.
- Existing recurrence interval/timezone and squad/opponent references survive edits. Dates and times retain the existing local wall-time API contract.

## Existing API limitations retained

The API updates or cancels an entire recurring event. It has no single-session exception endpoint. It also rejects editing a recurring series whose original start is in the past. Such series are shown read-only instead of advancing their start boundary and losing history. Changing that requires a separate backend design for future-series edits and historical occurrences.

No backend, Android, payment or deployment changes belong to this schedule revision.

## Validation

- Schedule unit suite: 38 passing tests after the final localization pass.
- `node e2e/schedule-redesign-smoke.mjs`: creation/edit/discard and visual checks across desktop, light theme, personal schedule, and 320/390/600 px widths; no runtime errors or application requests leaving the fixture.
- `node review/schedule-redesign-20260913/calendar-checks.mjs`: recurring edit mode, empty month create, mobile weekly shortcut, 390×480 footer visibility, restored background accessibility.
- Focused ESLint passed.
- Final TypeScript + named production build passed (build-final.log) using `tools/release/build-web.ps1`, output `dist/schedule-redesign-20260913`. Shared dist output was not cleared.

Screenshots and browser results are in this directory. `calendar-checks.mjs` additionally passed 6 behavior checks; `width-checks.mjs` verified editor fit at 768, 900, 1024 and 1280 px. `localization-check.mjs` exercises Georgian creation and saving on desktop and phone. The final language pass also handles browsers without Georgian Intl date data.

## Principal files

Product components: EventCreationModal, ScheduleGrid, ScheduleToolbar, ScheduleWorkspaceHeader, StandingSchedule, MobileScheduleWorkspace and CalendarPage. New scoped styles: schedule-event-editor.css and schedule-workspace.css. New date/duration helper: scheduleFormUtils.ts. Editor/tutorial locale entries: en.ts and ka.ts.

Unit tests: EventCreationModal.test.tsx, StandingSchedule.test.tsx, scheduleFormUtils.test.ts. Preview: e2e/fixtures/schedule-preview.html and schedule-preview.tsx. Browser check: e2e/schedule-redesign-smoke.mjs.

The working tree contains substantial pre-existing work. Preserve it; do not reset, stash, clean, stage all or blindly deploy a full backend build. Source-before backups of the editor and CalendarPage are kept in this directory for comparison with this turn's starting point.
