import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
    CalendarDays,
    Loader2,
    Plus,
    TriangleAlert,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ScheduleEventDrawer, type ScheduleEventFormValues } from '../components/schedule/ScheduleEventDrawer';
import { ScheduleGrid } from '../components/schedule/ScheduleGrid';
import { SelectedEventPanel } from '../components/schedule/SelectedEventPanel';
import { ScheduleToolbar } from '../components/schedule/ScheduleToolbar';
import { ScheduleWorkspaceHeader } from '../components/schedule/ScheduleWorkspaceHeader';
import {
    type ChallengeInfo,
    type ChallengeState,
    type ConflictInfo,
    EVENT_TYPES,
    eventTypeCopy,
    type ScheduleEntryMode,
    type ScheduleRibbonTab,
    surfaceCopy,
    type Notice,
    type NoticeTone,
    type PublicationState,
    type ScheduleWorkspaceEvent,
    type WorkspaceSurface,
    type WorkspaceVisibility,
    type WorkspaceView
} from '../components/schedule/workspaceTypes';
import { CollapsiblePanel } from '../components/ui/CollapsiblePanel';
import { fetchMyClubMembershipContext } from '../features/clubs/api';
import { isLeadershipRole, type ClubMembershipContext } from '../features/clubs/domain';
import {
    createClubEvent,
    createMyEvent,
    deleteScheduleEvent,
    fetchClubSchedule,
    fetchMySchedule,
    updateScheduleEvent,
    type DayOfWeek,
    type ScheduleEventOccurrence,
    type ScheduleRecurrenceRule,
    type ScheduleEventType,
    type ScheduleEventUpsertInput,
    type ScheduleVisibility
} from '../features/schedule/api';
import { extractApiErrorMessage } from '../utils/apiError';

interface DrawerState {
    mode: 'create' | 'edit';
    surface: WorkspaceSurface;
    initialValues: ScheduleEventFormValues;
    targetEventId?: number;
}

interface CalendarPageProps {
    user: { id?: number; username?: string; fullName?: string; role?: string } | null;
    darkMode: boolean;
    setDarkMode: (value: boolean) => void;
}

const durationByType: Record<ScheduleEventType, number> = {
    TRAINING: 90,
    TRYOUT: 120,
    MATCH: 120,
    FRIENDLY: 120,
    ACTIVITY: 75
};

const DEFAULT_LEFT_RAIL_WIDTH = 208;
const DEFAULT_RIGHT_RAIL_WIDTH = 276;
const MIN_LEFT_RAIL_WIDTH = 176;
const MAX_LEFT_RAIL_WIDTH = 320;
const MIN_RIGHT_RAIL_WIDTH = 228;
const MAX_RIGHT_RAIL_WIDTH = 380;
const MIN_CENTER_WIDTH = 780;
const RESIZER_WIDTH = 12;

const dayOfWeekValues: DayOfWeek[] = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const recurrenceDayOrder: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const recurrenceDayLabel: Record<DayOfWeek, string> = {
    MONDAY: 'Mon',
    TUESDAY: 'Tue',
    WEDNESDAY: 'Wed',
    THURSDAY: 'Thu',
    FRIDAY: 'Fri',
    SATURDAY: 'Sat',
    SUNDAY: 'Sun'
};
const pad = (value: number) => String(value).padStart(2, '0');
const cloneDate = (value: Date) => new Date(value.getTime());
const toDateKey = (value: Date) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
const toInputDate = (value: Date) => toDateKey(value);
const toInputTime = (value: Date) => `${pad(value.getHours())}:${pad(value.getMinutes())}`;
const toInputDateTime = (value: Date) => `${toInputDate(value)}T${toInputTime(value)}`;
const toApiLocalDateTime = (value: Date) => `${toInputDate(value)}T${toInputTime(value)}:00`;
const normalizeApiTime = (value: string) => (value.length >= 5 ? value.slice(0, 5) : value);
const ensureApiTimeSeconds = (value: string) => (value.length === 5 ? `${value}:00` : value);
const buildApiDateTime = (date: string, time: string) => `${date}T${ensureApiTimeSeconds(time)}`;

const parseDate = (value: string) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const formatEnumLabel = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

const startOfDay = (value: Date) => {
    const next = cloneDate(value);
    next.setHours(0, 0, 0, 0);
    return next;
};

const startOfWeek = (value: Date) => {
    const next = startOfDay(value);
    const dayOffset = (next.getDay() + 6) % 7;
    next.setDate(next.getDate() - dayOffset);
    return next;
};

const startOfMonth = (value: Date) => {
    const next = startOfDay(value);
    next.setDate(1);
    return next;
};

const endOfMonth = (value: Date) => {
    const next = startOfMonth(value);
    next.setMonth(next.getMonth() + 1);
    next.setMilliseconds(-1);
    return next;
};

const addDays = (value: Date, amount: number) => {
    const next = cloneDate(value);
    next.setDate(next.getDate() + amount);
    return next;
};

const addMinutes = (value: Date, amount: number) => {
    const next = cloneDate(value);
    next.setMinutes(next.getMinutes() + amount);
    return next;
};

const sameDay = (left: Date, right: Date) => toDateKey(left) === toDateKey(right);
const getVisibleRange = (view: WorkspaceView, cursorDate: Date) => {
    if (view === 'month') return { start: startOfMonth(cursorDate), end: endOfMonth(cursorDate) };
    if (view === 'day') return { start: startOfDay(cursorDate), end: addMinutes(addDays(startOfDay(cursorDate), 1), -1) };
    const start = startOfWeek(cursorDate);
    return { start, end: addMinutes(addDays(start, 7), -1) };
};

const intersectsRange = (event: ScheduleWorkspaceEvent, rangeStart: Date, rangeEnd: Date) => {
    const eventStart = parseDate(event.startsAt);
    const eventEnd = parseDate(event.endsAt);
    return eventStart <= rangeEnd && eventEnd >= rangeStart;
};

