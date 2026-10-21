import { matchdayKickoff } from './matchdaySchedule';
import type { TournamentDetail, TournamentEntryDto } from './domain';

export const participantProfilePath = (entry: TournamentEntryDto) => entry.clubId != null
    ? `/clubs/${entry.clubId}${entry.squadId != null ? '?tab=teams' : ''}`
    : entry.userId != null ? `/profile/${entry.userId}` : null;

export function tournamentReadiness(tournament: TournamentDetail, now = Date.now()) {
    const confirmed = tournament.entries.filter(e => ['ACTIVE', 'ELIMINATED', 'COMPLETED'].includes(e.status));
    const pending = tournament.entries.filter(e => ['PENDING', 'WAITLISTED', 'APPROVED'].includes(e.status));
    const scheduled = tournament.fixtures.filter(f => f.status === 'SCHEDULED');
    return {
        confirmed, pending,
        completed: tournament.fixtures.filter(f => f.status === 'COMPLETED').length,
        unscheduled: scheduled.filter(f => !f.scheduledAt).length,
        withoutVenue: scheduled.filter(f => f.locationId == null && !f.venueReservation).length,
        awaitingResult: scheduled.filter(f => f.scheduledAt && new Date(f.scheduledAt).getTime() < now).length,
        upcoming: scheduled.filter(f => !f.scheduledAt || new Date(f.scheduledAt).getTime() >= now).sort((a,b) => (a.scheduledAt ?? '9999').localeCompare(b.scheduledAt ?? '9999') || a.id-b.id),
    };
}

export function registrationWindow(tournament: TournamentDetail, now = Date.now()) {
    if (tournament.status !== 'PLANNING') return 'unavailable';
    if (tournament.registrationOpensAt && new Date(tournament.registrationOpensAt).getTime() > now) return 'not-open';
    if (tournament.registrationClosesAt && new Date(tournament.registrationClosesAt).getTime() < now) return 'closed';
    if (tournament.visibility === 'PRIVATE' || tournament.registrationPolicy === 'INVITE_ONLY') return 'invitation';
    return 'open';
}

export function tournamentKickoffLabel(value: string | null, language = 'en') {
    const kickoff = matchdayKickoff(value);
    if (!kickoff) return null;
    const day = new Intl.DateTimeFormat(language.startsWith('ka') ? 'ka-GE' : 'en-GB', {day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${kickoff.day}T12:00:00Z`));
    return `${day} · ${kickoff.time}`;
}
