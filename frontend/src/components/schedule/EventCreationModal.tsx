import { useEffect, useMemo, useState } from 'react';
import {
    CalendarDays,
    Check,
    ChevronLeft,
    ChevronRight,
    Clock,
    Dumbbell,
    Globe,
    Handshake,
    Loader2,
    Lock,
    Repeat2,
    Swords,
    Target,
    X,
    Zap
} from 'lucide-react';
import { MiniMap } from '../MiniMap';
import type { DayOfWeek, ScheduleEventType, ScheduleEventUpsertInput, ScheduleVisibility } from '../../features/schedule/api';
import { extractApiErrorMessage } from '../../utils/apiError';

export type ModalSurface = 'MY_SCHEDULE' | 'CLUB_SCHEDULE';
export type ModalMode = 'create' | 'edit';

export interface EventCreationFormValues {
    eventType: ScheduleEventType | null;
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    isRecurring: boolean;
    locationName: string;
    locationLat: string;
    locationLng: string;
    visibility: ScheduleVisibility;
    publishAt: string;
    description?: string;
    recurrenceDays?: DayOfWeek[];
    recurrenceStartDate?: string;
    recurrenceEndDate?: string;
    recurrenceStartTime?: string;
    recurrenceEndTime?: string;
}

interface EventCreationModalProps {
    isOpen: boolean;
    mode: ModalMode;
    surface: ModalSurface;
    initialValues: EventCreationFormValues;
    clubId: number | null;
    targetEventId?: number;
    subjectLabel: string;
    onClose: () => void;
    onSubmit: (payload: ScheduleEventUpsertInput, meta: { eventType: ScheduleEventType; recurring: boolean }) => Promise<void>;
}

const dayOfWeekValues: DayOfWeek[] = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const DAY_OPTIONS: Array<{ value: DayOfWeek; label: string }> = [
    { value: 'MONDAY', label: 'Mon' }, { value: 'TUESDAY', label: 'Tue' },
    { value: 'WEDNESDAY', label: 'Wed' }, { value: 'THURSDAY', label: 'Thu' },
    { value: 'FRIDAY', label: 'Fri' }, { value: 'SATURDAY', label: 'Sat' },
    { value: 'SUNDAY', label: 'Sun' }
];

const eventTypeOptions: Array<{ value: ScheduleEventType; label: string; description: string; icon: typeof CalendarDays }> = [
    { value: 'TRAINING', label: 'Training', description: 'Recurring or one-time training sessions.', icon: Dumbbell },
    { value: 'MATCH', label: 'Match', description: 'Competitive fixtures against other clubs.', icon: Swords },
    { value: 'TRYOUT', label: 'Tryout', description: 'Trials, talent windows, and recruitment.', icon: Target },
    { value: 'FRIENDLY', label: 'Friendly', description: 'Casual fixtures and open challenges.', icon: Handshake },
    { value: 'ACTIVITY', label: 'Activity', description: 'Meetings, operations, and general events.', icon: Zap }
];

const visibilityOptions: Array<{ value: ScheduleVisibility; label: string; description: string; icon: typeof Globe }> = [
    { value: 'PUBLIC', label: 'Public', description: 'Visible to everyone — appears on the map.', icon: Globe },
    { value: 'PRIVATE', label: 'Private', description: 'Club members only — hidden from the map.', icon: Lock },
    { value: 'SCHEDULED_PUBLICATION', label: 'Auto-publish', description: 'Private now, goes public automatically on a date you pick.', icon: Clock }
];

const p2 = (v: number) => String(v).padStart(2, '0');
const bdt = (date: string, time: string) => `${date}T${time.length === 5 ? time : time.slice(0, 5)}:00`;
const normDt = (v: string) => (v && v.length === 16 ? `${v}:00` : v);
const normT = (t: string) => (t.length === 5 ? t : t.slice(0, 5));
const gDow = (ds: string): DayOfWeek => {
    const d = new Date(`${ds}T12:00:00`);
    return Number.isNaN(d.getTime()) ? 'MONDAY' : dayOfWeekValues[d.getDay()];
};

