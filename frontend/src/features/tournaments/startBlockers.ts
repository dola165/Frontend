import type { TournamentDetail } from './domain';
import { isBracketParticipant } from './participantLabels';
import type { CompetitionRules } from '../competitions/api';

export type TournamentStartBlocker = {
    key: string;
    message: string;
    target: 'participants' | 'bracket' | 'schedule' | 'settings';
};

export function getTournamentStartBlockers(tournament: TournamentDetail, now = new Date(), rules?: CompetitionRules | null): TournamentStartBlocker[] {
    const blockers: TournamentStartBlocker[] = [];
    const activeEntries = tournament.entries.filter(isBracketParticipant);
    const activeFixtures = tournament.fixtures.filter(fixture => fixture.status !== 'CANCELLED');
    const placed = new Set(activeFixtures.flatMap(fixture => [fixture.homeEntryId, fixture.awayEntryId]).filter((id): id is number => id != null));
    const timestamp = (value?: string | null) => value ? new Date(value).getTime() : Number.NaN;

    if (!tournament.stages.length && rules?.structure !== 'LADDER') blockers.push({ key: 'stage', message: rules?'Add the opening competition draw or round.':'Add at least one competition stage.', target: 'bracket' });
    if (!tournament.fixtures.length && rules?.structure !== 'LADDER') blockers.push({ key: 'fixture', message: 'Add at least one match to the competition.', target: 'bracket' });
    if (activeEntries.length < 2) blockers.push({ key: 'entries', message: 'Confirm at least two active teams.', target: 'participants' });
    if (tournament.registrationOpensAt && now.getTime() < timestamp(tournament.registrationOpensAt)) blockers.push({ key: 'registration-opens', message: 'Wait until registration has opened, or change the registration window.', target: 'settings' });
    if (tournament.registrationClosesAt && now.getTime() < timestamp(tournament.registrationClosesAt)) blockers.push({ key: 'registration-closes', message: 'Close registration before starting, or change the registration window.', target: 'settings' });
    if (activeFixtures.some(fixture => (fixture.roundNumber ?? 1) <= 1 && fixture.homeEntryId == null && fixture.awayEntryId == null)) blockers.push({ key: 'opening', message: 'Place at least one team in every opening match.', target: 'bracket' });
    if (!rules && activeEntries.some(entry => !placed.has(entry.id))) blockers.push({ key: 'placement', message: 'Place every active team in a match.', target: 'bracket' });
    if (tournament.startDate && activeFixtures.some(fixture => fixture.scheduledAt && timestamp(fixture.scheduledAt) < timestamp(tournament.startDate))) blockers.push({ key: 'before-start', message: 'Move matches that are scheduled before the tournament starts.', target: 'schedule' });
    if (tournament.endDate && activeFixtures.some(fixture => fixture.scheduledAt && timestamp(fixture.scheduledAt) > timestamp(tournament.endDate))) blockers.push({ key: 'after-end', message: 'Move matches that are scheduled after the tournament ends.', target: 'schedule' });
    const scheduledAtVenues = activeFixtures.filter((fixture): fixture is typeof fixture & { scheduledAt: string; locationId: number } => fixture.scheduledAt != null && fixture.locationId != null)
        .sort((first, second) => timestamp(first.scheduledAt) - timestamp(second.scheduledAt));
    const hasVenueConflict = scheduledAtVenues.some((fixture, index) => scheduledAtVenues.slice(index + 1).some(next => next.locationId === fixture.locationId && timestamp(next.scheduledAt) - timestamp(fixture.scheduledAt) <= 90 * 60 * 1000));
    if (!rules && hasVenueConflict) blockers.push({ key: 'venue-conflict', message: 'Separate matches sharing a venue by more than 90 minutes.', target: 'schedule' });
    return blockers;
}
