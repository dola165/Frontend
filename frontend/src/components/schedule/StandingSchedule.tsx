import { useState } from 'react';
import { CalendarDays, ChevronRight, Clock, MapPin, Plus, Repeat2, Users } from 'lucide-react';
import type { DayOfWeek } from '../../features/schedule/api';
import { type ScheduleWorkspaceEvent } from './workspaceTypes';
import './schedule-workspace.css';

interface StandingScheduleProps {
    events: ScheduleWorkspaceEvent[];
    onSelect?: (event: ScheduleWorkspaceEvent) => void;
    onCreateTraining?: () => void;
    squadNamesById?: Readonly<Record<number, string>>;
}

const WEEKDAYS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const dayLabel: Record<DayOfWeek, string> = {
    MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu',
    FRIDAY: 'Fri', SATURDAY: 'Sat', SUNDAY: 'Sun'
};

const formatDays = (days: DayOfWeek[]) => {
    const ordered = WEEKDAYS.filter((day) => days.includes(day));
    if (ordered.length === 7) return 'Every day';
    if (ordered.length === 5 && ordered.every((day, index) => day === WEEKDAYS[index])) return 'Mon – Fri';
    return ordered.map((day) => dayLabel[day]).join(' · ');
};

const formatTime = (value: string) => {
    const match = /^(\d{1,2}):(\d{2})/.exec(value);
    if (!match) return value;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return value;
    const date = new Date(2000, 0, 1, hours, minutes);
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

export const StandingSchedule = ({ events, onSelect, onCreateTraining, squadNamesById }: StandingScheduleProps) => {
    // Occurrences share eventId. Titles and training times are not series identities.
    const series = new Map<number, ScheduleWorkspaceEvent>();
    const [now] = useState(() => Date.now());
    for (const event of events) {
        if (!event.recurring || event.eventType !== 'TRAINING' || event.status.toUpperCase() === 'CANCELLED') continue;
        const existing = series.get(event.eventId);
        const eventTime = new Date(event.startsAt).getTime();
        const existingTime = existing ? new Date(existing.startsAt).getTime() : NaN;
        // Prefer the next session for opening the series. Fall back to its latest past session.
        if (!existing || (eventTime > now && (existingTime <= now || eventTime < existingTime)) ||
            (eventTime <= now && existingTime <= now && eventTime > existingTime)) {
            series.set(event.eventId, event);
        }
    }
    const entries = [...series.values()];

    return (
        <section className="schedule-weekly-training" aria-label="Weekly training">
            <div className="schedule-weekly-training-heading">
                <h2><Repeat2 aria-hidden="true" />Weekly training</h2>
                {onCreateTraining && entries.length > 0 && (
                    <button type="button" className="schedule-workspace-icon-button" onClick={onCreateTraining}
                        aria-label="Create weekly training" title="Create weekly training"><Plus aria-hidden="true" /></button>
                )}
            </div>
            {entries.length === 0 ? (
                <div className="schedule-weekly-training-empty">
                    <span className="schedule-weekly-training-empty-icon" aria-hidden="true"><CalendarDays /></span>
                    <h3>A rhythm for your week</h3>
                    <p>Set your training days and times once. Sessions repeat on the calendar each week.</p>
                    {onCreateTraining && <button type="button" className="schedule-workspace-button" onClick={onCreateTraining}>
                        <Plus aria-hidden="true" />Add weekly training
                    </button>}
                    <span>No weekly training in this view.</span>
                </div>
            ) : (
                <>
                    <p className="schedule-weekly-training-intro">Repeating sessions in this view</p>
                    <div className="schedule-weekly-training-list">
                        {entries.map((event) => {
                            const recurrence = event.recurrence;
                            const days = recurrence ? formatDays(recurrence.daysOfWeek) : '';
                            const squadName = event.hostSquadId != null ? squadNamesById?.[event.hostSquadId] : undefined;
                            const content = <>
                                <span className="schedule-weekly-training-card-heading">
                                    <strong>{event.title}</strong>
                                    {onSelect && <ChevronRight aria-hidden="true" />}
                                </span>
                                {days && <span className="schedule-weekly-training-days">{days}</span>}
                                {recurrence ? <span className="schedule-weekly-training-detail" title={recurrence.timezone ?? undefined}>
                                    <Clock aria-hidden="true" />
                                    <span>{formatTime(recurrence.startTime)} – {formatTime(recurrence.endTime)}</span>
                                </span> : event.recurrenceLabel && <span className="schedule-weekly-training-detail">{event.recurrenceLabel}</span>}
                                {recurrence && recurrence.intervalValue > 1 && <span className="schedule-weekly-training-detail">
                                    <Repeat2 aria-hidden="true" />Every {recurrence.intervalValue} weeks
                                </span>}
                                {event.locationText && <span className="schedule-weekly-training-detail">
                                    <MapPin aria-hidden="true" /><span>{event.locationText}</span>
                                </span>}
                                {squadName && <span className="schedule-weekly-training-detail"><Users aria-hidden="true" /><span>{squadName}</span></span>}
                            </>;
                            return onSelect ? (
                                <button key={event.eventId} type="button" className="schedule-weekly-training-card"
                                    onClick={() => onSelect(event)}>{content}</button>
                            ) : <article key={event.eventId} className="schedule-weekly-training-card">{content}</article>;
                        })}
                    </div>
                </>
            )}
        </section>
    );
};
