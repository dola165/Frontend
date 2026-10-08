# Schedule release — 14 September 2026

Published the approved second schedule direction at https://app.grasskickz.com/calendar.

## Product integration

- CalendarPage now uses ScheduleDirectionWorkspace and ScheduleWeekBoard with actual API occurrences, squad names, existing permissions and event handlers.
- Week board is the desktop default; agenda is the phone default. The existing hourly calendar, month/day controls and desktop event movement remain available inside Calendar.
- Weekly training, past-event details, read-only access, cancellation and event saving retain their existing product logic.
- The approved open editor styling is scoped to the schedule workspace and follows dark/light theme tokens.
- English and Georgian labels and tutorial copy are included.
- No preview adapter, sample data or forced preview language is imported into the product.

## Build and deployment

- `VITE_API_BASE_URL=/api`, `VITE_ENABLE_MOCKS=false`.
- `npm run build -- --outDir dist/schedule-approved-20260914` passed (TypeScript + Vite). Log: `build.log`.
- Additional test suites were not run, as explicitly requested by the user. Earlier prototype and editor checks remain recorded in their review directories; they are not represented as a fresh integration rehearsal.
- Web image: `sha256:dd258ddfcb7d014259090bb232219a26a77ea82dc035a44441de3bff0382dac2`.
- Replaced only the web container under the existing operation lock. API, database and Redis container identities were preserved. Active release metadata and image configuration were updated atomically.
- Confirmed local index bytes and public app asset references/bytes against the build. Cloudflare injects analytics into public HTML, so whole-document byte equality is inappropriate there. The first publication attempt automatically rolled back on that mismatch; the corrected asset confirmation succeeded on the second attempt.
- Previous immutable web image retained: `sha256:58975cc9293f32e3944cd85c419bbd9e11b720a4567ffd021d5073534ace9b9e`.

Deployment script, candidate and final transaction evidence are in the backend project's `outputs/schedule-approved-20260914/`. No backend migrations or data changes were deployed.