export const EventCreationModal = ({
    isOpen, mode, surface, initialValues, clubId, targetEventId, subjectLabel, onClose, onSubmit
}: EventCreationModalProps) => {
    const [step, setStep] = useState(0);
    const [form, setForm] = useState<EventCreationFormValues>(initialValues);
    const [creationMode, setCreationMode] = useState<'single' | 'recurring'>('single');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setForm(initialValues);
        setCreationMode(initialValues.isRecurring ? 'recurring' : 'single');
        setStep(0);
        setErrorMessage(null);
        setSubmitting(false);
    }, [initialValues, isOpen]);

    const isClub = surface === 'CLUB_SCHEDULE';
    const isStanding = creationMode === 'recurring';
    const isTraining = form.eventType === 'TRAINING';

    const update = <K extends keyof EventCreationFormValues>(field: K, value: EventCreationFormValues[K]) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        if (errorMessage) setErrorMessage(null);
    };

    const toggleRecDay = (day: DayOfWeek) => {
        const cur = form.recurrenceDays ?? [];
        update('recurrenceDays', cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day]);
    };

    const canGoNext = useMemo(() => {
        if (step === 0) {
            const hasType = isStanding ? true : form.eventType !== null;
            return hasType && form.title.trim().length > 0;
        }
        if (step === 1) {
            if (isStanding) {
                const days = form.recurrenceDays ?? [];
                return Boolean(form.recurrenceStartDate && form.recurrenceStartTime && form.recurrenceEndTime && days.length > 0);
            }
            if (form.isRecurring && isTraining) {
                return Boolean(form.recurrenceStartDate && form.recurrenceStartTime && form.recurrenceEndTime);
            }
            if (!form.date || !form.startTime || !form.endTime) return false;
            try { return bdt(form.date, form.endTime) > bdt(form.date, form.startTime); } catch { return false; }
        }
        return true;
    }, [step, form, isStanding, isTraining]);

    const validate = (): string | null => {
        if (!form.title.trim()) return 'Title is required.';
        const recurring = form.isRecurring || isStanding;
        if (recurring && (isTraining || isStanding)) {
            if (!form.recurrenceStartDate || !form.recurrenceStartTime || !form.recurrenceEndTime) return 'Recurring training needs start date and start/end time.';
            if (form.recurrenceEndDate && form.recurrenceStartDate && form.recurrenceEndDate < form.recurrenceStartDate) return 'Recurrence end date cannot be before start.';
            if (form.recurrenceStartDate && form.recurrenceStartTime && form.recurrenceEndTime) {
                if (bdt(form.recurrenceStartDate, form.recurrenceEndTime) <= bdt(form.recurrenceStartDate, form.recurrenceStartTime)) return 'End time must be after start time.';
            }
            const days = form.recurrenceDays ?? [];
            if (days.length === 0) return 'Select at least one day of the week.';
        } else {
            if (!form.date || !form.startTime || !form.endTime) return 'Date and times are required.';
            if (bdt(form.date, form.endTime) <= bdt(form.date, form.startTime)) return 'End time must be after start time.';
        }
        if (isClub && form.visibility === 'SCHEDULED_PUBLICATION' && !form.publishAt) return 'Choose a publication date.';
        return null;
    };

    const handleSave = async () => {
        const msg = validate();
        if (msg) { setErrorMessage(msg); return; }
        const eType = isStanding ? 'TRAINING' : form.eventType!;
        const recur = form.isRecurring || isStanding;
        const payload: ScheduleEventUpsertInput = {
            title: form.title.trim(),
            description: form.description?.trim() || null,
            eventType: eType,
            startsAt: recur ? bdt(form.recurrenceStartDate!, form.recurrenceStartTime!) : bdt(form.date, form.startTime),
            endsAt: recur ? bdt(form.recurrenceStartDate!, form.recurrenceEndTime!) : bdt(form.date, form.endTime),
            visibility: isClub ? form.visibility : 'PRIVATE',
            publishAt: isClub && form.visibility === 'SCHEDULED_PUBLICATION' ? normDt(form.publishAt) : null,
            locationName: form.locationName.trim() || null,
            locationLat: form.locationLat.trim() ? Number(form.locationLat) : null,
            locationLng: form.locationLng.trim() ? Number(form.locationLng) : null,
            recurrence: recur ? {
                frequency: 'WEEKLY', intervalValue: 1,
                daysOfWeek: (form.recurrenceDays && form.recurrenceDays.length > 0) ? form.recurrenceDays : [gDow(form.recurrenceStartDate!)],
                startDate: form.recurrenceStartDate!,
                endDate: form.recurrenceEndDate || null,
                startTime: `${normT(form.recurrenceStartTime!)}:00`,
                endTime: `${normT(form.recurrenceEndTime!)}:00`,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            } : null
        };
        setSubmitting(true); setErrorMessage(null);
        try { await onSubmit(payload, { eventType: eType, recurring: recur }); }
        catch (error) { setErrorMessage(extractApiErrorMessage(error, 'Could not save the event.')); setSubmitting(false); }
    };

    const handleBackdropClick = () => {
        if ((form.title.trim() || form.eventType) && !window.confirm('Discard this event?')) return;
        onClose();
    };

    if (!isOpen) return null;

    const inputClass = 'w-full rounded-[var(--fc-radius)] border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-3 py-2.5 text-sm text-[var(--fc-text-primary)] outline-none transition-colors focus:border-[var(--fc-accent)] placeholder:text-[var(--fc-text-muted)]';
    const selLat = form.locationLat.trim() ? Number(form.locationLat) : null;
    const selLng = form.locationLng.trim() ? Number(form.locationLng) : null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={handleBackdropClick}>
            <div
                className="flex max-h-[90vh] w-full max-w-[600px] flex-col overflow-hidden rounded-[var(--fc-radius)] border border-[var(--fc-border)] bg-[var(--fc-card-bg)] shadow-2xl"
                style={{ animation: 'schedule-scale-in 200ms ease-out' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-4 border-b border-[var(--fc-border)] px-5 py-4">
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--fc-text-muted)]">
                            {mode === 'create' ? 'New Event' : 'Edit Event'} — Step {step + 1} of 3
                        </p>
                        <h2 className="mt-1 text-lg font-semibold text-[var(--fc-text-primary)]">
                            {step === 0 ? 'What kind of event?' : step === 1 ? 'When is it?' : 'Who can see this?'}
                        </h2>
                    </div>
                    <button type="button" onClick={onClose} disabled={submitting}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--fc-radius)] text-[var(--fc-text-muted)] transition-colors hover:bg-[var(--fc-surface-hover)] hover:text-[var(--fc-text-primary)]">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Step dots */}
                <div className="flex items-center justify-center gap-2 border-b border-[var(--fc-border)] px-5 py-2.5">
                    {[0, 1, 2].map((s) => (
                        <div key={s} className={`h-2 w-2 rounded-full transition-colors ${s === step ? 'bg-[var(--fc-accent)]' : s < step ? 'bg-[var(--fc-text-muted)]' : 'bg-[var(--fc-border)]'}`} />
                    ))}
                </div>

                {/* Step content */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {step === 0 && (
                        <div className="space-y-4">
                            {/* Creation mode toggle */}
                            <div className="flex rounded-[var(--fc-radius)] border border-[var(--fc-border)] bg-[var(--fc-sidebar-bg)] p-1">
                                <button type="button"
                                    onClick={() => {
                                        setCreationMode('single');
                                        if (form.eventType === 'TRAINING') update('isRecurring', false);
                                    }}
                                    className={`flex-1 rounded-[4px] px-3 py-2 text-xs font-semibold text-center transition-all ${creationMode === 'single' ? 'bg-[var(--fc-accent)] text-white' : 'text-[var(--fc-text-secondary)] hover:text-[var(--fc-text-primary)]'}`}>
                                    One-time Event
                                </button>
                                <button type="button"
                                    onClick={() => {
                                        setCreationMode('recurring');
                                        update('eventType', 'TRAINING');
                                        update('isRecurring', true);
                                        update('recurrenceStartDate', form.date);
                                        update('recurrenceStartTime', form.startTime);
                                        update('recurrenceEndTime', form.endTime);
                                    }}
                                    className={`flex-1 rounded-[4px] px-3 py-2 text-xs font-semibold text-center transition-all flex items-center justify-center gap-1.5 ${creationMode === 'recurring' ? 'bg-[var(--fc-accent)] text-white' : 'text-[var(--fc-text-secondary)] hover:text-[var(--fc-text-primary)]'}`}>
                                    <Repeat2 className="h-3.5 w-3.5" />
                                    Standing Schedule
                                </button>
                            </div>

                            {/* Event type grid */}
                            <div className="grid grid-cols-2 gap-3">
                                {eventTypeOptions.map((opt) => {
                                    const Icon = opt.icon;
                                    const active = form.eventType === opt.value;
                                    const locked = isStanding && opt.value !== 'TRAINING';
                                    return (
                                        <button key={opt.value} type="button"
                                            onClick={() => { if (!locked) update('eventType', opt.value); }}
                                            disabled={locked}
                                            className={`flex flex-col items-start gap-2 rounded-[var(--fc-radius)] border p-4 text-left transition-all ${locked ? 'opacity-30 cursor-not-allowed' : active ? 'border-[var(--fc-accent)] bg-[var(--fc-accent-soft)]' : 'border-[var(--fc-border)] hover:border-[var(--fc-accent-border)] hover:bg-[var(--fc-surface-hover)]'}`}>
                                            <Icon className={`h-5 w-5 ${active ? 'text-[var(--fc-accent)]' : 'text-[var(--fc-text-muted)]'}`} />
                                            <div>
                                                <p className="text-sm font-semibold text-[var(--fc-text-primary)]">{opt.label}</p>
                                                <p className="mt-0.5 text-xs leading-5 text-[var(--fc-text-secondary)]">{locked ? 'Standing schedules use Training events' : opt.description}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-[var(--fc-text-secondary)]">Event Name</label>
                                <input type="text" value={form.title} onChange={(e) => update('title', e.target.value)}
                                    maxLength={140} placeholder={isStanding ? 'e.g. Senior Training' : 'e.g. Senior Training'} className={inputClass} autoFocus
                                    onKeyDown={(e) => { if (e.key === 'Enter' && canGoNext) setStep(1); }} />
                            </div>
                            {errorMessage && <ErrorBanner message={errorMessage} />}
                        </div>
                    )}

                    {step === 1 && (
                        <div className="space-y-4">
                            {isStanding ? (
                                /* Standing Schedule fields */
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-[var(--fc-text-secondary)]">Start Date</label>
                                            <input type="date" value={form.recurrenceStartDate ?? form.date}
                                                onChange={(e) => update('recurrenceStartDate', e.target.value)} className={inputClass} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-[var(--fc-text-secondary)]">End Date (optional)</label>
                                            <input type="date" value={form.recurrenceEndDate ?? ''}
                                                onChange={(e) => update('recurrenceEndDate', e.target.value)} className={inputClass} />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-[var(--fc-text-secondary)]">Days of Week</label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {DAY_OPTIONS.map((opt) => {
                                                const days = form.recurrenceDays ?? [];
                                                const on = days.includes(opt.value);
                                                return (
                                                    <button key={opt.value} type="button" onClick={() => toggleRecDay(opt.value)}
                                                        className={`rounded-[var(--fc-radius)] border px-3 py-1.5 text-xs font-semibold transition-all ${on ? 'border-[var(--fc-accent)] bg-[var(--fc-accent-soft)] text-[var(--fc-accent)]' : 'border-[var(--fc-border)] text-[var(--fc-text-muted)] hover:border-[var(--fc-accent-border)]'}`}>
                                                        {opt.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-[var(--fc-text-secondary)]">Start Time</label>
                                            <input type="time" value={form.recurrenceStartTime ?? form.startTime}
                                                onChange={(e) => update('recurrenceStartTime', e.target.value)} className={inputClass} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-[var(--fc-text-secondary)]">End Time</label>
                                            <input type="time" value={form.recurrenceEndTime ?? form.endTime}
                                                onChange={(e) => update('recurrenceEndTime', e.target.value)} className={inputClass} />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* Single event fields */
                                <div className="space-y-4">
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-[var(--fc-text-secondary)]">Date</label>
                                            <input type="date" value={form.date} onChange={(e) => update('date', e.target.value)} className={inputClass} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-[var(--fc-text-secondary)]">Start Time</label>
                                            <input type="time" value={form.startTime} onChange={(e) => update('startTime', e.target.value)} className={inputClass} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-[var(--fc-text-secondary)]">End Time</label>
                                            <input type="time" value={form.endTime} onChange={(e) => update('endTime', e.target.value)} className={inputClass} />
                                        </div>
                                    </div>
                                    {isTraining && !isStanding && (
                                        <button type="button"
                                            onClick={() => {
                                                const next = !form.isRecurring;
                                                update('isRecurring', next);
                                                if (next) { update('recurrenceStartDate', form.date); update('recurrenceStartTime', form.startTime); update('recurrenceEndTime', form.endTime); }
                                            }}
                                            className="flex w-full items-start justify-between gap-3 rounded-[var(--fc-radius)] border border-[var(--fc-border)] bg-[var(--fc-sidebar-bg)] p-3.5 text-left transition-colors hover:bg-[var(--fc-surface-hover)]">
                                            <div>
                                                <p className="text-sm font-semibold text-[var(--fc-text-primary)]">Repeat every week</p>
                                                <p className="mt-1 text-xs text-[var(--fc-text-secondary)]">Set once — shows automatically each week</p>
                                            </div>
                                            <span className={`mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors ${form.isRecurring ? 'border-[var(--fc-accent)] bg-[var(--fc-accent-soft)] justify-end' : 'border-[var(--fc-border)] bg-[var(--fc-sidebar-bg)] justify-start'}`}>
                                                <span className="mx-1 h-2.5 w-2.5 rounded-full bg-[var(--fc-accent)]" />
                                            </span>
                                        </button>
                                    )}
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-[var(--fc-text-secondary)]">Location</label>
                                <input type="text" value={form.locationName} onChange={(e) => update('locationName', e.target.value)}
                                    maxLength={255} placeholder="e.g. Dinamo Academy Pitch" className={inputClass} />
                            </div>

                            {/* Minimap */}
                            <MiniMap
                                mode="picker"
                                title="Venue Picker"
                                selectedLocation={{ lat: selLat, lng: selLng }}
                                onSelectLocation={({ lat, lng }) => { update('locationLat', String(lat)); update('locationLng', String(lng)); }}
                            />

                            {errorMessage && <ErrorBanner message={errorMessage} />}
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            {isClub ? (
                                <div className="space-y-3">
                                    {visibilityOptions.map((opt) => {
                                        const Icon = opt.icon;
                                        const active = form.visibility === opt.value;
                                        return (
                                            <button key={opt.value} type="button" onClick={() => update('visibility', opt.value)}
                                                className={`flex w-full items-start gap-4 rounded-[var(--fc-radius)] border p-4 text-left transition-all ${active ? 'border-[var(--fc-accent)] bg-[var(--fc-accent-soft)]' : 'border-[var(--fc-border)] hover:border-[var(--fc-accent-border)] hover:bg-[var(--fc-surface-hover)]'}`}>
                                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${active ? 'bg-[var(--fc-accent)] text-white' : 'bg-[var(--fc-sidebar-bg)] text-[var(--fc-text-muted)]'}`}>
                                                    {active ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-[var(--fc-text-primary)]">{opt.label}</p>
                                                    <p className="mt-0.5 text-xs text-[var(--fc-text-secondary)]">{opt.description}</p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                    {form.visibility === 'SCHEDULED_PUBLICATION' && (
                                        <div className="space-y-1.5 pt-2">
                                            <label className="text-xs font-medium text-[var(--fc-text-secondary)]">Publish on</label>
                                            <input type="datetime-local" value={form.publishAt} onChange={(e) => update('publishAt', e.target.value)} className={inputClass} />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="rounded-[var(--fc-radius)] border border-[var(--fc-border)] bg-[var(--fc-sidebar-bg)] p-5 text-center">
                                    <Lock className="mx-auto h-8 w-8 text-[var(--fc-text-muted)]" />
                                    <p className="mt-3 text-sm font-semibold text-[var(--fc-text-primary)]">Personal events are always private</p>
                                    <p className="mt-1 text-xs text-[var(--fc-text-secondary)]">My Schedule stays personal only — it never appears on the map or in public listings.</p>
                                </div>
                            )}
                            {errorMessage && <ErrorBanner message={errorMessage} />}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-3 border-t border-[var(--fc-border)] px-5 py-3">
                    {step > 0 ? (
                        <button type="button" onClick={() => { setStep((s) => s - 1); setErrorMessage(null); }}
                            className="inline-flex items-center gap-1.5 rounded-[var(--fc-radius)] px-3 py-2 text-sm font-medium text-[var(--fc-text-secondary)] transition-colors hover:bg-[var(--fc-surface-hover)] hover:text-[var(--fc-text-primary)]">
                            <ChevronLeft className="h-4 w-4" /> Back
                        </button>
                    ) : <div />}
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={onClose} disabled={submitting}
                            className="rounded-[var(--fc-radius)] px-3 py-2 text-sm font-medium text-[var(--fc-text-secondary)] transition-colors hover:bg-[var(--fc-surface-hover)] hover:text-[var(--fc-text-primary)]">
                            Cancel
                        </button>
                        {step < 2 ? (
                            <button type="button" onClick={() => { setStep((s) => s + 1); setErrorMessage(null); }}
                                disabled={!canGoNext}
                                className="inline-flex items-center gap-1.5 rounded-[var(--fc-radius)] bg-[var(--fc-accent)] px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed">
                                Continue <ChevronRight className="h-4 w-4" />
                            </button>
                        ) : (
                            <button type="button" onClick={handleSave} disabled={submitting}
                                className="inline-flex items-center gap-2 rounded-[var(--fc-radius)] bg-[var(--fc-accent)] px-5 py-2 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed">
                                {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Save Event
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const ErrorBanner = ({ message }: { message: string }) => (
    <div className="rounded-[var(--fc-radius)] border px-4 py-3 text-sm"
        style={{ borderColor: 'var(--fc-state-danger)', backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--fc-state-danger)' }}>
        {message}
    </div>
);
