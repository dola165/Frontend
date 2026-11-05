import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { cancelScheduleEvent, type ScheduleEventUpsertInput } from '../../../features/schedule/api';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { useDialogFocus } from '../../workspace/useDialogFocus';
import { usePanelMotion } from '../../ui/usePanelMotion';
import { apiClient } from '../../../api/axiosConfig';
import { durationMinutes, localDateISO, upcomingTrainingDates } from '../scheduleFormUtils';
import { eventTypeCopy } from '../workspaceTypes';
import { useMobileSchedule } from '../useMobileSchedule';
import { DAYS, wallTime, weekday, type EventCreationFormValues, type EventCreationModalProps, type Issue } from './eventEditorModel';

/**
 * Everything the event editor knows and does: the form, its derived dates and labels, step navigation,
 * validation, saving and cancelling (with the in-flight guard), the squad list and the unsaved-changes warning.
 */
export function useEventEditor({
    audience,
    fixedSquad = false,
    isOpen,
    mode,
    surface,
    clubId,
    initialValues,
    targetEventId,
    canManageSchedule = false,
    targetEventClubId = null,
    targetEventStartsAt = null,
    onCancelled,
    subjectLabel,
    audienceNotice,
    onClose: finishClose,
    onSubmit,
}: EventCreationModalProps) {
    const motion = usePanelMotion(finishClose);
    const onClose = motion.close;
    const { t, i18n } = useTranslation();
    const language = i18n.resolvedLanguage || i18n.language || 'en';
    const dateLocale = language.startsWith('en') ? 'en-GB' : language;
    const STEPS = [t('schedule.editor.plan'), t('schedule.editor.whenWhere'), t('schedule.editor.reviewShare')];
    const days = DAYS.map((day) => ({
        ...day,
        short: t(`schedule.editor.weekdays.${day.value}.short`),
        label: t(`schedule.editor.weekdays.${day.value}.long`),
    }));
    const readableDate = (date: string) => {
        const value = new Date(`${date}T12:00:00`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(value.getTime())) {
            return t('schedule.editor.chooseDate');
        }
        // Some Chrome builds omit Georgian Intl data. Keep previews Georgian there too.
        if (language.startsWith('ka') && !Intl.DateTimeFormat.supportedLocalesOf([dateLocale]).length) {
            const day = days[(value.getDay() + 6) % 7].short;
            return `${day}, ${value.getDate()} ${t(`schedule.editor.months.${value.getMonth()}`)} ${value.getFullYear()}`;
        }
        return new Intl.DateTimeFormat(dateLocale, {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
        }).format(value);
    };
    const mobile = useMobileSchedule();
    const [form, setForm] = useState(initialValues),
        [step, setStep] = useState(0);
    const [error, setError] = useState<string | null>(null),
        [submitting, setSubmitting] = useState(false),
        [cancelling, setCancelling] = useState(false);
    const [discard, setDiscard] = useState(false),
        [cancelConfirm, setCancelConfirm] = useState(false),
        [mapOpen, setMapOpen] = useState(false);
    const [squads, setSquads] = useState<{ clubId: number; items: { id: number; name: string }[] } | null>(null),
        [squadError, setSquadError] = useState(false);
    const dialog = useRef<HTMLDivElement>(null),
        content = useRef<HTMLDivElement>(null),
        titleInput = useRef<HTMLInputElement>(null),
        stepHeading = useRef<HTMLHeadingElement>(null);
    const inFlight = useRef(false),
        titleId = useId(),
        descriptionId = useId();
    const isClub = surface === 'CLUB_SCHEDULE',
        recurring = form.isRecurring;
    const eventType = recurring && !audience?.privateInvitations ? 'TRAINING' : form.eventType;
    const squadClubId = mode === 'edit' ? targetEventClubId : clubId;
    const savedSeries = mode === 'edit' && initialValues.isRecurring;
    const originalSeriesStart =
        initialValues.recurrenceStartDate && initialValues.recurrenceStartTime
            ? new Date(wallTime(initialValues.recurrenceStartDate, initialValues.recurrenceStartTime)).getTime()
            : NaN;
    // The current API cannot edit a series whose original start is in the past.
    // Never advance its boundary automatically: doing that would remove history.
    const startedSeries = savedSeries && Number.isFinite(originalSeriesStart) && originalSeriesStart <= Date.now();
    const busy = submitting || cancelling,
        readOnly = busy || startedSeries;
    const dirty = JSON.stringify(form) !== JSON.stringify(initialValues) || !!audience?.dirty;
    const canCancel =
        mode === 'edit' &&
        !startedSeries &&
        canManageSchedule &&
        targetEventClubId != null &&
        targetEventId != null &&
        !!targetEventStartsAt &&
        new Date(targetEventStartsAt).getTime() > Date.now();
    const date = recurring ? (form.recurrenceStartDate ?? '') : form.date;
    const start = recurring ? (form.recurrenceStartTime ?? '') : form.startTime;
    const end = recurring ? (form.recurrenceEndTime ?? '') : form.endTime;
    const overnightEnabled = !!audience?.privateInvitations && !recurring;
    const endDate = overnightEnabled ? form.endDate || date : date;
    const elapsed = (new Date(wallTime(endDate, end)).getTime() - new Date(wallTime(date, start)).getTime()) / 60000;
    const minutes = overnightEnabled ? (Number.isFinite(elapsed) && elapsed > 0 ? elapsed : null) : durationMinutes(start, end);
    const interval = form.recurrenceInterval ?? 1;
    const sessionDates = recurring
        ? upcomingTrainingDates({
              startDate: date,
              endDate: form.recurrenceEndDate,
              daysOfWeek: form.recurrenceDays ?? [],
              intervalValue: interval,
              limit: 3,
              weekAnchor: audience?.privateInvitations ? 'MONDAY' : 'START',
          })
        : [];
    const daysText = days.filter((day) => form.recurrenceDays?.includes(day.value))
        .map((day) => day.short)
        .join(', ');
    const squadName =
        squads?.clubId === squadClubId ? squads.items.find((squad) => squad.id === form.hostSquadId)?.name : undefined;
    const hasSquad = isClub && !!eventType && ['TRAINING', 'MATCH', 'FRIENDLY'].includes(eventType);
    const privacyText = audience?.privateInvitations ? audience.privacyLabel : !isClub
        ? t('schedule.editor.onlyYou')
        : form.visibility === 'PUBLIC'
          ? t('schedule.event.public')
          : form.visibility === 'SCHEDULED_PUBLICATION'
            ? t('schedule.editor.publishesLater')
            : t('schedule.editor.clubMembers');
    const accent = eventType === 'ACTIVITY' ? 'var(--fc-text-secondary)' : eventType ? eventTypeCopy[eventType].accent : 'var(--fc-accent)';
    const update = <K extends keyof EventCreationFormValues>(key: K, value: EventCreationFormValues[K]) => {
        setForm((previous) => ({ ...previous, [key]: value,
            ...(key === 'date' && previous.endDate === previous.date ? { endDate: value as string } : {}),
        }));
        setError(null);
    };
    useEffect(() => {
        if (!isOpen) return;
        setForm(initialValues);
        setStep(0);
        setError(null);
        setSubmitting(false);
        setCancelling(false);
        setMapOpen(false);
        setDiscard(false);
        setCancelConfirm(false);
        inFlight.current = false;
    }, [isOpen, initialValues]);
    useEffect(() => {
        if (!isOpen || !isClub || !squadClubId || fixedSquad) return;
        const controller = new AbortController();
        setSquadError(false);
        void apiClient
            .get(`/clubs/${squadClubId}/squads`, { signal: controller.signal })
            .then((response) => {
                if (!controller.signal.aborted) setSquads({ clubId: squadClubId, items: response.data });
            })
            .catch(() => {
                if (!controller.signal.aborted) setSquadError(true);
            });
        return () => controller.abort();
    }, [isOpen, isClub, squadClubId, fixedSquad]);
    useEffect(() => {
        if (!isOpen || (!dirty && !busy)) return;
        const warn = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [isOpen, dirty, busy]);
    const requestClose = () => {
        if (inFlight.current) return;
        if (dirty) setDiscard(true);
        else onClose();
    };
    useDialogFocus(isOpen && !discard && !cancelConfirm, dialog, requestClose, mobile || startedSeries ? dialog : titleInput);
    const navigateStep = (next: number, field?: string) => {
        setStep(next);
        setError(null);
        content.current?.scrollTo?.({ top: 0 });
        requestAnimationFrame(() => {
            const control = field
                ? dialog.current?.querySelector<HTMLElement>(`[data-field="${field}"]`)
                : stepHeading.current;
            control?.focus();
        });
    };
    const selectMode = (repeat: boolean) => {
        setForm((previous) =>
            repeat
                ? {
                      ...previous,
                      isRecurring: true,
                      eventType: audience?.privateInvitations ? previous.eventType ?? 'TRAINING' : 'TRAINING',
                      recurrenceStartDate: previous.recurrenceStartDate || previous.date,
                      recurrenceStartTime: previous.recurrenceStartTime || previous.startTime,
                      recurrenceEndTime: previous.recurrenceEndTime || previous.endTime,
                      recurrenceEndDate: previous.recurrenceEndDate || (audience?.privateInvitations ? localDateISO(new Date(new Date(`${previous.date}T12:00:00`).getTime() + 42 * 86400000)) : ''),
                      recurrenceDays: previous.recurrenceDays?.length
                          ? previous.recurrenceDays
                          : [weekday(previous.date)],
                      recurrenceInterval: previous.recurrenceInterval ?? 1,
                      recurrenceTimezone:
                          previous.recurrenceTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
                  }
                : { ...previous, isRecurring: false },
        );
        setError(null);
    };
    const issue = (through: number): Issue | null => {
        if (!eventType) return { step: 0, field: 'kind', message: t('schedule.editor.chooseKind') };
        if (!form.title.trim()) return { step: 0, field: 'title', message: t('schedule.event.titleRequired') };
        if (through < 1) return null;
        if (!date || !start || !end || !Number.isFinite(new Date(wallTime(date, start)).getTime()))
            return { step: 1, field: 'date', message: t('schedule.event.dateTimesRequired') };
        if (!minutes) return { step: 1, field: 'endTime', message: t('schedule.event.endAfterStart') };
        if (overnightEnabled && minutes > 1440)
            return { step: 1, field: 'eventEndDate', message: t('schedule.editor.maxEventDuration') };
        if (new Date(wallTime(date, start)).getTime() <= Date.now())
            return { step: 1, field: 'date', message: t('schedule.event.startInFuture') };
        if (recurring) {
            if (!form.recurrenceDays?.length)
                return { step: 1, field: 'days', message: t('schedule.event.selectWeekday') };
            if (form.recurrenceEndDate && form.recurrenceEndDate < date)
                return { step: 1, field: 'endDate', message: t('schedule.event.recurrenceEndBeforeStart') };
            if (!sessionDates.length)
                return {
                    step: 1,
                    field: 'endDate',
                    message:
                        t('schedule.editor.noTrainingDays'),
                };
        }
        if (through < 2) return null;
        if (isClub && !audience?.privateInvitations && form.visibility === 'SCHEDULED_PUBLICATION') {
            const publication = new Date(form.publishAt).getTime();
            if (!form.publishAt || !Number.isFinite(publication))
                return { step: 2, field: 'publishAt', message: t('schedule.event.publicationDateRequired') };
            if (mode === 'create' && publication <= Date.now())
                return { step: 2, field: 'publishAt', message: t('schedule.editor.futurePublication') };
            if (publication >= new Date(wallTime(date, end)).getTime())
                return {
                    step: 2,
                    field: 'publishAt',
                    message:
                        t('schedule.editor.publishBeforeEnd'),
                };
        }
        return null;
    };
    const showIssue = (problem: Issue) => {
        navigateStep(problem.step, problem.field);
        setError(problem.message);
    };
    const next = () => {
        const problem = issue(step);
        if (problem) showIssue(problem);
        else navigateStep(Math.min(2, step + 1));
    };
    const handleSave = async () => {
        if (inFlight.current || startedSeries || (audience && !audience.ready)) return;
        const problem = issue(2);
        if (problem) {
            showIssue(problem);
            return;
        }
        const type = eventType!;
        const payload: ScheduleEventUpsertInput = {
            title: form.title.trim(),
            description: form.description?.trim() || null,
            eventType: type,
            opponentClubId: isClub && ['MATCH', 'FRIENDLY'].includes(type) ? (form.opponentClubId ?? null) : null,
            hostSquadId: hasSquad ? (form.hostSquadId ?? null) : null,
            startsAt: wallTime(date, start),
            endsAt: wallTime(endDate, end),
            visibility: isClub && !audience?.privateInvitations ? form.visibility : 'PRIVATE',
            publishAt:
                isClub && !audience?.privateInvitations && form.visibility === 'SCHEDULED_PUBLICATION'
                    ? form.publishAt.length === 16
                        ? `${form.publishAt}:00`
                        : form.publishAt
                    : null,
            locationName: form.locationName.trim() || null,
            locationLat: form.locationLat.trim() ? Number(form.locationLat) : null,
            locationLng: form.locationLng.trim() ? Number(form.locationLng) : null,
            recurrence: recurring
                ? {
                      frequency: 'WEEKLY',
                      intervalValue: interval,
                      daysOfWeek: form.recurrenceDays!,
                      startDate: date,
                      endDate: form.recurrenceEndDate || null,
                      startTime: `${start.slice(0, 5)}:00`,
                      endTime: `${end.slice(0, 5)}:00`,
                      timezone:
                          mode === 'edit'
                              ? (form.recurrenceTimezone ?? null)
                              : (form.recurrenceTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone),
                  }
                : null,
        };
        inFlight.current = true;
        setSubmitting(true);
        setError(null);
        try {
            await onSubmit(payload, { eventType: type, recurring });
        } catch (error) {
            setError(extractApiErrorMessage(error, t('schedule.event.saveFailed')));
        } finally {
            inFlight.current = false;
            setSubmitting(false);
        }
    };
    const handleCancel = async () => {
        if (inFlight.current || !canCancel || !targetEventId || targetEventClubId == null) return;
        inFlight.current = true;
        setCancelling(true);
        setError(null);
        try {
            await cancelScheduleEvent(targetEventClubId, targetEventId);
            toast.success(savedSeries ? t('schedule.editor.seriesCancelled') : t('schedule.editor.eventCancelled'));
            onClose();
            onCancelled?.();
        } catch (error) {
            setError(extractApiErrorMessage(error, t('schedule.editor.cancelFailed')));
        } finally {
            inFlight.current = false;
            setCancelling(false);
        }
    };
    const applyDuration = (duration: number) => {
        const [hours, mins] = start.split(':').map(Number);
        const total = hours * 60 + mins + duration;
        if (overnightEnabled && date && Number.isFinite(total)) {
            const finish = new Date(new Date(wallTime(date, start)).getTime() + duration * 60000);
            setForm(previous => ({ ...previous, endDate: localDateISO(finish), endTime: `${String(finish.getHours()).padStart(2, '0')}:${String(finish.getMinutes()).padStart(2, '0')}` }));
            setError(null);
            return;
        }
        if (!Number.isFinite(total) || total >= 1440) return;
        update(
            recurring ? 'recurrenceEndTime' : 'endTime',
            `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`,
        );
    };
    const lat = form.locationLat.trim() ? Number(form.locationLat) : null,
        lng = form.locationLng.trim() ? Number(form.locationLng) : null;
    const headline = startedSeries
        ? t('schedule.editor.trainingSeries')
        : mode === 'edit'
          ? savedSeries
              ? t('schedule.editor.editSeries')
              : t('schedule.editor.editEvent')
          : recurring && !audience?.privateInvitations
            ? t('schedule.editor.newTraining')
            : t('schedule.editor.newEvent');
    const saveLabel = audience?.saveLabel ?? (mode === 'edit' ? t('schedule.editor.saveChanges') : recurring ? t('schedule.editor.createTraining') : t('schedule.editor.createEvent'));
    return {
        STEPS, accent, applyDuration, audience, audienceNotice, busy, canCancel, cancelConfirm, content,
        date, days, daysText, descriptionId, dialog, discard, end, endDate, error, eventType, fixedSquad,
        form, handleCancel, handleSave, hasSquad, headline, inFlight, interval, isClub, issue, lat, lng,
        mapOpen, minutes, mode, motion, navigateStep, next, onClose, overnightEnabled, privacyText, readOnly,
        readableDate, recurring, requestClose, saveLabel, savedSeries, selectMode, sessionDates,
        setCancelConfirm, setDiscard, setForm, setMapOpen, showIssue, squadClubId, squadError, squadName,
        squads, start, startedSeries, step, stepHeading, subjectLabel, submitting, surface, t,
        titleId, titleInput, update,
    };
}

export type EventEditor = ReturnType<typeof useEventEditor>;
