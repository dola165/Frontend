import { useEffect, useState } from 'react';
import { apiClient } from '../../api/axiosConfig';
import type { NotificationItem } from '../../types/notifications';
import type { ScheduleEventOccurrence } from '../../features/schedule/api';
import { ScheduleResult } from '../../features/matchHistory/ScheduleResult';
import { TryoutNotificationReceipt } from '../../features/tryouts/TryoutNotificationReceipt';

type Target = { kind: 'event' | 'outcome'; id: string; onClose: () => void };

/** Fetch a specific target; an inbox item never grants permission to its resource. */
export const NotificationTarget = ({ kind, id, onClose }: Target) => {
    const [result, setResult] = useState<{ key: string; value?: NotificationItem | ScheduleEventOccurrence; error?: string } | null>(null);
    const [retry, setRetry] = useState(0);
    const key = `${kind}:${id}:${retry}`;
    const valid = /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id));
    useEffect(() => {
        let active = true;
        if (!valid) return;
        const path = kind === 'event' ? `/schedule/events/${id}` : `/notifications/${id}`;
        void apiClient.get<NotificationItem | ScheduleEventOccurrence>(path).then(({ data }) => {
            if (active) setResult({ key, value: data });
        }).catch((error: { response?: { status?: number } }) => {
            if (!active) return;
            const denied = [403, 404, 410].includes(error.response?.status ?? 0);
            setResult({ key, error: denied
                ? 'This item is unavailable or you no longer have access. Your notification records the update you received.'
                : 'We could not load this item. Please try again.' });
        });
        return () => { active = false; };
    }, [id, key, kind, valid]);
    const current = !valid ? { key, error: 'This notification destination is unavailable.' } : result?.key === key ? result : null;
    const event = kind === 'event' ? current?.value as ScheduleEventOccurrence | undefined : undefined;
    const outcome = kind === 'outcome' ? current?.value as NotificationItem | undefined : undefined;
    return <section aria-label="Notification destination" className="max-h-[70dvh] shrink-0 overflow-y-auto border-b theme-border bg-[var(--theme-surface)] p-4">
        <div className="flex items-start justify-between gap-4">
            <h2 className="font-bold">{event?.title ?? outcome?.title ?? 'Notification details'}</h2>
            <button type="button" onClick={onClose} className="app-text-action">Close details</button>
        </div>
        {!current && <p role="status">Loading details…</p>}
        {current?.error && <div role="alert"><p>{current.error}</p><button type="button" className="app-text-action" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
        {event && <>
            <ScheduleResult event={event} clubId={event.clubId} clubName={event.clubName} onSaved={() => setRetry(value => value + 1)} />
            <p className="mt-2">{event.status.replaceAll('_', ' ')} · {event.clubName ?? 'Personal event'}</p>
            <p><time dateTime={event.startsAt}>{new Date(event.startsAt).toLocaleString()}</time> – <time dateTime={event.endsAt}>{new Date(event.endsAt).toLocaleString()}</time></p>
            {event.recurring && <p>This update concerns a recurring event series.</p>}
            {event.locationName && <p>{event.locationName}</p>}
            {event.description && <p className="whitespace-pre-wrap">{event.description}</p>}
        </>}
        {outcome && <><p className="mt-2 whitespace-pre-wrap">{outcome.body}</p>{outcome.entityType === 'tryout_application'
            ? <TryoutNotificationReceipt notification={outcome} />
            : <p className="mt-2 text-sm">This is the update recorded when the notification was sent. A separate detail view is not available here.</p>}</>}
    </section>;
};
