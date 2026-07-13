import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Calendar, Check, Loader2, Search, Trophy, UserPlus, Users } from 'lucide-react';
import { extractApiErrorMessage } from '../utils/apiError';
import { fetchTournaments, registerPlayer } from '../features/tournaments/api';
import { PaginationBar } from '../components/ui/PaginationBar';
import type { TournamentSummary } from '../features/tournaments/domain';
import { tournamentScopeLabel, tournamentVisibilityLabel } from '../features/tournaments/domain';
import { useAuth } from '../context/AuthContext';
import { buildLoginRedirectPath } from '../utils/authRedirect';

const statusTone: Record<string, string> = {
    PLANNING: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30',
    ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
    COMPLETED: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/30',
    CANCELLED: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30',
};

const inputClass = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#00c853] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-[#00c853]';
const selectClass = 'rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-[#00c853] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-[#00c853]';

export const BrowseTournamentsPage = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(12);
    const [totalPages, setTotalPages] = useState(1);
    const [scopeFilter, setScopeFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [registeringId, setRegisteringId] = useState<number | null>(null);
    const [registeredIds, setRegisteredIds] = useState<Set<number>>(new Set());
    const [message, setMessage] = useState<string | null>(null);
    const [messageType, setMessageType] = useState<'success' | 'error'>('success');

    const showMessage = (text: string, type: 'success' | 'error') => {
        setMessage(text);
        setMessageType(type);
        setTimeout(() => setMessage(null), 4000);
    };

    const loadTournaments = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params: Record<string, string> = { page: String(page), size: String(pageSize) };
            if (scopeFilter) params.scope = scopeFilter;
            if (statusFilter) params.status = statusFilter;
            const result = await fetchTournaments(params);
            setTournaments(result.content);
            setTotalPages(result.totalPages);
        } catch (err) {
            setError(extractApiErrorMessage(err, 'Failed to load events.'));
            setTournaments([]);
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, scopeFilter, statusFilter]);

    useEffect(() => {
        void loadTournaments();
    }, [loadTournaments]);

    const handleRegister = async (tournamentId: number) => {
        if (!isAuthenticated) {
            navigate(buildLoginRedirectPath(window.location.pathname));
            return;
        }
        setRegisteringId(tournamentId);
        try {
            await registerPlayer(tournamentId);
            setRegisteredIds((prev) => new Set(prev).add(tournamentId));
            showMessage('Successfully registered for the event.', 'success');
        } catch (err) {
            showMessage(extractApiErrorMessage(err, 'Failed to register.'), 'error');
        } finally {
            setRegisteringId(null);
        }
    };

    const displayTournaments = searchQuery
        ? tournaments.filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : tournaments;

    return (
        <div className="min-h-full bg-[#f2f4f7] font-sans text-slate-950 selection:bg-[#00c853]/20 dark:bg-slate-950 dark:text-slate-100 dark:selection:bg-[#00c853]/30">
            <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
                {/* Header */}
                <div>
                    <p className="text-sm font-semibold text-[#00c853]">Discovery</p>
                    <h1 className="mt-1 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl dark:text-white">
                        Events
                    </h1>
                    <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
                        Browse and register for events across the platform.
                    </p>
                </div>

                {/* Toast */}
                {message && (
                    <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                        messageType === 'success'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                            : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300'
                    }`}>
                        {message}
                    </div>
                )}

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative min-w-0 flex-1 lg:max-w-sm">
                        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search events..."
                            className={`${inputClass} pl-11`}
                        />
                    </div>
                    <select value={scopeFilter} onChange={(e) => { setScopeFilter(e.target.value); setPage(0); }} className={selectClass}>
                        <option value="">All Scopes</option>
                        <option value="PLAYER">Player</option>
                        <option value="CLUB">Club</option>
                        <option value="SQUAD">Squad</option>
                    </select>
                    <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} className={selectClass}>
                        <option value="">All Statuses</option>
                        <option value="PLANNING">Planning</option>
                        <option value="ACTIVE">Active</option>
                        <option value="COMPLETED">Completed</option>
                    </select>
                    {isAuthenticated && (
                        <Link
                            to="/tournaments/setup"
                            className="inline-flex items-center gap-2 rounded-full bg-[#00c853] px-5 py-3 text-sm font-semibold text-black transition-colors hover:bg-[#00e676]"
                        >
                            <Trophy className="h-4 w-4" />
                            Create Event
                        </Link>
                    )}
                </div>

                {/* Error */}
                {error && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                        {error}
                    </div>
                )}

                {/* Content */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-[#00c853]" />
                    </div>
                ) : displayTournaments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <Trophy className="mb-4 h-12 w-12 text-slate-300 dark:text-slate-600" />
                        <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">No events found</p>
                        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                            {searchQuery || scopeFilter || statusFilter
                                ? 'Try adjusting your filters.'
                                : 'No events have been created yet.'}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Grid of cards */}
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {displayTournaments.map((t) => (
                                <Link
                                    key={t.id}
                                    to={`/tournaments/${t.id}`}
                                    className="group flex flex-col rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-[#1f6feb] hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-[#4c8dff]"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-[#f2f4f7] text-[#00c853] dark:border-slate-700 dark:bg-slate-800 dark:text-[#00c853]">
                                            <Trophy className="h-5 w-5" />
                                        </div>
                                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone[t.status] ?? statusTone.COMPLETED}`}>
                                            {t.status}
                                        </span>
                                    </div>

                                    <h3 className="mt-4 text-base font-semibold text-slate-950 group-hover:text-[#00c853] dark:text-white dark:group-hover:text-[#00c853]">
                                        {t.name}
                                    </h3>

                                    {t.description && (
                                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                            {t.description}
                                        </p>
                                    )}

                                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                                            {t.participantScope === 'PLAYER' ? <UserPlus className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                                            {tournamentScopeLabel(t.participantScope)}
                                        </span>
                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                                            {tournamentVisibilityLabel(t.visibility)}
                                        </span>
                                        {t.entryCount > 0 && (
                                            <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                                                {t.entryCount} entries
                                            </span>
                                        )}
                                    </div>

                                    {t.hostClubName && (
                                        <p className="mt-3 text-xs font-medium text-slate-400 dark:text-slate-500">
                                            Hosted by {t.hostClubName}
                                        </p>
                                    )}

                                    {t.startDate && (
                                        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                            <Calendar className="h-3.5 w-3.5" />
                                            <span>{new Date(t.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                            {t.endDate && (
                                                <span>— {new Date(t.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                            )}
                                        </div>
                                    )}

                                    <div className="mt-5 flex items-center gap-2 pt-3">
                                        <span className="flex-1 text-sm font-semibold text-[#00c853] group-hover:underline dark:text-[#00c853]">
                                            View Event
                                            <ArrowRight className="ml-1.5 inline-block h-4 w-4" />
                                        </span>
                                        {t.participantScope === 'PLAYER' && t.status === 'PLANNING' && (
                                            registeredIds.has(t.id) ? (
                                                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                                                    <Check className="h-3.5 w-3.5" />
                                                    Registered
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleRegister(t.id);
                                                    }}
                                                    disabled={registeringId === t.id}
                                                    className="inline-flex items-center gap-1.5 rounded-full bg-[#00c853] px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-[#00e676] disabled:opacity-60"
                                                >
                                                    {registeringId === t.id ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <UserPlus className="h-3.5 w-3.5" />
                                                    )}
                                                    Register
                                                </button>
                                            )
                                        )}
                                    </div>
                                </Link>
                            ))}
                        </div>

                        <PaginationBar
                            page={page}
                            totalPages={totalPages}
                            totalElements={0}
                            pageSize={pageSize}
                            onPageChange={setPage}
                            onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
                        />
                    </>
                )}
            </div>
        </div>
    );
};
