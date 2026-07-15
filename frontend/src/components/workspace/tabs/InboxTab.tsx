import { Loader2 } from 'lucide-react';
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
    onOpen: (notification: NotificationItem) => void;
    onLoadMore: () => void;
    onMarkAllRead: () => void;
}

export const InboxTab = ({
    notifications, loading, loadingMore, busyId, hasMore,
    unreadCount, onOpen, onLoadMore, onMarkAllRead
}: InboxTabProps) => {
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

            <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] overflow-hidden divide-y divide-[var(--fc-border)]">
                {notifications.map((notification) => (
                    <NotificationListItem
                        key={notification.id}
                        notification={notification}
                        compact
                        showScope={false}
                        busy={busyId === notification.id}
                        onOpen={onOpen}
                    />
                ))}
            </div>

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
