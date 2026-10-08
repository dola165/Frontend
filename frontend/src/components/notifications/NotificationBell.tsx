import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
    fetchNotifications,
    fetchUnreadNotificationCount,
    markAllNotificationsAsRead,
    markNotificationAsRead
} from '../../api/notifications';
import type { NotificationItem } from '../../types/notifications';
import {
    buildNotificationDestination,
    emitNotificationsChanged,
    subscribeNotificationsChanged
} from '../../utils/notifications';
import { NotificationListItem } from './NotificationListItem';

interface NotificationBellProps {
    enabled: boolean;
    light?: boolean;
}

export const NotificationBell = ({ enabled, light = false }: NotificationBellProps) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [markingAll, setMarkingAll] = useState(false);
    const [readError, setReadError] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const navigate = useNavigate();
    const location = useLocation();
    const isNotificationsPage = location.pathname === '/notifications';

    const refreshUnreadCount = useCallback(async () => {
        if (!enabled) {
            setUnreadCount(0);
            return;
        }
        try {
            const response = await fetchUnreadNotificationCount();
            setUnreadCount(response.unreadCount);
        } catch (error) {
            console.error('Failed to fetch notification count', error);
        }
    }, [enabled]);

    const loadPreview = useCallback(async () => {
        if (!enabled) {
            setNotifications([]);
            return;
        }
        setLoadingPreview(true);
        try {
            const [pageResponse, countResponse] = await Promise.all([
                fetchNotifications({ page: 0, size: 7 }),
                fetchUnreadNotificationCount()
            ]);
            setNotifications(pageResponse.content ?? []);
            setUnreadCount(countResponse.unreadCount);
        } catch (error) {
            console.error('Failed to load notifications preview', error);
        } finally {
            setLoadingPreview(false);
        }
    }, [enabled]);

    useEffect(() => {
        if (!enabled) {
            setIsOpen(false);
            setNotifications([]);
            setUnreadCount(0);
            return;
        }

        void refreshUnreadCount();

        const unsubscribe = subscribeNotificationsChanged(() => {
            if (isOpen) void loadPreview();
            else void refreshUnreadCount();
        });

        return () => {
            unsubscribe();
        };
    }, [enabled, isOpen, loadPreview, refreshUnreadCount]);

    useEffect(() => {
        setIsOpen(false);
    }, [location.pathname, location.search]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleToggle = () => {
        const next = !isOpen;
        setIsOpen(next);
        if (next) {
            setReadError(null);
            void loadPreview();
        }
    };

    const handleOpenNotification = async (notification: NotificationItem) => {
        if (busyId != null || markingAll) {
            return;
        }

        try {
            setBusyId(notification.id);
            if (!notification.isRead) {
                await markNotificationAsRead(notification.id);
                setNotifications((current) =>
                    current.map((entry) => entry.id === notification.id ? { ...entry, isRead: true } : entry)
                );
                setUnreadCount((current) => Math.max(0, current - 1));
                emitNotificationsChanged();
            }
        } catch (error) {
            console.error('Failed to mark notification as read', error);
        } finally {
            setBusyId(null);
            setIsOpen(false);
        }

        navigate(buildNotificationDestination(notification));
    };

    const handleMarkAllAsRead = async () => {
        if (markingAll || busyId != null || loadingPreview || unreadCount === 0) return;
        setMarkingAll(true);
        setReadError(null);
        try {
            await markAllNotificationsAsRead();
            setNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })));
            setUnreadCount(0);
            emitNotificationsChanged({ allRead: true });
        } catch {
            setReadError('Could not mark notifications as read. Please try again.');
        } finally {
            setMarkingAll(false);
        }
    };

    if (!enabled) {
        return null;
    }

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={handleToggle}
                className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${isNotificationsPage
                    ? light ? 'border-[var(--color-accent)]/45 bg-[var(--color-inset)] text-[var(--color-accent)]' : 'border-[var(--color-accent)]/45 bg-[var(--color-inset)] text-[var(--color-accent)]'
                    : light ? 'border-[color:var(--color-border)] bg-[color:var(--color-elevated)] text-[color:var(--color-text)] hover:bg-[color:var(--color-inset)] hover:text-[color:var(--color-text)]' : 'border-[color:var(--color-border)]/[0.07] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-inset)] hover:text-[color:var(--color-text)]'}`}
                aria-label={t('nav.notifications')}
                title={t('nav.notifications')}
                aria-expanded={isOpen}
                aria-haspopup="menu"
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 inline-flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-[var(--color-accent)] px-1.5 text-[10px] font-semibold text-[var(--color-on-accent)] shadow-panel">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="app-popover theme-surface theme-border theme-shadow absolute right-0 top-12 z-[120] w-[min(380px,calc(100vw-32px))] overflow-hidden border">
                    <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-4 py-3">
                        <div>
                            <p className="text-sm font-semibold text-[var(--text-primary)]">Notifications</p>
                            <p className="mt-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                                {unreadCount} unread
                            </p>
                        </div>
                    </div>

                    <div className="max-h-[420px] overflow-y-auto">
                        {loadingPreview ? (
                            <div className="flex items-center justify-center py-10 text-[var(--text-secondary)]">
                                <Loader2 className="h-5 w-5 animate-spin" />
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="px-4 py-10 text-center">
                                <p className="text-sm font-medium text-[var(--text-secondary)]">No notifications yet.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-[var(--theme-border)]">
                                {notifications.map((notification) => (
                                    <NotificationListItem
                                        key={notification.id}
                                        notification={notification}
                                        compact
                                        showScope={false}
                                        busy={markingAll || busyId === notification.id}
                                        onOpen={handleOpenNotification}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {readError && <p role="alert" className="px-4 py-2 text-xs text-[var(--text-primary)]">{readError}</p>}
                    <div className="flex items-center justify-between gap-2 border-t border-[var(--theme-border)] px-2">
                        <Link
                            to="/notifications"
                            onClick={() => setIsOpen(false)}
                            className={`inline-flex min-h-11 items-center px-2 text-[11px] font-semibold transition-colors hover:bg-[var(--theme-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${light ? 'text-[var(--color-accent)]' : 'text-[var(--color-accent)]'}`}
                        >
                            See all
                        </Link>
                        <button
                            type="button"
                            onClick={() => void handleMarkAllAsRead()}
                            disabled={unreadCount === 0 || markingAll || loadingPreview || busyId != null}
                            aria-busy={markingAll}
                            className={`inline-flex min-h-11 items-center gap-1.5 px-2 text-[11px] font-semibold transition-colors hover:bg-[var(--theme-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:cursor-default disabled:opacity-50 ${light ? 'text-[var(--color-accent)]' : 'text-[var(--color-accent)]'}`}
                        >
                            {markingAll ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <CheckCheck aria-hidden="true" className="h-4 w-4" />}
                            Mark all as read
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
