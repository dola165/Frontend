import { Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { NotificationListItem } from '../../notifications/NotificationListItem';
import type { NotificationItem } from '../../../types/notifications';
import { EmptyState, PageSpinner, SectionHeader } from '../helpers';

interface InboxTabProps {
    notifications: NotificationItem[];
    loading: boolean;
    loadingMore: boolean;
    busyId: number | null;
    hasMore: boolean;
    unreadCount: number;
    error?: string | null;
    onOpen: (notification: NotificationItem) => void;
    onLoadMore: () => void;
    onMarkAllRead: () => void;
    onRetry: () => void;
}

export const InboxTab = ({
    notifications, loading, loadingMore, busyId, hasMore,
    unreadCount, error, onOpen, onLoadMore, onMarkAllRead, onRetry
}: InboxTabProps) => {
    const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'PRIORITY'>('ALL');
    const [area, setArea] = useState('ALL');
    const areas = useMemo(() => Array.from(new Set(notifications.map((item) => item.entityType).filter(Boolean) as string[])).sort(), [notifications]);
    const visibleNotifications = useMemo(() => notifications.filter((item) => {
        const filterMatches = filter === 'ALL' || (filter === 'UNREAD' && !item.isRead) || (filter === 'PRIORITY' && /urgent|action|required|failed|warning/i.test(`${item.title} ${item.body}`));
        return filterMatches && (area === 'ALL' || item.entityType === area);
    }), [area, filter, notifications]);

    if (error && notifications.length === 0) {
        return (
            <div className="space-y-4">
                <SectionHeader eyebrow="Club Inbox" title="Notifications" description="Club management notifications and alerts." />
                <div className="rounded-xl border border-[var(--fc-state-danger-soft)] bg-[var(--fc-state-danger-soft)] p-5">
                    <p className="text-sm font-semibold text-[var(--fc-text-primary)]">{error}</p>
                    <button type="button" onClick={onRetry} className="mt-3 rounded-lg bg-[var(--fc-accent)] px-3 py-1.5 text-xs font-semibold text-white">Retry</button>
                </div>
            </div>
        );
    }
    if (loading && notifications.length === 0) {
        return (
            <div className="space-y-4">
                <SectionHeader eyebrow="Club Inbox" title="Notifications" description="Club management notifications and alerts." />
                <PageSpinner />
            </div>
        );
    }

    if (!loading && notifications.length === 0) {
        return (
            <div className="space-y-4">
                <SectionHeader eyebrow="Club Inbox" title="Notifications" description="Club management notifications and alerts." />
                <EmptyState message="No club notifications." />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <SectionHeader
                eyebrow="Club Inbox"
                title="Notifications"
                description={`${unreadCount > 0 ? `${unreadCount} unread · ` : ''}Club management notifications and alerts.`}
                action={
                    unreadCount > 0 ? (
                        <button
                            type="button"
                            onClick={onMarkAllRead}
                            className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-3 py-1.5 text-xs font-medium text-[var(--fc-text-secondary)] hover:text-[var(--fc-text-primary)] transition-colors"
                        >
                            Mark All Read
                        </button>
                    ) : undefined
                }
            />

            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-3">
                <select aria-label="Inbox filter" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="rounded-lg border border-[var(--fc-border)] bg-[var(--fc-page-bg)] px-3 py-2 text-xs font-semibold text-[var(--fc-text-primary)]">
                    <option value="ALL">All notifications</option><option value="UNREAD">Unread</option><option value="PRIORITY">Priority</option>
                </select>
                <select aria-label="Inbox area" value={area} onChange={(e) => setArea(e.target.value)} className="rounded-lg border border-[var(--fc-border)] bg-[var(--fc-page-bg)] px-3 py-2 text-xs font-semibold text-[var(--fc-text-primary)]">
                    <option value="ALL">All areas</option>
                    {areas.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
                </select>
                <span className="text-xs text-[var(--fc-text-muted)]">{visibleNotifications.length} shown</span>
            </div>

            {visibleNotifications.length === 0 ? <EmptyState message="No notifications match these filters." /> : <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] overflow-hidden divide-y divide-[var(--fc-border)]">
                {visibleNotifications.map((notification) => (
                    <NotificationListItem
                        key={notification.id}
                        notification={notification}
                        compact
                        showScope={false}
                        busy={busyId === notification.id}
                        onOpen={onOpen}
                    />
                ))}
            </div>}

            {hasMore && (
                <div className="flex justify-center pt-2">
                    <button
                        type="button"
                        onClick={onLoadMore}
                        disabled={loadingMore}
                        className="inline-flex items-center gap-2 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-4 py-2 text-xs font-medium text-[var(--fc-text-secondary)] hover:text-[var(--fc-text-primary)] disabled:opacity-50 transition-colors"
                    >
                        {loadingMore ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Loading...
                            </>
                        ) : (
                            'Load More'
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};
