import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CalendarDays, Globe2, Loader2, MapPin, Repeat2, ShieldCheck, Swords, UserRound, X } from 'lucide-react';
import { MiniMap } from '../MiniMap';
import type { DayOfWeek, ScheduleEventType, ScheduleEventUpsertInput, ScheduleVisibility } from '../../features/schedule/api';
import { extractApiErrorMessage } from '../../utils/apiError';

export type ScheduleDrawerSurface = 'MY_SCHEDULE' | 'CLUB_SCHEDULE';
export type ScheduleDrawerMode = 'create' | 'edit';

export interface ScheduleEventFormValues {
    title: string;
    description: string;
    eventType: ScheduleEventType;
    date: string;
    startTime: string;
    endTime: string;
    locationName: string;
    locationLat: string;
    locationLng: string;
    visibility: ScheduleVisibility;
    publishAt: string;
    opponentClubId: string;
    isRecurring: boolean;
    recurrenceDays: DayOfWeek[];
    recurrenceStartDate: string;
    recurrenceEndDate: string;
    recurrenceStartTime: string;
    recurrenceEndTime: string;
}

interface ScheduleEventDrawerProps {
    isOpen: boolean;
    mode: ScheduleDrawerMode;
    surface: ScheduleDrawerSurface;
    initialValues: ScheduleEventFormValues;
    subjectLabel: string;
    onClose: () => void;
    onSubmit: (payload: ScheduleEventUpsertInput, meta: { eventType: ScheduleEventType; recurring: boolean }) => Promise<void>;
}

interface FormSectionProps {
    icon: typeof CalendarDays;
    eyebrow: string;
    title: string;
    description: string;
    children: ReactNode;
}

const eventTypeOptions: Array<{ value: ScheduleEventType; label: string; description: string; icon: typeof CalendarDays }> = [
    { value: 'TRAINING', label: 'Training', description: 'Recurring or one-time club and personal training sessions.', icon: Repeat2 },
    { value: 'TRYOUT', label: 'Tryout', description: 'Trials, talent windows, and recruitment sessions.', icon: Globe2 },
    { value: 'MATCH', label: 'Match', description: 'Competitive fixtures or scheduled match windows.', icon: Swords },
    { value: 'FRIENDLY', label: 'Friendly', description: 'Friendly fixtures and open challenge opportunities.', icon: MapPin },
    { value: 'ACTIVITY', label: 'Activity', description: 'Fallback operational event for anything else.', icon: CalendarDays }
];

const visibilityOptions: Array<{ value: ScheduleVisibility; label: string; description: string }> = [
    { value: 'PRIVATE', label: 'Private', description: 'Members only for club events, user only for personal events.' },
    { value: 'PUBLIC', label: 'Public', description: 'Immediately discoverable where public schedule listings are used.' },
    { value: 'SCHEDULED_PUBLICATION', label: 'Scheduled Publication', description: 'Private now, then automatically becomes public later.' }
];

const dayOptions: Array<{ value: DayOfWeek; label: string }> = [
    { value: 'MONDAY', label: 'Mon' },
    { value: 'TUESDAY', label: 'Tue' },
    { value: 'WEDNESDAY', label: 'Wed' },
    { value: 'THURSDAY', label: 'Thu' },
    { value: 'FRIDAY', label: 'Fri' },
    { value: 'SATURDAY', label: 'Sat' },
    { value: 'SUNDAY', label: 'Sun' }
];

const FormSection = ({ icon: Icon, eyebrow, title, description, children }: FormSectionProps) => (
    <section className="space-y-4 border-t border-subtle pt-6 first:border-t-0 first:pt-0">
        <div className="flex items-start gap-3">
            <div className="theme-surface-strong flex h-9 w-9 shrink-0 items-center justify-center border border-subtle accent-primary">
                <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">{eyebrow}</p>
                <h3 className="mt-1 text-base font-black uppercase tracking-[0.14em] text-primary">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-secondary">{description}</p>
            </div>
        </div>
        {children}
    </section>
);

const buildLocalDateTime = (date: string, time: string) => `${date}T${normalizeTime(time)}:00`;
const normalizeTime = (time: string) => (time.length === 5 ? time : time.slice(0, 5));
const normalizeDateTimeLocal = (value: string) => (value && value.length === 16 ? `${value}:00` : value);
const isPositiveNumber = (value: string) => Number.isFinite(Number(value)) && Number(value) > 0;

