import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MatchHistoryLink } from '../features/matchHistory/MatchHistoryLink';
import { ResultSummary } from '../features/matchHistory/ResultSummary';
import '../features/matchHistory/match-history.css';
import { isAxiosError } from 'axios';
import {
    ArrowLeft,
    ArrowRight,
    Award,
    Building2,
    CalendarDays,
    Check,
    Clock3,
    Crown,
    Loader2,
    LockKeyhole,
    RotateCcw,
    ShieldCheck,
    Share2,
    RefreshCw,
    Trophy,
    UserPlus,
    UsersRound,
    X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fetchTournament, registerPlayer, requestEntry } from '../features/tournaments/api';
import { VenueReservationSummary } from '../features/eventVenues/VenueReservationSummary';
import type { TournamentDetail, TournamentEntryDto, TournamentTieState } from '../features/tournaments/domain';
import { useAuth } from '../context/AuthContext';
import { buildLoginRedirectPath } from '../utils/authRedirect';
import { extractApiErrorMessage } from '../utils/apiError';
import { apiClient } from '../api/axiosConfig';
import { TournamentBracketBoard } from '../features/tournaments/components/TournamentBracketBoard';
import { StandingsTable } from '../features/tournaments/components/StandingsTable';
import { TournamentSeriesPanel } from '../features/tournamentSeries/TournamentSeriesPanel';
import { ExtensionDemoLabel, ExtensionSurface } from '../features/capabilities/ExtensionBoundary';
import { isExtensionCapabilityAvailable } from '../features/capabilities/extensions';
import { tournamentPublicCopy } from '../locales/tournamentPublic';
import { useDialogFocus } from '../components/workspace/useDialogFocus';
import { TournamentTieBlockerBanner, TournamentTieResolution } from '../features/tournaments/components/TournamentTieResolution';
import './tournament-public.css';
import {
    TournamentIdentity,
    TournamentScopeBadge,
    TournamentStatusBadge,
    TournamentVisual,
} from '../components/tournaments/TournamentPresentation';
import {
    formatTournamentDate,
    formatTournamentDateRange,
    tournamentPolicyText,
    tournamentScopeText,
    tournamentVisibilityText,
} from '../components/tournaments/tournamentFormatters';

const panelClass = 'rounded-2xl border border-white/[0.07] bg-[#15181c] shadow-[0_18px_50px_rgba(0,0,0,0.1)]';

