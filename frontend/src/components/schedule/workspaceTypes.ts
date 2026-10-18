import {
    CalendarDays,
    CalendarRange,
    LayoutGrid,
    Rows3,
    ShieldCheck,
    UserRound
} from 'lucide-react';
import type { ScheduleEventType, ScheduleRecurrenceRule } from '../../features/schedule/api';
import { activityColors, activityIcons } from '../../features/schedule/activityIcons';

export type WorkspaceSurface = 'MY_SCHEDULE' | 'CLUB_SCHEDULE';
export type WorkspaceView = 'month' | 'week' | 'day';
export type WorkspaceVisibility = 'PRIVATE' | 'CLUB_ONLY' | 'SCHEDULED_PUBLICATION' | 'PUBLIC';
export type PublicationState = 'PRIVATE' | 'QUEUED' | 'LIVE';
export type NoticeTone = 'success' | 'warning' | 'error';
export type ChallengePathway = 'OUTGOING_CHALLENGE' | 'OPEN_OPPORTUNITY';
export type ChallengeState = 'PENDING_ACCEPTANCE' | 'ACCEPTED' | 'REJECTED' | 'OPPONENT_PENDING';

export interface Notice {
    tone: NoticeTone;
    message: string;
}

export interface ConflictInfo {
    sourceEventId: string;
    sourceTitle: string;
    overlapMinutes: number;
    severity: 'warning' | 'critical';
    explanation: string;
}

export interface ChallengeInfo {
    pathway: ChallengePathway;
    state: ChallengeState;
    opponentName?: string | null;
}

export interface ScheduleWorkspaceEvent {
    homeScore?: number | null;
    awayScore?: number | null;
    resultStatus?: import('../../features/matchHistory/api').ResultStatus;
    matchExchangeId?: number | null;
    canRecordResult?: boolean;
    resultClubId?: number | null;
    seriesId?: string | null;
    /** Squad availability in opt-out terms: `going` are expected, `pending` were asked to confirm and have not. */
    responseSummary?: { total: number; going: number; pending: number; cantCome?: number };
    journeys?: import('../../features/mapPlanning/journeyScheduleData').JourneyEntry[];
    origin?: 'CLUB_CALENDAR' | 'PERSONAL_CALENDAR' | 'MATCH_EXCHANGE' | 'SQUAD_SESSION' | 'JOURNEY';
    originId?: number | null;
    id: string;
    eventId: number;
    title: string;
    subtitle?: string | null;
    description?: string | null;
    eventType: ScheduleEventType;
    startsAt: string;
    endsAt: string;
    locationText?: string | null;
    locationLat?: number | null;
    locationLng?: number | null;
    status: string;
    visibility: WorkspaceVisibility;
    publicationState: PublicationState;
    publishAt?: string | null;
    recurring: boolean;
    recurrence?: ScheduleRecurrenceRule | null;
    recurrenceLabel?: string | null;
    ownerLabel: string;
    mapEligible: boolean;
    appearsOnMap: boolean;
    opponentClubId?: number | null;
    hostSquadId?: number | null;
    hostSquadName?: string | null;
    conflictingEventIds: number[];
    conflict?: ConflictInfo | null;
    challenge?: ChallengeInfo | null;
}

export const EVENT_TYPES: ScheduleEventType[] = ['TRAINING', 'TRYOUT', 'MATCH', 'FRIENDLY', 'ACTIVITY'];

export const surfaceCopy: Record<WorkspaceSurface, { label: string; description: string; icon: typeof UserRound }> = {
    MY_SCHEDULE: {
        label: 'My Schedule',
        description: 'Private planning + overlap alerts.',
        icon: UserRound
    },
    CLUB_SCHEDULE: {
        label: 'Club Schedule',
        description: 'Club calendar + publishing.',
        icon: ShieldCheck
    }
};

export const viewCopy: Record<WorkspaceView, { label: string; icon: typeof LayoutGrid }> = {
    month: { label: 'Month', icon: LayoutGrid },
    week: { label: 'Week', icon: CalendarRange },
    day: { label: 'Day', icon: Rows3 }
};

const activity = (label: string, type: ScheduleEventType) => ({ label, accent: activityColors[type], soft: `color-mix(in srgb, ${activityColors[type]} 14%, transparent)`, icon: activityIcons[type] });
/** Every match is green (a trophy, or a handshake for a friendly), training blue, a club event violet, a trial pink. */
export const eventTypeCopy: Record<ScheduleEventType, { label: string; accent: string; soft: string; icon: typeof CalendarDays }> = {
    TRAINING: activity('Training', 'TRAINING'),
    TRYOUT: activity('Trial', 'TRYOUT'),
    MATCH: activity('Match', 'MATCH'),
    FRIENDLY: activity('Friendly', 'FRIENDLY'),
    ACTIVITY: activity('Club event', 'ACTIVITY'),
    MEETING: activity('Meeting', 'MEETING'),
};

export const visibilityCopy: Record<WorkspaceVisibility, string> = {
    PRIVATE: 'Private',
    CLUB_ONLY: 'Club Only',
    SCHEDULED_PUBLICATION: 'Scheduled Release',
    PUBLIC: 'Public'
};

export const publicationCopy: Record<PublicationState, string> = {
    PRIVATE: 'Not published',
    QUEUED: 'Publication queued',
    LIVE: 'Live publicly'
};
