import {
    CalendarDays,
    CalendarRange,
    Globe2,
    LayoutGrid,
    MapPinned,
    Repeat2,
    Rows3,
    ShieldCheck,
    Swords,
    UserRound
} from 'lucide-react';
import type { ScheduleEventType, ScheduleRecurrenceRule } from '../../features/schedule/api';

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

export const eventTypeCopy: Record<ScheduleEventType, { label: string; accent: string; soft: string; icon: typeof CalendarDays }> = {
    TRAINING: { label: 'Training', accent: 'var(--accent-primary)', soft: 'var(--accent-primary-soft)', icon: Repeat2 },
    TRYOUT: { label: 'Tryout', accent: 'var(--state-info)', soft: 'var(--state-info-soft)', icon: Globe2 },
    MATCH: { label: 'Match', accent: 'var(--state-warning)', soft: 'var(--state-warning-soft)', icon: Swords },
    FRIENDLY: { label: 'Friendly', accent: 'var(--accent-muted)', soft: 'var(--accent-muted-soft)', icon: MapPinned },
    ACTIVITY: { label: 'Activity', accent: 'var(--theme-border-strong)', soft: 'var(--theme-surface-inset)', icon: CalendarDays }
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
