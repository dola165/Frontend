import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, Loader2, MapPin } from 'lucide-react';
import { apiClient } from '../../../api/axiosConfig';
import type { ScheduleItem, ScheduleItemKind } from '../../../types/schedule';
import { scheduleKindLabel, scheduleStatusLabel, scheduleVisibilityLabel } from '../../../types/schedule';

interface TabCalendarProps {
    clubId: number;
    isOwnClubAdmin: boolean;
}

const formatDayLabel = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Scheduled';
    return parsed.toLocaleString(undefined, { month: 'long', year: 'numeric' });
};

const formatRowTime = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const kindTone = (kind: ScheduleItemKind) => {
    if (kind === 'TRYOUT') return 'accent-primary';
    if (kind === 'MATCH') return 'text-sky-600 dark:text-sky-300';
    return 'text-secondary';
};

export const TabCalendar = ({ clubId, isOwnClubAdmin }: TabCalendarProps) => {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<ScheduleItem[]>([]);

    const groupedItems = useMemo(
        () =>
            items.reduce<Record<string, ScheduleItem[]>>((acc, item) => {
                const label = formatDayLabel(item.startsAt);
                if (!acc[label]) acc[label] = [];
                acc[label].push(item);
                return acc;
            }, {}),
        [items]
    );

    useEffect(() => {
        setLoading(true);
        apiClient.get(`/clubs/${clubId}/calendar`)
            .then((response) => setItems(response.data || []))
            .catch((error) => {
                console.error('Failed to load club calendar', error);
                setItems([]);
            })
            .finally(() => setLoading(false));
    }, [clubId]);

    if (loading) {
        return (
            <div className="flex justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin accent-primary" />
            </div>
        );
    }

    return (
        <section className="bg-surface border border-subtle">
            <div className="border-b border-subtle px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] accent-primary">Entity Tab</p>
                        <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-primary">Schedule</h2>
                        <p className="mt-2 text-sm leading-6 text-secondary">Public fixtures, tryouts, and internal planning entries stay grouped under the club context.</p>
                    </div>
                    {isOwnClubAdmin && (
                        <Link to="/calendar" className="inline-flex items-center gap-2 border border-subtle bg-base px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-primary">
                            Open Schedule
                            <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                    )}
                </div>
            </div>

            {items.length === 0 ? (
                <div className="px-5 py-12 text-center">
                    <CalendarDays className="mx-auto h-10 w-10 text-secondary" />
                    <h3 className="mt-4 text-lg font-black uppercase tracking-[0.14em] text-primary">No Schedule Entries Yet</h3>
                    <p className="mt-2 text-sm text-secondary">
                        {isOwnClubAdmin ? 'Once the club schedules fixtures, tryouts, or availability windows, they will appear here.' : 'No public schedule items are published yet.'}
                    </p>
                </div>
            ) : (
                Object.entries(groupedItems).map(([groupLabel, groupItems]) => (
                    <section key={groupLabel} className="border-t border-subtle">
                        <div className="border-b border-subtle bg-base px-4 py-3">
                            <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-secondary">{groupLabel}</h3>
                        </div>
                        <div className="divide-y divide-[color:var(--border-subtle)]">
                            {groupItems.map((item) => (
                                <article key={item.id} className="grid gap-4 px-4 py-4 lg:grid-cols-[140px_minmax(0,1fr)_auto] lg:items-start">
                                    <div className="text-[11px] font-black uppercase tracking-[0.16em] accent-primary">{formatRowTime(item.startsAt)}</div>
                                    <div>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <p className="text-sm font-black uppercase tracking-[0.12em] text-primary">{item.title}</p>
                                            <span className={`text-[11px] font-black uppercase tracking-[0.16em] ${kindTone(item.kind)}`}>{scheduleKindLabel[item.kind]}</span>
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] font-black uppercase tracking-[0.16em] text-secondary">
                                            {item.subtitle && <span>{item.subtitle}</span>}
                                            {item.locationText && (
                                                <span className="inline-flex items-center gap-1.5">
                                                    <MapPin className="h-3.5 w-3.5 accent-primary" />
                                                    {item.locationText}
                                                </span>
                                            )}
                                        </div>
                                        {item.details && <p className="mt-3 text-sm leading-6 text-secondary">{item.details}</p>}
                                    </div>
                                    <div className="flex flex-wrap gap-2 lg:justify-end">
                                        <span className="border border-subtle bg-base px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-primary">{scheduleVisibilityLabel[item.visibility]}</span>
                                        <span className="border border-subtle bg-base px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-secondary">{scheduleStatusLabel[item.status]}</span>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>
                ))
            )}
        </section>
    );
};
