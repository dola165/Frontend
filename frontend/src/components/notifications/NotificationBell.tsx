import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Loader2 } from 'lucide-react';
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
}

export const NotificationBell = ({ enabled }: NotificationBellProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [busyId, setBusyId] = useState<number | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const navigate = useNavigate();
    const location = useLocation();

    const refreshUnreadCount = async () => {
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
    };

    const loadPreview = async () => {
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
    };

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
    }, [enabled, isOpen]);

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
                className="relative p-2 text-[#a1a1aa] transition-colors hover:text-[#f4f4f5]"
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
                    <div className="flex items-center justify-between border-b border-[#ffffff0d] px-4 py-3">
                        <div>
                            <p className="text-sm font-semibold  text-[#f4f4f5]">Notifications</p>
                            <p className="mt-1 text-[11px] font-semibold  text-[#a1a1aa]">
                                {unreadCount} unread
                            </p>
                        </div>
                    </div>

                    <div className="max-h-[420px] overflow-y-auto">
                        {loadingPreview ? (
                            <div className="flex items-center justify-center py-10 text-[#a1a1aa]">
                                <Loader2 className="h-5 w-5 animate-spin" />
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="px-4 py-10 text-center">
                                <p className="text-sm font-medium text-[#a1a1aa]">No notifications yet.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-[color:#ffffff0d]">
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
                        className="block border-t border-[#ffffff0d] px-4 py-3 text-center text-[11px] font-semibold  text-[#16a34a] transition-colors hover:bg-[#0f1117]"
                    >
                        See all
                    </Link>
                </div>
            )}
        </div>
    );
};
