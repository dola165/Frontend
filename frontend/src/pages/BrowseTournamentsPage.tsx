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
    PLANNING: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    COMPLETED: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const inputClass = 'w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-4 py-3 text-sm text-[#f4f4f5] outline-none transition-colors placeholder:text-[#a1a1aa] focus:ring-1 focus:ring-[#16a34a]';
const selectClass = 'rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-4 py-3 text-sm font-medium text-[#f4f4f5] outline-none transition-colors focus:ring-1 focus:ring-[#16a34a]';

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
        <div className="min-h-full bg-[#0f1117] text-[#f4f4f5] selection:bg-[#16a34a]/20">
            <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm font-medium text-[#16a34a]">Discovery</p>
                        <h1 className="mt-1 text-2xl font-semibold text-[#f4f4f5]">Tournaments</h1>
                        <p className="mt-2 max-w-2xl text-sm text-[#a1a1aa]">
                            Browse and register for tournaments across the platform.
                        </p>
                    </div>
                    <Link to="/tournaments/setup" className="shrink-0 rounded-xl bg-[#16a34a] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity inline-flex items-center gap-2">
                        <Trophy className="h-4 w-4" />
                        Create Tournament
                    </Link>
                </div>

                {/* Toast */}
                {message && (
                    <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                        messageType === 'success'
                            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                            : 'border-red-500/20 bg-red-500/10 text-red-400'
                    }`}>
                        {message}
                    </div>
                )}

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative min-w-0 flex-1 lg:max-w-sm">
                        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a1a1aa]" />
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
                </div>

                {/* Error */}
                {error && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-400">
                        {error}
                    </div>
                )}

                {/* Content */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-[#16a34a]" />
                    </div>
                ) : displayTournaments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <Trophy className="mb-4 h-12 w-12 text-[#a1a1aa]" />
                        <p className="text-lg font-semibold text-[#f4f4f5]">No tournaments found</p>
                        <p className="mt-2 text-sm text-[#a1a1aa]">
                            {searchQuery || scopeFilter || statusFilter
                                ? 'Try adjusting your filters.'
                                : 'No tournaments have been created yet.'}
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
                                    className="group flex flex-col rounded-xl border border-[#ffffff0d] bg-[#16181d] p-5 transition-all hover:border-[#16a34a]"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#ffffff0d] bg-[var(--fc-surface-hover)] text-[#16a34a]">
                                            <Trophy className="h-5 w-5" />
                                        </div>
                                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone[t.status] ?? statusTone.COMPLETED}`}>
                                            {t.status}
                                        </span>
                                    </div>

                                    <h3 className="mt-4 text-base font-semibold text-[#f4f4f5] group-hover:text-[#16a34a] transition-colors">
                                        {t.name}
                                    </h3>

                                    {t.description && (
                                        <p className="mt-2 line-clamp-2 text-sm text-[#a1a1aa]">
                                            {t.description}
                                        </p>
                                    )}

                                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#a1a1aa]">
                                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--fc-surface-hover)] px-2.5 py-1">
                                            {t.participantScope === 'PLAYER' ? <UserPlus className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                                            {tournamentScopeLabel(t.participantScope)}
                                        </span>
                                        <span className="rounded-full bg-[var(--fc-surface-hover)] px-2.5 py-1">
                                            {tournamentVisibilityLabel(t.visibility)}
                                        </span>
                                        {t.entryCount > 0 && (
                                            <span className="rounded-full bg-[var(--fc-surface-hover)] px-2.5 py-1">
                                                {t.entryCount} entries
                                            </span>
                                        )}
                                    </div>

                                    {t.hostClubName && (
                                        <p className="mt-3 text-xs text-[#a1a1aa]">
                                            Hosted by {t.hostClubName}
                                        </p>
                                    )}

                                    {t.startDate && (
                                        <div className="mt-3 flex items-center gap-1.5 text-xs text-[#a1a1aa]">
                                            <Calendar className="h-3.5 w-3.5" />
                                            <span>{new Date(t.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                            {t.endDate && (
                                                <span>— {new Date(t.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                            )}
                                        </div>
                                    )}

                                    <div className="mt-5 flex items-center gap-2 pt-3">
                                        <span className="flex-1 text-sm font-medium text-[#16a34a] group-hover:underline">
                                            View Event
                                            <ArrowRight className="ml-1.5 inline-block h-4 w-4" />
                                        </span>
                                        {t.participantScope === 'PLAYER' && t.status === 'PLANNING' && (
                                            registeredIds.has(t.id) ? (
                                                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-400">
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
                                                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#16a34a] px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
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
