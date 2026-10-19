import type { ReactNode } from 'react';
import type { DayOfWeek, ScheduleEventType, ScheduleEventUpsertInput, ScheduleVisibility } from '../../../features/schedule/api';
import { eventTypeCopy } from '../workspaceTypes';

// The event editor's form values, props and the small date helpers its parts share.
export type ModalSurface = 'MY_SCHEDULE' | 'CLUB_SCHEDULE';
export type ModalMode = 'create' | 'edit';
export interface EventCreationFormValues {
    eventType: ScheduleEventType | null;
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    endDate?: string;
    isRecurring: boolean;
    locationName: string;
    locationLat: string;
    locationLng: string;
    visibility: ScheduleVisibility;
    publishAt: string;
    description?: string;
    hostSquadId?: number | null;
    opponentClubId?: number | null;
    recurrenceDays?: DayOfWeek[];
    recurrenceStartDate?: string;
    recurrenceEndDate?: string;
    recurrenceStartTime?: string;
    recurrenceEndTime?: string;
    recurrenceInterval?: number;
    recurrenceTimezone?: string | null;
}
export interface EventCreationModalProps {
    audience?: {
        privateInvitations: boolean;
        privacyLabel: string;
        saveLabel: string;
        dirty: boolean;
        ready: boolean;
        planContent: ReactNode;
        reviewContent: (form: EventCreationFormValues) => ReactNode;
    };
    fixedSquad?: boolean;
    isOpen: boolean;
    mode: ModalMode;
    surface: ModalSurface;
    initialValues: EventCreationFormValues;
    clubId: number | null;
    targetEventId?: number;
    canManageSchedule?: boolean;
    targetEventClubId?: number | null;
    targetEventStartsAt?: string | null;
    onCancelled?: () => void;
    subjectLabel: string;
    audienceNotice?: string;
    onClose: () => void;
    onSubmit: (
        payload: ScheduleEventUpsertInput,
        meta: { eventType: ScheduleEventType; recurring: boolean },
    ) => Promise<void>;
}
export const DAYS: { value: DayOfWeek; short: string; label: string }[] = [
    { value: 'MONDAY', short: 'Mon', label: 'Monday' },
    { value: 'TUESDAY', short: 'Tue', label: 'Tuesday' },
    { value: 'WEDNESDAY', short: 'Wed', label: 'Wednesday' },
    { value: 'THURSDAY', short: 'Thu', label: 'Thursday' },
    { value: 'FRIDAY', short: 'Fri', label: 'Friday' },
    { value: 'SATURDAY', short: 'Sat', label: 'Saturday' },
    { value: 'SUNDAY', short: 'Sun', label: 'Sunday' },
];
export const TYPES = (['TRAINING', 'MATCH', 'FRIENDLY', 'TRYOUT', 'ACTIVITY'] as const).map(value => ({ value, icon: eventTypeCopy[value].icon }));
export const wallTime = (date: string, time: string) => `${date}T${time.slice(0, 5)}:00`;
export const weekday = (date: string): DayOfWeek => DAYS[(new Date(`${date}T12:00:00`).getDay() + 6) % 7]?.value ?? 'MONDAY';
export type Issue = { step: number; field: string; message: string };
