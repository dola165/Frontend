import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    LayoutGrid,
    LayoutList,
    Loader2,
    RotateCcw,
    Search,
    Sparkles,
    Trophy,
    X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { extractApiErrorMessage } from '../utils/apiError';
import { fetchTournaments, registerPlayer } from '../features/tournaments/api';
import { PaginationBar } from '../components/ui/PaginationBar';
import { TournamentCard } from '../components/tournaments/TournamentCard';
import { TournamentListCard } from '../components/tournaments/TournamentListCard';
import type { TournamentSummary } from '../features/tournaments/domain';
import { useAuth } from '../context/AuthContext';
import { buildLoginRedirectPath } from '../utils/authRedirect';

const inputClass = 'w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 hover:border-white/[0.14] focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/10';
const selectClass = 'min-w-40 rounded-xl border border-white/[0.08] bg-[#111418] px-4 py-3 text-sm font-medium text-zinc-200 outline-none transition hover:border-white/[0.14] focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/10';

export const BrowseTournamentsPage = () => {
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth();
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

    const canCreateTournament = isAuthenticated && ['ORGANIZER', 'ADMIN'].includes(user?.role ?? '');

    const showMessage = (text: string, type: 'success' | 'error') => {
        setMessage(text);
        setMessageType(type);
        window.setTimeout(() => setMessage(null), 4000);
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
            setError(extractApiErrorMessage(err, t('tournaments.public.browseLoadFailed')));
            setTournaments([]);
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, scopeFilter, statusFilter, t]);

    useEffect(() => {
        void loadTournaments();
    }, [loadTournaments]);

    useEffect(() => {
        try {
            localStorage.setItem('tournament-view-mode', viewMode);
        } catch {
            // localStorage can be unavailable in privacy-restricted browsers.
        }
    }, [viewMode]);

    const handleRegister = async (tournamentId: number) => {
        if (!isAuthenticated) {
            navigate(buildLoginRedirectPath(window.location.pathname));
            return;
        }
        if (registeringId != null) return;
        setRegisteringId(tournamentId);
        try {
            await registerPlayer(tournamentId);
            setRegisteredIds((previous) => new Set(previous).add(tournamentId));
            showMessage(t('tournaments.public.registrationSuccess'), 'success');
        } catch (err) {
            showMessage(extractApiErrorMessage(err, t('tournaments.public.registrationFailed')), 'error');
        } finally {
            setRegisteringId(null);
        }
    };

    const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
    const displayTournaments = normalizedSearch
        ? tournaments.filter((tournament) =>
            [tournament.name, tournament.description, tournament.hostClubName, tournament.organizerName]
                .filter(Boolean)
                .some((value) => value!.toLocaleLowerCase().includes(normalizedSearch)))
        : tournaments;

    const hasActiveFilters = Boolean(searchQuery || scopeFilter || statusFilter);
    const clearFilters = () => {
        setSearchQuery('');
        setScopeFilter('');
        setStatusFilter('');
        setPage(0);
    };

    return (
        <div className="min-h-full bg-[#0d1014] text-zinc-100 selection:bg-emerald-400/20">
            <div className="flex w-full flex-col gap-6 pb-8">
                <section className="relative isolate overflow-hidden rounded-3xl border border-white/[0.07] bg-[#121a16] px-6 py-7 shadow-[0_24px_70px_rgba(0,0,0,0.18)] sm:px-8 sm:py-9 lg:px-10">
                    <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_82%_18%,rgba(39,189,104,0.20),transparent_27%),radial-gradient(circle_at_8%_110%,rgba(50,111,83,0.28),transparent_34%)]" />
                    <div className="absolute -right-16 top-1/2 -z-10 h-72 w-72 -translate-y-1/2 rounded-full border border-white/[0.06]" />
                    <div className="absolute right-20 top-1/2 -z-10 h-px w-72 -translate-y-1/2 bg-white/[0.06]" />
                    <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl">
                            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
                                <Sparkles className="h-3.5 w-3.5" />
                                {t('tournaments.public.competitionHub')}
                            </p>
                            <h1 className="mt-3 text-3xl font-bold tracking-[-0.035em] text-white sm:text-4xl">
                                {t('tournaments.public.browseTitle')}
                            </h1>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                                {t('tournaments.public.browseDescription')}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3 backdrop-blur-sm">
                                <p className="text-2xl font-bold text-white">{loading ? '—' : totalElements}</p>
                                <p className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                                    {t('tournaments.public.availableCompetitions')}
                                </p>
                            </div>
                            {canCreateTournament ? (
                                <Link
                                    to="/tournaments/setup"
                                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-xl shadow-emerald-950/30 transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                                >
                                    <Trophy className="h-4 w-4" />
                                    {t('tournaments.public.createTournament')}
                                </Link>
                            ) : null}
                        </div>
                    </div>
                </section>

                {message ? (
                    <div
                        role={messageType === 'error' ? 'alert' : 'status'}
                        className={`rounded-xl border px-4 py-3 text-sm font-semibold ${messageType === 'success'
                            ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                            : 'border-rose-400/20 bg-rose-400/10 text-rose-300'}`}
                    >
                        {message}
                    </div>
                ) : null}

                <section aria-label={t('tournaments.public.filters')} className="rounded-2xl border border-white/[0.07] bg-[#15181c] p-4 sm:p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                        <div className="relative min-w-0 flex-1 lg:max-w-xl">
                            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                            <input
                                type="search"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder={t('tournaments.public.searchPlaceholder')}
                                aria-label={t('tournaments.public.searchLabel')}
                                className={`${inputClass} pl-11`}
                            />
                        </div>
                        <select
                            value={scopeFilter}
                            aria-label={t('tournaments.public.scopeFilter')}
                            onChange={(event) => { setScopeFilter(event.target.value); setPage(0); }}
                            className={selectClass}
                        >
                            <option value="">{t('tournaments.public.allScopes')}</option>
                            <option value="PLAYER">{t('tournaments.public.scope.player')}</option>
                            <option value="CLUB">{t('tournaments.public.scope.club')}</option>
                            <option value="SQUAD">{t('tournaments.public.scope.squad')}</option>
                        </select>
                        <select
                            value={statusFilter}
                            aria-label={t('tournaments.public.statusFilter')}
                            onChange={(event) => { setStatusFilter(event.target.value); setPage(0); }}
                            className={selectClass}
                        >
                            <option value="">{t('tournaments.public.allStatuses')}</option>
                            <option value="PLANNING">{t('tournaments.public.status.planning')}</option>
                            <option value="ACTIVE">{t('tournaments.public.status.active')}</option>
                            <option value="COMPLETED">{t('tournaments.public.status.completed')}</option>
                            <option value="CANCELLED">{t('tournaments.public.status.cancelled')}</option>
                        </select>
                        <div className="flex w-fit shrink-0 rounded-xl border border-white/[0.08] bg-black/20 p-1 lg:ml-auto" role="group" aria-label={t('tournaments.public.viewMode')}>
                            <button
                                type="button"
                                onClick={() => setViewMode('list')}
                                aria-label={t('tournaments.public.listView')}
                                aria-pressed={viewMode === 'list'}
                                className={`inline-flex h-9 w-10 items-center justify-center rounded-lg transition ${viewMode === 'list' ? 'bg-white/[0.09] text-white' : 'text-zinc-500 hover:text-zinc-200'}`}
                            >
                                <LayoutList className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('grid')}
                                aria-label={t('tournaments.public.gridView')}
                                aria-pressed={viewMode === 'grid'}
                                className={`inline-flex h-9 w-10 items-center justify-center rounded-lg transition ${viewMode === 'grid' ? 'bg-white/[0.09] text-white' : 'text-zinc-500 hover:text-zinc-200'}`}
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {hasActiveFilters ? (
                        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-4">
                            <span className="mr-1 text-xs font-semibold text-zinc-500">{t('tournaments.public.activeFilters')}</span>
                            {searchQuery ? (
                                <button type="button" onClick={() => setSearchQuery('')} className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300 hover:border-white/[0.16]">
                                    {t('tournaments.public.searchChip', { query: searchQuery })}<X className="h-3 w-3" />
                                </button>
                            ) : null}
                            {scopeFilter ? (
                                <button type="button" onClick={() => { setScopeFilter(''); setPage(0); }} className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300 hover:border-white/[0.16]">
                                    {t(`tournaments.public.scope.${scopeFilter.toLowerCase()}`)}<X className="h-3 w-3" />
                                </button>
                            ) : null}
                            {statusFilter ? (
                                <button type="button" onClick={() => { setStatusFilter(''); setPage(0); }} className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300 hover:border-white/[0.16]">
                                    {t(`tournaments.public.status.${statusFilter.toLowerCase()}`)}<X className="h-3 w-3" />
                                </button>
                            ) : null}
                            <button type="button" onClick={clearFilters} className="ml-auto text-xs font-bold text-emerald-300 hover:text-emerald-200">
                                {t('tournaments.public.clearAll')}
                            </button>
                        </div>
                    ) : null}
                </section>

                {error ? (
                    <div role="alert" className="flex flex-col gap-4 rounded-2xl border border-rose-400/20 bg-rose-400/[0.07] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm font-bold text-rose-200">{t('tournaments.public.unableToLoad')}</p>
                            <p className="mt-1 text-sm text-rose-200/70">{error}</p>
                        </div>
                        <button type="button" onClick={() => void loadTournaments()} className="inline-flex w-fit items-center gap-2 rounded-xl border border-rose-300/20 px-4 py-2 text-sm font-bold text-rose-100 transition hover:bg-rose-300/10">
                            <RotateCcw className="h-4 w-4" />
                            {t('tournaments.public.tryAgain')}
                        </button>
                    </div>
                ) : null}

                {!error ? (
                    <section aria-labelledby="tournament-results-heading">
                        <div className="mb-4 flex items-end justify-between gap-4">
                            <div>
                                <h2 id="tournament-results-heading" className="text-lg font-bold text-zinc-100">{t('tournaments.public.results')}</h2>
                                <p className="mt-1 text-xs text-zinc-500" aria-live="polite">
                                    {loading
                                        ? t('tournaments.public.loadingCompetitions')
                                        : t('tournaments.public.showingResults', { shown: displayTournaments.length, total: totalElements })}
                                </p>
                            </div>
                        </div>

                        {loading ? (
                            <div className="grid gap-4" aria-label={t('tournaments.public.loadingCompetitions')}>
                                <Loader2 className="sr-only animate-spin" />
                                {[0, 1, 2].map((item) => (
                                    <div key={item} className="grid animate-pulse overflow-hidden rounded-2xl border border-white/[0.06] bg-[#15181c] md:grid-cols-[220px_1fr_190px]">
                                        <div className="h-44 bg-white/[0.04]" />
                                        <div className="space-y-3 p-6">
                                            <div className="h-3 w-28 rounded bg-white/[0.06]" />
                                            <div className="h-5 w-2/5 rounded bg-white/[0.08]" />
                                            <div className="h-3 w-3/4 rounded bg-white/[0.05]" />
                                        </div>
                                        <div className="hidden border-l border-white/[0.05] p-6 md:block"><div className="h-9 rounded-xl bg-white/[0.06]" /></div>
                                    </div>
                                ))}
                            </div>
                        ) : displayTournaments.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.1] bg-[#15181c] px-6 py-16 text-center">
                                <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-zinc-500">
                                    <Trophy className="h-7 w-7" />
                                </span>
                                <p className="mt-5 text-lg font-bold text-zinc-100">{t('tournaments.public.noTournamentsFound')}</p>
                                <p className="mt-2 max-w-md text-sm text-zinc-500">
                                    {hasActiveFilters ? t('tournaments.public.emptyFiltered') : t('tournaments.public.emptyDefault')}
                                </p>
                                {hasActiveFilters ? (
                                    <button type="button" onClick={clearFilters} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-500">
                                        <RotateCcw className="h-4 w-4" />
                                        {t('browseTournaments.emptyCtaClear')}
                                    </button>
                                ) : canCreateTournament ? (
                                    <Link to="/tournaments/setup" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-500">
                                        <Trophy className="h-4 w-4" />
                                        {t('browseTournaments.emptyCtaCreate')}
                                    </Link>
                                ) : null}
                            </div>
                        ) : (
                            <>
                                <div className={viewMode === 'grid' ? 'grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 min-[2200px]:grid-cols-5' : 'flex flex-col gap-4'}>
                                    {displayTournaments.map((tournament) => viewMode === 'grid' ? (
                                        <TournamentCard
                                            key={tournament.id}
                                            tournament={tournament}
                                            isRegistered={registeredIds.has(tournament.id)}
                                            isRegistering={registeringId === tournament.id}
                                            onRegister={handleRegister}
                                        />
                                    ) : (
                                        <TournamentListCard
                                            key={tournament.id}
                                            tournament={tournament}
                                            isRegistered={registeredIds.has(tournament.id)}
                                            isRegistering={registeringId === tournament.id}
                                            onRegister={handleRegister}
                                        />
                                    ))}
                                </div>
                                <PaginationBar
                                    page={page}
                                    totalPages={totalPages}
                                    totalElements={totalElements}
                                    pageSize={pageSize}
                                    onPageChange={setPage}
                                    onPageSizeChange={(size) => { setPageSize(size); setPage(0); }}
                                />
                            </>
                        )}
                    </section>
                ) : null}
            </div>
        </div>
    );
};
