import type { TournamentDetail, TournamentFixtureDto } from './domain';
import { participantName } from './participantLabels';

const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/[,;]/g, '\\$&');
// Fold at 75 UTF-8 bytes, including the continuation space (RFC 5545).
const fold = (line: string) => {
    const rows: string[] = []; let row = ''; let bytes = 0;
    for (const char of line) {
        const size = new TextEncoder().encode(char).length;
        if (bytes + size > 75) { rows.push(row); row = ' '; bytes = 1; }
        row += char; bytes += size;
    }
    return [...rows, row].join('\r\n');
};
function calendarDate(value: string) {
    // LocalDateTime has no zone. Preserve the displayed wall time; never invent a zone.
    if (/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?$/.test(value)) return value.replace(/[-:]/g, '') + (value.length === 16 ? '00' : '');
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z') : null;
}
export function tournamentCalendar(tournament: TournamentDetail, origin: string, fixtures: TournamentFixtureDto[] = tournament.fixtures, now = new Date()) {
    const rows = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GrassKickZ//Tournament schedule//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    for (const fixture of fixtures) {
        const start = fixture.scheduledAt ? calendarDate(fixture.scheduledAt) : null;
        if (!start || fixture.status === 'CANCELLED') continue;
        const home = fixture.homeLabel || participantName(tournament.entries.find(entry => entry.id === fixture.homeEntryId));
        const away = fixture.awayLabel || participantName(tournament.entries.find(entry => entry.id === fixture.awayEntryId));
        rows.push('BEGIN:VEVENT', `UID:tournament-${tournament.id}-fixture-${fixture.id}@grasskickz.com`, `DTSTAMP:${calendarDate(now.toISOString())}`,
            `DTSTART:${start}`, `SUMMARY:${escape(`${home} vs ${away} · ${tournament.name}`)}`,
            `DESCRIPTION:${escape('Schedule snapshot. Check GrassKickZ for changes. Match end time is not confirmed.')}`,
            `URL:${new URL(`/tournaments/${tournament.id}?fixtureId=${fixture.id}`, origin).href}`, 'END:VEVENT');
    }
    rows.push('END:VCALENDAR'); return rows.map(fold).join('\r\n') + '\r\n';
}
export function downloadTournamentCalendar(tournament: TournamentDetail, fixtures?: TournamentFixtureDto[]) {
    const url = URL.createObjectURL(new Blob([tournamentCalendar(tournament, window.location.origin, fixtures)], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `grasskickz-tournament-${tournament.id}.ics`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