const formatRangeLabel = (view: WorkspaceView, cursorDate: Date) => {
    if (view === 'month') {
        return cursorDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
    if (view === 'day') {
        return cursorDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    }
    const weekStart = startOfWeek(cursorDate);
    const weekEnd = addDays(weekStart, 6);
    if (weekStart.getMonth() === weekEnd.getMonth()) {
        return `${weekStart.toLocaleDateString(undefined, { month: 'long' })} ${weekStart.getDate()} - ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
    }
    return `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    })}`;
};

const monthGrid = (cursorDate: Date) => {
    const start = startOfMonth(cursorDate);
    const gridStart = addDays(start, -((start.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, index) => {
        const date = addDays(gridStart, index);
        return { date, inMonth: date.getMonth() === cursorDate.getMonth() };
    });
};

const addViewStep = (view: WorkspaceView, cursorDate: Date, delta: number) => {
    const next = cloneDate(cursorDate);
    if (view === 'month') {
        next.setMonth(next.getMonth() + delta);
        return next;
    }
    if (view === 'week') {
        next.setDate(next.getDate() + delta * 7);
        return next;
    }
    next.setDate(next.getDate() + delta);
    return next;
};

const isPublicFacing = (event: ScheduleWorkspaceEvent) => event.visibility === 'PUBLIC' || event.visibility === 'SCHEDULED_PUBLICATION';
const getDefaultHour = (surface: WorkspaceSurface) => (surface === 'CLUB_SCHEDULE' ? 18 : 9);
const getDayOfWeek = (value: Date) => dayOfWeekValues[value.getDay()];
const isWeekdaySeries = (days: DayOfWeek[]) => ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].every((day) => days.includes(day as DayOfWeek)) && days.length === 5;
const formatRecurrenceLabel = (recurrence?: ScheduleRecurrenceRule | null) => {
    if (!recurrence) {
        return 'Single event';
    }

    const orderedDays = recurrenceDayOrder.filter((day) => recurrence.daysOfWeek.includes(day));
    const daysLabel = isWeekdaySeries(orderedDays)
        ? 'Mon-Fri'
        : orderedDays.map((day) => recurrenceDayLabel[day]).join(' / ');

    return `${daysLabel} · ${normalizeApiTime(recurrence.startTime)}-${normalizeApiTime(recurrence.endTime)}`;
};

const buildQueuedPublishAt = (startsAt: string) => {
    const start = parseDate(startsAt);
    const suggested = addDays(start, -5);
    const earliest = addMinutes(new Date(), 15);
    return toApiLocalDateTime(suggested > earliest ? suggested : earliest);
};

const normalizeAnchor = (surface: WorkspaceSurface, anchor: Date) => {
    const next = cloneDate(anchor);
    if (next.getHours() === 0 && next.getMinutes() === 0) {
        next.setHours(getDefaultHour(surface), 0, 0, 0);
    } else {
        next.setSeconds(0, 0);
    }
    return next;
};

const buildCreateFormValues = (
    surface: WorkspaceSurface,
    anchor: Date,
    eventType: ScheduleEventType,
    isRecurring = false
): ScheduleEventFormValues => {
    const start = normalizeAnchor(surface, anchor);
    const end = addMinutes(start, durationByType[eventType]);
    return {
        title: '',
        description: '',
        eventType,
        date: toInputDate(start),
        startTime: toInputTime(start),
        endTime: toInputTime(end),
        locationName: '',
        locationLat: '',
        locationLng: '',
        visibility: 'PRIVATE',
        publishAt: '',
        opponentClubId: '',
        isRecurring,
        recurrenceDays: [getDayOfWeek(start)],
        recurrenceStartDate: toInputDate(start),
        recurrenceEndDate: '',
        recurrenceStartTime: toInputTime(start),
        recurrenceEndTime: toInputTime(end)
    };
};

const buildEditFormValues = (event: ScheduleWorkspaceEvent): ScheduleEventFormValues => {
    const start = parseDate(event.startsAt);
    const end = parseDate(event.endsAt);
    const recurrence = event.recurrence;
    return {
        title: event.title,
        description: event.description ?? '',
        eventType: event.eventType,
        date: toInputDate(start),
        startTime: toInputTime(start),
        endTime: toInputTime(end),
        locationName: event.locationText ?? '',
        locationLat: event.locationLat != null ? String(event.locationLat) : '',
        locationLng: event.locationLng != null ? String(event.locationLng) : '',
        visibility: event.visibility === 'CLUB_ONLY' ? 'PRIVATE' : event.visibility,
        publishAt: event.publishAt ? toInputDateTime(parseDate(event.publishAt)) : '',
        opponentClubId: event.opponentClubId != null ? String(event.opponentClubId) : '',
        isRecurring: Boolean(recurrence),
        recurrenceDays: recurrence ? recurrenceDayOrder.filter((day) => recurrence.daysOfWeek.includes(day)) : [getDayOfWeek(start)],
        recurrenceStartDate: recurrence?.startDate ?? toInputDate(start),
        recurrenceEndDate: recurrence?.endDate ?? '',
        recurrenceStartTime: recurrence ? normalizeApiTime(recurrence.startTime) : toInputTime(start),
        recurrenceEndTime: recurrence ? normalizeApiTime(recurrence.endTime) : toInputTime(end)
    };
};

const toDisplayVisibility = (event: ScheduleEventOccurrence): WorkspaceVisibility =>
    event.clubId != null && event.visibility === 'PRIVATE' ? 'CLUB_ONLY' : event.visibility;

const toChallengeInfo = (event: ScheduleEventOccurrence): ChallengeInfo | null => {
    if (event.eventType !== 'MATCH' && event.eventType !== 'FRIENDLY') {
        return null;
    }

    if (event.challengeStatus === 'OPEN' && !event.opponentClubId) {
        return { pathway: 'OPEN_OPPORTUNITY', state: 'OPPONENT_PENDING' };
    }

    if (!event.challengeStatus) {
        return null;
    }

    const state: ChallengeState =
        event.challengeStatus === 'PENDING'
            ? 'PENDING_ACCEPTANCE'
            : event.challengeStatus === 'ACCEPTED'
                ? 'ACCEPTED'
                : event.challengeStatus === 'REJECTED'
                    ? 'REJECTED'
                    : 'OPPONENT_PENDING';

    return {
        pathway: event.opponentClubId ? 'OUTGOING_CHALLENGE' : 'OPEN_OPPORTUNITY',
        state,
        opponentName: event.opponentClubName
    };
};

const toWorkspaceEvent = (event: ScheduleEventOccurrence, ownerLabel: string): ScheduleWorkspaceEvent => {
    const visibility = toDisplayVisibility(event);
    const publicationState: PublicationState = event.publicNow ? 'LIVE' : event.visibility === 'SCHEDULED_PUBLICATION' ? 'QUEUED' : 'PRIVATE';
    const challenge = toChallengeInfo(event);
    const mapEligible = event.clubId != null && (event.eventType === 'TRYOUT' || event.eventType === 'MATCH' || event.eventType === 'FRIENDLY');
    const recurrenceLabel = formatRecurrenceLabel(event.recurrence);

    return {
        id: event.occurrenceId,
        eventId: event.eventId,
        title: event.title,
        subtitle: event.opponentClubName ? `vs ${event.opponentClubName}` : event.recurring ? recurrenceLabel : null,
        description: event.description,
        eventType: event.eventType,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        locationText: event.locationName,
        locationLat: event.locationLat,
        locationLng: event.locationLng,
        status: challenge ? formatEnumLabel(challenge.state) : formatEnumLabel(event.status),
        visibility,
        publicationState,
        publishAt: event.publishAt,
        recurring: event.recurring,
        recurrence: event.recurrence,
        recurrenceLabel,
        ownerLabel,
        mapEligible,
        appearsOnMap: Boolean(event.publicNow && mapEligible),
        opponentClubId: event.opponentClubId,
        conflictingEventIds: event.conflictingEventIds ?? [],
        conflict: null,
        challenge
    };
};

const decoratePersonalConflicts = (personalEvents: ScheduleWorkspaceEvent[], clubEvents: ScheduleWorkspaceEvent[]) =>
    personalEvents.map<ScheduleWorkspaceEvent>((event) => {
        if (!event.conflictingEventIds.length) {
            return { ...event, conflict: null };
        }

        const sourceEvent =
            clubEvents.find((clubEvent) => event.conflictingEventIds.includes(clubEvent.eventId) && parseDate(event.startsAt) < parseDate(clubEvent.endsAt) && parseDate(event.endsAt) > parseDate(clubEvent.startsAt))
            ?? clubEvents.find((clubEvent) => event.conflictingEventIds.includes(clubEvent.eventId))
            ?? null;

        if (!sourceEvent) {
            return {
                ...event,
                conflict: {
                    sourceEventId: '',
                    sourceTitle: 'Club schedule',
                    overlapMinutes: 0,
                    severity: 'warning',
                    explanation: 'This private item overlaps with club schedule time.'
                }
            };
        }

        const overlapStart = Math.max(parseDate(event.startsAt).getTime(), parseDate(sourceEvent.startsAt).getTime());
        const overlapEnd = Math.min(parseDate(event.endsAt).getTime(), parseDate(sourceEvent.endsAt).getTime());
        const overlapMinutes = Math.max(0, Math.round((overlapEnd - overlapStart) / 60000));
        const severity: ConflictInfo['severity'] = overlapMinutes >= 45 ? 'critical' : 'warning';

        return {
            ...event,
            conflict: {
                sourceEventId: sourceEvent.id,
                sourceTitle: sourceEvent.title,
                overlapMinutes,
                severity,
                explanation: `Overlaps with ${sourceEvent.title} for ${overlapMinutes} minutes.`
            }
        };
    });

const buildEventUpdatePayload = (
    event: ScheduleWorkspaceEvent,
    overrides?: Partial<Pick<ScheduleEventUpsertInput, 'visibility' | 'publishAt'>>
): ScheduleEventUpsertInput => ({
    title: event.title,
    description: event.description ?? null,
    eventType: event.eventType,
    startsAt: event.recurrence ? buildApiDateTime(event.recurrence.startDate, event.recurrence.startTime) : event.startsAt,
    endsAt: event.recurrence ? buildApiDateTime(event.recurrence.startDate, event.recurrence.endTime) : event.endsAt,
    visibility: overrides?.visibility ?? (event.visibility === 'CLUB_ONLY' ? 'PRIVATE' : event.visibility),
    publishAt: overrides?.publishAt ?? (event.publishAt ?? null),
    locationName: event.locationText ?? null,
    locationLat: event.locationLat ?? null,
    locationLng: event.locationLng ?? null,
    opponentClubId: event.opponentClubId ?? null,
    recurrence: event.recurrence
        ? {
            ...event.recurrence,
            startTime: ensureApiTimeSeconds(event.recurrence.startTime),
            endTime: ensureApiTimeSeconds(event.recurrence.endTime),
            endDate: event.recurrence.endDate ?? null,
            timezone: event.recurrence.timezone ?? null
        }
        : null
});

export const CalendarPage = ({ user, darkMode, setDarkMode }: CalendarPageProps) => {
    const navigate = useNavigate();
    const columnsRef = useRef<HTMLDivElement | null>(null);
    const [membershipContext, setMembershipContext] = useState<ClubMembershipContext | null>(null);
    const [membershipResolved, setMembershipResolved] = useState(false);
    const [bootstrapped, setBootstrapped] = useState(false);
    const [scheduleBusy, setScheduleBusy] = useState(false);
    const [loadNotice, setLoadNotice] = useState<string | null>(null);
    const [actionNotice, setActionNotice] = useState<Notice | null>(null);
    const [workspaceSurface, setWorkspaceSurface] = useState<WorkspaceSurface>('MY_SCHEDULE');
    const [viewMode, setViewMode] = useState<WorkspaceView>('week');
    const [cursorDate, setCursorDate] = useState(() => new Date());
    const [enabledTypes, setEnabledTypes] = useState<ScheduleEventType[]>(EVENT_TYPES);
    const [showConflictOnly, setShowConflictOnly] = useState(false);
    const [showPublicOnly, setShowPublicOnly] = useState(false);
    const [clubEvents, setClubEvents] = useState<ScheduleWorkspaceEvent[]>([]);
    const [personalEventsRaw, setPersonalEventsRaw] = useState<ScheduleWorkspaceEvent[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [drawerState, setDrawerState] = useState<DrawerState | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [activeInsertType, setActiveInsertType] = useState<ScheduleEventType>('TRAINING');
    const [entryMode, setEntryMode] = useState<ScheduleEntryMode>('single');
    const [activeRibbonTab, setActiveRibbonTab] = useState<ScheduleRibbonTab>('edit');
    const [pendingSelection, setPendingSelection] = useState<{ eventId: number; startsAt?: string | null } | null>(null);
    const [deletingEventId, setDeletingEventId] = useState<number | null>(null);
    const [railWidths, setRailWidths] = useState(() => ({
        left: Number(localStorage.getItem('talanti:schedule-left-rail')) || DEFAULT_LEFT_RAIL_WIDTH,
        right: Number(localStorage.getItem('talanti:schedule-right-rail')) || DEFAULT_RIGHT_RAIL_WIDTH
    }));
    const [resizeState, setResizeState] = useState<{
        side: 'left' | 'right';
        startX: number;
        startLeft: number;
        startRight: number;
    } | null>(null);

    useEffect(() => {
        let active = true;
        const loadMembership = async () => {
            try {
                const context = await fetchMyClubMembershipContext();
                if (!active) {
                    return;
                }
                setMembershipContext(context);
                setWorkspaceSurface(context?.clubId && isLeadershipRole(context?.myRole) ? 'CLUB_SCHEDULE' : 'MY_SCHEDULE');
                setLoadNotice(null);
            } catch (error) {
                if (!active) {
                    return;
                }
                setMembershipContext(null);
                setWorkspaceSurface('MY_SCHEDULE');
                setLoadNotice(extractApiErrorMessage(error, 'Membership context could not be loaded. My Schedule remains available.'));
            } finally {
                if (active) {
                    setMembershipResolved(true);
                }
            }
        };

        void loadMembership();
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        localStorage.setItem('talanti:schedule-left-rail', String(Math.round(railWidths.left)));
        localStorage.setItem('talanti:schedule-right-rail', String(Math.round(railWidths.right)));
    }, [railWidths.left, railWidths.right]);

    useEffect(() => {
        if (!resizeState) {
            return;
        }

        const handlePointerMove = (event: PointerEvent) => {
            const containerWidth = columnsRef.current?.getBoundingClientRect().width ?? window.innerWidth;

            setRailWidths((current) => {
                if (resizeState.side === 'left') {
                    const maxLeft = Math.min(
                        MAX_LEFT_RAIL_WIDTH,
                        containerWidth - resizeState.startRight - (RESIZER_WIDTH * 2) - MIN_CENTER_WIDTH
                    );
                    return {
                        ...current,
                        left: Math.round(Math.max(MIN_LEFT_RAIL_WIDTH, Math.min(maxLeft, resizeState.startLeft + (event.clientX - resizeState.startX))))
                    };
                }

                const maxRight = Math.min(
                    MAX_RIGHT_RAIL_WIDTH,
                    containerWidth - resizeState.startLeft - (RESIZER_WIDTH * 2) - MIN_CENTER_WIDTH
                );
                return {
                    ...current,
                    right: Math.round(Math.max(MIN_RIGHT_RAIL_WIDTH, Math.min(maxRight, resizeState.startRight - (event.clientX - resizeState.startX))))
                };
            });
        };

        const handlePointerUp = () => {
            setResizeState(null);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);

        return () => {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [resizeState]);

    const canOpenClubSchedule = Boolean(membershipContext?.clubId);
    const canManageClubSchedule = isLeadershipRole(membershipContext?.myRole);
    const clubLabel = membershipContext?.clubName ?? 'Club Schedule';
    const visibleRange = useMemo(() => getVisibleRange(viewMode, cursorDate), [cursorDate, viewMode]);

    const requestWindow = useMemo(() => {
        const paddingDays = viewMode === 'month' ? 14 : viewMode === 'week' ? 7 : 2;
        return {
            from: addDays(visibleRange.start, -paddingDays),
            to: addDays(visibleRange.end, paddingDays)
        };
    }, [viewMode, visibleRange.end, visibleRange.start]);

    useEffect(() => {
        if (!membershipResolved) {
            return;
        }

        let active = true;

        const loadSchedules = async () => {
            setScheduleBusy(true);
            try {
                const from = toApiLocalDateTime(requestWindow.from);
                const to = toApiLocalDateTime(requestWindow.to);
                const [nextPersonal, nextClub] = await Promise.all([
                    fetchMySchedule(from, to),
                    membershipContext?.clubId ? fetchClubSchedule(membershipContext.clubId, from, to) : Promise.resolve([])
                ]);

                if (!active) {
                    return;
                }

                setClubEvents(nextClub.map((event) => toWorkspaceEvent(event, clubLabel)));
                setPersonalEventsRaw(nextPersonal.map((event) => toWorkspaceEvent(event, 'Visible only to you')));
                setLoadNotice(null);
            } catch (error) {
                if (!active) {
                    return;
                }
                setLoadNotice(extractApiErrorMessage(error, 'Schedule data could not be loaded.'));
            } finally {
                if (active) {
                    setScheduleBusy(false);
                    setBootstrapped(true);
                }
            }
        };

        void loadSchedules();
        return () => {
            active = false;
        };
    }, [clubLabel, membershipContext?.clubId, membershipResolved, refreshKey, requestWindow.from, requestWindow.to]);

    const personalEvents = useMemo(
        () => decoratePersonalConflicts(personalEventsRaw, clubEvents),
        [clubEvents, personalEventsRaw]
    );

    const activeEvents = workspaceSurface === 'CLUB_SCHEDULE' ? clubEvents : personalEvents;

    const filteredEvents = useMemo(
        () =>
            activeEvents
                .filter((event) => enabledTypes.includes(event.eventType))
                .filter((event) => intersectsRange(event, visibleRange.start, visibleRange.end))
                .filter((event) => (workspaceSurface === 'MY_SCHEDULE' ? (!showConflictOnly || Boolean(event.conflict)) : (!showPublicOnly || isPublicFacing(event))))
                .sort((left, right) => parseDate(left.startsAt).getTime() - parseDate(right.startsAt).getTime()),
        [activeEvents, enabledTypes, showConflictOnly, showPublicOnly, visibleRange.end, visibleRange.start, workspaceSurface]
    );

    const selectedEvent = useMemo(
        () => filteredEvents.find((event) => event.id === selectedEventId) ?? filteredEvents[0] ?? null,
        [filteredEvents, selectedEventId]
    );

    useEffect(() => {
        if (!filteredEvents.length) {
            setSelectedEventId(null);
            return;
        }
        if (!selectedEventId || !filteredEvents.some((event) => event.id === selectedEventId)) {
            setSelectedEventId(filteredEvents[0].id);
        }
    }, [filteredEvents, selectedEventId]);

    useEffect(() => {
        if (!pendingSelection) {
            return;
        }

        const availableEvents = [...clubEvents, ...personalEvents];
        const exactMatch = availableEvents.find(
            (event) => event.eventId === pendingSelection.eventId && (!pendingSelection.startsAt || event.startsAt === pendingSelection.startsAt)
        );
        const fallbackMatch = availableEvents.find((event) => event.eventId === pendingSelection.eventId);
        const match = exactMatch ?? fallbackMatch;

        if (match) {
            setSelectedEventId(match.id);
            setCursorDate(parseDate(match.startsAt));
            setPendingSelection(null);
        }
    }, [clubEvents, pendingSelection, personalEvents]);

    const visibleConflicts = useMemo(
        () => personalEvents.filter((event) => Boolean(event.conflict)).length,
        [personalEvents]
    );

    const clubPublicationQueue = useMemo(
        () => clubEvents.filter((event) => event.publicationState === 'QUEUED').length,
        [clubEvents]
    );

    const monthEvents = useMemo(
        () =>
            filteredEvents.reduce<Record<string, ScheduleWorkspaceEvent[]>>((accumulator, event) => {
                const key = toDateKey(parseDate(event.startsAt));
                accumulator[key] = [...(accumulator[key] ?? []), event];
                return accumulator;
            }, {}),
        [filteredEvents]
    );

    const weekColumns = useMemo(() => (viewMode === 'day' ? [cursorDate] : Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(cursorDate), index))), [cursorDate, viewMode]);
    const canCreateEvent = workspaceSurface === 'MY_SCHEDULE' || canManageClubSchedule;
    const canEditSelectedEvent = Boolean(selectedEvent && canCreateEvent);
    const canDeleteSelectedEvent = Boolean(selectedEvent && canCreateEvent);
    const canAdjustVisibility = Boolean(selectedEvent && workspaceSurface === 'CLUB_SCHEDULE' && canManageClubSchedule);

    const includeType = (type: ScheduleEventType) => {
        setEnabledTypes((current) => (current.includes(type) ? current : [...current, type]));
    };

    const handleSelectInsertType = (type: ScheduleEventType) => {
        setActiveInsertType(type);
        if (type !== 'TRAINING' && entryMode === 'series') {
            setEntryMode('single');
        }
        setActiveRibbonTab('insert');
    };

    const handleSelectEntryMode = (mode: ScheduleEntryMode) => {
        if (mode === 'series') {
            setActiveInsertType('TRAINING');
        }
        setEntryMode(mode);
        setActiveRibbonTab('insert');
    };

    const openCreateDrawer = (
        eventType = activeInsertType,
        anchor = cursorDate,
        options?: { recurring?: boolean }
    ) => {
        if (!canCreateEvent) {
            return;
        }
        const nextType = eventType ?? (workspaceSurface === 'CLUB_SCHEDULE' ? 'TRAINING' : 'ACTIVITY');
        const recurring = Boolean(options?.recurring ?? (entryMode === 'series' && nextType === 'TRAINING'));
        includeType(nextType);
        setActiveInsertType(nextType);
        setShowConflictOnly(false);
        setShowPublicOnly(false);
        setActiveRibbonTab('edit');
        setDrawerState({
            mode: 'create',
            surface: workspaceSurface,
            initialValues: buildCreateFormValues(workspaceSurface, anchor, nextType, recurring)
        });
    };

    const openEditDrawer = () => {
        if (!selectedEvent || !canEditSelectedEvent) {
            return;
        }
        includeType(selectedEvent.eventType);
        setActiveInsertType(selectedEvent.eventType);
        setEntryMode(selectedEvent.recurring ? 'series' : 'single');
        setActiveRibbonTab('edit');
        setDrawerState({
            mode: 'edit',
            surface: workspaceSurface,
            initialValues: buildEditFormValues(selectedEvent),
            targetEventId: selectedEvent.eventId
        });
    };

    const mutateSelectedClubVisibility = async (visibility: ScheduleVisibility, publishAt?: string | null, successMessage?: string) => {
        if (!selectedEvent || !canAdjustVisibility) {
            return;
        }
        try {
            await updateScheduleEvent(selectedEvent.eventId, buildEventUpdatePayload(selectedEvent, { visibility, publishAt: publishAt ?? null }));
            setActionNotice({ tone: 'success', message: successMessage ?? 'Club event updated.' });
            setPendingSelection({ eventId: selectedEvent.eventId, startsAt: selectedEvent.startsAt });
            setRefreshKey((current) => current + 1);
        } catch (error) {
            setActionNotice({ tone: 'error', message: extractApiErrorMessage(error, 'Could not update visibility.') });
        }
    };

    const handleDeleteSelected = async () => {
        if (!selectedEvent || !canDeleteSelectedEvent) {
            return;
        }
        if (!window.confirm(`Delete "${selectedEvent.title}"?`)) {
            return;
        }

        setDeletingEventId(selectedEvent.eventId);
        try {
            await deleteScheduleEvent(selectedEvent.eventId);
            setActionNotice({ tone: 'success', message: selectedEvent.recurring ? 'Recurring series deleted.' : 'Event deleted.' });
            setSelectedEventId(null);
            setRefreshKey((current) => current + 1);
        } catch (error) {
            setActionNotice({ tone: 'error', message: extractApiErrorMessage(error, 'Could not delete the event.') });
        } finally {
            setDeletingEventId(null);
        }
    };

    const handleOpenConflictSource = () => {
        if (!selectedEvent?.conflict?.sourceEventId || !canOpenClubSchedule) {
            return;
        }
        const source = clubEvents.find((event) => event.id === selectedEvent.conflict?.sourceEventId);
        setWorkspaceSurface('CLUB_SCHEDULE');
        setShowConflictOnly(false);
        if (source) {
            setCursorDate(parseDate(source.startsAt));
            setSelectedEventId(source.id);
        }
    };

    const confirmLeaveScheduler = () => window.confirm('Are you sure you want to leave scheduler?');

    const handleGoBack = () => {
        if (!confirmLeaveScheduler()) {
            return;
        }
        if (window.history.length > 1) {
            navigate(-1);
            return;
        }
        navigate('/feed');
    };

    const handleOpenAccount = () => {
        if (!confirmLeaveScheduler()) {
            return;
        }
        navigate('/account');
    };

    const beginResize = (side: 'left' | 'right', clientX: number) => {
        setResizeState({
            side,
            startX: clientX,
            startLeft: railWidths.left,
            startRight: railWidths.right
        });
    };

    const resetRailLayout = () =>
        setRailWidths({
            left: DEFAULT_LEFT_RAIL_WIDTH,
            right: DEFAULT_RIGHT_RAIL_WIDTH
        });

    const handleDrawerSubmit = async (payload: ScheduleEventUpsertInput, meta: { eventType: ScheduleEventType; recurring: boolean }) => {
        includeType(meta.eventType);
        setActiveInsertType(meta.eventType);
        setEntryMode(meta.recurring ? 'series' : 'single');
        setShowConflictOnly(false);
        setShowPublicOnly(false);

        if (drawerState?.surface === 'CLUB_SCHEDULE') {
            if (!membershipContext?.clubId) {
                throw new Error('Club schedule context is unavailable.');
            }

            const result =
                drawerState.mode === 'create'
                    ? await createClubEvent(membershipContext.clubId, payload)
                    : await updateScheduleEvent(drawerState.targetEventId ?? selectedEvent?.eventId ?? 0, payload);

            setActionNotice({
                tone: 'success',
                message: meta.recurring ? 'Club event saved with a recurrence rule.' : 'Club event saved.'
            });
            setPendingSelection({
                eventId: result.eventId,
                startsAt: drawerState.mode === 'edit' ? selectedEvent?.startsAt ?? payload.startsAt : payload.startsAt
            });
        } else {
            const result =
                drawerState?.mode === 'create'
                    ? await createMyEvent(payload)
                    : await updateScheduleEvent(drawerState?.targetEventId ?? selectedEvent?.eventId ?? 0, payload);

            setActionNotice({
                tone: result.conflict ? 'warning' : 'success',
                message: result.conflict
                    ? 'Personal event saved with a club schedule overlap warning. The event remains private.'
                    : 'Personal event saved.'
            });
            setPendingSelection({
                eventId: result.eventId,
                startsAt: drawerState?.mode === 'edit' ? selectedEvent?.startsAt ?? payload.startsAt : payload.startsAt
            });
        }

        setDrawerState(null);
        setRefreshKey((current) => current + 1);
    };

    const enabledTypeLabels = EVENT_TYPES.filter((type) => enabledTypes.includes(type)).map((type) => eventTypeCopy[type].label);
    const filterSummary = enabledTypeLabels.length === EVENT_TYPES.length
        ? 'All types visible.'
        : `${enabledTypeLabels.length}/${EVENT_TYPES.length} types visible.`;
    const filterChips = [
        ...(enabledTypeLabels.length === EVENT_TYPES.length ? [] : enabledTypeLabels),
        ...(workspaceSurface === 'MY_SCHEDULE'
            ? (showConflictOnly ? ['Conflicts only'] : [])
            : (showPublicOnly ? ['Public only'] : []))
    ];
    const toolbarStats: Array<{ label: string; value: string; tone: 'green' | 'blue' | 'purple' | 'pink' }> = [
        {
            label: workspaceSurface === 'CLUB_SCHEDULE' ? 'Queue' : 'Conflicts',
            value: workspaceSurface === 'CLUB_SCHEDULE' ? String(clubPublicationQueue) : String(visibleConflicts),
            tone: workspaceSurface === 'CLUB_SCHEDULE' ? 'green' : 'pink'
        },
        {
            label: 'Visible',
            value: String(filteredEvents.length),
            tone: 'blue'
        },
        {
            label: 'Access',
            value: workspaceSurface === 'CLUB_SCHEDULE' ? (canManageClubSchedule ? 'Admin' : 'Read only') : 'Private',
            tone: 'purple'
        }
    ];
    const headerOverflowActions = [
        ...(selectedEvent && canAdjustVisibility
            ? [
                {
                    id: 'release-now',
                    label: 'Release now',
                    description: 'Make the selected club event public immediately.',
                    tone: 'positive' as const,
                    onSelect: () => void mutateSelectedClubVisibility('PUBLIC', null, 'Club event is public now.')
                },
                {
                    id: 'queue-release',
                    label: 'Queue release',
                    description: 'Keep the event private for now and publish it later.',
                    onSelect: () => void mutateSelectedClubVisibility(
                        'SCHEDULED_PUBLICATION',
                        buildQueuedPublishAt(selectedEvent.startsAt),
                        'Club event queued for publication.'
                    )
                },
                {
                    id: 'keep-private',
                    label: 'Keep private',
                    description: 'Return the event to members-only visibility.',
                    onSelect: () => void mutateSelectedClubVisibility('PRIVATE', null, 'Club event moved back to private.')
                }
            ]
            : []),
        ...(selectedEvent?.conflict && canOpenClubSchedule
            ? [{
                id: 'open-overlap',
                label: 'Open overlap',
                description: 'Jump to the overlapping club item in the same workspace.',
                onSelect: handleOpenConflictSource
            }]
            : [])
    ];

    if (!bootstrapped && (scheduleBusy || !membershipResolved)) {
        return (
            <div className="schedule-page-shell theme-page flex h-full min-h-0 items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin accent-primary" />
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-secondary">Loading Schedule Workspace</p>
                </div>
            </div>
        );
    }

    return (
        <div className="schedule-page-shell theme-page flex h-full min-h-0 flex-col overflow-hidden text-primary">
            <ScheduleWorkspaceHeader
                user={user}
                darkMode={darkMode}
                setDarkMode={setDarkMode}
                workspaceLabel={surfaceCopy[workspaceSurface].label}
                rangeLabel={formatRangeLabel(viewMode, cursorDate)}
                selectedEvent={selectedEvent}
                scheduleBusy={scheduleBusy}
                workspaceSurface={workspaceSurface}
                canOpenClubSchedule={canOpenClubSchedule}
                activeInsertType={activeInsertType}
                activeRibbonTab={activeRibbonTab}
                entryMode={entryMode}
                viewMode={viewMode}
                canCreateEvent={canCreateEvent}
                canEditSelectedEvent={canEditSelectedEvent}
                canDeleteSelectedEvent={canDeleteSelectedEvent}
                canOpenConflictSource={Boolean(selectedEvent?.conflict && canOpenClubSchedule)}
                onBack={handleGoBack}
                onOpenAccount={handleOpenAccount}
                onSelectRibbonTab={setActiveRibbonTab}
                onSelectSurface={(surface) => setWorkspaceSurface(surface)}
                onSelectInsertType={handleSelectInsertType}
                onSelectEntryMode={handleSelectEntryMode}
                onSelectViewMode={(view) => {
                    setActiveRibbonTab('layout');
                    setViewMode(view);
                }}
                onResetLayout={resetRailLayout}
                onCreate={canCreateEvent ? () => openCreateDrawer(activeInsertType, cursorDate, { recurring: entryMode === 'series' }) : undefined}
                onEdit={canEditSelectedEvent ? openEditDrawer : undefined}
                onDelete={canDeleteSelectedEvent ? () => void handleDeleteSelected() : undefined}
                onFocusSelected={selectedEvent ? () => {
                    setActiveRibbonTab('reference');
                    setCursorDate(parseDate(selectedEvent.startsAt));
                } : undefined}
                onOpenConflictSource={selectedEvent?.conflict ? () => {
                    setActiveRibbonTab('reference');
                    handleOpenConflictSource();
                } : undefined}
                overflowActions={headerOverflowActions}
            />

            <div className="schedule-page-frame flex min-h-0 flex-1 flex-col pt-2">
                <div
                    ref={columnsRef}
                    className="schedule-page-columns-band schedule-workspace-grid min-h-0 flex-1"
                    style={{ gridTemplateColumns: `${railWidths.left}px ${RESIZER_WIDTH}px minmax(${MIN_CENTER_WIDTH}px, 1fr) ${RESIZER_WIDTH}px ${railWidths.right}px` }}
                >
                    <aside className="schedule-page-left-zone schedule-scroll-surface min-h-0 overflow-y-auto rounded-[4px] px-2.5 py-3">
                        <div className="flex flex-col gap-3">
                            <CollapsiblePanel
                                eyebrow="Filters"
                                title="Advanced Filters"
                                helpText={`${filterSummary} ${workspaceSurface === 'MY_SCHEDULE' ? 'Use conflict-only when you want to focus on overlaps.' : 'Use public-only when you want the public-facing club view only.'}`}
                                defaultOpen
                                bodyClassName="px-3 py-3"
                            >
                                <div className="flex flex-col gap-2">
                                    {EVENT_TYPES.map((type) => {
                                        const meta = eventTypeCopy[type];
                                        const enabled = enabledTypes.includes(type);
                                        const toneClass = type === 'TRAINING'
                                            ? 'schedule-tone-green'
                                            : type === 'TRYOUT'
                                                ? 'schedule-tone-blue'
                                                : type === 'FRIENDLY'
                                                    ? 'schedule-tone-pink'
                                                    : 'schedule-tone-purple';

                                        return (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => setEnabledTypes((current) => (current.includes(type) ? current.filter((entry) => entry !== type) : [...current, type]))}
                                                className={`schedule-interactive ${toneClass} flex items-center justify-between gap-3 rounded-[4px] px-3 py-2 text-left ${
                                                    enabled ? 'bg-elevated text-primary' : 'bg-transparent opacity-80'
                                                }`}
                                                data-active={enabled}
                                            >
                                                <span className="flex items-center gap-3">
                                                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta.accent }} />
                                                    <span className={`text-[11px] font-black uppercase tracking-[0.16em] ${enabled ? 'text-current' : 'text-primary'}`}>{meta.label}</span>
                                                </span>
                                                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">{enabled ? 'Shown' : 'Hidden'}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="mt-3 border-t border-subtle pt-3">
                                    {workspaceSurface === 'MY_SCHEDULE' ? (
                                        <ToggleRow
                                            label="Conflict only"
                                            description="Only overlapping personal items."
                                            checked={showConflictOnly}
                                            onToggle={() => setShowConflictOnly((current) => !current)}
                                        />
                                    ) : (
                                        <ToggleRow
                                            label="Public only"
                                            description="Only public-facing club items."
                                            checked={showPublicOnly}
                                            onToggle={() => setShowPublicOnly((current) => !current)}
                                        />
                                    )}
                                </div>
                            </CollapsiblePanel>

                            <CollapsiblePanel
                                eyebrow="Calendar"
                                title={cursorDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                                helpText="Jump to a date without giving the planner more permanent chrome."
                                defaultOpen
                                bodyClassName="px-3 py-3"
                            >
                                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase tracking-[0.16em] text-secondary">
                                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label) => (
                                        <span key={label} className="py-1">{label}</span>
                                    ))}
                                    {monthGrid(cursorDate).map(({ date, inMonth }) => {
                                        const active = sameDay(date, cursorDate);
                                        const today = sameDay(date, new Date());

                                        return (
                                            <button
                                                key={toDateKey(date)}
                                                type="button"
                                                onClick={() => setCursorDate(date)}
                                                className={`schedule-interactive schedule-tone-blue h-8 rounded-[4px] text-[11px] font-black ${
                                                    active ? 'bg-elevated text-current' : 'bg-transparent text-secondary'
                                                } ${!inMonth ? 'opacity-45' : ''}`}
                                                data-active={active}
                                                style={today && !active ? { borderColor: 'var(--accent-primary)' } : undefined}
                                            >
                                                {date.getDate()}
                                            </button>
                                        );
                                    })}
                                </div>
                            </CollapsiblePanel>

                            <CollapsiblePanel
                                eyebrow="Help"
                                title="Legend"
                                helpText="Green = primary positive action. Pink = emphasis or destructive intent. Red = conflict or failure."
                            >
                                <div className="space-y-3 text-sm leading-6 text-secondary">
                                    <LegendRow title="Green" body="Primary actions, recurring work, and positive operational highlights." />
                                    <LegendRow title="Pink" body="Precision separators and quiet emphasis inside the schedule workspace." />
                                    <LegendRow title="Red" body="Reserved for real conflict or failure states only." />
                                </div>
                            </CollapsiblePanel>
                        </div>
                    </aside>

                    <div
                        role="separator"
                        aria-orientation="vertical"
                        aria-label="Resize left rail"
                        tabIndex={0}
                        onPointerDown={(event) => beginResize('left', event.clientX)}
                        onDoubleClick={() => setRailWidths((current) => ({ ...current, left: DEFAULT_LEFT_RAIL_WIDTH }))}
                        className={`schedule-rail-resizer ${resizeState?.side === 'left' ? 'schedule-rail-resizer--active' : ''}`}
                    />

                    <section className="schedule-page-center-zone flex min-h-0 flex-col overflow-hidden rounded-[4px]">
                        <div className="precision-rule flex min-h-0 flex-1 flex-col">
                            <ScheduleToolbar
                                workspaceLabel={surfaceCopy[workspaceSurface].label}
                                rangeLabel={formatRangeLabel(viewMode, cursorDate)}
                                filterSummary={filterSummary}
                                filterChips={filterChips}
                                stats={toolbarStats}
                                scheduleBusy={scheduleBusy}
                                onPrevious={() => setCursorDate((current) => addViewStep(viewMode, current, -1))}
                                onToday={() => setCursorDate(new Date())}
                                onNext={() => setCursorDate((current) => addViewStep(viewMode, current, 1))}
                            />

                            {actionNotice && <NoticeBanner notice={actionNotice} />}
                            {loadNotice && <NoticeBanner notice={{ tone: 'warning', message: loadNotice }} />}

                            <div className="min-h-0 flex-1 overflow-hidden">
                                {filteredEvents.length === 0 ? (
                                    <div className="flex h-full items-center justify-center px-6 text-center">
                                        <div className="max-w-md">
                                            <CalendarDays className="mx-auto h-10 w-10 text-secondary" />
                                            <h2 className="mt-4 text-lg font-black uppercase tracking-[0.16em] text-primary">No Schedule Items In View</h2>
                                            <p className="mt-3 text-sm leading-6 text-secondary">
                                                {workspaceSurface === 'CLUB_SCHEDULE' && !canOpenClubSchedule
                                                    ? 'Join a club to access the club-owned schedule workspace.'
                                                    : 'Adjust the current filters, date window, or view mode to reveal schedule items.'}
                                            </p>
                                            {canCreateEvent && (
                                                <button
                                                    type="button"
                                                    onClick={() => openCreateDrawer()}
                                                    className="schedule-toolbar-action schedule-tone-green mt-5 inline-flex items-center gap-2 rounded-[4px] px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] accent-primary"
                                                >
                                                    <Plus className="h-3.5 w-3.5" />
                                                    {workspaceSurface === 'CLUB_SCHEDULE' ? 'Create Club Event' : 'Create Personal Event'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <ScheduleGrid
                                        viewMode={viewMode}
                                        cursorDate={cursorDate}
                                        monthEvents={monthEvents}
                                        days={weekColumns}
                                        events={filteredEvents}
                                        selectedEventId={selectedEvent?.id ?? null}
                                        onSelectDate={setCursorDate}
                                        onSelectEvent={setSelectedEventId}
                                        canCreate={canCreateEvent}
                                        onCreateAt={(date) => openCreateDrawer(undefined, date)}
                                    />
                                )}
                            </div>
                        </div>
                    </section>

                    <div
                        role="separator"
                        aria-orientation="vertical"
                        aria-label="Resize right rail"
                        tabIndex={0}
                        onPointerDown={(event) => beginResize('right', event.clientX)}
                        onDoubleClick={() => setRailWidths((current) => ({ ...current, right: DEFAULT_RIGHT_RAIL_WIDTH }))}
                        className={`schedule-rail-resizer ${resizeState?.side === 'right' ? 'schedule-rail-resizer--active' : ''}`}
                    />

                    <aside className="schedule-page-right-zone schedule-scroll-surface min-h-0 overflow-y-auto rounded-[4px] px-2.5 py-3">
                        <SelectedEventPanel
                            selectedEvent={selectedEvent}
                            workspaceLabel={surfaceCopy[workspaceSurface].label}
                            workspaceSurface={workspaceSurface}
                            canManageClubSchedule={canManageClubSchedule}
                            canOpenClubSchedule={canOpenClubSchedule}
                            canEditSelectedEvent={canEditSelectedEvent}
                            canDeleteSelectedEvent={canDeleteSelectedEvent}
                            canAdjustVisibility={canAdjustVisibility}
                            deletingEventId={deletingEventId}
                            onEdit={openEditDrawer}
                            onDelete={handleDeleteSelected}
                            onReleaseNow={() => void mutateSelectedClubVisibility('PUBLIC', null, 'Club event is public now.')}
                            onQueueRelease={() => void mutateSelectedClubVisibility('SCHEDULED_PUBLICATION', buildQueuedPublishAt(selectedEvent?.startsAt ?? new Date().toISOString()), 'Club event queued for publication.')}
                            onKeepPrivate={() => void mutateSelectedClubVisibility('PRIVATE', null, 'Club event moved back to private.')}
                            onOpenConflictSource={handleOpenConflictSource}
                        />
                    </aside>
                </div>
            </div>

            {drawerState && (
                <ScheduleEventDrawer
                    isOpen
                    mode={drawerState.mode}
                    surface={drawerState.surface}
                    initialValues={drawerState.initialValues}
                    subjectLabel={drawerState.surface === 'CLUB_SCHEDULE' ? clubLabel : 'Visible only to you'}
                    onClose={() => setDrawerState(null)}
                    onSubmit={handleDrawerSubmit}
                />
            )}
        </div>
    );
};

const noticeToneStyles: Record<NoticeTone, CSSProperties> = {
    success: {
        borderColor: 'var(--accent-primary)',
        backgroundColor: 'var(--accent-primary-soft)',
        color: 'var(--accent-primary)'
    },
    warning: {
        borderColor: 'var(--state-warning)',
        backgroundColor: 'var(--state-warning-soft)',
        color: 'var(--state-warning)'
    },
    error: {
        borderColor: 'var(--state-danger)',
        backgroundColor: 'var(--state-danger-soft)',
        color: 'var(--state-danger)'
    }
};

const NoticeBanner = ({ notice }: { notice: Notice }) => (
    <div className="border-b border-subtle px-4 py-3 lg:px-5">
        <div className="flex items-start gap-3 border px-3 py-3 text-sm" style={noticeToneStyles[notice.tone]}>
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{notice.message}</span>
        </div>
    </div>
);

const ToggleRow = ({
    label,
    description,
    checked,
    onToggle
}: {
    label: string;
    description: string;
    checked: boolean;
    onToggle: () => void;
}) => (
    <button type="button" onClick={onToggle} className="schedule-toggle-row schedule-interactive schedule-tone-blue flex items-start justify-between gap-3 rounded-[4px] px-3 py-3 text-left">
        <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">{label}</p>
            <p className="mt-1 text-sm leading-5 text-secondary">{description}</p>
        </div>
        <span
            className={`schedule-toggle-track mt-1 inline-flex h-5 w-9 items-center border transition-colors ${
                checked ? 'schedule-toggle-track--active border-accent-primary justify-end' : 'border-subtle justify-start'
            }`}
        >
            <span className="mx-1 h-2.5 w-2.5 rounded-full bg-[color:var(--accent-primary)]" />
        </span>
    </button>
);

const LegendRow = ({ title, body }: { title: string; body: string }) => (
    <div>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">{title}</p>
        <p className="mt-1 text-sm leading-6 text-secondary">{body}</p>
    </div>
);
