import { Clock, Repeat2 } from 'lucide-react';
import { eventTypeCopy, type ScheduleWorkspaceEvent } from './workspaceTypes';

interface StandingScheduleProps {
    events: ScheduleWorkspaceEvent[];
}

const dayLabel: Record<string, string> = {
    MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu',
    FRIDAY: 'Fri', SATURDAY: 'Sat', SUNDAY: 'Sun'
};

const normalizeTime = (t: string) => (t.length >= 5 ? t.slice(0, 5) : t);

const formatTime12h = (t: string) => {
    const [h, m] = normalizeTime(t).split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hour}:${String(m).padStart(2, '0')} ${period}`;
};

const formatDaysAndTime = (event: ScheduleWorkspaceEvent): string | null => {
    if (!event.recurrence) return null;
    const days = event.recurrence.daysOfWeek;
    if (!days.length) return null;
    const ordered = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
        .filter((d) => days.includes(d as never));
    const daysStr = ordered.length === 5 && ordered.every((d) => ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].includes(d))
        ? 'Mon–Fri'
        : ordered.map((d) => dayLabel[d] || d.slice(0, 3)).join(' • ');
    const start = formatTime12h(event.recurrence.startTime);
    const end = formatTime12h(event.recurrence.endTime);
    return `${daysStr}  ·  ${start} – ${end}`;
};

export const StandingSchedule = ({ events }: StandingScheduleProps) => {
    const recurring = events.filter((e) => e.recurring);
    const grouped = recurring.reduce<Record<string, ScheduleWorkspaceEvent[]>>((acc, event) => {
        const key = `${event.title}|${event.recurrence?.startTime ?? ''}|${event.recurrence?.endTime ?? ''}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(event);
        return acc;
    }, {});

    const entries = Object.values(grouped).map((group) => {
        const first = group[0];
        const allDays = [...new Set(group.flatMap((e) => e.recurrence?.daysOfWeek ?? []))];
        const merged = { ...first, recurrence: first.recurrence ? { ...first.recurrence, daysOfWeek: allDays } : first.recurrence };
        return { event: merged, count: group.length };
    });

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Repeat2 className="h-3.5 w-3.5 text-[var(--fc-text-muted)]" />
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--fc-text-muted)]">Standing Schedule</p>
            </div>

            {entries.length === 0 ? (
                <p className="text-xs leading-5 text-[var(--fc-text-muted)]">
                    No recurring routines yet. Create a Training event with "Repeat every week" to build your standing schedule.
                </p>
            ) : (
                <div className="space-y-2">
                    {entries.map(({ event }) => {
                        const detail = formatDaysAndTime(event);
                        const meta = eventTypeCopy[event.eventType];
                        return (
                            <div
                                key={event.id}
                                className="rounded-[var(--fc-radius)] border border-[var(--fc-border)] bg-[var(--fc-sidebar-bg)] p-3"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: meta.accent }} />
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-[var(--fc-text-primary)] truncate">{event.title}</p>
                                        {detail && (
                                            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--fc-text-muted)]">
                                                <Clock className="h-3 w-3 shrink-0" />
                                                <span>{detail}</span>
                                            </div>
                                        )}
                                        {event.locationText && (
                                            <p className="mt-0.5 text-[11px] text-[var(--fc-text-muted)] truncate">{event.locationText}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
