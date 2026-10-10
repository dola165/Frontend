import { useMemo, useState } from 'react';
import { CheckCheck } from 'lucide-react';
import type { NotificationItem } from '../../../types/notifications';
import { JourneyReminderActions } from '../../../features/mapPlanning/JourneyReminderActions';
import { formatNotificationTime, notificationActionLabel, notificationTypeLabel } from '../../../utils/notifications';
import { Badge, Button, Chip, EmptyNote, List, PageFrame, PageHeader, Panel, Skeleton } from '../../../design/primitives';
import '../../../features/clubOperations/records/records.css';
import '../../../features/clubWorkspace/club-workspace.css';

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
const areaLabel = (value: string) => areaNames[value] ?? value.toLowerCase().replaceAll('_', ' ').replace(/^\w/, letter => letter.toUpperCase());
const filters = [['ALL', 'All'], ['UNREAD', 'Unread'], ['PRIORITY', 'Needs action']] as const;

/** The club's notifications: filter by read state or area, open one to go to its record. */
export const InboxTab = ({ notifications, loading, loadingMore, busyId, hasMore, unreadCount, error, onOpen, onLoadMore, onMarkAllRead, onRetry }: InboxTabProps) => {
    const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'PRIORITY'>('ALL');
    const [area, setArea] = useState('ALL');
    const areas = useMemo(() => Array.from(new Set(notifications.map(item => item.entityType).filter(Boolean) as string[])).sort(), [notifications]);
    const visible = useMemo(() => notifications.filter(item => {
        const matches = filter === 'ALL' || (filter === 'UNREAD' && !item.isRead) || (filter === 'PRIORITY' && /urgent|action|required|failed|warning/i.test(`${item.title} ${item.body}`));
        return matches && (area === 'ALL' || item.entityType === area);
    }), [area, filter, notifications]);

    return <PageFrame className="rec-page">
        <PageHeader title="Club updates" subtitle={unreadCount ? `${unreadCount} unread · decisions and alerts for the club` : 'Decisions and alerts for the club, in one place.'}
            actions={unreadCount > 0 && <Button onClick={onMarkAllRead}><CheckCheck aria-hidden="true" />Mark all as read</Button>} />
        <div className="gk-stack gk-stack--tight">
            <div className="rec-toolbar">
                <div className="gk-chips" role="group" aria-label="Club updates filter">{filters.map(([value, text]) => <Chip key={value} pressed={filter === value} onClick={() => setFilter(value)}>{text}{value === 'UNREAD' && unreadCount ? ` ${unreadCount}` : ''}</Chip>)}</div>
                <select className="gk-input" aria-label="Club updates area" value={area} onChange={e => setArea(e.target.value)}>
                    <option value="ALL">All areas</option>{areas.map(item => <option key={item} value={item}>{areaLabel(item)} ({notifications.filter(n => n.entityType === item).length})</option>)}
                </select>
                <span role="status" className="rec-toolbar__count">{loading ? 'Loading…' : `${visible.length} shown${hasMore ? ' · more available' : ''}`}</span>
            </div>
            {error && <div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{error}</span><Button size="sm" onClick={onRetry}>Retry</Button></div>}
            <Panel flush>
                {loading && notifications.length === 0 ? <div className="cw-skeleton-rows" role="status" aria-label="Loading notifications">{[0, 1, 2, 3].map(i => <Skeleton key={i} height={52} />)}</div>
                    : !error && notifications.length === 0 ? <EmptyNote title="No club updates yet">New club notifications appear here.</EmptyNote>
                        : visible.length === 0 ? <EmptyNote title="No notifications match these filters." action={<Button size="sm" onClick={() => { setFilter('ALL'); setArea('ALL'); }}>Show all</Button>}>Try all notifications or another area.</EmptyNote>
                            : <List label="Club notifications">{visible.map(notification => {
                                const action = notificationActionLabel(notification);
                                return <li key={notification.id} data-unread={!notification.isRead || undefined}>
                                    <button type="button" className="gk-list-row rec-note-row" disabled={busyId === notification.id} onClick={() => onOpen(notification)}>
                                        <span className="gk-list-row__lead"><span className={`rec-dot${notification.isRead ? '' : ' rec-dot--on'}`} aria-label={notification.isRead ? undefined : 'Unread'} /></span>
                                        <span className="gk-list-row__main">
                                            <span className="gk-list-row__title">{notification.title}</span>
                                            <span className="rec-request__text">{notification.body}</span>
                                            <span className="gk-list-row__meta">{notificationTypeLabel(notification.type)}</span>
                                        </span>
                                        <span className="gk-list-row__trail rec-trail-wrap"><span className="rec-row__due">{formatNotificationTime(notification.createdAt)}</span>{action && <Badge tone="accent">{action}</Badge>}</span>
                                    </button>
                                    <JourneyReminderActions notification={notification} />
                                </li>;
                            })}</List>}
                {hasMore && <div className="rec-pager"><Button size="sm" disabled={loadingMore} onClick={onLoadMore}>{loadingMore ? 'Loading…' : 'Load more notifications'}</Button></div>}
            </Panel>
        </div>
    </PageFrame>;
};
