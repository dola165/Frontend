import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Search, ShieldCheck, ShieldEllipsis, UsersRound } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { extractApiErrorMessage } from '../utils/apiError';
import { useAuth } from '../context/AuthContext';
import { ADMIN_CLUB_PAGE_SIZE, fetchAdminClubs, verifyAdminClub, type AdminClubPage } from '../features/admin/api';
import { ContentReportsPanel } from '../features/jev/ContentReportsPanel';
import { ModerationPanel } from '../features/moderation/ModerationPanel';
import { AdmissionGovernancePanel } from '../features/admissions/governance/AdmissionGovernancePanel';

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
    if (role === 'SYSTEM_ADMIN') return 'border-[color:var(--color-danger)]/20 text-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10';
    if (role === 'CLUB_ADMIN') return 'border-[color:var(--color-accent)]/20 text-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10';
    if (role === 'AGENT') return 'border-[color:var(--color-info)]/20 text-[color:var(--color-info)] bg-[color:var(--color-info)]/10';
    return 'border-[color:var(--color-border)] text-[var(--color-secondary)]';
};

export const AdminPage = () => {
    const { status, user, sessionId } = useAuth();
    if (status !== 'authenticated' || user?.role !== 'SYSTEM_ADMIN') {
        return <p role="alert" className="p-6">System administrator access is required.</p>;
    }
    // Retiring an account also retires all loaded admin data and in-flight UI updates.
    return <AdminPanel key={`${sessionId}:${user.id}`} />;
};

const AdminPanel = () => {
    // Keep the unapproved post-reporting draft out of the normal release.
    const contentReportsEnabled = import.meta.env.VITE_EXPERIMENTAL_CONTENT_REPORTS === 'true';
    const [tab, setTab] = useState<'users' | 'clubs' | 'reports' | 'safety' | 'admissions'>(() => {const requested=new URLSearchParams(window.location.search).get('tab');return requested==='admissions'?'admissions':requested==='safety'?'safety':'users';});
    return <div className="admin-workspace min-h-[calc(100dvh-var(--app-header-height))] bg-[var(--color-surface)] px-4 py-6 text-[var(--color-text)] md:px-6">
        <header className="mb-6">
            <p className="text-xs font-semibold text-[color:var(--color-accent)]">System administration</p>
            <h1 className="mt-2 text-3xl font-semibold">Admin Panel</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--color-secondary)]">Review account information and verify clubs.</p>
            <nav aria-label="Administration sections" className="mt-5 flex flex-wrap gap-2">
                {([{ id: 'users', label: 'Users' }, { id: 'clubs', label: 'Club verification' }, ...(contentReportsEnabled ? [{ id: 'reports', label: 'Content reports' } as const] : []), { id: 'safety', label: 'People & messages' }, { id:'admissions',label:'Admission safeguarding & privacy' }] as const).map(item =>
                    <button key={item.id} type="button" aria-pressed={tab === item.id} onClick={() => setTab(item.id)}
                        className={`min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold ${tab === item.id ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]' : 'border-[color:var(--color-border)] text-[var(--color-secondary)]'}`}>
                        {item.label}
                    </button>)}
            </nav>
        </header>
        {tab === 'users' ? <AdminUserDirectory /> : tab === 'clubs' ? <ClubVerificationPanel /> : tab === 'safety' ? <ModerationPanel /> : tab==='admissions'?<AdmissionGovernancePanel/>:contentReportsEnabled ? <ContentReportsPanel /> : null}
    </div>;
};

const adminButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[color:var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] hover:border-[color:var(--color-accent)] focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50';

