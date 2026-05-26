export type ScheduleItemKind = 'MATCH' | 'TRYOUT' | 'AVAILABILITY';
export type ScheduleItemStatus = 'OPEN' | 'SCHEDULED' | 'CONFIRMED' | 'PENDING_ACCEPTANCE' | 'CANCELLED' | 'COMPLETED';
export type ScheduleItemVisibility = 'PUBLIC' | 'CLUB_ADMIN';

export interface ScheduleItem {
    id: string;
    kind: ScheduleItemKind;
    title: string;
    subtitle?: string | null;
    startsAt: string;
    locationText?: string | null;
    status: ScheduleItemStatus;
    visibility: ScheduleItemVisibility;
    details?: string | null;
}

export const scheduleKindLabel: Record<ScheduleItemKind, string> = {
    MATCH: 'Match',
    TRYOUT: 'Tryout',
    AVAILABILITY: 'Club Event'
};

export const scheduleStatusLabel: Record<ScheduleItemStatus, string> = {
    OPEN: 'Open',
    SCHEDULED: 'Scheduled',
    CONFIRMED: 'Confirmed',
    PENDING_ACCEPTANCE: 'Pending',
    CANCELLED: 'Cancelled',
    COMPLETED: 'Completed'
};

export const scheduleVisibilityLabel: Record<ScheduleItemVisibility, string> = {
    PUBLIC: 'Public',
    CLUB_ADMIN: 'Internal'
};
