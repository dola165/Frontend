import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, BellRing, Building2, CheckCheck, Inbox, Loader2, UserRound, X } from 'lucide-react';
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
    const activeScope = scopeTabs.find((tab) => tab.id === filter.scope) ?? scopeTabs[0];
    const activeScopeTitle = filter.scope === 'all' ? 'All activity' : `${activeScope.label} activity`;
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

    const loadScopeCounts = useCallback(async () => {
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
    }, []);

    const refreshUnreadCount = useCallback(async (scope = filter.scope, clubId = filter.clubId) => {
        try {
            const response = await fetchUnreadNotificationCount({ scope, clubId });
            setUnreadCount(response.unreadCount);
        } catch (error) {
            console.error('Failed to refresh unread count', error);
        }
    }, [filter.clubId, filter.scope]);

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
    }, [loadScopeCounts, refreshUnreadCount]);

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
            <div className="theme-page flex h-full min-h-[calc(100vh-var(--app-header-height))] items-center justify-center">
                <Loader2 className="h-9 w-9 animate-spin text-[var(--accent-primary)]" />
            </div>
        );
    }

    return (
        <div className="theme-page min-h-full [--accent-primary:#3f7666] [--accent-primary-soft:rgba(63,118,102,0.10)] dark:[--accent-primary:#5f927f] dark:[--accent-primary-soft:rgba(95,146,127,0.16)]">
            <div className="flex w-full flex-col gap-6">
                <header className="border-b theme-border pb-6">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl">
                            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--accent-primary)]">
                                <Inbox className="h-4 w-4" />
                                Activity inbox
                            </div>
                            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-primary sm:text-5xl">Notifications</h1>
                            <p className="mt-3 text-sm leading-6 text-secondary sm:text-base">
                                Invites, decisions, match reminders, and club updates—kept in one place and ordered by what happened most recently.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 sm:gap-5">
                            <div className="border-l-2 border-[var(--accent-primary)] pl-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted">Unread in this view</p>
                                <p className="mt-0.5 text-2xl font-black leading-none text-primary">{unreadCount}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => void handleMarkAllAsRead()}
                                disabled={markingAll || unreadCount === 0}
                                className="inline-flex min-h-11 items-center justify-center gap-2 border border-[var(--accent-primary)] bg-[var(--accent-primary)] px-4 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {markingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
                                Mark all as read
                            </button>
                        </div>
                    </div>
                </header>

                <div className="grid min-w-0 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[290px_minmax(0,1fr)]">
                    <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
                        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-muted">Show notifications</p>
                        <nav aria-label="Notification scope" className="grid grid-cols-3 border-y theme-border lg:grid-cols-1">
                            {scopeTabs.map((tab) => {
                                const isActive = filter.scope === tab.id;
                                const unread = tab.id === 'all'
                                    ? scopeCounts.all
                                    : tab.id === 'personal'
                                        ? scopeCounts.personal
                                        : scopeCounts.club;
                                const ScopeIcon = tab.id === 'all' ? Inbox : tab.id === 'personal' ? UserRound : Building2;

                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        aria-pressed={isActive}
                                        onClick={() =>
                                            updateScopeSearch(
                                                tab.id,
                                                tab.id === 'club' ? filter.clubId : null,
                                                tab.id === 'club' ? filter.clubName : null
                                            )
                                        }
                                        className={`group flex min-w-0 items-center gap-1.5 border-l-2 px-2 py-3 text-left transition-colors lg:gap-3 lg:border-b lg:px-3 lg:last:border-b-0 ${
                                            isActive
                                                ? 'border-l-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-primary lg:border-b-[var(--theme-border)]'
                                                : 'border-l-transparent text-secondary hover:bg-[var(--theme-surface-muted)] hover:text-primary lg:border-b-[var(--theme-border)]'
                                        }`}
                                        title={tab.description}
                                    >
                                        <ScopeIcon className={`hidden h-4 w-4 shrink-0 lg:block ${isActive ? 'text-[var(--accent-primary)]' : 'text-muted'}`} />
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-bold">{tab.label}</span>
                                            <span className="mt-0.5 hidden truncate text-[11px] text-muted lg:block">
                                                {tab.id === 'all' ? 'Everything together' : tab.id === 'personal' ? 'Invites and decisions' : 'Managed club activity'}
                                            </span>
                                        </span>
                                        <span className={`text-xs font-black tabular-nums ${unread > 0 && isActive ? 'text-[var(--accent-primary)]' : 'text-muted'}`}>
                                            {unread}
                                        </span>
                                    </button>
                                );
                            })}
                        </nav>

                        <div className="mt-6 hidden lg:block">
                            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted">Shortcuts</p>
                            <div className="border-y theme-border">
                                {quickLinks.map((link) => (
                                    <Link
                                        key={link.to}
                                        to={link.to}
                                        className="group flex items-center justify-between border-b theme-border px-1 py-3 text-sm font-semibold text-secondary transition-colors last:border-b-0 hover:text-primary"
                                    >
                                        {link.label}
                                        <ArrowUpRight className="h-4 w-4 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </aside>

                    <main className="min-w-0">
                        <div className="mb-4 flex flex-col gap-3 border-b theme-border pb-4 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-xl font-black text-primary">{activeScopeTitle}</h2>
                                    <span className="text-xs font-bold text-muted">{totalElements} total</span>
                                </div>
                                <p className="mt-1 text-sm text-secondary">{activeScope.description}</p>
                            </div>

                            {filter.scope === 'club' && (
                                <div className="flex flex-wrap items-center gap-2 text-xs text-secondary">
                                    <Building2 className="h-4 w-4 text-[var(--accent-primary)]" />
                                    <span>{activeClubLabel || 'All managed clubs'}</span>
                                    {filter.clubId != null && (
                                        <button
                                            type="button"
                                            onClick={() => updateScopeSearch('club')}
                                            className="inline-flex items-center gap-1 border-b border-[var(--accent-primary)] py-1 font-bold text-[var(--accent-primary)]"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                            Clear club filter
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {errorMessage && (
                            <div className="mb-4 border-l-2 border-[var(--state-danger)] bg-[var(--state-danger-soft)] px-4 py-3 text-sm font-semibold text-[var(--state-danger)]">
                                {errorMessage}
                            </div>
                        )}

                        <section className="theme-surface border-y theme-border">
                            {notifications.length === 0 ? (
                                <div className="px-6 py-16 text-center">
                                    <BellRing className="mx-auto h-9 w-9 text-muted" />
                                    <h2 className="mt-4 text-xl font-black text-primary">{emptyState.title}</h2>
                                    <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-secondary">{emptyState.body}</p>
                                    <div className="mt-5 flex justify-center gap-2">
                                        {filter.scope === 'club' ? (
                                            <Link to="/my-club" className="border-b-2 border-[var(--accent-primary)] px-1 py-2 text-sm font-bold text-[var(--accent-primary)]">
                                                Open My Club
                                            </Link>
                                        ) : (
                                            <Link to="/clubs" className="border-b-2 border-[var(--accent-primary)] px-1 py-2 text-sm font-bold text-[var(--accent-primary)]">
                                                Browse Clubs
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="divide-y divide-[var(--theme-border)]">
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
                            <button
                                type="button"
                                onClick={() => void handleLoadMore()}
                                disabled={loadingMore}
                                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 border theme-border text-sm font-bold text-primary transition-colors hover:bg-[var(--theme-surface-muted)] disabled:cursor-wait disabled:opacity-60"
                            >
                                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                                Load more notifications
                            </button>
                        )}

                        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 lg:hidden">
                            {quickLinks.map((link) => (
                                <Link key={link.to} to={link.to} className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary">
                                    {link.label}
                                    <ArrowUpRight className="h-4 w-4" />
                                </Link>
                            ))}
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
};
