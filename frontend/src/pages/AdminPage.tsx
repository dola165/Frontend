import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Search, ShieldCheck, ShieldEllipsis, UsersRound } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { extractApiErrorMessage } from '../utils/apiError';

type AdminUserListItem = {
    id: number;
    username: string;
    email: string;
    role: string;
    displayName: string;
    fullName?: string | null;
    profileComplete: boolean;
    emailVerified: boolean;
    passwordLoginEnabled: boolean;
    clubId?: number | null;
    clubName?: string | null;
    clubRole?: string | null;
};

type AdminUserPage = {
    content: AdminUserListItem[];
    pageNumber: number;
    pageSize: number;
    totalElements: number;
};

const PAGE_SIZE = 24;

const roleTone = (role: string) => {
    if (role === 'SYSTEM_ADMIN') return 'border-rose-500/20 text-rose-400 bg-rose-500/10';
    if (role === 'CLUB_ADMIN') return 'border-emerald-500/20 text-emerald-400 bg-emerald-500/10';
    if (role === 'AGENT') return 'border-sky-500/20 text-sky-400 bg-sky-500/10';
    return 'border-[#ffffff0d] text-[#a1a1aa]';
};

export const AdminPage = () => {
    const [query, setQuery] = useState('');
    const [pageNumber, setPageNumber] = useState(0);
    const [users, setUsers] = useState<AdminUserListItem[]>([]);
    const [totalElements, setTotalElements] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const hasMore = users.length < totalElements;

    useEffect(() => {
        const timeoutId = window.setTimeout(async () => {
            setLoading(true);
            setErrorMessage(null);
            try {
                const response = await apiClient.get<AdminUserPage>('/admin/users', {
                    params: {
                        page: 0,
                        size: PAGE_SIZE,
                        ...(query.trim() ? { query: query.trim() } : {})
                    }
                });
                setUsers(response.data.content);
                setPageNumber(response.data.pageNumber);
                setTotalElements(response.data.totalElements);
            } catch (requestError) {
                setUsers([]);
                setPageNumber(0);
                setTotalElements(0);
                setErrorMessage(extractApiErrorMessage(requestError, 'Failed to load the admin directory.'));
            } finally {
                setLoading(false);
            }
        }, 250);

        return () => window.clearTimeout(timeoutId);
    }, [query]);

    const handleLoadMore = async () => {
        setLoadingMore(true);
        try {
            const response = await apiClient.get<AdminUserPage>('/admin/users', {
                params: {
                    page: pageNumber + 1,
                    size: PAGE_SIZE,
                    ...(query.trim() ? { query: query.trim() } : {})
                }
            });
            setUsers((current) => [...current, ...response.data.content]);
            setPageNumber(response.data.pageNumber);
            setTotalElements(response.data.totalElements);
        } catch (requestError) {
            setErrorMessage(extractApiErrorMessage(requestError, 'Failed to load more users.'));
        } finally {
            setLoadingMore(false);
        }
    };

    const visibleStats = useMemo(() => ({
        verified: users.filter((user) => user.emailVerified).length,
        clubLinked: users.filter((user) => user.clubId != null).length,
        systemAdmins: users.filter((user) => user.role === 'SYSTEM_ADMIN').length
    }), [users]);

    return (
        <div className="bg-[#0f1117] min-h-[calc(100vh-64px)] text-[#f4f4f5]">
            <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
                <header className="border-b border-[#ffffff0d] pb-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <p className="text-[11px] font-semibold text-[#16a34a]">
                                System Admin
                            </p>
                            <h1 className="mt-2 text-3xl font-semibold text-[#f4f4f5]">Admin Panel</h1>
                            <p className="mt-2 max-w-2xl text-sm text-[#a1a1aa]">
                                Inspect users, personas, verification state, and club affiliation without layering on fake destructive tools.
                            </p>
                        </div>

                        <div className="rounded-xl border border-dashed border-[#ffffff0d] px-4 py-3 text-sm text-[#a1a1aa]">
                            Lifecycle controls stay intentionally read-only here until broader admin backend support is ready.
                        </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                        <div className="bg-[#16181d] border border-[#ffffff0d] rounded-xl px-4 py-4">
                            <p className="text-[11px] font-semibold text-[#a1a1aa]">Visible Users</p>
                            <p className="mt-3 text-3xl font-semibold text-[#f4f4f5]">{totalElements}</p>
                        </div>
                        <div className="bg-[#16181d] border border-[#ffffff0d] rounded-xl px-4 py-4">
                            <p className="text-[11px] font-semibold text-[#a1a1aa]">Verified In View</p>
                            <p className="mt-3 text-3xl font-semibold text-[#f4f4f5]">{visibleStats.verified}</p>
                        </div>
                        <div className="bg-[#16181d] border border-[#ffffff0d] rounded-xl px-4 py-4">
                            <p className="text-[11px] font-semibold text-[#a1a1aa]">Club Linked In View</p>
                            <p className="mt-3 text-3xl font-semibold text-[#f4f4f5]">{visibleStats.clubLinked}</p>
                        </div>
                    </div>

                    <div className="mt-5">
                        <label className="flex items-center gap-3 rounded-xl border border-[#ffffff0d] bg-[#16181d] px-4 py-3 focus-within:border-[#16a34a]">
                            <Search className="h-4 w-4 text-[#a1a1aa]" />
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search by name, username, or email"
                                className="w-full bg-transparent text-sm font-medium text-[#f4f4f5] outline-none placeholder:text-[#a1a1aa]"
                            />
                        </label>
                    </div>

                    {errorMessage && (
                        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-400">
                            {errorMessage}
                        </div>
                    )}
                </header>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-[#16a34a]" />
                    </div>
                ) : users.length === 0 ? (
                    <section className="bg-[#16181d] border border-[#ffffff0d] rounded-xl px-6 py-16 text-center">
                        <UsersRound className="mx-auto h-10 w-10 text-[#a1a1aa]" />
                        <h2 className="mt-4 text-xl font-semibold text-[#f4f4f5]">
                            {query.trim() ? 'No users matched this search' : 'No users available'}
                        </h2>
                        <p className="mt-2 text-sm text-[#a1a1aa]">
                            {query.trim()
                                ? 'Try a broader name, username, or email search.'
                                : 'This environment does not currently expose any user records.'}
                        </p>
                    </section>
                ) : (
                    <section className="grid gap-4">
                        {users.map((user) => (
                            <article key={user.id} className="bg-[#16181d] border border-[#ffffff0d] rounded-xl px-5 py-5">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="text-lg font-semibold text-[#f4f4f5]">{user.displayName}</h2>
                                            <span className={`rounded-xl border px-3 py-1 text-[10px] font-semibold ${roleTone(user.role)}`}>
                                                {user.role}
                                            </span>
                                            <span className={`rounded-xl border px-3 py-1 text-[10px] font-semibold ${user.emailVerified ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/10' : 'border-amber-500/20 text-amber-400 bg-amber-500/10'}`}>
                                                {user.emailVerified ? 'Verified' : 'Unverified'}
                                            </span>
                                            <span className={`rounded-xl border px-3 py-1 text-[10px] font-semibold ${user.profileComplete ? 'border-sky-500/20 text-sky-400 bg-sky-500/10' : 'border-[#ffffff0d] text-[#a1a1aa]'}`}>
                                                {user.profileComplete ? 'Profile Ready' : 'Profile Partial'}
                                            </span>
                                        </div>

                                        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                            <div>
                                                <p className="text-[11px] font-semibold text-[#a1a1aa]">Username</p>
                                                <p className="mt-1 text-sm font-semibold text-[#f4f4f5]">{user.username}</p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-semibold text-[#a1a1aa]">Email</p>
                                                <p className="mt-1 text-sm font-semibold text-[#f4f4f5]">{user.email}</p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-semibold text-[#a1a1aa]">Club Affiliation</p>
                                                <p className="mt-1 text-sm font-semibold text-[#f4f4f5]">
                                                    {user.clubName ? `${user.clubName} (${user.clubRole || 'Member'})` : 'No active club affiliation'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-semibold text-[#a1a1aa]">Password Sign-In</p>
                                                <p className="mt-1 text-sm font-semibold text-[#f4f4f5]">
                                                    {user.passwordLoginEnabled ? 'Configured' : 'Provider only'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 lg:justify-end">
                                        <Link
                                            to={`/profile/${user.id}`}
                                            className="inline-flex items-center gap-2 rounded-xl border border-[#ffffff0d] px-4 py-2 text-[11px] font-semibold text-[#a1a1aa] transition-colors hover:border-[#16a34a] hover:text-[#16a34a]"
                                        >
                                            <ShieldCheck className="h-3.5 w-3.5" />
                                            Public Profile
                                        </Link>
                                        {user.clubId ? (
                                            <Link
                                                to={`/clubs/${user.clubId}`}
                                                className="inline-flex items-center gap-2 rounded-xl bg-[#16a34a] px-4 py-2 text-[11px] font-semibold text-white transition-colors hover:bg-[#22c55e]"
                                            >
                                                <ShieldEllipsis className="h-3.5 w-3.5" />
                                                Open Club
                                            </Link>
                                        ) : (
                                            <span className="inline-flex items-center rounded-xl border border-dashed border-[#ffffff0d] px-4 py-2 text-[11px] font-semibold text-[#a1a1aa]">
                                                No club route
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </article>
                        ))}
                    </section>
                )}

                {hasMore && (
                    <div className="flex justify-center">
                        <button
                            type="button"
                            onClick={() => void handleLoadMore()}
                            disabled={loadingMore}
                            className="inline-flex items-center gap-2 rounded-xl border border-[#ffffff0d] px-4 py-2 text-[11px] font-semibold text-[#a1a1aa] transition-colors hover:text-[#16a34a] disabled:cursor-wait disabled:opacity-60"
                        >
                            {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Load more
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
