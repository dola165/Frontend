import { CompetitionCapacity } from '../features/competitions/CompetitionCapacity';
import { usePlayerEntryEligibility } from '../features/competitions/usePlayerEntryEligibility';
import { CompetitionOperationsPanel } from '../features/competitions/CompetitionOperationsPanel';
import { getCompetitionProfile, type Profile } from '../features/competitions/api';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import { accessibleClubs } from '../components/layout/clubAccess';
import type { ClubMembershipContext } from '../features/clubs/domain';
import { downloadTournamentCalendar } from '../features/tournaments/tournament-calendar';
import { tournamentPublicCopy } from '../locales/tournamentPublic';
import { useDialogFocus } from '../components/workspace/useDialogFocus';
import { TournamentTieBlockerBanner, TournamentTieResolution } from '../features/tournaments/components/TournamentTieResolution';
import { TournamentConnections } from '../features/tournaments/components/TournamentConnections';
import { participantProfilePath, registrationWindow, tournamentKickoffLabel, tournamentReadiness } from '../features/tournaments/tournament-readiness';
import '../features/tournaments/components/tournament-hub.css';
import './tournament-public.css';
import '../features/competitions/competition-detail.css';
import { CompetitionVisual } from '../features/competitions/CompetitionVisual';
import { CompetitionFacts } from '../features/competitions/CompetitionFacts';
import {
    TournamentIdentity,
    TournamentScopeBadge,
    TournamentStatusBadge,
} from '../components/tournaments/TournamentPresentation';
import {
    formatTournamentDate,
    formatTournamentDateRange,
    tournamentPolicyText,
    tournamentScopeText,
    tournamentVisibilityText,
} from '../components/tournaments/tournamentFormatters';

const panelClass = 'rounded-2xl border border-[color:var(--color-border)]/[0.07] bg-[var(--color-surface)] shadow-[0_18px_50px_color-mix(in_srgb,_var(--color-shadow)_10%,_transparent)]';

