import type { ScheduleWorkspaceEvent } from '../../../components/schedule/workspaceTypes';
import { eventKind } from '../../clubWorkspace/fixtures';
import type { ScheduleEventOccurrence, ScheduleEventType } from '../api';

export { eventKind };

const sentence = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/^./, letter => letter.toUpperCase());

/** A schedule API occurrence in the shape the event dialogs and editors read. */
export function toWorkspaceEvent(event: ScheduleEventOccurrence, ownerLabel: string): ScheduleWorkspaceEvent {
    const matchLike = event.clubId != null && ['TRYOUT', 'MATCH', 'FRIENDLY'].includes(event.eventType);
    return {
        id: event.occurrenceId, eventId: event.eventId,
        homeScore: event.homeScore, awayScore: event.awayScore, resultStatus: event.resultStatus, matchExchangeId: event.matchExchangeId,
        canRecordResult: event.canRecordResult, resultClubId: event.resultClubId, origin: event.origin, originId: event.originId,
        title: event.title, subtitle: event.opponentClubName ? `vs ${event.opponentClubName}` : null, description: event.description,
        eventType: event.eventType, startsAt: event.startsAt, endsAt: event.endsAt,
        locationText: event.locationName, locationLat: event.locationLat, locationLng: event.locationLng,
        status: sentence(event.status),
        visibility: event.clubId != null && event.visibility === 'PRIVATE' ? 'CLUB_ONLY' : event.visibility,
        publicationState: event.publicNow ? 'LIVE' : event.visibility === 'SCHEDULED_PUBLICATION' ? 'QUEUED' : 'PRIVATE',
        publishAt: event.publishAt, recurring: event.recurring, recurrence: event.recurrence, recurrenceLabel: null,
        ownerLabel, mapEligible: matchLike, appearsOnMap: Boolean(event.publicNow && matchLike),
        opponentClubId: event.opponentClubId, hostSquadId: event.challengerSquadId, hostSquadName: event.challengerSquadName,
        conflictingEventIds: event.conflictingEventIds ?? [], conflict: null, challenge: null,
    };
}

/** The type filters people use: matches, training and everything else the club runs. */
export type TypeFilter = 'all' | 'matches' | 'training' | 'events';
export const typeFilters: Array<{ id: TypeFilter; label: string }> = [
    { id: 'all', label: 'Everything' }, { id: 'matches', label: 'Matches' }, { id: 'training', label: 'Training' }, { id: 'events', label: 'Club events' },
];
export const typeFilterFrom = (value: string | null): TypeFilter => typeFilters.some(filter => filter.id === value) ? value as TypeFilter : 'all';
export function matchesType(type: ScheduleEventType, filter: TypeFilter) {
    if (filter === 'all') return true;
    if (filter === 'matches') return type === 'MATCH' || type === 'FRIENDLY';
    if (filter === 'training') return type === 'TRAINING';
    return type === 'ACTIVITY' || type === 'TRYOUT';
}
