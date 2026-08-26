import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LayoutGrid, LayoutList, Loader2, Search, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { extractApiErrorMessage } from '../utils/apiError';
import { fetchTournaments, registerPlayer } from '../features/tournaments/api';
import { PaginationBar } from '../components/ui/PaginationBar';
import { TournamentCard } from '../components/tournaments/TournamentCard';
import { TournamentListCard } from '../components/tournaments/TournamentListCard';
import type { TournamentSummary } from '../features/tournaments/domain';
import { useAuth } from '../context/AuthContext';
import { buildLoginRedirectPath } from '../utils/authRedirect';

const inputClass = 'w-full rounded-xl border border-[#ffffff0d] bg-[#16181d] px-4 py-3 text-sm text-[#f4f4f5] outline-none transition-colors placeholder:text-[#a1a1aa] focus:ring-1 focus:ring-[#16a34a]';
const selectClass = 'rounded-xl border border-[#ffffff0d] bg-[#16181d] px-4 py-3 text-sm font-medium text-[#f4f4f5] outline-none transition-colors focus:ring-1 focus:ring-[#16a34a]';

export const BrowseTournamentsPage = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const { t } = useTranslation();
    const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(12);
    const [totalPages, setTotalPages] = useState(1);
    const [totalElements, setTotalElements] = useState(0);
    const [scopeFilter, setScopeFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [registeringId, setRegisteringId] = useState<number | null>(null);
    const [registeredIds, setRegisteredIds] = useState<Set<number>>(new Set());
    const [message, setMessage] = useState<string | null>(null);
    const [messageType, setMessageType] = useState<'success' | 'error'>('success');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
        try {
            return (localStorage.getItem('tournament-view-mode') as 'list' | 'grid') || 'list';
        } catch {
            return 'list';
        }
    });

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
            setTotalElements(result.totalElements);
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

    useEffect(() => {
        try {
            localStorage.setItem('tournament-view-mode', viewMode);
        } catch {
            /* noop — localStorage may be unavailable */
        }
    }, [viewMode]);

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

    const hasActiveFilters = Boolean(searchQuery || scopeFilter || statusFilter);

    const clearFilters = () => {
        setSearchQuery('');
        setScopeFilter('');
        setStatusFilter('');
        setPage(0);
    };

    return (
        <div className="min-h-full bg-[#0f1117] text-[#f4f4f5] selection:bg-[#16a34a]/20">
            <div className="mx-auto flex w-full flex-col gap-6 px-6 py-6 sm:px-8">
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

                    {/* View toggle */}
                    <div className="ml-auto flex rounded-xl border border-[#ffffff0d] bg-[#16181d] p-0.5">
                        <button
                            type="button"
                            onClick={() => setViewMode('list')}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                                viewMode === 'list'
                                    ? 'bg-[#16a34a] text-white'
                                    : 'text-[#a1a1aa] hover:text-[#f4f4f5]'
                            }`}
                            aria-label="List view"
                        >
                            <LayoutList className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('grid')}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                                viewMode === 'grid'
                                    ? 'bg-[#16a34a] text-white'
                                    : 'text-[#a1a1aa] hover:text-[#f4f4f5]'
                            }`}
                            aria-label="Grid view"
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </button>
                    </div>
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
                            {hasActiveFilters
                                ? 'Try adjusting your filters.'
                                : 'No tournaments have been created yet.'}
                        </p>
                        {hasActiveFilters ? (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#16a34a] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                            >
                                {t('browseTournaments.emptyCtaClear')}
                            </button>
                        ) : (
                            <Link to="/tournaments/setup" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#16a34a] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90">
                                <Trophy className="h-4 w-4" />
                                {t('browseTournaments.emptyCtaCreate')}
                            </Link>
                        )}
                    </div>
                ) : (
                    <>
                        <div className={viewMode === 'grid' ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' : 'flex flex-col gap-4'}>
                            {displayTournaments.map((t) =>
                                viewMode === 'grid' ? (
                                    <TournamentCard
                                        key={t.id}
                                        tournament={t}
                                        isRegistered={registeredIds.has(t.id)}
                                        isRegistering={registeringId === t.id}
                                        onRegister={handleRegister}
                                    />
                                ) : (
                                    <TournamentListCard
                                        key={t.id}
                                        tournament={t}
                                        isRegistered={registeredIds.has(t.id)}
                                        isRegistering={registeringId === t.id}
                                        onRegister={handleRegister}
                                    />
                                )
                            )}
                        </div>

                        <PaginationBar
                            page={page}
                            totalPages={totalPages}
                            totalElements={totalElements}
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
