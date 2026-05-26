import { apiClient } from '../../api/axiosConfig';

export type ScheduleEventType = 'TRAINING' | 'TRYOUT' | 'MATCH' | 'FRIENDLY' | 'ACTIVITY';
export type ScheduleVisibility = 'PRIVATE' | 'PUBLIC' | 'SCHEDULED_PUBLICATION';
export type ScheduleChallengeStatus = 'OPEN' | 'PENDING' | 'ACCEPTED' | 'REJECTED';
export type DayOfWeek =
    | 'MONDAY'
    | 'TUESDAY'
    | 'WEDNESDAY'
    | 'THURSDAY'
    | 'FRIDAY'
    | 'SATURDAY'
    | 'SUNDAY';

export interface ScheduleRecurrenceRule {
    frequency: 'WEEKLY';
    intervalValue: number;
    daysOfWeek: DayOfWeek[];
    startDate: string;
    endDate?: string | null;
    startTime: string;
    endTime: string;
    timezone?: string | null;
}

export interface ScheduleRecurrenceRuleInput extends ScheduleRecurrenceRule {}

export interface ScheduleEventUpsertInput {
    title: string;
    description?: string | null;
    eventType: ScheduleEventType;
    startsAt: string;
    endsAt: string;
    visibility?: ScheduleVisibility | null;
    publishAt?: string | null;
    locationName?: string | null;
    locationLat?: number | null;
    locationLng?: number | null;
    opponentClubId?: number | null;
    recurrence?: ScheduleRecurrenceRuleInput | null;
}

export interface ScheduleEventMutationResult {
    eventId: number;
    conflict: boolean;
    conflictingEventIds: number[];
}

export interface ScheduleEventOccurrence {
    eventId: number;
    occurrenceId: string;
    clubId: number | null;
    clubName: string | null;
    userId: number | null;
    eventType: ScheduleEventType;
    title: string;
    description: string | null;
    startsAt: string;
    endsAt: string;
    locationName: string | null;
    locationLat: number | null;
    locationLng: number | null;
    visibility: ScheduleVisibility;
    publishAt: string | null;
    publicNow: boolean;
    recurring: boolean;
    recurrence: ScheduleRecurrenceRule | null;
    opponentClubId: number | null;
    opponentClubName: string | null;
    challengeStatus: ScheduleChallengeStatus | null;
    status: string;
    conflict: boolean;
    conflictingEventIds: number[];
}

interface ScheduleWindowResponse {
    events: ScheduleEventOccurrence[];
}

export interface PublicScheduleEventsOptions {
    from?: string;
    to?: string;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    eventType?: ScheduleEventType;
}

export interface ScheduleChallengeRequest {
    challengerClubId?: number;
    targetClubId: number;
    note?: string | null;
}

export interface ScheduleChallengeResponse {
    respondingClubId: number;
    decision: 'ACCEPTED' | 'REJECTED';
    note?: string | null;
}

const withWindow = (from?: string, to?: string) => ({
    params: {
        ...(from ? { from } : {}),
        ...(to ? { to } : {})
    }
});

export const fetchClubSchedule = async (clubId: number, from?: string, to?: string) => {
    const response = await apiClient.get<ScheduleWindowResponse>(`/schedule/clubs/${clubId}/events`, withWindow(from, to));
    return response.data.events ?? [];
};

export const fetchMySchedule = async (from?: string, to?: string) => {
    const response = await apiClient.get<ScheduleWindowResponse>('/schedule/me/events', withWindow(from, to));
    return response.data.events ?? [];
};

export const fetchPublicScheduleEvents = async (options: PublicScheduleEventsOptions = {}) => {
    const response = await apiClient.get<ScheduleWindowResponse>('/schedule/public-events', {
        params: {
            ...(options.from ? { from: options.from } : {}),
            ...(options.to ? { to: options.to } : {}),
            ...(options.lat != null ? { lat: options.lat } : {}),
            ...(options.lng != null ? { lng: options.lng } : {}),
            ...(options.radiusKm != null ? { radiusKm: options.radiusKm } : {}),
            ...(options.eventType ? { eventType: options.eventType } : {})
        }
    });
    return response.data.events ?? [];
};

export const createClubEvent = async (clubId: number, payload: ScheduleEventUpsertInput) => {
    const response = await apiClient.post<ScheduleEventMutationResult>(`/schedule/clubs/${clubId}/events`, payload);
    return response.data;
};

export const createMyEvent = async (payload: ScheduleEventUpsertInput) => {
    const response = await apiClient.post<ScheduleEventMutationResult>('/schedule/me/events', payload);
    return response.data;
};

export const updateScheduleEvent = async (eventId: number, payload: ScheduleEventUpsertInput) => {
    const response = await apiClient.put<ScheduleEventMutationResult>(`/schedule/events/${eventId}`, payload);
    return response.data;
};

export const deleteScheduleEvent = async (eventId: number) => {
    await apiClient.delete(`/schedule/events/${eventId}`);
};

export const createScheduleChallenge = async (eventId: number, payload: ScheduleChallengeRequest) => {
    const response = await apiClient.post<ScheduleEventOccurrence>(`/schedule/events/${eventId}/challenge`, payload);
    return response.data;
};

export const respondToScheduleChallenge = async (eventId: number, payload: ScheduleChallengeResponse) => {
    const response = await apiClient.post<ScheduleEventOccurrence>(`/schedule/challenges/${eventId}/response`, payload);
    return response.data;
};
