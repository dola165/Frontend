import { useEffect, useState } from 'react';
import { CalendarDays, Loader2, MapPin } from 'lucide-react';
import { apiClient } from '../../../api/axiosConfig';
import type { ScheduleItem } from '../../../types/schedule';

const formatDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const TabEvents = ({ clubId }: { clubId: number }) => {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<ScheduleItem[]>([]);

    useEffect(() => {
        setLoading(true);
        apiClient.get(`/clubs/${clubId}/calendar`)
            .then((response) => {
                const values = Array.isArray(response.data) ? response.data : [];
                const upcoming = values
                    .filter((item) => item?.startsAt)
                    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
                    .slice(0, 6);
                setItems(upcoming);
            })
            .catch((error) => {
                console.error('Failed to load events', error);
                setItems([]);
            })
            .finally(() => setLoading(false));
    }, [clubId]);

    if (loading) {
        return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-[color:var(--club-tone-green)]" /></div>;
    }

    return (
        <section className="rounded-[24px] border border-[color:var(--club-theme-border-subtle)] bg-[rgba(12,18,27,0.96)] p-5 shadow-[0_18px_32px_rgba(2,6,12,0.22)]">
            <div className="mb-5">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--club-tone-blue)]">Events</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[color:var(--club-theme-text-primary)]">Upcoming club events</h2>
            </div>

            {items.length === 0 ? (
                <div className="rounded-[18px] border border-white/6 bg-white/[0.03] px-5 py-12 text-center">
                    <CalendarDays className="mx-auto h-10 w-10 text-[color:var(--club-theme-text-secondary)]" />
                    <p className="mt-4 text-sm text-[color:var(--club-theme-text-secondary)]">No public events are scheduled right now.</p>
                </div>
            ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                    {items.map((item) => (
                        <article key={item.id} className="rounded-[18px] border border-white/6 bg-white/[0.03] p-4">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--club-accent-orange)]">
                                <CalendarDays className="h-3.5 w-3.5" />
                                {formatDate(item.startsAt)}
                            </div>
                            <h3 className="mt-3 text-lg font-black tracking-[-0.03em] text-[color:var(--club-theme-text-primary)]">{item.title}</h3>
                            {item.subtitle ? <p className="mt-1 text-sm text-[color:var(--club-theme-text-secondary)]">{item.subtitle}</p> : null}
                            {item.locationText ? (
                                <p className="mt-3 inline-flex items-center gap-2 text-sm text-[color:var(--club-theme-text-secondary)]">
                                    <MapPin className="h-4 w-4 text-[color:var(--club-tone-green)]" />
                                    {item.locationText}
                                </p>
                            ) : null}
                            {item.details ? <p className="mt-3 text-sm leading-6 text-[color:var(--club-theme-text-secondary)]">{item.details}</p> : null}
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
};