const ClubVerificationPanel = () => {
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(0);
    const [result, setResult] = useState<AdminClubPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [revision, setRevision] = useState(0);
    const [reviewingId, setReviewingId] = useState<number | null>(null);
    const [pendingId, setPendingId] = useState<number | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const verification = useRef<AbortController | null>(null);

    useEffect(() => () => verification.current?.abort(), []);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setLoadError(null);
        setResult(null);
        const timeout = window.setTimeout(async () => {
            try {
                const next = await fetchAdminClubs(query, page, controller.signal);
                if (!controller.signal.aborted) setResult(next);
            } catch (error) {
                if (!controller.signal.aborted) setLoadError(extractApiErrorMessage(error, 'Could not load the club list.'));
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }, query.trim() ? 250 : 0);
        return () => { window.clearTimeout(timeout); controller.abort(); };
    }, [query, page, revision]);

    const verify = async (clubId: number) => {
        const club = result?.content.find(item => item.id === clubId);
        if (verification.current || loading || reviewingId !== clubId || !club || club.isOfficial) return;
        const controller = new AbortController();
        verification.current = controller;
        setPendingId(clubId);
        setActionError(null);
        setSuccess(null);
        try {
            await verifyAdminClub(clubId, controller.signal);
            if (controller.signal.aborted) return;
            setSuccess(`${club.name} is verified.`);
            setReviewingId(null);
            // Read fresh server data after the audited transition, rather than making an optimistic badge.
            setRevision(current => current + 1);
        } catch (error) {
            if (controller.signal.aborted) return;
            setActionError(extractApiErrorMessage(error, 'Could not confirm verification. Refresh the list before trying again.'));
        } finally {
            if (!controller.signal.aborted) {
                verification.current = null;
                setPendingId(null);
            }
        }
    };

    const resetReview = () => { setReviewingId(null); setActionError(null); setSuccess(null); };
    const totalPages = Math.max(1, Math.ceil((result?.totalElements ?? 0) / ADMIN_CLUB_PAGE_SIZE));

    return <section aria-labelledby="club-verification-heading" className="space-y-4">
        <div>
            <h2 id="club-verification-heading" className="text-xl font-semibold">Club verification</h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--color-secondary)]">Review a club’s profile before verifying it. Verification adds the verified badge and makes the club eligible to host tournaments.</p>
        </div>
        <div className="flex flex-wrap gap-3">
            <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
                <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--color-secondary)]" />
                <input aria-label="Search clubs" value={query} disabled={pendingId !== null}
                    onChange={event => { setQuery(event.target.value); setPage(0); resetReview(); }}
                    placeholder="Search clubs by name" className="min-w-0 w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-secondary)]" />
            </label>
            <button type="button" className={adminButton} disabled={loading || pendingId !== null}
                onClick={() => { resetReview(); setRevision(current => current + 1); }}>Refresh clubs</button>
        </div>
        {success && <p role="status" className="rounded-xl border border-[color:var(--color-accent)]/20 bg-[color:var(--color-accent)]/10 p-4 text-sm text-[color:var(--color-accent)]">{success}</p>}
        {actionError && <p role="alert" className="rounded-xl border border-[color:var(--color-danger)]/20 bg-[color:var(--color-danger)]/10 p-4 text-sm text-[color:var(--color-danger)]">{actionError}</p>}
        {loadError && <div role="alert" className="rounded-xl border border-[color:var(--color-danger)]/20 bg-[color:var(--color-danger)]/10 p-4 text-sm text-[color:var(--color-danger)]">
            <p>{loadError}</p><button type="button" className={`${adminButton} mt-3`} onClick={() => setRevision(current => current + 1)}>Retry club list</button>
        </div>}
        {loading ? <p role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--color-secondary)]"><Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />Loading clubs…</p>
            : result && <>
                <p className="text-sm text-[var(--color-secondary)]">{result.totalElements} {result.totalElements === 1 ? 'club' : 'clubs'} found</p>
                {result.content.length === 0 ? <p className="rounded-xl border border-[color:var(--color-border)] p-8 text-center text-sm text-[var(--color-secondary)]">{query.trim() ? 'No clubs matched this search.' : 'No clubs are available to review.'}</p>
                    : <div className="grid gap-4">{result.content.map(club => <article key={club.id} aria-labelledby={`admin-club-${club.id}`} className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-4 md:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                                <h3 id={`admin-club-${club.id}`} className="break-words text-lg font-semibold">{club.name}</h3>
                                <p className="mt-1 text-sm text-[var(--color-secondary)]">{[club.type?.replaceAll('_', ' '), club.cityName, club.countryName].filter(Boolean).join(' · ') || 'Location and club type not provided'}</p>
                                <p className={`mt-2 text-sm font-semibold ${club.isOfficial ? 'text-[color:var(--color-accent)]' : 'text-[color:var(--color-warning)]'}`}>{club.isOfficial ? 'Verified club' : 'Unverified club'}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Link to={`/clubs/${club.id}`} className={adminButton}>View club profile</Link>
                                {!club.isOfficial && <button type="button" className={adminButton} disabled={pendingId !== null}
                                    aria-expanded={reviewingId === club.id} aria-controls={`club-review-${club.id}`}
                                    onClick={() => { resetReview(); setReviewingId(club.id); }}>Review verification</button>}
                            </div>
                        </div>
                        {reviewingId === club.id && !club.isOfficial && <div id={`club-review-${club.id}`} className="mt-4 space-y-3 border-t border-[color:var(--color-border)] pt-4">
                            {club.description && <p className="whitespace-pre-wrap break-words text-sm text-[var(--color-secondary)]">{club.description}</p>}
                            {club.addressText && <p className="text-sm text-[var(--color-secondary)]">{club.addressText}</p>}
                            <p className="text-sm">Confirm that you have reviewed {club.name} and want to mark it as verified. This decision is recorded in the club’s audit history.</p>
                            <div className="flex flex-wrap gap-2">
                                <button type="button" className={`${adminButton} border-[color:var(--color-accent)] bg-[color:var(--color-accent)]`} disabled={pendingId !== null} onClick={() => void verify(club.id)}>
                                    {pendingId === club.id && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}{pendingId === club.id ? 'Verifying…' : 'Confirm verification'}
                                </button>
                                <button type="button" className={adminButton} disabled={pendingId !== null} onClick={resetReview}>Cancel</button>
                            </div>
                        </div>}
                    </article>)}</div>}
                {totalPages > 1 && <nav aria-label="Club pages" className="flex flex-wrap items-center justify-center gap-3">
                    <button type="button" className={adminButton} disabled={page === 0 || pendingId !== null} onClick={() => { resetReview(); setPage(current => current - 1); }}>Previous clubs</button>
                    <span className="text-sm text-[var(--color-secondary)]">Page {page + 1} of {totalPages}</span>
                    <button type="button" className={adminButton} disabled={page + 1 >= totalPages || pendingId !== null} onClick={() => { resetReview(); setPage(current => current + 1); }}>Next clubs</button>
                </nav>}
            </>}
    </section>;
};

