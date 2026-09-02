import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
    fetchNotifications,
    fetchUnreadNotificationCount,
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
            void refreshUnreadCount();
            if (isOpen) {
                void loadPreview();
            }
        });

        const handleFocus = () => void refreshUnreadCount();
        window.addEventListener('focus', handleFocus);

        return () => {
            unsubscribe();
            window.removeEventListener('focus', handleFocus);
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
            void loadPreview();
        }
    };

    const handleOpenNotification = async (notification: NotificationItem) => {
        if (busyId != null) {
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

    if (!enabled) {
        return null;
    }

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={handleToggle}
                className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16a34a] ${isNotificationsPage
                    ? light ? 'border-[#16a34a]/45 bg-[#dcfce7] text-[#166534]' : 'border-[#22c55e]/45 bg-[#354038] text-[#86efac]'
                    : light ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-950' : 'border-white/[0.07] bg-[#292d34] text-[#f1f3f5] hover:bg-[#363b44] hover:text-white'}`}
                aria-label={t('nav.notifications')}
                title={t('nav.notifications')}
                aria-expanded={isOpen}
                aria-haspopup="menu"
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 inline-flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-[color:var(--accent-muted)] px-1.5 text-[10px] font-semibold text-white shadow-panel">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="theme-surface theme-border theme-shadow absolute right-0 top-12 z-[120] w-[380px] overflow-hidden border">
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
                                        busy={busyId === notification.id}
                                        onOpen={handleOpenNotification}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <Link
                        to="/notifications"
                        onClick={() => setIsOpen(false)}
                        className="block border-t border-[var(--theme-border)] px-4 py-3 text-center text-[11px] font-semibold text-[#16a34a] transition-colors hover:bg-[var(--theme-surface-muted)]"
                    >
                        See all
                    </Link>
                </div>
            )}
        </div>
    );
};
