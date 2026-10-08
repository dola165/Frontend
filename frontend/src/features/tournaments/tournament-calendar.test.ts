import { tournamentCalendar } from './tournament-calendar';
import type { TournamentDetail } from './domain';
const tournament = { id: 3, name: 'Cup; 2027\nFinals', entries: [], fixtures: [
    { id: 7, scheduledAt: '2027-06-01T11:30:00', status: 'SCHEDULED', homeLabel: 'Home, FC', awayLabel: 'Away FC' },
    { id: 8, scheduledAt: null, status: 'SCHEDULED' },
    { id: 9, scheduledAt: '2027-06-01T12:00:00Z', status: 'CANCELLED' },
] } as unknown as TournamentDetail;
it('preserves local kickoff, escapes content and links each real fixture without inventing duration', () => {
    const value = tournamentCalendar(tournament, 'https://app.grasskickz.com', undefined, new Date('2026-10-02T00:00:00Z'));
    expect(value).toContain('DTSTART:20270601T113000\r\n');
    expect(value).toContain('Home\\, FC vs Away FC · Cup\\; 2027\\nFinals');
    expect(value).toContain('https://app.grasskickz.com/tournaments/3?fixtureId=7');
    expect(value.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(value).not.toMatch(/DTEND|DURATION|TZID/);
});
it('keeps UTC timestamps and stable IDs when importing an updated schedule', () => {
    const value = tournamentCalendar({ ...tournament, fixtures: [{ ...tournament.fixtures[0], scheduledAt: '2027-06-01T11:30:00Z' }] }, 'https://app.grasskickz.com');
    expect(value).toContain('DTSTART:20270601T113000Z');
    expect(value).toContain('UID:tournament-3-fixture-7@grasskickz.com');
});
it('folds long multilingual lines on UTF-8 boundaries', () => {
    const value = tournamentCalendar({ ...tournament, name: 'თასი'.repeat(50) }, 'https://app.grasskickz.com');
    expect(value).toContain('\r\n ');
    expect(value.split('\r\n').every(line => new TextEncoder().encode(line).length <= 75)).toBe(true);
    expect(value).not.toContain('�');
});