const AdminUserDirectory = () => {
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
        <div className="bg-[var(--color-surface)] min-h-[calc(100vh-64px)] text-[var(--color-text)]">
            <div className="flex w-full flex-col gap-6">
                <header className="border-b border-[color:var(--color-border)] pb-6">
                    <h2 className="text-xl font-semibold">User directory</h2>

                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                        <div className="bg-[var(--color-surface)] border border-[color:var(--color-border)] rounded-xl px-4 py-4">
                            <p className="text-[11px] font-semibold text-[var(--color-secondary)]">Visible Users</p>
                            <p className="mt-3 text-3xl font-semibold text-[var(--color-text)]">{totalElements}</p>
                        </div>
                        <div className="bg-[var(--color-surface)] border border-[color:var(--color-border)] rounded-xl px-4 py-4">
                            <p className="text-[11px] font-semibold text-[var(--color-secondary)]">Email Verified In View</p>
                            <p className="mt-3 text-3xl font-semibold text-[var(--color-text)]">{visibleStats.verified}</p>
                        </div>
                        <div className="bg-[var(--color-surface)] border border-[color:var(--color-border)] rounded-xl px-4 py-4">
                            <p className="text-[11px] font-semibold text-[var(--color-secondary)]">Club Linked In View</p>
                            <p className="mt-3 text-3xl font-semibold text-[var(--color-text)]">{visibleStats.clubLinked}</p>
                        </div>
                    </div>

                    <div className="mt-5">
                        <label className="flex items-center gap-3 rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface)] px-4 py-3 focus-within:border-[var(--color-accent)]">
                            <Search className="h-4 w-4 text-[var(--color-secondary)]" />
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search by name, username, or email"
                                className="w-full bg-transparent text-sm font-medium text-[var(--color-text)] outline-none placeholder:text-[var(--color-secondary)]"
                            />
                        </label>
                    </div>

                    {errorMessage && (
                        <div className="mt-4 rounded-xl border border-[color:var(--color-danger)]/20 bg-[color:var(--color-danger)]/10 px-4 py-3 text-sm font-medium text-[color:var(--color-danger)]">
                            {errorMessage}
                        </div>
                    )}
                </header>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-accent)]" />
                    </div>
                ) : users.length === 0 ? (
                    <section className="bg-[var(--color-surface)] border border-[color:var(--color-border)] rounded-xl px-6 py-16 text-center">
                        <UsersRound className="mx-auto h-10 w-10 text-[var(--color-secondary)]" />
                        <h2 className="mt-4 text-xl font-semibold text-[var(--color-text)]">
                            {query.trim() ? 'No users matched this search' : 'No users available'}
                        </h2>
                        <p className="mt-2 text-sm text-[var(--color-secondary)]">
                            {query.trim()
                                ? 'Try a broader name, username, or email search.'
                                : 'This environment does not currently expose any user records.'}
                        </p>
                    </section>
                ) : (
                    <section className="grid gap-4">
                        {users.map((user) => (
                            <article key={user.id} className="bg-[var(--color-surface)] border border-[color:var(--color-border)] rounded-xl px-5 py-5">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="text-lg font-semibold text-[var(--color-text)]">{user.displayName}</h2>
                                            <span className={`rounded-xl border px-3 py-1 text-[10px] font-semibold ${roleTone(user.role)}`}>
                                                {user.role}
                                            </span>
                                            <span className={`rounded-xl border px-3 py-1 text-[10px] font-semibold ${user.emailVerified ? 'border-[color:var(--color-accent)]/20 text-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10' : 'border-[color:var(--color-warning)]/20 text-[color:var(--color-warning)] bg-[color:var(--color-warning)]/10'}`}>
                                                {user.emailVerified ? 'Email verified' : 'Email unverified'}
                                            </span>
                                            <span className={`rounded-xl border px-3 py-1 text-[10px] font-semibold ${user.profileComplete ? 'border-[color:var(--color-info)]/20 text-[color:var(--color-info)] bg-[color:var(--color-info)]/10' : 'border-[color:var(--color-border)] text-[var(--color-secondary)]'}`}>
                                                {user.profileComplete ? 'Profile Ready' : 'Profile Partial'}
                                            </span>
                                        </div>

                                        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                            <div>
                                                <p className="text-[11px] font-semibold text-[var(--color-secondary)]">Username</p>
                                                <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">{user.username}</p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-semibold text-[var(--color-secondary)]">Email</p>
                                                <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">{user.email}</p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-semibold text-[var(--color-secondary)]">Club Affiliation</p>
                                                <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">
                                                    {user.clubName ? `${user.clubName} (${user.clubRole || 'Member'})` : 'No active club affiliation'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-semibold text-[var(--color-secondary)]">Password Sign-In</p>
                                                <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">
                                                    {user.passwordLoginEnabled ? 'Configured' : 'Provider only'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 lg:justify-end">
                                        <Link
                                            to={`/profile/${user.id}`}
                                            className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--color-border)] px-4 py-2 text-[11px] font-semibold text-[var(--color-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                                        >
                                            <ShieldCheck className="h-3.5 w-3.5" />
                                            Public Profile
                                        </Link>
                                        {user.clubId ? (
                                            <Link
                                                to={`/clubs/${user.clubId}`}
                                                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-[11px] font-semibold text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent)]"
                                            >
                                                <ShieldEllipsis className="h-3.5 w-3.5" />
                                                Open Club
                                            </Link>
                                        ) : (
                                            <span className="inline-flex items-center rounded-xl border border-dashed border-[color:var(--color-border)] px-4 py-2 text-[11px] font-semibold text-[var(--color-secondary)]">
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
                            className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--color-border)] px-4 py-2 text-[11px] font-semibold text-[var(--color-secondary)] transition-colors hover:text-[var(--color-accent)] disabled:cursor-wait disabled:opacity-60"
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