export const ScheduleEventDrawer = ({
    isOpen,
    mode,
    surface,
    initialValues,
    subjectLabel,
    onClose,
    onSubmit
}: ScheduleEventDrawerProps) => {
    const [formData, setFormData] = useState<ScheduleEventFormValues>(initialValues);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        setFormData(initialValues);
        setErrorMessage(null);
        setSubmitting(false);
    }, [initialValues, isOpen]);

    const isClubSurface = surface === 'CLUB_SCHEDULE';
    const isTraining = formData.eventType === 'TRAINING';
    const isMatchLike = formData.eventType === 'MATCH' || formData.eventType === 'FRIENDLY';
    const supportsRecurrence = isTraining;
    const hasPinnedLocation = Boolean(formData.locationLat.trim() && formData.locationLng.trim());

    const helperCopy = useMemo(() => {
        if (!isClubSurface && isTraining) {
            return 'Personal training blocks can repeat weekly while still staying private and conflict-aware.';
        }
        if (!isClubSurface) {
            return 'Personal schedule items stay private by design, but they still receive conflict warnings when they overlap club responsibilities.';
        }
        if (formData.eventType === 'TRYOUT') {
            return 'Tryouts often start private while staff confirm logistics, then shift to public discovery closer to the session.';
        }
        if (isMatchLike) {
            return 'Leave opponent club blank to create an open match or friendly request that can be discovered later.';
        }
        if (isTraining) {
            return 'Recurring training uses weekly rules rather than duplicating rows manually.';
        }
        return 'Club events can stay internal, go public immediately, or queue publication for later.';
    }, [formData.eventType, isClubSurface, isMatchLike, isTraining]);

    useEffect(() => {
        if (!isClubSurface || formData.visibility !== 'SCHEDULED_PUBLICATION' || formData.publishAt) {
            return;
        }

        const anchorDate = formData.isRecurring && supportsRecurrence ? formData.recurrenceStartDate : formData.date;
        const anchorTime = formData.isRecurring && supportsRecurrence ? formData.recurrenceStartTime : formData.startTime;
        if (!anchorDate || !anchorTime) {
            return;
        }

        const kickoff = new Date(`${anchorDate}T${anchorTime}:00`);
        if (Number.isNaN(kickoff.getTime())) {
            return;
        }

        const suggested = new Date(kickoff.getTime() - 5 * 24 * 60 * 60 * 1000);
        const earliest = new Date(Date.now() + 15 * 60 * 1000);
        const value = suggested > earliest ? suggested : earliest;
        const formatted = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}T${String(
            value.getHours()
        ).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;

        setFormData((current) => ({ ...current, publishAt: formatted }));
    }, [formData.date, formData.isRecurring, formData.publishAt, formData.recurrenceStartDate, formData.recurrenceStartTime, formData.startTime, formData.visibility, isClubSurface, supportsRecurrence]);

    if (!isOpen) {
        return null;
    }

    const updateField = <K extends keyof ScheduleEventFormValues>(field: K, value: ScheduleEventFormValues[K]) => {
        setFormData((current) => ({ ...current, [field]: value }));
        if (errorMessage) {
            setErrorMessage(null);
        }
    };

    const updateLocationFromMap = ({ lat, lng }: { lat: number; lng: number }) => {
        setFormData((current) => ({
            ...current,
            locationLat: lat.toFixed(6),
            locationLng: lng.toFixed(6)
        }));
        if (errorMessage) {
            setErrorMessage(null);
        }
    };

    const toggleRecurrenceDay = (day: DayOfWeek) => {
        setFormData((current) => ({
            ...current,
            recurrenceDays: current.recurrenceDays.includes(day)
                ? current.recurrenceDays.filter((entry) => entry !== day)
                : [...current.recurrenceDays, day]
        }));
        if (errorMessage) {
            setErrorMessage(null);
        }
    };

    const validate = () => {
        if (!formData.title.trim()) {
            return 'Title is required.';
        }

        if (formData.isRecurring && supportsRecurrence) {
            if (!formData.recurrenceDays.length) {
                return 'Pick at least one recurrence day.';
            }
            if (!formData.recurrenceStartDate || !formData.recurrenceStartTime || !formData.recurrenceEndTime) {
                return 'Recurring training needs a start date and start/end time.';
            }
            if (formData.recurrenceEndDate && formData.recurrenceEndDate < formData.recurrenceStartDate) {
                return 'Recurrence end date cannot be before the recurrence start date.';
            }
            if (buildLocalDateTime(formData.recurrenceStartDate, formData.recurrenceEndTime) <= buildLocalDateTime(formData.recurrenceStartDate, formData.recurrenceStartTime)) {
                return 'Recurring training end time must be after the start time.';
            }
        } else {
            if (!formData.date || !formData.startTime || !formData.endTime) {
                return 'Date, start time, and end time are required.';
            }
            if (buildLocalDateTime(formData.date, formData.endTime) <= buildLocalDateTime(formData.date, formData.startTime)) {
                return 'End time must be after the start time.';
            }
        }

        if (isClubSurface && formData.visibility === 'SCHEDULED_PUBLICATION' && !formData.publishAt) {
            return 'Choose when the club event should become public.';
        }

        if (formData.locationLat.trim() && Number.isNaN(Number(formData.locationLat))) {
            return 'Latitude must be a valid number.';
        }

        if (formData.locationLng.trim() && Number.isNaN(Number(formData.locationLng))) {
            return 'Longitude must be a valid number.';
        }

        if (isMatchLike && formData.opponentClubId.trim() && !isPositiveNumber(formData.opponentClubId)) {
            return 'Opponent club must be a positive number when provided.';
        }

        return null;
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        const validationMessage = validate();
        if (validationMessage) {
            setErrorMessage(validationMessage);
            return;
        }

        const payload: ScheduleEventUpsertInput = {
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            eventType: formData.eventType,
            startsAt: formData.isRecurring && supportsRecurrence
                ? buildLocalDateTime(formData.recurrenceStartDate, formData.recurrenceStartTime)
                : buildLocalDateTime(formData.date, formData.startTime),
            endsAt: formData.isRecurring && supportsRecurrence
                ? buildLocalDateTime(formData.recurrenceStartDate, formData.recurrenceEndTime)
                : buildLocalDateTime(formData.date, formData.endTime),
            visibility: isClubSurface ? formData.visibility : 'PRIVATE',
            publishAt: isClubSurface && formData.visibility === 'SCHEDULED_PUBLICATION' ? normalizeDateTimeLocal(formData.publishAt) : null,
            locationName: formData.locationName.trim() || null,
            locationLat: formData.locationLat.trim() ? Number(formData.locationLat) : null,
            locationLng: formData.locationLng.trim() ? Number(formData.locationLng) : null,
            opponentClubId: isMatchLike && formData.opponentClubId.trim() ? Number(formData.opponentClubId) : null,
            recurrence:
                formData.isRecurring && supportsRecurrence
                    ? {
                        frequency: 'WEEKLY',
                        intervalValue: 1,
                        daysOfWeek: formData.recurrenceDays,
                        startDate: formData.recurrenceStartDate,
                        endDate: formData.recurrenceEndDate || null,
                        startTime: `${normalizeTime(formData.recurrenceStartTime)}:00`,
                        endTime: `${normalizeTime(formData.recurrenceEndTime)}:00`,
                        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
                    }
                    : null
        };

        setSubmitting(true);
        setErrorMessage(null);
        try {
            await onSubmit(payload, { eventType: formData.eventType, recurring: formData.isRecurring && supportsRecurrence });
        } catch (error) {
            setErrorMessage(extractApiErrorMessage(error, 'Could not save the schedule event.'));
            setSubmitting(false);
        }
    };

    return (
        <div className="theme-overlay-strong fixed inset-0 z-[9999] flex justify-end backdrop-blur-sm">
            <div className="theme-surface theme-border flex h-full w-full max-w-[560px] flex-col border-l shadow-2xl">
                <div className="operational-divider flex items-start justify-between gap-4 px-5 py-5">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] accent-primary">
                            {mode === 'create' ? 'Create Schedule Item' : 'Edit Schedule Item'}
                        </p>
                        <h2 className="mt-2 text-xl font-black uppercase tracking-tight text-primary">
                            {mode === 'create' ? 'New Event' : 'Edit Event'}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-secondary">
                            {subjectLabel}. {helperCopy}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="inline-flex h-10 w-10 items-center justify-center border border-subtle bg-base text-secondary transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                        <div className="space-y-8">
                            <FormSection
                                icon={surface === 'CLUB_SCHEDULE' ? ShieldCheck : UserRound}
                                eyebrow="Common Fields"
                                title="Core event details"
                                description="Keep the event title sharp and operational so it reads clearly from the schedule grid."
                            >
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">
                                            Title
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.title}
                                            onChange={(event) => updateField('title', event.target.value)}
                                            maxLength={140}
                                            required
                                            className="theme-surface-strong theme-border w-full border px-3 py-3 text-sm font-semibold text-primary outline-none transition-colors focus:border-accent-primary"
                                            placeholder={surface === 'CLUB_SCHEDULE' ? 'e.g. Senior Training' : 'e.g. Personal block'}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">
                                            Event Type
                                        </label>
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            {eventTypeOptions.map((option) => {
                                                const Icon = option.icon;
                                                const active = formData.eventType === option.value;

                                                return (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => updateField('eventType', option.value)}
                                                        className={`border px-3 py-3 text-left transition-colors ${
                                                            active ? 'theme-surface-strong border-accent-muted' : 'theme-surface border-subtle hover:theme-surface-strong'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <Icon className={`h-4 w-4 ${active ? 'accent-primary' : 'text-secondary'}`} />
                                                            <span className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">{option.label}</span>
                                                        </div>
                                                        <p className="mt-2 text-sm leading-5 text-secondary">{option.description}</p>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">
                                            Notes / Description
                                        </label>
                                        <textarea
                                            rows={4}
                                            maxLength={2000}
                                            value={formData.description}
                                            onChange={(event) => updateField('description', event.target.value)}
                                            className="theme-surface-strong theme-border w-full border px-3 py-3 text-sm font-medium text-primary outline-none transition-colors focus:border-accent-primary"
                                            placeholder="Operational notes, staff instructions, or personal context."
                                        />
                                    </div>
                                </div>
                            </FormSection>

                            <FormSection
                                icon={CalendarDays}
                                eyebrow="Timing"
                                title={supportsRecurrence ? 'One-time or recurring timing' : 'Date and time'}
                                description={supportsRecurrence
                                    ? 'Training can stay one-time or switch to a weekly recurrence rule when you need a standing schedule.'
                                    : 'The schedule grid and empty-slot quick add will prefill these when you start from the board.'}
                            >
                                <div className="space-y-4">
                                    {supportsRecurrence && (
                                        <button
                                            type="button"
                                            onClick={() => updateField('isRecurring', !formData.isRecurring)}
                                            className="flex items-start justify-between gap-3 border border-subtle bg-base px-3 py-3 text-left"
                                        >
                                            <div>
                                                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">Recurring training</p>
                                                <p className="mt-1 text-sm leading-5 text-secondary">
                                                    Use weekly recurrence for fixed training blocks instead of creating duplicate entries manually.
                                                </p>
                                            </div>
                                            <span
                                                className={`mt-1 inline-flex h-5 w-9 items-center border transition-colors ${
                                                    formData.isRecurring ? 'border-accent-primary bg-accent-primary-soft justify-end' : 'border-subtle bg-surface justify-start'
                                                }`}
                                            >
                                                <span className="mx-1 h-2.5 w-2.5 rounded-full bg-[color:var(--accent-primary)]" />
                                            </span>
                                        </button>
                                    )}

                                    {formData.isRecurring && supportsRecurrence ? (
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">Days Of Week</label>
                                                <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                                                    {dayOptions.map((option) => {
                                                        const active = formData.recurrenceDays.includes(option.value);
                                                        return (
                                                            <button
                                                                key={option.value}
                                                                type="button"
                                                                onClick={() => toggleRecurrenceDay(option.value)}
                                                                className={`border px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] transition-colors ${
                                                                    active ? 'theme-surface-strong border-accent-muted text-primary' : 'bg-base border-subtle text-secondary'
                                                                }`}
                                                            >
                                                                {option.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">Start Date</label>
                                                    <input
                                                        type="date"
                                                        value={formData.recurrenceStartDate}
                                                        onChange={(event) => updateField('recurrenceStartDate', event.target.value)}
                                                        className="theme-surface-strong theme-border w-full border px-3 py-3 text-sm font-semibold text-primary outline-none transition-colors focus:border-accent-primary"
                                                    />
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">End Date (Optional)</label>
                                                    <input
                                                        type="date"
                                                        value={formData.recurrenceEndDate}
                                                        onChange={(event) => updateField('recurrenceEndDate', event.target.value)}
                                                        className="theme-surface-strong theme-border w-full border px-3 py-3 text-sm font-semibold text-primary outline-none transition-colors focus:border-accent-primary"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">Start Time</label>
                                                    <input
                                                        type="time"
                                                        value={formData.recurrenceStartTime}
                                                        onChange={(event) => updateField('recurrenceStartTime', event.target.value)}
                                                        className="theme-surface-strong theme-border w-full border px-3 py-3 text-sm font-semibold text-primary outline-none transition-colors focus:border-accent-primary"
                                                    />
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">End Time</label>
                                                    <input
                                                        type="time"
                                                        value={formData.recurrenceEndTime}
                                                        onChange={(event) => updateField('recurrenceEndTime', event.target.value)}
                                                        className="theme-surface-strong theme-border w-full border px-3 py-3 text-sm font-semibold text-primary outline-none transition-colors focus:border-accent-primary"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid gap-4 md:grid-cols-3">
                                            <div className="space-y-2 md:col-span-1">
                                                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">Date</label>
                                                <input
                                                    type="date"
                                                    value={formData.date}
                                                    onChange={(event) => updateField('date', event.target.value)}
                                                    className="theme-surface-strong theme-border w-full border px-3 py-3 text-sm font-semibold text-primary outline-none transition-colors focus:border-accent-primary"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">Start Time</label>
                                                <input
                                                    type="time"
                                                    value={formData.startTime}
                                                    onChange={(event) => updateField('startTime', event.target.value)}
                                                    className="theme-surface-strong theme-border w-full border px-3 py-3 text-sm font-semibold text-primary outline-none transition-colors focus:border-accent-primary"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">End Time</label>
                                                <input
                                                    type="time"
                                                    value={formData.endTime}
                                                    onChange={(event) => updateField('endTime', event.target.value)}
                                                    className="theme-surface-strong theme-border w-full border px-3 py-3 text-sm font-semibold text-primary outline-none transition-colors focus:border-accent-primary"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </FormSection>

                            <FormSection
                                icon={MapPin}
                                eyebrow="Location"
                                title="Venue and map context"
                                description="Use the map pin as the source of truth for venue coordinates, then add a human-readable label for operators."
                            >
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">Location Name</label>
                                        <input
                                            type="text"
                                            value={formData.locationName}
                                            onChange={(event) => updateField('locationName', event.target.value)}
                                            maxLength={255}
                                            className="theme-surface-strong theme-border w-full border px-3 py-3 text-sm font-semibold text-primary outline-none transition-colors focus:border-accent-primary"
                                            placeholder="e.g. Pitch 1, club ground, neutral venue"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">Venue Picker</label>
                                        <MiniMap
                                            mode="picker"
                                            selectedLocation={{
                                                lat: formData.locationLat.trim() ? Number(formData.locationLat) : null,
                                                lng: formData.locationLng.trim() ? Number(formData.locationLng) : null
                                            }}
                                            onSelectLocation={updateLocationFromMap}
                                        />
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-3 border border-subtle bg-base px-3 py-3">
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">Pinned Coordinates</p>
                                            <p className="mt-1 text-sm font-semibold text-primary">
                                                {hasPinnedLocation ? `${formData.locationLat}, ${formData.locationLng}` : 'No venue pin selected yet.'}
                                            </p>
                                            <p className="mt-1 text-sm leading-5 text-secondary">
                                                {hasPinnedLocation
                                                    ? 'The saved event will use this map pin for discovery and venue context.'
                                                    : 'Leave this blank for events that do not need a fixed map point.'}
                                            </p>
                                        </div>

                                        {hasPinnedLocation ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    updateField('locationLat', '');
                                                    updateField('locationLng', '');
                                                }}
                                                className="schedule-toolbar-action schedule-tone-pink inline-flex items-center gap-2 rounded-[4px] px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-primary"
                                            >
                                                Clear Pin
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            </FormSection>

                            {isClubSurface ? (
                                <FormSection
                                    icon={ShieldCheck}
                                    eyebrow="Visibility"
                                    title="Club publication controls"
                                    description="Club events can stay private, go live immediately, or queue release for later publication."
                                >
                                    <div className="space-y-4">
                                        <div className="grid gap-2">
                                            {visibilityOptions.map((option) => {
                                                const active = formData.visibility === option.value;
                                                return (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => updateField('visibility', option.value)}
                                                        className={`border px-3 py-3 text-left transition-colors ${
                                                            active ? 'theme-surface-strong border-accent-muted' : 'bg-base border-subtle'
                                                        }`}
                                                    >
                                                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">{option.label}</p>
                                                        <p className="mt-1 text-sm leading-5 text-secondary">{option.description}</p>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {formData.visibility === 'SCHEDULED_PUBLICATION' && (
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">Publish At</label>
                                                <input
                                                    type="datetime-local"
                                                    value={formData.publishAt}
                                                    onChange={(event) => updateField('publishAt', event.target.value)}
                                                    className="theme-surface-strong theme-border w-full border px-3 py-3 text-sm font-semibold text-primary outline-none transition-colors focus:border-accent-primary"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </FormSection>
                            ) : (
                                <FormSection
                                    icon={UserRound}
                                    eyebrow="Privacy"
                                    title="Private by design"
                                    description="My Schedule stays personal only. It never becomes public and never appears on the map."
                                >
                                    <div className="border border-subtle bg-base px-3 py-3 text-sm leading-6 text-secondary">
                                        Personal items still return conflict warnings when they overlap club obligations, but the event itself remains private.
                                    </div>
                                </FormSection>
                            )}

                            {(isMatchLike || formData.eventType === 'TRYOUT' || formData.eventType === 'ACTIVITY') && (
                                <FormSection
                                    icon={isMatchLike ? Swords : formData.eventType === 'TRYOUT' ? Globe2 : CalendarDays}
                                    eyebrow="Type-Specific"
                                    title={
                                        isMatchLike
                                            ? 'Match / friendly setup'
                                            : formData.eventType === 'TRYOUT'
                                                ? 'Tryout controls'
                                                : 'General activity'
                                    }
                                    description={
                                        isMatchLike
                                            ? 'Use an opponent club when the fixture is already targeted, or leave it empty to keep the event open.'
                                            : formData.eventType === 'TRYOUT'
                                                ? 'Tryouts often rely on location and publication timing more heavily than internal activities.'
                                                : 'Activity is the lightweight fallback when you need a simple operational event.'
                                    }
                                >
                                    <div className="space-y-4">
                                        {isMatchLike && (
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">Opponent Club Id (Optional)</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    step="1"
                                                    value={formData.opponentClubId}
                                                    onChange={(event) => updateField('opponentClubId', event.target.value)}
                                                    className="theme-surface-strong theme-border w-full border px-3 py-3 text-sm font-semibold text-primary outline-none transition-colors focus:border-accent-primary"
                                                    placeholder="Leave blank for open match / friendly request"
                                                />
                                                <p className="text-sm leading-5 text-secondary">
                                                    When blank, the event stays open for discovery and later challenge-response handling.
                                                </p>
                                            </div>
                                        )}

                                        {formData.eventType === 'TRYOUT' && (
                                            <div className="border border-subtle bg-base px-3 py-3 text-sm leading-6 text-secondary">
                                                Tryouts can stay private while scouting and staffing are finalized, then switch to scheduled publication before the event date.
                                            </div>
                                        )}

                                        {formData.eventType === 'ACTIVITY' && (
                                            <div className="border border-subtle bg-base px-3 py-3 text-sm leading-6 text-secondary">
                                                Use Activity for meetings, club operations, logistics blocks, or personal schedule items that do not fit the other event types.
                                            </div>
                                        )}
                                    </div>
                                </FormSection>
                            )}

                            {errorMessage && (
                                <div
                                    className="border px-3 py-3 text-sm"
                                    style={{
                                        borderColor: 'var(--state-danger)',
                                        backgroundColor: 'var(--state-danger-soft)',
                                        color: 'var(--state-danger)'
                                    }}
                                >
                                    {errorMessage}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="precision-rule flex items-center justify-between gap-3 px-5 py-4">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-secondary">
                            {mode === 'create' ? 'Create from the current schedule context.' : 'Update the selected schedule item.'}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={submitting}
                                className="border border-subtle bg-base px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-primary transition-colors hover:theme-surface disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="inline-flex items-center gap-2 border border-accent-primary bg-accent-primary-soft px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                {mode === 'create' ? 'Save Event' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};
