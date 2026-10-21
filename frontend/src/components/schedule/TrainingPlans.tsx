import { useId, useState } from 'react';
import { Clock3, MapPin, Plus, Repeat2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DayOfWeek } from '../../features/schedule/api';
import { useJourneyCopy } from '../../features/squadCommunication/journeyCopy';
import { Button } from '../../design/primitives';
import { formatDate, formatTime } from '../../utils/formatting';
import type { ScheduleWorkspaceEvent } from './workspaceTypes';

const WEEKDAYS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const DAY_FALLBACKS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const usable = (event: ScheduleWorkspaceEvent) => Number.isFinite(Date.parse(event.startsAt)) && Number.isFinite(Date.parse(event.endsAt)) && event.status.toUpperCase() !== 'CANCELLED';

/** One entry per repeating training series in view: the next real occurrence, or the latest one when browsing history. */
function trainingPlans(events: ScheduleWorkspaceEvent[], now: number) {
    const series = new Map<string, ScheduleWorkspaceEvent>();
    for (const event of events) {
        if (!usable(event) || !event.recurring || event.eventType !== 'TRAINING') continue;
        const key = `${event.origin ?? 'CLUB_CALENDAR'}:${event.seriesId ?? event.eventId}`;
        const existing = series.get(key);
        const start = Date.parse(event.startsAt), previous = existing ? Date.parse(existing.startsAt) : NaN;
        if (!existing || (start >= now && (previous < now || start < previous)) || (start < now && previous < now && start > previous)) series.set(key, event);
    }
    return [...series.values()].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

/**
 * The squad's repeating training under the schedule: each plan opens its saved session, and people who plan the
 * squad can add another. Recurrence rules describe plans; only real occurrences are listed.
 */
export function TrainingPlans({ events, squadName, canCreate, onCreate, onSelect }: {
    events: ScheduleWorkspaceEvent[]; squadName: (event: ScheduleWorkspaceEvent) => string | null | undefined;
    canCreate: boolean; onCreate?: () => void; onSelect: (event: ScheduleWorkspaceEvent) => void;
}) {
    const { t } = useTranslation();
    const copy = useJourneyCopy();
    const id = useId();
    const [now] = useState(() => Date.now());
    const plans = trainingPlans(events, now);
    if (!plans.length) return null;
    const weekday = (day: DayOfWeek) => t(`schedule.editor.weekdays.${day}.short`, { defaultValue: DAY_FALLBACKS[WEEKDAYS.indexOf(day)] });
    return <section className="gk-plans" aria-labelledby={id} data-tutorial="calendar-standing-schedule">
        <header className="gk-plans__head">
            <h3 id={id}>{copy('Training plans', 'ვარჯიშების გეგმები')}</h3>
            {canCreate && onCreate && <Button size="sm" variant="ghost" onClick={onCreate}><Plus aria-hidden="true" />{copy('Add training plan', 'ვარჯიშის გეგმის დამატება')}</Button>}
        </header>
        <ul className="gk-plans__list">{plans.map(plan => {
            const rule = plan.recurrence;
            return <li key={`${plan.origin}:${plan.seriesId ?? plan.eventId}`}><button type="button" className="gk-plans__plan" onClick={() => onSelect(plan)}>
                <span className="gk-plans__who">{squadName(plan) || plan.ownerLabel || t('schedule.direction.clubTraining', { defaultValue: 'Club training' })}</span>
                <strong>{plan.title}</strong>
                {rule ? <small><Clock3 aria-hidden="true" />{WEEKDAYS.filter(day => rule.daysOfWeek.includes(day)).map(weekday).join(', ')} · {rule.startTime.slice(0, 5)}–{rule.endTime.slice(0, 5)}
                    {rule.intervalValue > 1 && <><Repeat2 aria-hidden="true" />{t('schedule.direction.everyWeeks', { count: rule.intervalValue, defaultValue: 'Every {{count}} weeks' })}</>}</small>
                    : <small><Clock3 aria-hidden="true" />{formatDate(plan.startsAt, { day: 'numeric', month: 'short' })} · {formatTime(plan.startsAt)}–{formatTime(plan.endsAt)}</small>}
                {plan.locationText && <small><MapPin aria-hidden="true" />{plan.locationText}</small>}
            </button></li>;
        })}</ul>
    </section>;
}
