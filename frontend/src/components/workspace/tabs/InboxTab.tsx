import { CheckCheck, Inbox, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { NotificationListItem } from '../../notifications/NotificationListItem';
import type { NotificationItem } from '../../../types/notifications';
import { EmptyState, PageSpinner } from '../helpers';

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

const areaNames: Record<string, string> = { CLUB_MEMBERSHIP_APPLICATION: 'Applications', PLAYER_CLUB_AFFILIATION: 'Players', SCHEDULE_EVENT: 'Calendar' };
const areaLabel = (value: string) => areaNames[value] ?? value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());

export const InboxTab = ({
    notifications, loading, loadingMore, busyId, hasMore,
    unreadCount, error, onOpen, onLoadMore, onMarkAllRead, onRetry,
}: InboxTabProps) => {
    const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'PRIORITY'>('ALL');
    const [area, setArea] = useState('ALL');
    const areas = useMemo(() => Array.from(new Set(notifications.map(item => item.entityType).filter(Boolean) as string[])).sort(), [notifications]);
    const visibleNotifications = useMemo(() => notifications.filter(item => {
        const filterMatches = filter === 'ALL' || (filter === 'UNREAD' && !item.isRead) || (filter === 'PRIORITY' && /urgent|action|required|failed|warning/i.test(`${item.title} ${item.body}`));
        return filterMatches && (area === 'ALL' || item.entityType === area);
    }), [area, filter, notifications]);

    return <section className="workspace-inbox" aria-labelledby="workspace-inbox-title">
        <header className="wi-heading">
            <div><span className="wi-eyebrow">Club inbox</span><h1 id="workspace-inbox-title">Notifications<span aria-hidden="true">.</span></h1><p>Club updates, decisions and alerts, together in one place.</p></div>
            {unreadCount > 0 && <span className="wi-unread">{unreadCount} unread</span>}
        </header>
        <div className="wi-layout">
            <div className="wi-main">
                <div className="wi-filters">
                    <label><span className="sr-only">Inbox filter</span><select value={filter} onChange={e => setFilter(e.target.value as typeof filter)}><option value="ALL">All notifications</option><option value="UNREAD">Unread</option><option value="PRIORITY">Priority</option></select></label>
                    <label><span className="sr-only">Inbox area</span><select value={area} onChange={e => setArea(e.target.value)}><option value="ALL">All areas</option>{areas.map(item => <option key={item} value={item}>{areaLabel(item)}</option>)}</select></label>
                    <span role="status" className="wi-count">{loading ? 'Loading…' : `${visibleNotifications.length} shown${hasMore ? ' · more available' : ''}`}</span>
                    {unreadCount > 0 && <button type="button" className="wi-mark-read" onClick={onMarkAllRead}><CheckCheck size={15} aria-hidden="true"/>Mark all as read</button>}
                </div>
                {error && <div className="wi-error" role="alert"><p>{error}</p><button type="button" onClick={onRetry}>Retry</button></div>}
                {loading && notifications.length === 0 ? <PageSpinner /> : !error && notifications.length === 0 ? <EmptyState message="Your club inbox is up to date" description="New club notifications will appear here." icon={<Inbox size={26}/>} /> : visibleNotifications.length === 0 ? <EmptyState message="No notifications match these filters." description="Try all notifications or choose another area." /> : <div className="wi-list" role="group" aria-label="Club notifications" aria-busy={loading}>
                    {visibleNotifications.map(notification => <div className="wi-item" key={notification.id} data-unread={!notification.isRead}>
                        <NotificationListItem notification={notification} compact showScope={false} busy={busyId === notification.id} onOpen={onOpen}/>
                    </div>)}
                </div>}
                {hasMore && <div className="wi-pagination"><button type="button" disabled={loadingMore} onClick={onLoadMore}>{loadingMore && <Loader2 size={15} className="animate-spin" aria-hidden="true"/>}{loadingMore ? 'Loading…' : 'Load more notifications'}</button></div>}
            </div>
            <aside className="wi-context" aria-label="Inbox context">
                <section className="wi-context-card"><span className="wi-eyebrow">In this club</span><h2><Inbox size={17} aria-hidden="true"/>Club inbox</h2><p>Open a notification to go to the relevant record or page. Marking it as read clears its unread indicator.</p></section>
                {areas.length > 0 && <section className="wi-context-card"><h2>Browse by area</h2><p>{hasMore ? 'Areas in the notifications loaded so far.' : 'Areas in your club notifications.'}</p><div className="wi-area-links"><button type="button" aria-pressed={area === 'ALL'} onClick={() => setArea('ALL')}>All areas</button>{areas.map(item => <button key={item} type="button" aria-pressed={area === item} onClick={() => setArea(item)}>{areaLabel(item)}<span>{notifications.filter(n => n.entityType === item).length}</span></button>)}</div></section>}
            </aside>
        </div>
    </section>;
};