const Section = ({ icon, title, eyebrow, children }: { icon: ReactNode; title: string; eyebrow?: string; children: ReactNode }) => (
    <section className={`${panelClass} p-5 sm:p-6`}>
        <div className="flex items-center gap-3 border-b border-[color:var(--color-border)]/[0.06] pb-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--color-border)]/[0.08] bg-[color:var(--color-ink)]/[0.04] text-[color:var(--color-accent)]">
                {icon}
            </span>
            <div>
                {eyebrow ? <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">{eyebrow}</p> : null}
                <h2 className="text-base font-bold text-[color:var(--color-text)]">{title}</h2>
            </div>
        </div>
        <div className="pt-5">{children}</div>
    </section>
);

const publicEntryStatuses = new Set(['APPROVED', 'ACTIVE', 'ELIMINATED', 'COMPLETED']);

const entryDisplayName = (entry: TournamentEntryDto) =>
    entry.squadName ?? entry.clubName ?? entry.displayName ?? 'Participant';

export const TournamentDetailPage = () => {
    const { tournamentId } = useParams(); const { user, sessionId } = useAuth();
    return <TournamentDetailContent key={`${tournamentId}:${user?.id}:${sessionId}`}/>;
};
const TournamentDetailContent = () => {
    const { tournamentId } = useParams<{ tournamentId: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedFixture = Number(searchParams.get('fixtureId')) || null;
    const navigate = useNavigate();
    const location = useLocation();
    const returnTo = typeof location.state?.returnTo==='string' && /^\/matches(?:\?|$)/.test(location.state.returnTo) && !location.state.returnTo.includes('\\') ? location.state.returnTo : '/matches?section=competitions';
    const { isAuthenticated, user } = useAuth();
    const { t, i18n } = useTranslation();
    const [tournament, setTournament] = useState<TournamentDetail | null>(null);
    const [profile,setProfile]=useState<Profile>();
    const [profileError,setProfileError]=useState(''),[profileAttempt,setProfileAttempt]=useState(0);
    useEffect(()=>{const controller=new AbortController();const id=Number(tournamentId);if(Number.isSafeInteger(id)&&id>0)void getCompetitionProfile(id,controller.signal).then(value=>{if(!controller.signal.aborted){setProfile(value);setProfileError('');}}).catch(cause=>{if(!controller.signal.aborted){setProfile(undefined);setProfileError(extractApiErrorMessage(cause,'Could not load the competition rules.'));}});return()=>controller.abort();},[tournamentId,profileAttempt]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [registering, setRegistering] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [myClubId, setMyClubId] = useState<number | null>(null);
    const [myClubs, setMyClubs] = useState(() => accessibleClubs(user?.navigationCapabilities).filter(club => club.canOpenWorkspace));
    const myClubName = myClubs.find(club => club.id === myClubId)?.name ?? null;
    const [clubsLoading, setClubsLoading] = useState(isAuthenticated);
    const [clubsError, setClubsError] = useState(false);
    const [clubsRevision, setClubsRevision] = useState(0);
    const [squadsLoading, setSquadsLoading] = useState(false);
    const [squadsError, setSquadsError] = useState(false);
    const [squadsRevision, setSquadsRevision] = useState(0);
    const [showEntryModal, setShowEntryModal] = useState(false);
    const [mySquads, setMySquads] = useState<{ id: number; name: string }[]>([]);
    const [selectedSquadId, setSelectedSquadId] = useState('');
    const [entrySubmitting, setEntrySubmitting] = useState(false);
    const [withdrawing, setWithdrawing] = useState(false);
    type PublicTab = 'overview' | 'bracket' | 'matches' | 'teams' | 'about';
    const requestedTab = searchParams.get('tab');
    const activeTab: PublicTab = requestedFixture ? 'matches' : ['bracket','matches','teams','about'].includes(requestedTab ?? '') ? requestedTab as PublicTab : 'overview';
    const setActiveTab = (tab: PublicTab) => setSearchParams(previous => { const value = new URLSearchParams(previous); value.delete('fixtureId'); if(tab === 'overview') value.delete('tab'); else value.set('tab',tab); return value; });
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
    const activeAssignment = isAuthenticated && user?.id != null ? tournament?.staffAssignments?.find((assignment) => assignment.userId === user.id && assignment.status === 'ACTIVE') : undefined;
    const isStaff = activeAssignment != null;
    const canResolveTies = isAuthenticated && user?.id != null && tournament?.staffAssignments?.some(assignment => assignment.userId === user.id && assignment.status === 'ACTIVE' && ['ADMIN','STAFF'].includes(assignment.role)) === true;
    const userEntry = user?.id == null ? undefined : tournament?.entries?.find((entry) =>
        entry.userId === user.id && !['WITHDRAWN', 'REJECTED'].includes(entry.status));
    const isRegistered = userEntry != null;
    const visibleEntries = tournament?.entries?.filter((entry) => publicEntryStatuses.has(entry.status)) ?? [];
    const fixtureCount = tournament?.fixtures?.length ?? 0;
    const scope = tournament?.participantScope;
    const policy = tournament?.registrationPolicy;
    const userClubEntry = myClubId != null ? tournament?.entries?.find((entry) => entry.clubId === myClubId && (scope !== 'SQUAD' || entry.squadId === Number(selectedSquadId)) && !['WITHDRAWN','REJECTED'].includes(entry.status)) : undefined;
    const previousClubEntry = myClubId != null ? tournament?.entries?.filter((entry) => entry.clubId === myClubId && (scope !== 'SQUAD' || entry.squadId === Number(selectedSquadId)) && ['WITHDRAWN','REJECTED'].includes(entry.status)).sort((a,b) => b.id-a.id)[0] : undefined;
    const windowState = tournament ? registrationWindow(tournament) : 'unavailable';
    const playerEntry = usePlayerEntryEligibility(user?.id ?? null, isAuthenticated && scope === 'PLAYER' && windowState === 'open' && !isRegistered);
    const playerEligible = playerEntry.eligible;
    const canRegisterPlayer = scope === 'PLAYER' && windowState === 'open' && isAuthenticated && playerEligible && !isRegistered;
    const canRequestClubEntry = (scope === 'CLUB' || scope === 'SQUAD')
        && windowState === 'open'
        && isAuthenticated
        && myClubs.length > 0
        && policy !== 'INVITE_ONLY'
        && (myClubs.length > 1 || scope === 'SQUAD' || !userClubEntry);
    const isInviteOnly = policy === 'INVITE_ONLY' && tournament?.status === 'PLANNING';
    const canWithdraw = isRegistered && tournament?.status === 'PLANNING';

    const loadTournament = useCallback(async () => {
        if (!Number.isSafeInteger(id) || id < 1) {
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
        let active = true;
        const known = accessibleClubs(user?.navigationCapabilities).filter(club => club.canOpenWorkspace);
        setClubsLoading(true); setClubsError(false);
        apiClient.get<ClubMembershipContext>('/clubs/my-membership-context').then(response => {
            if (!active) return;
            const context = response.data;
            const primary = context?.clubId && ['OWNER','CLUB_ADMIN','COACH'].includes(context.myRole ?? '')
                ? { id: context.clubId, name: context.clubName || t('tournaments.public.yourClub'), canOpenWorkspace: true, relationships: [] } : null;
            const clubs = primary ? [...known.filter(club => club.id !== primary.id), primary] : known;
            setMyClubs(clubs); setMyClubId(current => clubs.some(club => club.id === current) ? current : primary?.id ?? clubs[0]?.id ?? null);
        }).catch(() => { if (active) { setClubsError(true); setMyClubs(known); setMyClubId(known[0]?.id ?? null); } })
            .finally(() => { if (active) setClubsLoading(false); });
        return () => { active = false; };
    }, [isAuthenticated, user?.navigationCapabilities, clubsRevision, t]);

    useEffect(() => {
        setSelectedSquadId(''); setMySquads([]); setSquadsError(false);
        if (!showEntryModal || !myClubId || scope !== 'SQUAD') { setSquadsLoading(false); return; }
        let active = true; setSquadsLoading(true);
        apiClient.get<Array<{ id: number; name: string }>>(`/clubs/${myClubId}/squads`).then(response => {
            if (active) setMySquads((response.data ?? []).filter(squad => Number.isSafeInteger(squad.id) && squad.id > 0));
        }).catch(() => { if (active) setSquadsError(true); }).finally(() => { if (active) setSquadsLoading(false); });
        return () => { active = false; };
    }, [showEntryModal, myClubId, scope, squadsRevision]);

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

    const openEntryModal = () => { setSelectedSquadId(''); setMessage(null); setShowEntryModal(true); };

    const handleConfirmEntry = async () => {
        if (!canRequestClubEntry || !myClubId || entrySubmitting || userClubEntry || (scope === 'SQUAD' && (!selectedSquadId || squadsLoading || squadsError))) return;
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
            <div className="min-h-full bg-[var(--color-page)] pb-8" aria-label={t('tournaments.public.loadingTournament')}>
                <Loader2 className="sr-only animate-spin" />
                <div className="animate-pulse overflow-hidden rounded-3xl border border-[color:var(--color-border)]/[0.06] bg-[var(--color-surface)]">
                    <div className="h-80 bg-[color:var(--color-ink)]/[0.04] sm:h-96" />
                </div>
                <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="space-y-5">
                        {[0, 1].map((item) => <div key={item} className="h-52 animate-pulse rounded-2xl border border-[color:var(--color-border)]/[0.06] bg-[var(--color-surface)]" />)}
                    </div>
                    <div className="h-72 animate-pulse rounded-2xl border border-[color:var(--color-border)]/[0.06] bg-[var(--color-surface)]" />
                </div>
            </div>
        );
    }

    if (error || !tournament) {
        return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-3xl border border-[color:var(--color-border)]/[0.07] bg-[var(--color-surface)] px-6 py-16 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[color:var(--color-border)]/[0.08] bg-[color:var(--color-ink)]/[0.04] text-[color:var(--color-muted)]">
                    <Trophy className="h-8 w-8" />
                </span>
                <h1 className="mt-5 text-2xl font-bold text-[color:var(--color-text)]">{!error && message?.type === 'success' ? message.text : t('tournaments.public.notFoundTitle')}</h1>
                {error || message?.type !== 'success' ? (
                    <p className="mt-2 max-w-md text-sm text-[color:var(--color-muted)]">{error ?? t('tournaments.public.notFoundDescription')}</p>
                ) : null}
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                    {error ? (
                        <button type="button" onClick={() => void loadTournament()} className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--color-border)]/[0.1] px-4 py-2.5 text-sm font-bold text-[color:var(--color-text)] transition hover:bg-[color:var(--color-ink)]/[0.05]">
                            <RotateCcw className="h-4 w-4" />
                            {t('tournaments.public.tryAgain')}
                        </button>
                    ) : null}
                    <Link to={returnTo} className="inline-flex items-center gap-2 rounded-xl bg-[color:var(--color-accent)] px-4 py-2.5 text-sm font-bold text-[color:var(--color-on-accent)] transition hover:bg-[color:var(--color-accent)]">
                        <ArrowLeft className="h-4 w-4" />
                        {i18n.language.startsWith('ka')?'შეჯიბრებებში დაბრუნება':'Back to competitions'}
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
                <Link to={`/tournaments/${tournament.id}/workspace`} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--color-accent)] px-4 py-3 text-sm font-bold text-[color:var(--color-on-accent)] transition hover:bg-[color:var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]">
                    <ShieldCheck className="h-4 w-4" />
                    {t('tournaments.public.openWorkspace')}
                    <ArrowRight className="h-4 w-4" />
                </Link>
            );
        }
        if (isRegistered) {
            return (
                <div className="space-y-3">
                    <div className="flex items-center gap-3 rounded-xl border border-[color:var(--color-accent)]/20 bg-[color:var(--color-accent)]/10 px-4 py-3 text-sm font-bold text-[color:var(--color-accent)]">
                        <Check className="h-4 w-4" />
                        {t('tournaments.public.registered')}
                    </div>
                    {canWithdraw ? (
                        <button type="button" onClick={handleWithdraw} disabled={withdrawing} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[color:var(--color-danger)]/20 bg-[color:var(--color-danger)]/[0.07] px-4 py-2.5 text-sm font-bold text-[color:var(--color-danger)] transition hover:bg-[color:var(--color-danger)]/[0.12] disabled:cursor-wait disabled:opacity-60">
                            {withdrawing ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                            {t('tournaments.public.withdraw')}
                        </button>
                    ) : null}
                </div>
            );
        }
        if (scope === 'PLAYER' && windowState === 'open' && isAuthenticated && playerEntry.status === 'pending') return <p role="status" className="tc-note">{i18n.language.startsWith('ka') ? 'რეგისტრაციის პირობების შემოწმება…' : 'Checking entry eligibility…'}</p>;
        if (scope === 'PLAYER' && windowState === 'open' && isAuthenticated && playerEntry.status === 'error') return <div className="tc-note"><p role="alert">{i18n.language.startsWith('ka') ? 'რეგისტრაციის პირობები ვერ შემოწმდა.' : 'Entry eligibility could not be checked.'}</p><button type="button" onClick={playerEntry.retry} className="tc-action">{i18n.language.startsWith('ka') ? 'ხელახლა ცდა' : 'Retry eligibility check'}</button></div>;
        if (scope === 'PLAYER' && windowState === 'open' && isAuthenticated && !playerEligible) return <p className="tc-note">{i18n.language.startsWith('ka') ? 'ინდივიდუალური რეგისტრაცია მოითხოვს სრულწლოვანი მოთამაშის დასრულებულ პროფილს. ბავშვების მონაწილეობას გუნდი მართავს.' : 'Individual entry requires an adult player with completed account setup. Youth participation is managed through club and squad entries.'}</p>;
        if (canRegisterPlayer) {
            return (
                <button type="button" onClick={handleRegister} disabled={registering} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--color-accent)] px-4 py-3 text-sm font-bold text-[color:var(--color-on-accent)] transition hover:bg-[color:var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)] disabled:cursor-wait disabled:opacity-60">
                    {registering ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                    {registering ? t('tournaments.public.registering') : t('tournaments.public.register')}
                </button>
            );
        }
        if (canRequestClubEntry) {
            return (
                <div>
                {previousClubEntry && !userClubEntry && <p className="tc-note">{i18n.language.startsWith('ka') ? 'წინა მოთხოვნა: ' : 'Previous request: '}{t(`tournaments.public.entryStatus.${previousClubEntry.status.toLowerCase()}`)}. {i18n.language.startsWith('ka') ? 'შეგიძლიათ ახალი მოთხოვნის გაგზავნა.' : 'You can submit a new request.'}</p>}
                <button type="button" onClick={openEntryModal} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--color-accent)] px-4 py-3 text-sm font-bold text-[color:var(--color-on-accent)] transition hover:bg-[color:var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]">
                    <Building2 className="h-4 w-4" />
                    {t('tournaments.public.requestEntry')}
                </button>
                </div>
            );
        }
        if (userClubEntry) {
            return (
                <div className="flex items-center gap-3 rounded-xl border border-[color:var(--color-info)]/20 bg-[color:var(--color-info)]/[0.08] px-4 py-3 text-sm font-bold text-[color:var(--color-info)]">
                    <Clock3 className="h-4 w-4" />
                    {t('tournaments.public.clubEntryStatus', { status: t(`tournaments.public.entryStatus.${userClubEntry.status.toLowerCase()}`) })}
                </div>
            );
        }
        if (!isAuthenticated && windowState === 'open') {
            return (
                <button type="button" onClick={() => navigate(buildLoginRedirectPath(window.location.pathname))} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--color-accent)] px-4 py-3 text-sm font-bold text-[color:var(--color-on-accent)] transition hover:bg-[color:var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]">
                    <UserPlus className="h-4 w-4" />
                    {scope === 'PLAYER' ? t('tournaments.public.signInToRegister') : t('tournaments.public.signInToRequest')}
                </button>
            );
        }
        if (windowState === 'closed' || windowState === 'not-open') return <div className="tc-registration-state"><Clock3 size={18}/><strong>{windowState === 'closed' ? (i18n.language.startsWith('ka') ? 'რეგისტრაცია დასრულდა' : 'Registration closed') : (i18n.language.startsWith('ka') ? 'რეგისტრაცია ჯერ არ დაწყებულა' : 'Registration opens later')}</strong></div>;
        if (isInviteOnly || windowState === 'invitation') {
            return (
                <div className="rounded-xl border border-[color:var(--color-warning)]/20 bg-[color:var(--color-warning)]/[0.07] px-4 py-3">
                    <p className="flex items-center gap-2 text-sm font-bold text-[color:var(--color-warning)]"><LockKeyhole className="h-4 w-4" />{t('tournaments.public.inviteOnly')}</p>
                    <p className="mt-1.5 text-xs leading-5 text-[color:var(--color-warning)]/60">{t('tournaments.public.inviteOnlyExplanation')}</p>
                </div>
            );
        }
        if ((scope === 'CLUB' || scope === 'SQUAD') && isAuthenticated && tournament.status === 'PLANNING' && clubsLoading) return <p role="status" className="tc-note">{t('tournaments.public.loadingTournament')}</p>;
        if ((scope === 'CLUB' || scope === 'SQUAD') && isAuthenticated && clubsError && myClubs.length === 0) return <div role="alert"><p className="tc-note">{i18n.language.startsWith('ka') ? 'კლუბების ჩატვირთვა ვერ მოხერხდა.' : 'Could not load your club responsibilities.'}</p><button className="tw-button" onClick={() => setClubsRevision(value => value + 1)}>{t('tournaments.public.tryAgain')}</button></div>;
        if ((scope === 'CLUB' || scope === 'SQUAD') && isAuthenticated && myClubs.length === 0 && tournament.status === 'PLANNING') {
            return (
                <div className="rounded-xl border border-[color:var(--color-border)]/[0.08] bg-[color:var(--color-ink)]/[0.03] px-4 py-3">
                    <p className="text-sm font-bold text-[color:var(--color-secondary)]">{t('tournaments.public.clubRequired')}</p>
                    <p className="mt-1.5 text-xs leading-5 text-[color:var(--color-muted)]">{t('tournaments.public.clubRequiredExplanation')}</p>
                </div>
            );
        }
        return (
            <div className="rounded-xl border border-[color:var(--color-border)]/[0.08] bg-[color:var(--color-ink)]/[0.03] px-4 py-3">
                <p className="text-sm font-bold text-[color:var(--color-secondary)]">{t('tournaments.public.registrationUnavailable')}</p>
                <p className="mt-1.5 text-xs leading-5 text-[color:var(--color-muted)]">{t(`tournaments.public.registrationUnavailableStatus.${tournament.status.toLowerCase()}`)}</p>
            </div>
        );
    })();

    return (
        <div className="tournament-public-page competition-detail">
            {message ? (
                <div role={message.type === 'error' ? 'alert' : 'status'} className={`mb-5 rounded-xl border px-4 py-3 text-sm font-semibold ${message.type === 'success' ? 'border-[color:var(--color-accent)]/20 bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]' : 'border-[color:var(--color-danger)]/20 bg-[color:var(--color-danger)]/10 text-[color:var(--color-danger)]'}`}>
                    {message.text}
                </div>
            ) : null}
            <header className="tp-hero tc-event-hero">
                <div className="tp-hero-inner">
                    <div className="tp-hero-top">
                        <Link to={returnTo}><ArrowLeft size={15} />{i18n.language.startsWith('ka')?'შეჯიბრებებში დაბრუნება':'Back to competitions'}</Link>
                        <div className="tp-hero-actions"><button type="button" className="tp-share" aria-label={refreshing ? copy.refreshing : copy.refresh} disabled={refreshing} onClick={() => void refreshResults()}><RefreshCw size={15} className={refreshing ? 'animate-spin' : undefined} /><span className="tp-refresh-label">{refreshing ? copy.refreshing : copy.refresh}</span></button><button type="button" className="tp-share" onClick={() => void copyLink()}><Share2 size={15} />{shareState === 'copied' ? copy.copied : copy.share}</button></div>
                    </div>
                    <div>
                        <p className="tp-host"><Building2 size={16} /><Link to={`/organizations/${tournament.organizerOrganizationId}`}>{copy.host} · {organizerName}</Link></p>
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
                            <div className="tc-event-cover"><CompetitionVisual id={tournament.id} name={tournament.name} imageUrl={tournament.bannerImageUrl} discipline={profile?.rules?.discipline}/></div>
            </header>
            <CompetitionFacts rules={profile?.rules} loading={!profile && !profileError} error={profileError} retry={()=>setProfileAttempt(a=>a+1)}/>
            {shareState === 'fallback' ? <label className="tp-share-fallback">{copy.copyFallback}<input readOnly value={shareUrl} onFocus={(event) => event.target.select()} /></label> : null}
            {shareState === 'copied' ? <span role="status" className="sr-only">{copy.copied}</span> : null}
            {tournament.championName ? <div className="tp-champion"><Crown size={30} /><div><small>{t('tournaments.public.champion')}</small><strong>{tournament.championName}</strong></div></div> : null}
            <TournamentTieBlockerBanner state={tieState} tournament={tournament}/>
            <section className="tp-entry-bar" aria-label={copy.registration}>
                <div>
                    <h2>{isStaff ? t('tournaments.public.manageCompetition') : t('tournaments.public.registration')}</h2>
                    <div className="tc-registration-capacity"><CompetitionCapacity count={visibleEntries.length} capacity={tournament.entryCap} name={tournament.name}/></div>
                    <div className="tp-entry-summary">
                        <span>{tournamentPolicyText(tournament.registrationPolicy, t)}</span>
                        <span>{tournamentVisibilityText(tournament.visibility, t)}</span>
                        <span>{t('tournaments.public.registrationWindow')}: {registrationRange || t('tournaments.public.toBeAnnounced')}</span>
                    </div>
                </div>
                <div>{actionContent}</div>
            </section>
            <div className="tp-tabs" role="tablist" aria-label={copy.navigation}>
                {(['overview', 'bracket', 'matches', 'teams', 'about'] as const).map((tab, index, tabs) => <button
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
                >{tab === 'overview' ? (i18n.language.startsWith('ka') ? 'მიმოხილვა' : 'Overview') : tab === 'bracket' ? copy.competition : copy[tab]}</button>)}
            </div>
            <main className="tp-panel" id={`public-panel-${activeTab}`} role="tabpanel" aria-labelledby={`public-tab-${activeTab}`}>
                {activeTab === 'overview' ? <div className="tc-overview-grid"><div className="tc-stack">
                    <section className="tc-panel"><div className="tc-panel-heading"><CalendarDays size={20}/><div><h2>{tournament.status === 'COMPLETED' ? (i18n.language.startsWith('ka') ? 'ბოლო შედეგები' : 'Latest results') : t('tournaments.public.scheduleTitle')}</h2><p>{dateRange}</p></div><button className="tc-text-button" onClick={()=>setActiveTab('matches')}>{copy.allMatches} <ArrowRight size={14}/></button></div>
                        {(tournament.status === 'COMPLETED' ? tournament.fixtures.filter(f=>f.status==='COMPLETED').slice(-4).reverse() : tournamentReadiness(tournament).upcoming.slice(0,4)).map(f=><button className="tc-fixture" key={f.id} onClick={()=>{setSearchParams(previous => { const value = new URLSearchParams(previous); value.set('tab','matches'); value.set('fixtureId',String(f.id)); return value; });setSelectedStageId(f.stageId);setMatchFilter('all');}}><span className="tc-fixture-date"><CalendarDays size={17}/>{tournamentKickoffLabel(f.scheduledAt,i18n.language) || t('tournaments.public.toBeAnnounced')}</span><span><small>{f.stageName}</small><strong>{f.homeLabel || '—'} <span className="tc-vs">vs</span> {f.awayLabel || '—'}</strong>{f.status === 'COMPLETED' && <ResultSummary homeScore={f.homeScore} awayScore={f.awayScore} status={f.homeScore != null && f.awayScore != null ? 'RECORDED' : 'NONE'} fixtureStatus={f.status} compact/>}</span><ArrowRight size={16}/></button>)}
                        {!(tournament.status === 'COMPLETED' ? tournament.fixtures.some(f=>f.status==='COMPLETED') : tournamentReadiness(tournament).upcoming.length) && <div className="tc-empty"><CalendarDays size={24}/><h3>{i18n.language.startsWith('ka')?'მომავალი მატჩები არ არის':(tournament.status === 'COMPLETED' ? 'No results published' : 'Schedule not published yet')}</h3><p>{i18n.language.startsWith('ka')?'გამოქვეყნებული განრიგი და შედეგები ნახეთ მატჩების განყოფილებაში.':'Check Matches for the published schedule and recorded results.'}</p></div>}
                    </section>
                    <section className="tc-panel"><div className="tc-panel-heading"><UsersRound size={20}/><h2>{copy.teams}</h2><button className="tc-text-button" onClick={()=>setActiveTab('teams')}>{i18n.language.startsWith('ka')?'ყველა მონაწილე':'All participants'} <ArrowRight size={14}/></button></div><div className="tc-participant-preview">{visibleEntries.slice(0,6).map(entry=><div key={entry.id}><span className="tp-team-crest"><ShieldCheck size={16}/></span><strong>{participantProfilePath(entry)?<Link to={participantProfilePath(entry)!}>{entryDisplayName(entry)}</Link>:entryDisplayName(entry)}</strong></div>)}</div>{!visibleEntries.length&&<p className="tc-note">{t('tournaments.public.noEntriesDescription')}</p>}</section>
                    <section className="tc-panel"><h2>{t('tournaments.public.aboutTitle')}</h2><p className="tc-note">{tournament.description || t('tournaments.public.noDescriptionLong')}</p><button className="tc-text-button" onClick={()=>setActiveTab('about')}>{t('tournaments.public.rulesTitle')} <ArrowRight size={14}/></button></section>
                </div><aside className="tc-stack"><TournamentConnections tournament={tournament}/><section className="tc-panel"><h2>{i18n.language.startsWith('ka')?'შეჯიბრება':'Competition'}</h2><p className="tc-note">{tournament.stages.map(stage=>stage.name).join(' · ') || copy.notDrawnHint}</p><button className="tw-button" onClick={()=>setActiveTab('bracket')}><Trophy size={16}/>{copy.competition}</button><MatchHistoryLink tournamentId={tournament.id} className="tc-text-button"/></section></aside></div> : null}
                {activeTab === 'bracket' ? <>
                    {profileError&&<div role="alert"><p>{profileError}</p><button type="button" onClick={()=>setProfileAttempt(a=>a+1)}>{i18n.language.startsWith('ka')?'წესების ხელახლა ჩატვირთვა':'Reload competition rules'}</button></div>}{profile&&!profile.legacy&&<CompetitionOperationsPanel tournament={tournament} interactive={isAuthenticated} changed={refreshTournament} />}
                    <TournamentTieResolution tournament={tournament} canResolve={canResolveTies && tournament.status === 'ACTIVE'} canAudit={canResolveTies} enabled={isAuthenticated && tournament.status !== 'PLANNING' && tournament.status !== 'CANCELLED'} refreshKey={resultsRevision} onStateChange={setTieState} onResolved={refreshTournament}/>
                    {stages.length !== 1 || selectedStage?.stageType !== 'KNOCKOUT' ? <div className="tp-heading"><div><h2>{selectedStage?.stageType !== 'KNOCKOUT' && selectedStage ? t('tournaments.standings.title') : copy.bracket}</h2><p>{copy.bracketHint}</p></div>{stageSelector}</div> : null}
                    {selectedStage ? <>
                        {selectedStage.stageType === 'KNOCKOUT' ? <TournamentBracketBoard tournament={tournament} stageId={selectedStage.id} /> : null}
                        {selectedStage.stageType !== 'KNOCKOUT' && profile?.legacy ? <StandingsTable key={selectedStage.id} tournamentId={tournament.id} stageId={selectedStage.id} refreshKey={resultsRevision} entryStatuses={new Map(visibleEntries.map((entry) => [entry.id, entry.status]))} advanceCount={selectedStage.advanceCount} /> : null}
                    </> : tournament.fixtures.length ? <TournamentBracketBoard tournament={tournament} /> : <div className="tp-empty"><Trophy size={28} className="mx-auto mb-3" /><h3>{copy.notDrawn}</h3><p>{copy.notDrawnHint}</p></div>}
                </> : null}
                {activeTab === 'matches' ? <>
                    <div className="tp-heading"><div><h2>{tournament.status === 'COMPLETED' ? (i18n.language.startsWith('ka') ? 'ბოლო შედეგები' : 'Latest results') : t('tournaments.public.scheduleTitle')}</h2><p>{t('tournaments.public.fixtureCount', { count: visibleFixtures.length })}</p><MatchHistoryLink tournamentId={tournament.id} className="inline-flex items-center gap-2 mt-3" /></div>{stageSelector}</div>
                    <div className="tp-filter" role="group" aria-label={copy.matches}><button className="tw-button" disabled={!visibleFixtures.some(fixture => fixture.scheduledAt && fixture.status !== 'CANCELLED')} onClick={() => downloadTournamentCalendar(tournament, visibleFixtures)}><CalendarDays size={15}/>{i18n.language.startsWith('ka') ? 'ექსპორტი (.ics)' : 'Export fixtures (.ics)'}</button>
                        {(['all', 'SCHEDULED', 'COMPLETED', 'CANCELLED'] as const).map((filter) => <button key={filter} type="button" aria-pressed={matchFilter === filter} onClick={() => setMatchFilter(filter)}>{filter === 'all' ? copy.allMatches : filter === 'SCHEDULED' ? copy.upcoming : filter === 'COMPLETED' ? copy.results : copy.cancelled}</button>)}
                    </div>
                    {visibleFixtures.length ? <div className="tp-match-list">{visibleFixtures.map((fixture) => {
                        const kickoff = fixture.scheduledAt ? new Date(fixture.scheduledAt) : null;
                        const kickoffTime = kickoff && !Number.isNaN(kickoff.getTime()) ? kickoff.toLocaleTimeString(i18n.language.startsWith('ka') ? 'ka-GE' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) : null;
                        return <article key={fixture.id} id={`fixture-${fixture.id}`} className="tp-match" style={fixture.id === requestedFixture ? { outline: '2px solid var(--accent-primary, var(--color-accent))', outlineOffset: 3, scrollMarginTop: 100 } : undefined}>
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
                            <div className="tp-team-name"><span className="tp-team-crest" aria-hidden="true">{name.slice(0, 2).toLocaleUpperCase()}</span><div><h3>{participantProfilePath(entry) ? <Link to={participantProfilePath(entry)!}>{name}</Link> : name}</h3><p>{entry.squadName || (entry.clubId == null && entry.userId == null ? copy.guestTeam : copy.participating)}</p></div></div>
                            <div className="tp-team-status">{t(`tournaments.public.entryStatus.${entry.status.toLowerCase()}`)}</div>
                        </article>;
                    })}</div> : <div className="tp-empty"><UsersRound size={26} className="mx-auto mb-3" /><h3>{teamSearch ? copy.noSearch : t('tournaments.public.noEntriesTitle')}</h3>{!teamSearch ? <p>{t('tournaments.public.noEntriesDescription')}</p> : null}</div>}
                </> : null}
                {activeTab === 'about' ? <div className="tp-about-grid">
                    <div className="tp-about-stack">
                        <ExtensionSurface capability="tournamentSeries"><TournamentSeriesPanel tournamentId={tournament.id}/></ExtensionSurface>
                        {isExtensionCapabilityAvailable('volunteerShifts') && <Link to={`/volunteering?tournamentId=${tournament.id}`}>Volunteer at this tournament →<ExtensionDemoLabel capability="volunteerShifts" /></Link>}
                        <Section icon={<Trophy className="h-5 w-5" />} title={t('tournaments.public.aboutTitle')}>
                            <p className="whitespace-pre-wrap text-sm leading-6 text-[color:var(--color-muted)]">{tournament.description || t('tournaments.public.noDescriptionLong')}</p>
                        </Section>
                        <Section icon={<ShieldCheck className="h-5 w-5" />} title={t('tournaments.public.rulesTitle')}>
                            <p className="whitespace-pre-wrap text-sm leading-6 text-[color:var(--color-muted)]">{tournament.rules || t('tournaments.public.noRules')}</p>
                        </Section>
                        <Section icon={<Award className="h-5 w-5" />} title={t('tournaments.public.prizesTitle')}>
                            <p className="whitespace-pre-wrap text-sm leading-6 text-[color:var(--color-muted)]">{tournament.incentives || t('tournaments.public.noPrizes')}</p>
                        </Section>
                    </div>
                    <Section icon={<Building2 className="h-5 w-5" />} title={copy.host}>
                        <p className="text-lg font-bold">{organizerName}</p>
                        <dl className="mt-4 space-y-5 text-xs">
                            {tournament.hostClubName ? <div><dt className="text-[color:var(--color-muted)]">{copy.partnerClub}</dt><dd className="mt-1 font-semibold">{tournament.hostClubId ? <Link to={`/clubs/${tournament.hostClubId}`}>{tournament.hostClubName}</Link> : tournament.hostClubName}</dd></div> : null}
                            <div><dt className="text-[color:var(--color-muted)]">{t('tournaments.public.scheduleTitle')}</dt><dd className="mt-1 font-semibold">{dateRange || t('tournaments.public.datesToBeConfirmed')}</dd></div>
                            <div><dt className="text-[color:var(--color-muted)]">{t('tournaments.public.scopeLabel')}</dt><dd className="mt-1 font-semibold">{tournamentScopeText(tournament.participantScope, t)}</dd></div>
                            <div><dt className="text-[color:var(--color-muted)]">{t('tournaments.public.registration')}</dt><dd className="mt-1 font-semibold">{tournamentPolicyText(tournament.registrationPolicy, t)}</dd></div>
                            <div><dt className="text-[color:var(--color-muted)]">{t('tournaments.public.registrationWindow')}</dt><dd className="mt-1 font-semibold">{registrationRange || t('tournaments.public.toBeAnnounced')}</dd></div>
                        </dl>
                    </Section>
                </div> : null}
            </main>

            {showEntryModal ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--color-overlay)]/75 p-4 backdrop-blur-sm" onClick={() => !entrySubmitting && setShowEntryModal(false)}>
                    <div ref={entryDialogRef} role="dialog" aria-modal="true" aria-labelledby="entry-modal-title" className="tp-entry-dialog w-full max-w-md overflow-hidden rounded-2xl border border-[color:var(--color-border)]/[0.09] bg-[var(--color-surface)] shadow-[0_30px_100px_color-mix(in_srgb,_var(--color-shadow)_55%,_transparent)]" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--color-border)]/[0.06] p-5 sm:p-6">
                            <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--color-accent)]">{t('tournaments.public.entryRequest')}</p><h2 id="entry-modal-title" className="mt-1 text-lg font-bold text-[color:var(--color-text)]">{t('tournaments.public.requestEntry')}</h2></div>
                            <button type="button" aria-label={t('tournaments.public.close')} disabled={entrySubmitting} onClick={() => setShowEntryModal(false)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--color-border)]/[0.08] text-[color:var(--color-muted)] transition hover:text-[color:var(--color-text)] disabled:opacity-40"><X className="h-4 w-4" /></button>
                        </div>
                        <div className="p-5 sm:p-6">
                            <p className="text-sm leading-6 text-[color:var(--color-muted)]">{t('tournaments.public.entryModalDescription', { tournament: tournament.name })}</p>
                            <div className="mt-4 rounded-xl border border-[color:var(--color-border)] bg-[var(--color-inset)] p-4">
                                <label className="tc-entry-club">{i18n.language.startsWith('ka') ? 'კლუბი' : 'Entering club'}<select value={myClubId ?? ''} disabled={entrySubmitting} onChange={event => setMyClubId(Number(event.target.value))}>{myClubs.map(club => <option key={club.id} value={club.id}>{club.name}</option>)}</select></label>
                                <TournamentIdentity name={myClubName || t('tournaments.public.yourClub')} subtitle={scope === 'SQUAD' ? t('tournaments.public.enteringWithSquad') : t('tournaments.public.clubEntry')} />
                            </div>
                            {scope === 'SQUAD' && !squadsLoading && !squadsError && mySquads.length === 0 ? <p className="mt-4 rounded-xl border border-[color:var(--color-warning)]/15 bg-[color:var(--color-warning)]/[0.06] px-3 py-2.5 text-xs font-semibold text-[color:var(--color-warning)]">{t('tournaments.diagram.noSquadsAvailable')}</p> : null}
                            {squadsLoading && <p role="status" className="tc-note">{i18n.language.startsWith('ka') ? 'გუნდები იტვირთება…' : 'Loading squads…'}</p>}
                            {squadsError && <div role="alert"><p className="tc-note">{i18n.language.startsWith('ka') ? 'გუნდების ჩატვირთვა ვერ მოხერხდა.' : 'Could not load squads. Your request has not been sent.'}</p><button className="tw-button" disabled={entrySubmitting} onClick={() => setSquadsRevision(value => value + 1)}>{t('tournaments.public.tryAgain')}</button></div>}
                            {userClubEntry && <p role="status" className="tc-note">{t('tournaments.public.clubEntryStatus', { status: t(`tournaments.public.entryStatus.${userClubEntry.status.toLowerCase()}`) })}</p>}
                            <p className="tc-note">{i18n.language.startsWith('ka') ? 'მოთხოვნა შეუძლია კლუბის მფლობელს, ადმინისტრატორს ან მწვრთნელს. კლუბთან სხვა კავშირი მართვის უფლებას არ იძლევა.' : 'Entry requests require a club owner, administrator or coach. Family and player connections do not grant club management access.'}</p>
                            {mySquads.length > 0 ? (
                                <label className="mt-4 block">
                                    <span className="mb-2 block text-xs font-bold text-[color:var(--color-muted)]">{scope === 'SQUAD' ? t('tournaments.entry.squadRequired') : t('tournaments.entry.selectSquad')}</span>
                                    <select disabled={entrySubmitting} value={selectedSquadId} onChange={(event) => setSelectedSquadId(event.target.value)} className="w-full rounded-xl border border-[color:var(--color-border)]/[0.08] bg-[var(--color-page)] px-3 py-3 text-sm font-semibold text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]/40 focus:ring-2 focus:ring-[color:var(--color-accent)]/10">
                                        {scope === 'CLUB' ? <option value="">{t('tournaments.entry.playAsClub')}</option> : <option value="">{t('tournaments.public.chooseSquad')}</option>}
                                        {mySquads.map((squad) => <option key={squad.id} value={squad.id} disabled={tournament.entries.some(entry => entry.clubId === myClubId && entry.squadId === squad.id && !['WITHDRAWN','REJECTED'].includes(entry.status))}>{squad.name}</option>)}
                                    </select>
                                </label>
                            ) : null}
                            <div className="mt-6 flex justify-end gap-3">
                                <button type="button" disabled={entrySubmitting} onClick={() => setShowEntryModal(false)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-[color:var(--color-muted)] transition hover:text-[color:var(--color-text)] disabled:opacity-40">{t('tournaments.public.cancel')}</button>
                                <button type="button" onClick={handleConfirmEntry} disabled={entrySubmitting || !myClubId || Boolean(userClubEntry) || (scope === 'SQUAD' && (!selectedSquadId || squadsLoading || squadsError))} className="inline-flex items-center gap-2 rounded-xl bg-[color:var(--color-accent)] px-4 py-2.5 text-sm font-bold text-[color:var(--color-on-accent)] transition hover:bg-[color:var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50">
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