const Section = ({ icon, title, eyebrow, children }: { icon: ReactNode; title: string; eyebrow?: string; children: ReactNode }) => (
    <section className={`${panelClass} p-5 sm:p-6`}>
        <div className="flex items-center gap-3 border-b border-white/[0.06] pb-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-emerald-300">
                {icon}
            </span>
            <div>
                {eyebrow ? <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-600">{eyebrow}</p> : null}
                <h2 className="text-base font-bold text-zinc-100">{title}</h2>
            </div>
        </div>
        <div className="pt-5">{children}</div>
    </section>
);

const publicEntryStatuses = new Set(['APPROVED', 'ACTIVE', 'ELIMINATED', 'COMPLETED']);

const entryDisplayName = (entry: TournamentEntryDto) =>
    entry.squadName ?? entry.clubName ?? entry.displayName ?? 'Participant';

export const TournamentDetailPage = () => {
    const { tournamentId } = useParams<{ tournamentId: string }>();
    const [searchParams] = useSearchParams();
    const requestedFixture = Number(searchParams.get('fixtureId')) || null;
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth();
    const { t, i18n } = useTranslation();
    const [tournament, setTournament] = useState<TournamentDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [registering, setRegistering] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [myClubId, setMyClubId] = useState<number | null>(null);
    const [myClubName, setMyClubName] = useState<string | null>(null);
    const [showEntryModal, setShowEntryModal] = useState(false);
    const [mySquads, setMySquads] = useState<{ id: number; name: string }[]>([]);
    const [selectedSquadId, setSelectedSquadId] = useState('');
    const [entrySubmitting, setEntrySubmitting] = useState(false);
    const [withdrawing, setWithdrawing] = useState(false);
    const [activeTab, setActiveTab] = useState<'bracket' | 'matches' | 'teams' | 'about'>(requestedFixture ? 'matches' : 'bracket');
    const [selectedStageId, setSelectedStageId] = useState<number | null>(null);
    const [matchFilter, setMatchFilter] = useState<'all' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'>('all');
    const [teamSearch, setTeamSearch] = useState('');
    const [shareState, setShareState] = useState<'idle' | 'copied' | 'fallback'>('idle');
    const [refreshing, setRefreshing] = useState(false);
    const [resultsRevision, setResultsRevision] = useState(0);
    const [tieState, setTieState] = useState<TournamentTieState | null>(null);
    const entryDialogRef = useRef<HTMLDivElement>(null);
    useDialogFocus(showEntryModal, entryDialogRef, () => { if (!entrySubmitting) setShowEntryModal(false); });
    const copy = tournamentPublicCopy(i18n.language);
    useEffect(() => {
        if (requestedFixture && tournament && activeTab === 'matches') document.getElementById(`fixture-${requestedFixture}`)?.scrollIntoView?.({ block: 'center' });
    }, [requestedFixture, tournament, activeTab]);

    const id = Number(tournamentId);
    const activeAssignment = tournament?.staffAssignments?.find((assignment) => assignment.userId === user?.id && assignment.status === 'ACTIVE');
    const isStaff = activeAssignment != null;
    const canResolveTies = activeAssignment?.role === 'ADMIN' || activeAssignment?.role === 'STAFF';
    const userEntry = user?.id == null ? undefined : tournament?.entries?.find((entry) =>
        entry.userId === user.id && !['WITHDRAWN', 'REJECTED'].includes(entry.status));
    const isRegistered = userEntry != null;
    const visibleEntries = tournament?.entries?.filter((entry) => publicEntryStatuses.has(entry.status)) ?? [];
    const fixtureCount = tournament?.fixtures?.length ?? 0;
    const scope = tournament?.participantScope;
    const policy = tournament?.registrationPolicy;
    const userClubEntry = myClubId != null ? tournament?.entries?.find((entry) => entry.clubId === myClubId) : undefined;
    const canRegisterPlayer = scope === 'PLAYER' && tournament?.status === 'PLANNING' && isAuthenticated && !isRegistered;
    const canRequestClubEntry = (scope === 'CLUB' || scope === 'SQUAD')
        && tournament?.status === 'PLANNING'
        && isAuthenticated
        && myClubId != null
        && policy !== 'INVITE_ONLY'
        && !userClubEntry;
    const isInviteOnly = policy === 'INVITE_ONLY' && tournament?.status === 'PLANNING';
    const canWithdraw = isRegistered && tournament?.status === 'PLANNING';

    const loadTournament = useCallback(async () => {
        if (!id) {
            setError(t('tournaments.public.invalidTournament'));
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const data = await fetchTournament(id);
            setTournament(data);
        } catch (err) {
            setError(extractApiErrorMessage(err, t('tournaments.public.detailLoadFailed')));
            setTournament(null);
        } finally {
            setLoading(false);
        }
    }, [id, t]);

    useEffect(() => {
        void loadTournament();
    }, [loadTournament]);

    useEffect(() => {
        if (!isAuthenticated) return;
        apiClient.get('/clubs/my-club')
            .then((response) => {
                if (response.data?.clubId) {
                    setMyClubId(response.data.clubId);
                    setMyClubName(response.data.clubName ?? null);
                }
            })
            .catch(() => {
                setMyClubId(null);
                setMyClubName(null);
            });
    }, [isAuthenticated]);

    const refreshTournament = async () => {
        const data = await fetchTournament(id);
        setTournament(data);
        setResultsRevision(current => current + 1);
    };

    const refreshResults = async () => {
        if (refreshing) return;
        setRefreshing(true);
        setMessage(null);
        try {
            await refreshTournament();
            setMessage({ text: copy.refreshed, type: 'success' });
        } catch (err) {
            if (isAxiosError(err) && [401, 403, 404].includes(err.response?.status ?? 0)) {
                setTournament(null);
                setError(extractApiErrorMessage(err, t('tournaments.public.detailLoadFailed')));
            } else setMessage({ text: extractApiErrorMessage(err, copy.refreshFailed), type: 'error' });
        } finally {
            setRefreshing(false);
        }
    };

    const handleRegister = async () => {
        if (!isAuthenticated) {
            navigate(buildLoginRedirectPath(window.location.pathname));
            return;
        }
        if (registering) return;
        setRegistering(true);
        try {
            await registerPlayer(id);
            setMessage({ text: t('tournaments.public.registrationSuccess'), type: 'success' });
            await refreshTournament();
        } catch (err) {
            setMessage({ text: extractApiErrorMessage(err, t('tournaments.public.registrationFailed')), type: 'error' });
        } finally {
            setRegistering(false);
        }
    };

    const openEntryModal = async () => {
        setSelectedSquadId('');
        setMySquads([]);
        setShowEntryModal(true);
        if (!myClubId) return;
        try {
            const response = await apiClient.get<Array<{ id?: number; name?: string }>>(`/clubs/${myClubId}/squads`);
            setMySquads(
                (response.data ?? [])
                    .map((squad) => ({ id: squad.id ?? 0, name: squad.name ?? '—' }))
                    .filter((squad) => squad.id > 0),
            );
        } catch {
            setMySquads([]);
        }
    };

    const handleConfirmEntry = async () => {
        if (!myClubId || entrySubmitting) return;
        setEntrySubmitting(true);
        try {
            await requestEntry(id, {
                clubId: myClubId,
                squadId: selectedSquadId ? Number(selectedSquadId) : null,
            });
            setMessage({ text: t('tournaments.public.entryRequestSuccess'), type: 'success' });
            setShowEntryModal(false);
            await refreshTournament();
        } catch (err) {
            setMessage({ text: extractApiErrorMessage(err, t('tournaments.public.entryRequestFailed')), type: 'error' });
        } finally {
            setEntrySubmitting(false);
        }
    };

    const handleWithdraw = async () => {
        if (!userEntry || withdrawing) return;
        if (!window.confirm(t('tournaments.public.withdrawConfirm'))) return;
        setWithdrawing(true);
        try {
            const response = await apiClient.post<TournamentDetail>(`/tournaments/${id}/entries/${userEntry.id}/withdraw`, {});
            setMessage({ text: t('tournaments.public.withdrawSuccess'), type: 'success' });
            // A successful withdrawal can remove the viewer's last private-tournament entitlement.
            setTournament(response.status === 204 ? null : response.data);
            setError(null);
        } catch (err) {
            setMessage({ text: extractApiErrorMessage(err, t('tournaments.public.withdrawFailed')), type: 'error' });
        } finally {
            setWithdrawing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-full bg-[#0d1014] pb-8" aria-label={t('tournaments.public.loadingTournament')}>
                <Loader2 className="sr-only animate-spin" />
                <div className="animate-pulse overflow-hidden rounded-3xl border border-white/[0.06] bg-[#15181c]">
                    <div className="h-80 bg-white/[0.04] sm:h-96" />
                </div>
                <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="space-y-5">
                        {[0, 1].map((item) => <div key={item} className="h-52 animate-pulse rounded-2xl border border-white/[0.06] bg-[#15181c]" />)}
                    </div>
                    <div className="h-72 animate-pulse rounded-2xl border border-white/[0.06] bg-[#15181c]" />
                </div>
            </div>
        );
    }

    if (error || !tournament) {
        return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-3xl border border-white/[0.07] bg-[#121519] px-6 py-16 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-zinc-500">
                    <Trophy className="h-8 w-8" />
                </span>
                <h1 className="mt-5 text-2xl font-bold text-zinc-100">{!error && message?.type === 'success' ? message.text : t('tournaments.public.notFoundTitle')}</h1>
                {error || message?.type !== 'success' ? (
                    <p className="mt-2 max-w-md text-sm text-zinc-500">{error ?? t('tournaments.public.notFoundDescription')}</p>
                ) : null}
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                    {error ? (
                        <button type="button" onClick={() => void loadTournament()} className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] px-4 py-2.5 text-sm font-bold text-zinc-200 transition hover:bg-white/[0.05]">
                            <RotateCcw className="h-4 w-4" />
                            {t('tournaments.public.tryAgain')}
                        </button>
                    ) : null}
                    <Link to="/tournaments" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-500">
                        <ArrowLeft className="h-4 w-4" />
                        {t('tournaments.public.backToTournaments')}
                    </Link>
                </div>
            </div>
        );
    }

    const dateRange = formatTournamentDateRange(tournament.startDate, tournament.endDate, i18n.language);
    const registrationRange = formatTournamentDateRange(tournament.registrationOpensAt, tournament.registrationClosesAt, i18n.language);
    const organizerName = tournament.organizerName ?? t('tournaments.public.organizerFallback');
    const stages = [...tournament.stages].sort((a, b) => a.stageOrder - b.stageOrder);
    const selectedStage = stages.find((stage) => stage.id === selectedStageId)
        ?? stages.find(stage => stage.id === tournament.fixtures.find(f => f.id === requestedFixture)?.stageId)
        ?? stages.find((stage) => stage.status === 'ACTIVE') ?? stages[0];
    const visibleFixtures = tournament.fixtures
        .filter((fixture) => (!selectedStage || fixture.stageId === selectedStage.id) && (matchFilter === 'all' || fixture.status === matchFilter))
        .sort((a, b) => (a.scheduledAt ?? '9999').localeCompare(b.scheduledAt ?? '9999') || (a.roundNumber ?? 0) - (b.roundNumber ?? 0) || (a.fixtureOrder ?? 0) - (b.fixtureOrder ?? 0));
    const filteredEntries = visibleEntries.filter((entry) => [entry.clubName, entry.squadName, entry.displayName].some((value) => value?.toLocaleLowerCase().includes(teamSearch.trim().toLocaleLowerCase())) || !teamSearch.trim());
    const shareUrl = new URL(`/tournaments/${tournament.id}`, window.location.origin).href;
    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setShareState('copied');
        } catch {
            setShareState('fallback');
        }
    };
    const stageSelector = stages.length > 1 ? (
        <label className="tp-stage">{copy.stage}<select aria-label={copy.stage} value={selectedStage?.id ?? ''} onChange={(event) => setSelectedStageId(Number(event.target.value))}>
            {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
        </select></label>
    ) : null;

    const actionContent = (() => {
        if (isStaff) {
            return (
                <Link to={`/tournaments/${tournament.id}/workspace`} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">
                    <ShieldCheck className="h-4 w-4" />
                    {t('tournaments.public.openWorkspace')}
                    <ArrowRight className="h-4 w-4" />
                </Link>
            );
        }
        if (isRegistered) {
            return (
                <div className="space-y-3">
                    <div className="flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-300">
                        <Check className="h-4 w-4" />
                        {t('tournaments.public.registered')}
                    </div>
                    {canWithdraw ? (
                        <button type="button" onClick={handleWithdraw} disabled={withdrawing} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-2.5 text-sm font-bold text-rose-300 transition hover:bg-rose-400/[0.12] disabled:cursor-wait disabled:opacity-60">
                            {withdrawing ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                            {t('tournaments.public.withdraw')}
                        </button>
                    ) : null}
                </div>
            );
        }
        if (canRegisterPlayer) {
            return (
                <button type="button" onClick={handleRegister} disabled={registering} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-wait disabled:opacity-60">
                    {registering ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                    {registering ? t('tournaments.public.registering') : t('tournaments.public.register')}
                </button>
            );
        }
        if (canRequestClubEntry) {
            return (
                <button type="button" onClick={openEntryModal} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">
                    <Building2 className="h-4 w-4" />
                    {t('tournaments.public.requestEntry')}
                </button>
            );
        }
        if (userClubEntry) {
            return (
                <div className="flex items-center gap-3 rounded-xl border border-sky-400/20 bg-sky-400/[0.08] px-4 py-3 text-sm font-bold text-sky-300">
                    <Clock3 className="h-4 w-4" />
                    {t('tournaments.public.clubEntryStatus', { status: t(`tournaments.public.entryStatus.${userClubEntry.status.toLowerCase()}`) })}
                </div>
            );
        }
        if (!isAuthenticated && tournament.status === 'PLANNING' && !isInviteOnly) {
            return (
                <button type="button" onClick={() => navigate(buildLoginRedirectPath(window.location.pathname))} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">
                    <UserPlus className="h-4 w-4" />
                    {scope === 'PLAYER' ? t('tournaments.public.signInToRegister') : t('tournaments.public.signInToRequest')}
                </button>
            );
        }
        if (isInviteOnly) {
            return (
                <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.07] px-4 py-3">
                    <p className="flex items-center gap-2 text-sm font-bold text-amber-200"><LockKeyhole className="h-4 w-4" />{t('tournaments.public.inviteOnly')}</p>
                    <p className="mt-1.5 text-xs leading-5 text-amber-100/60">{t('tournaments.public.inviteOnlyExplanation')}</p>
                </div>
            );
        }
        if ((scope === 'CLUB' || scope === 'SQUAD') && isAuthenticated && myClubId == null && tournament.status === 'PLANNING') {
            return (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                    <p className="text-sm font-bold text-zinc-300">{t('tournaments.public.clubRequired')}</p>
                    <p className="mt-1.5 text-xs leading-5 text-zinc-500">{t('tournaments.public.clubRequiredExplanation')}</p>
                </div>
            );
        }
        return (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                <p className="text-sm font-bold text-zinc-300">{t('tournaments.public.registrationUnavailable')}</p>
                <p className="mt-1.5 text-xs leading-5 text-zinc-500">{t(`tournaments.public.registrationUnavailableStatus.${tournament.status.toLowerCase()}`)}</p>
            </div>
        );
    })();

    return (
        <div className="tournament-public-page">
            {message ? (
                <div role={message.type === 'error' ? 'alert' : 'status'} className={`mb-5 rounded-xl border px-4 py-3 text-sm font-semibold ${message.type === 'success' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-rose-400/20 bg-rose-400/10 text-rose-300'}`}>
                    {message.text}
                </div>
            ) : null}
            <TournamentVisual name={tournament.name} imageUrl={tournament.bannerImageUrl} className="tp-hero">
                <div className="tp-hero-inner">
                    <div className="tp-hero-top">
                        <Link to="/tournaments"><ArrowLeft size={15} />{t('tournaments.public.backToTournaments')}</Link>
                        <div className="tp-hero-actions"><button type="button" className="tp-share" aria-label={refreshing ? copy.refreshing : copy.refresh} disabled={refreshing} onClick={() => void refreshResults()}><RefreshCw size={15} className={refreshing ? 'animate-spin' : undefined} /><span className="tp-refresh-label">{refreshing ? copy.refreshing : copy.refresh}</span></button><button type="button" className="tp-share" onClick={() => void copyLink()}><Share2 size={15} />{shareState === 'copied' ? copy.copied : copy.share}</button></div>
                    </div>
                    <div>
                        <p className="tp-host"><Building2 size={16} />{copy.host} · {organizerName}</p>
                        <h1 className="tp-title">{tournament.name}</h1>
                        <p className="tp-description">{tournament.description || t('tournaments.public.noDescription')}</p>
                        <div className="tp-hero-meta">
                            <span><CalendarDays size={15} />{dateRange || t('tournaments.public.datesToBeConfirmed')}</span>
                            <span><UsersRound size={15} />{t('tournaments.public.entryCount', { count: visibleEntries.length })}</span>
                            <span>{t('tournaments.public.fixtureCount', { count: fixtureCount })}</span>
                            <TournamentStatusBadge status={tournament.status} />
                            <TournamentScopeBadge scope={tournament.participantScope} />
                        </div>
                    </div>
                </div>
            </TournamentVisual>
            {shareState === 'fallback' ? <label className="tp-share-fallback">{copy.copyFallback}<input readOnly value={shareUrl} onFocus={(event) => event.target.select()} /></label> : null}
            {shareState === 'copied' ? <span role="status" className="sr-only">{copy.copied}</span> : null}
            {tournament.championName ? <div className="tp-champion"><Crown size={30} /><div><small>{t('tournaments.public.champion')}</small><strong>{tournament.championName}</strong></div></div> : null}
            <TournamentTieBlockerBanner state={tieState} tournament={tournament}/>
            <section className="tp-entry-bar" aria-label={copy.registration}>
                <div>
                    <h2>{isStaff ? t('tournaments.public.manageCompetition') : t('tournaments.public.registration')}</h2>
                    <div className="tp-entry-summary">
                        <span>{tournamentPolicyText(tournament.registrationPolicy, t)}</span>
                        <span>{tournamentVisibilityText(tournament.visibility, t)}</span>
                        <span>{t('tournaments.public.registrationWindow')}: {registrationRange || t('tournaments.public.toBeAnnounced')}</span>
                    </div>
                </div>
                <div>{actionContent}</div>
            </section>
            <div className="tp-tabs" role="tablist" aria-label={copy.navigation}>
                {(['bracket', 'matches', 'teams', 'about'] as const).map((tab, index, tabs) => <button
                    key={tab} id={`public-tab-${tab}`} type="button" role="tab" aria-selected={activeTab === tab}
                    aria-controls={`public-panel-${tab}`} tabIndex={activeTab === tab ? 0 : -1}
                    onClick={() => setActiveTab(tab)} onKeyDown={(event) => {
                        let target = index;
                        if (event.key === 'ArrowRight') target = (index + 1) % tabs.length;
                        else if (event.key === 'ArrowLeft') target = (index + tabs.length - 1) % tabs.length;
                        else if (event.key === 'Home') target = 0;
                        else if (event.key === 'End') target = tabs.length - 1;
                        else return;
                        event.preventDefault(); setActiveTab(tabs[target]);
                        document.getElementById(`public-tab-${tabs[target]}`)?.focus();
                    }}
                >{tab === 'bracket' ? copy.competition : copy[tab]}</button>)}
            </div>
            <main className="tp-panel" id={`public-panel-${activeTab}`} role="tabpanel" aria-labelledby={`public-tab-${activeTab}`}>
                {activeTab === 'bracket' ? <>
                    <TournamentTieResolution tournament={tournament} canResolve={canResolveTies && tournament.status === 'ACTIVE'} canAudit={canResolveTies} enabled={isAuthenticated && tournament.status !== 'PLANNING' && tournament.status !== 'CANCELLED'} refreshKey={resultsRevision} onStateChange={setTieState} onResolved={refreshTournament}/>
                    {stages.length !== 1 || selectedStage?.stageType !== 'KNOCKOUT' ? <div className="tp-heading"><div><h2>{selectedStage?.stageType !== 'KNOCKOUT' && selectedStage ? t('tournaments.standings.title') : copy.bracket}</h2><p>{copy.bracketHint}</p></div>{stageSelector}</div> : null}
                    {selectedStage ? <>
                        {selectedStage.stageType === 'KNOCKOUT' ? <TournamentBracketBoard tournament={tournament} stageId={selectedStage.id} /> : null}
                        {selectedStage.stageType !== 'KNOCKOUT' ? <StandingsTable key={selectedStage.id} tournamentId={tournament.id} stageId={selectedStage.id} refreshKey={resultsRevision} entryStatuses={new Map(visibleEntries.map((entry) => [entry.id, entry.status]))} advanceCount={selectedStage.advanceCount} /> : null}
                    </> : tournament.fixtures.length ? <TournamentBracketBoard tournament={tournament} /> : <div className="tp-empty"><Trophy size={28} className="mx-auto mb-3" /><h3>{copy.notDrawn}</h3><p>{copy.notDrawnHint}</p></div>}
                </> : null}
                {activeTab === 'matches' ? <>
                    <div className="tp-heading"><div><h2>{t('tournaments.public.scheduleTitle')}</h2><p>{t('tournaments.public.fixtureCount', { count: visibleFixtures.length })}</p><MatchHistoryLink tournamentId={tournament.id} className="inline-flex items-center gap-2 mt-3" /></div>{stageSelector}</div>
                    <div className="tp-filter" aria-label={copy.matches}>
                        {(['all', 'SCHEDULED', 'COMPLETED', 'CANCELLED'] as const).map((filter) => <button key={filter} type="button" aria-pressed={matchFilter === filter} onClick={() => setMatchFilter(filter)}>{filter === 'all' ? copy.allMatches : filter === 'SCHEDULED' ? copy.upcoming : filter === 'COMPLETED' ? copy.results : copy.cancelled}</button>)}
                    </div>
                    {visibleFixtures.length ? <div className="tp-match-list">{visibleFixtures.map((fixture) => {
                        const kickoff = fixture.scheduledAt ? new Date(fixture.scheduledAt) : null;
                        const kickoffTime = kickoff && !Number.isNaN(kickoff.getTime()) ? kickoff.toLocaleTimeString(i18n.language.startsWith('ka') ? 'ka-GE' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) : null;
                        return <article key={fixture.id} id={`fixture-${fixture.id}`} className="tp-match" style={fixture.id === requestedFixture ? { outline: '2px solid var(--accent-primary, #36b973)', outlineOffset: 3, scrollMarginTop: 100 } : undefined}>
                            <div className="tp-match-date"><p>{formatTournamentDate(fixture.scheduledAt, i18n.language) || t('tournaments.public.kickoffToBeConfirmed')}{kickoffTime ? ` · ${kickoffTime}` : ''}</p><p className="tp-match-round">{fixture.stageName || selectedStage?.name}{fixture.roundNumber != null ? ` · ${copy.round} ${fixture.roundNumber}` : ''}</p></div>
                            <div className="tp-match-teams">
                                <div className="tp-match-team" data-winner={fixture.homeEntryId != null && fixture.winnerEntryId === fixture.homeEntryId}><span>{fixture.homeLabel || t('tournaments.public.toBeDecided')}</span><strong>{fixture.homeScore ?? '–'}</strong></div>
                                <div className="tp-match-team" data-winner={fixture.awayEntryId != null && fixture.winnerEntryId === fixture.awayEntryId}><span>{fixture.awayLabel || t('tournaments.public.toBeDecided')}</span><strong>{fixture.awayScore ?? '–'}</strong></div>
                            </div>
                            <div className="tp-match-state">{fixture.status ? t(`tournaments.workspace.fixtureStatus.${fixture.status.toLowerCase()}`) : t('tournaments.public.fixture')}</div>
                            {fixture.status === 'COMPLETED' && <ResultSummary homeScore={fixture.homeScore} awayScore={fixture.awayScore} status={fixture.homeScore != null && fixture.awayScore != null ? 'RECORDED' : (fixture.homeEntryId != null) !== (fixture.awayEntryId != null) ? 'BYE' : 'NONE'} fixtureStatus={fixture.status} compact />}
                            {isStaff && <Link className="inline-flex items-center gap-1 text-sm" to={`/tournaments/${tournament.id}/workspace?view=schedule&fixtureId=${fixture.id}`}>{i18n.language.startsWith('ka') ? 'მატჩის მართვა' : 'Manage match'} →</Link>}
                            <VenueReservationSummary value={fixture.venueReservation}/>
                        </article>;
                    })}</div> : <div className="tp-empty"><CalendarDays size={26} className="mx-auto mb-3" /><h3>{tournament.fixtures.length ? copy.noMatches : t('tournaments.public.noFixturesTitle')}</h3><p>{t('tournaments.public.noFixturesDescription')}</p></div>}
                </> : null}
                {activeTab === 'teams' ? <>
                    <div className="tp-heading"><div><h2>{copy.teams}</h2><p>{t('tournaments.public.entryCount', { count: visibleEntries.length })}</p></div><input className="tp-search" type="search" aria-label={copy.teamSearch} placeholder={copy.searchHint} value={teamSearch} onChange={(event) => setTeamSearch(event.target.value)} /></div>
                    {filteredEntries.length ? <div className="tp-team-grid">{filteredEntries.map((entry) => {
                        const name = entry.clubName || entryDisplayName(entry);
                        return <article className="tp-team" key={entry.id}>
                            <div className="tp-team-name"><span className="tp-team-crest" aria-hidden="true">{name.slice(0, 2).toLocaleUpperCase()}</span><div><h3>{entry.clubId ? <Link to={`/clubs/${entry.clubId}`}>{name}</Link> : name}</h3><p>{entry.squadName || (entry.clubId == null && entry.userId == null ? copy.guestTeam : copy.participating)}</p></div></div>
                            <div className="tp-team-status">{t(`tournaments.public.entryStatus.${entry.status.toLowerCase()}`)}</div>
                        </article>;
                    })}</div> : <div className="tp-empty"><UsersRound size={26} className="mx-auto mb-3" /><h3>{teamSearch ? copy.noSearch : t('tournaments.public.noEntriesTitle')}</h3>{!teamSearch ? <p>{t('tournaments.public.noEntriesDescription')}</p> : null}</div>}
                </> : null}
                {activeTab === 'about' ? <div className="tp-about-grid">
                    <div className="tp-about-stack">
                        <ExtensionSurface capability="tournamentSeries"><TournamentSeriesPanel tournamentId={tournament.id}/></ExtensionSurface>
                        {isExtensionCapabilityAvailable('volunteerShifts') && <Link to={`/volunteering?tournamentId=${tournament.id}`}>Volunteer at this tournament →<ExtensionDemoLabel capability="volunteerShifts" /></Link>}
                        <Section icon={<Trophy className="h-5 w-5" />} title={t('tournaments.public.aboutTitle')}>
                            <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-400">{tournament.description || t('tournaments.public.noDescriptionLong')}</p>
                        </Section>
                        <Section icon={<ShieldCheck className="h-5 w-5" />} title={t('tournaments.public.rulesTitle')}>
                            <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-400">{tournament.rules || t('tournaments.public.noRules')}</p>
                        </Section>
                        <Section icon={<Award className="h-5 w-5" />} title={t('tournaments.public.prizesTitle')}>
                            <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-400">{tournament.incentives || t('tournaments.public.noPrizes')}</p>
                        </Section>
                    </div>
                    <Section icon={<Building2 className="h-5 w-5" />} title={copy.host}>
                        <p className="text-lg font-bold">{organizerName}</p>
                        <dl className="mt-4 space-y-5 text-xs">
                            {tournament.hostClubName ? <div><dt className="text-zinc-500">{copy.partnerClub}</dt><dd className="mt-1 font-semibold">{tournament.hostClubId ? <Link to={`/clubs/${tournament.hostClubId}`}>{tournament.hostClubName}</Link> : tournament.hostClubName}</dd></div> : null}
                            <div><dt className="text-zinc-500">{copy.venue}</dt><dd className="mt-1 font-semibold">{dateRange || t('tournaments.public.datesToBeConfirmed')}</dd></div>
                            <div><dt className="text-zinc-500">{t('tournaments.public.scopeLabel')}</dt><dd className="mt-1 font-semibold">{tournamentScopeText(tournament.participantScope, t)}</dd></div>
                            <div><dt className="text-zinc-500">{t('tournaments.public.registration')}</dt><dd className="mt-1 font-semibold">{tournamentPolicyText(tournament.registrationPolicy, t)}</dd></div>
                            <div><dt className="text-zinc-500">{t('tournaments.public.registrationWindow')}</dt><dd className="mt-1 font-semibold">{registrationRange || t('tournaments.public.toBeAnnounced')}</dd></div>
                        </dl>
                    </Section>
                </div> : null}
            </main>

            {showEntryModal ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={() => !entrySubmitting && setShowEntryModal(false)}>
                    <div ref={entryDialogRef} role="dialog" aria-modal="true" aria-labelledby="entry-modal-title" className="tp-entry-dialog w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.09] bg-[#15181c] shadow-[0_30px_100px_rgba(0,0,0,0.55)]" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] p-5 sm:p-6">
                            <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300">{t('tournaments.public.entryRequest')}</p><h2 id="entry-modal-title" className="mt-1 text-lg font-bold text-zinc-100">{t('tournaments.public.requestEntry')}</h2></div>
                            <button type="button" aria-label={t('tournaments.public.close')} disabled={entrySubmitting} onClick={() => setShowEntryModal(false)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] text-zinc-500 transition hover:text-zinc-200 disabled:opacity-40"><X className="h-4 w-4" /></button>
                        </div>
                        <div className="p-5 sm:p-6">
                            <p className="text-sm leading-6 text-zinc-400">{t('tournaments.public.entryModalDescription', { tournament: tournament.name })}</p>
                            <div className="mt-4 rounded-xl border border-white/[0.07] bg-black/20 p-4">
                                <TournamentIdentity name={myClubName || t('tournaments.public.yourClub')} subtitle={scope === 'SQUAD' ? t('tournaments.public.enteringWithSquad') : t('tournaments.public.clubEntry')} />
                            </div>
                            {scope === 'SQUAD' && mySquads.length === 0 ? <p className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.06] px-3 py-2.5 text-xs font-semibold text-amber-200">{t('tournaments.diagram.noSquadsAvailable')}</p> : null}
                            {mySquads.length > 0 ? (
                                <label className="mt-4 block">
                                    <span className="mb-2 block text-xs font-bold text-zinc-400">{scope === 'SQUAD' ? t('tournaments.entry.squadRequired') : t('tournaments.entry.selectSquad')}</span>
                                    <select value={selectedSquadId} onChange={(event) => setSelectedSquadId(event.target.value)} className="w-full rounded-xl border border-white/[0.08] bg-[#0f1114] px-3 py-3 text-sm font-semibold text-zinc-100 outline-none focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/10">
                                        {scope === 'CLUB' ? <option value="">{t('tournaments.entry.playAsClub')}</option> : <option value="">{t('tournaments.public.chooseSquad')}</option>}
                                        {mySquads.map((squad) => <option key={squad.id} value={squad.id}>{squad.name}</option>)}
                                    </select>
                                </label>
                            ) : null}
                            <div className="mt-6 flex justify-end gap-3">
                                <button type="button" disabled={entrySubmitting} onClick={() => setShowEntryModal(false)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-zinc-400 transition hover:text-zinc-100 disabled:opacity-40">{t('tournaments.public.cancel')}</button>
                                <button type="button" onClick={handleConfirmEntry} disabled={entrySubmitting || (scope === 'SQUAD' && !selectedSquadId)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">
                                    {entrySubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                                    {entrySubmitting ? t('tournaments.public.submitting') : t('tournaments.public.submitEntryRequest')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};
