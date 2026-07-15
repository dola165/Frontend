import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BellRing, CheckCheck, Loader2, X } from 'lucide-react';
import {
    fetchNotifications,
    fetchUnreadNotificationCount,
    markAllNotificationsAsRead,
    markNotificationAsRead
} from '../api/notifications';
import { NotificationListItem } from '../components/notifications/NotificationListItem';
import type { NotificationItem, NotificationListScope } from '../types/notifications';
import { extractApiErrorMessage } from '../utils/apiError';
import {
    buildNotificationDestination,
    createNotificationSearch,
    emitNotificationsChanged,
    readNotificationFilterFromSearchParams,
    subscribeNotificationsChanged
} from '../utils/notifications';
import { useAuth } from '../context/AuthContext';

const PAGE_SIZE = 20;

const scopeTabs: Array<{ id: NotificationListScope; label: string; description: string }> = [
    { id: 'all', label: 'All', description: 'Every accessible notification in one stream.' },
    { id: 'personal', label: 'Personal', description: 'Your invites, squad moves, and player-facing updates.' },
    { id: 'club', label: 'Club', description: 'Operational notifications for clubs you currently manage.' }
];

export const NotificationsPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const filter = useMemo(() => readNotificationFilterFromSearchParams(searchParams), [searchParams]);

    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [pageNumber, setPageNumber] = useState(0);
    const [totalElements, setTotalElements] = useState(0);
    const [unreadCount, setUnreadCount] = useState(0);
    const [scopeCounts, setScopeCounts] = useState({ all: 0, personal: 0, club: 0 });
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [markingAll, setMarkingAll] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const hasMore = notifications.length < totalElements;
    const activeClubLabel =
        filter.clubName ||
        notifications.find((notification) => notification.clubId === filter.clubId)?.clubName ||
        (filter.clubId != null ? `Club #${filter.clubId}` : null);

    const quickLinks = useMemo(() => {
        const links = [
            { to: '/account?tab=security', label: 'Account Center' },
            { to: '/my-club', label: 'My Club' }
        ];

        if (user?.role === 'SYSTEM_ADMIN') {
            links.push({ to: '/admin', label: 'Admin' });
        }

        return links;
    }, [user?.role]);

    const loadScopeCounts = async () => {
        try {
            const [allCount, personalCount, clubCount] = await Promise.all([
                fetchUnreadNotificationCount(),
                fetchUnreadNotificationCount({ scope: 'personal' }),
                fetchUnreadNotificationCount({ scope: 'club' })
            ]);
            setScopeCounts({
                all: allCount.unreadCount,
                personal: personalCount.unreadCount,
                club: clubCount.unreadCount
            });
        } catch (error) {
            console.error('Failed to load notification scope counts', error);
        }
    };

    const refreshUnreadCount = async (scope = filter.scope, clubId = filter.clubId) => {
        try {
            const response = await fetchUnreadNotificationCount({ scope, clubId });
            setUnreadCount(response.unreadCount);
        } catch (error) {
            console.error('Failed to refresh unread count', error);
        }
    };

    const loadNotifications = async (
        targetPage: number,
        append: boolean,
        scope = filter.scope,
        clubId = filter.clubId
    ) => {
        const response = await fetchNotifications({
            page: targetPage,
            size: PAGE_SIZE,
            scope,
            clubId
        });

        setPageNumber(response.pageNumber);
        setTotalElements(response.totalElements);
        setNotifications((current) => (append ? [...current, ...response.content] : response.content));
    };

    useEffect(() => {
        let active = true;

        const hydrate = async () => {
            setLoading(true);
            setErrorMessage(null);

            try {
                const [pageResponse, countResponse, allCount, personalCount, clubCount] = await Promise.all([
                    fetchNotifications({
                        page: 0,
                        size: PAGE_SIZE,
                        scope: filter.scope,
                        clubId: filter.clubId
                    }),
                    fetchUnreadNotificationCount({
                        scope: filter.scope,
                        clubId: filter.clubId
                    }),
                    fetchUnreadNotificationCount(),
                    fetchUnreadNotificationCount({ scope: 'personal' }),
                    fetchUnreadNotificationCount({ scope: 'club' })
                ]);

                if (!active) {
                    return;
                }

                setNotifications(pageResponse.content);
                setPageNumber(pageResponse.pageNumber);
                setTotalElements(pageResponse.totalElements);
                setUnreadCount(countResponse.unreadCount);
                setScopeCounts({
                    all: allCount.unreadCount,
                    personal: personalCount.unreadCount,
                    club: clubCount.unreadCount
                });
            } catch (error) {
                if (!active) {
                    return;
                }

                setNotifications([]);
                setPageNumber(0);
                setTotalElements(0);
                setUnreadCount(0);
                setScopeCounts({ all: 0, personal: 0, club: 0 });
                setErrorMessage(extractApiErrorMessage(error, 'Failed to load notifications.'));
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        void hydrate();

        return () => {
            active = false;
        };
    }, [filter.clubId, filter.scope]);

    useEffect(() => {
        const unsubscribe = subscribeNotificationsChanged(() => {
            void refreshUnreadCount();
            void loadScopeCounts();
        });

        return () => unsubscribe();
    }, [filter.clubId, filter.scope]);

    const updateScopeSearch = (scope: NotificationListScope, clubId?: number | null, clubName?: string | null) => {
        const search = createNotificationSearch(scope, clubId ?? null, clubName ?? null);
        setSearchParams(search ? new URLSearchParams(search) : new URLSearchParams());
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
                    current.map((entry) => (entry.id === notification.id ? { ...entry, isRead: true } : entry))
                );
                setUnreadCount((current) => Math.max(0, current - 1));
                emitNotificationsChanged();
            }
        } catch (error) {
            setErrorMessage(extractApiErrorMessage(error, 'Failed to update notification.'));
            setBusyId(null);
            return;
        }

        setBusyId(null);
        navigate(buildNotificationDestination(notification));
    };

    const handleLoadMore = async () => {
        setLoadingMore(true);
        try {
            await loadNotifications(pageNumber + 1, true);
        } catch (error) {
            setErrorMessage(extractApiErrorMessage(error, 'Failed to load more notifications.'));
        } finally {
            setLoadingMore(false);
        }
    };

    const handleMarkAllAsRead = async () => {
        setMarkingAll(true);
        setErrorMessage(null);

        try {
            await markAllNotificationsAsRead({
                scope: filter.scope,
                clubId: filter.clubId
            });
            setNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })));
            setUnreadCount(0);
            emitNotificationsChanged();
        } catch (error) {
            setErrorMessage(extractApiErrorMessage(error, 'Failed to mark notifications as read.'));
        } finally {
            setMarkingAll(false);
        }
    };

    const emptyState = useMemo(() => {
        if (filter.scope === 'personal') {
            return {
                title: 'No personal notifications yet',
                body: 'Invites, squad moves, and player-facing updates will land here.'
            };
        }

        if (filter.scope === 'club') {
            return {
                title: filter.clubId != null ? 'No club notifications for this context' : 'No club notifications yet',
                body:
                    filter.clubId != null
                        ? 'Operational alerts for this club will appear here when staff actions need attention.'
                        : 'Club challenges, staff-review alerts, and management updates will appear here.'
            };
        }

        return {
            title: 'All clear right now',
            body: 'New club invites, challenges, squad moves, and tryout decisions will appear here.'
        };
    }, [filter.clubId, filter.scope]);

    if (loading) {
        return (
            <div className="bg-[#0f1117] flex h-full min-h-[calc(100vh-var(--app-header-height))] items-center justify-center">
                <Loader2 className="h-9 w-9 animate-spin text-[#16a34a]" />
            </div>
        );
    }

    return (
        <div className="bg-[#0f1117] min-h-full">
            <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
                <header className="border-b border-[#ffffff0d] pb-5">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <p className="text-[11px] font-semibold text-[#16a34a]">Destination Page</p>
                            <h1 className="mt-2 text-3xl font-semibold text-[#f4f4f5]">Notifications</h1>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#a1a1aa]">
                                A single operational stream for personal updates and club actions, with scope changes treated as local tab switches.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-2 border border-[#ffffff0d] bg-[#16181d] px-3 py-2 text-[11px] font-medium text-[#f4f4f5]">
                                <BellRing className="h-3.5 w-3.5 text-[#16a34a]" />
                                {unreadCount} unread
                            </span>
                            <button
                                type="button"
                                onClick={() => void handleMarkAllAsRead()}
                                disabled={markingAll || unreadCount === 0}
                                className="rounded-xl bg-[#16a34a] px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {markingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                                Mark Visible Read
                            </button>
                        </div>
                    </div>

                    <div className="mt-5 overflow-x-auto">
                        <div className="flex min-w-max gap-5 border-b border-[#ffffff0d]">
                            {scopeTabs.map((tab) => {
                                const isActive = filter.scope === tab.id;
                                const unread =
                                    tab.id === 'all' ? scopeCounts.all : tab.id === 'personal' ? scopeCounts.personal : scopeCounts.club;

                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() =>
                                            updateScopeSearch(
                                                tab.id,
                                                tab.id === 'club' ? filter.clubId : null,
                                                tab.id === 'club' ? filter.clubName : null
                                            )
                                        }
                                        className={`inline-flex min-h-12 items-center gap-2 border-b-2 px-1 text-sm font-medium transition-colors ${
                                            isActive ? 'border-[#16a34a] text-[#16a34a] font-semibold' : 'border-transparent text-[#a1a1aa] font-medium hover:text-[#f4f4f5]'
                                        }`}
                                        title={tab.description}
                                    >
                                        <span>{tab.label}</span>
                                        {unread > 0 && (
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${isActive ? 'bg-[#16a34a]/10 text-[#16a34a]' : 'bg-[#16181d] text-[#a1a1aa]'}`}>
                                                {unread}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-[#a1a1aa]">
                            <span>Current scope</span>
                            <span className="text-[#16a34a]">{scopeTabs.find((tab) => tab.id === filter.scope)?.label}</span>
                            {filter.scope === 'club' && (
                                <>
                                    <span className="h-1 w-1 rounded-full bg-[#16a34a]" />
                                    <span>{activeClubLabel ? activeClubLabel : 'All managed clubs'}</span>
                                </>
                            )}
                            {filter.clubId != null && (
                                <button
                                    type="button"
                                    onClick={() => updateScopeSearch('club')}
                                    className="inline-flex items-center gap-1.5 border border-[#ffffff0d] bg-[#16181d] px-2.5 py-1.5 text-[10px] font-medium text-[#a1a1aa]"
                                >
                                    <X className="h-3.5 w-3.5" />
                                    Clear Club Filter
                                </button>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {quickLinks.map((link) => (
                                <Link
                                    key={link.to}
                                    to={link.to}
                                    className="border border-[#ffffff0d] bg-[#16181d] px-3 py-2 text-[11px] font-medium text-[#a1a1aa] transition-colors hover:text-[#f4f4f5]"
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                </header>

                {errorMessage && (
                    <div className="border border-[var(--fc-state-danger)] bg-[var(--fc-state-danger-soft)] text-[var(--fc-state-danger)] px-4 py-3 text-sm font-semibold">
                        {errorMessage}
                    </div>
                )}

                <section className="rounded-xl bg-[#16181d] border border-[#ffffff0d]">
                    {notifications.length === 0 ? (
                        <div className="px-6 py-16 text-center">
                            <BellRing className="mx-auto h-10 w-10 text-[#a1a1aa]" />
                            <h2 className="mt-4 text-xl font-semibold text-[#f4f4f5]">{emptyState.title}</h2>
                            <p className="mt-2 text-sm leading-6 text-[#a1a1aa]">{emptyState.body}</p>
                            <div className="mt-5 flex justify-center gap-2">
                                {filter.scope === 'club' ? (
                                    <Link to="/my-club" className="border border-[#16a34a] bg-[#16a34a]/10 px-4 py-2 text-[11px] font-medium text-[#16a34a]">
                                        Open My Club
                                    </Link>
                                ) : (
                                    <Link to="/clubs" className="border border-[#16a34a] bg-[#16a34a]/10 px-4 py-2 text-[11px] font-medium text-[#16a34a]">
                                        Browse Clubs
                                    </Link>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="divide-y divide-[#ffffff0d]">
                            {notifications.map((notification) => (
                                <NotificationListItem
                                    key={notification.id}
                                    notification={notification}
                                    busy={busyId === notification.id}
                                    showScope={filter.scope === 'all'}
                                    onOpen={handleOpenNotification}
                                />
                            ))}
                        </div>
                    )}
                </section>

                {hasMore && (
                    <div className="flex justify-center">
                        <button
                            type="button"
                            onClick={() => void handleLoadMore()}
                            disabled={loadingMore}
                            className="rounded-xl border border-[#ffffff0d] px-3 py-1.5 text-xs font-medium text-[#f4f4f5] w-full disabled:cursor-wait disabled:opacity-60"
                        >
                            {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Load More
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
