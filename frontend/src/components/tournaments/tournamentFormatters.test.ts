import { formatTournamentDateRange } from './tournamentFormatters';

it('keeps the workspace header on the published competition day across midnight for the viewer', () => {
    expect(formatTournamentDateRange('2026-10-17T16:31-04:00', '2026-10-17T22:30-04:00', 'en', 'America/New_York')).toBe('17 Oct 2026 — 17 Oct 2026');
    expect(formatTournamentDateRange(null, null, 'en', 'America/New_York')).toBeNull();
});
