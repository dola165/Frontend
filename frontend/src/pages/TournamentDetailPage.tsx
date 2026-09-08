import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
    Trophy,
    UserPlus,
    UsersRound,
    X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fetchTournament, registerPlayer, requestEntry } from '../features/tournaments/api';
import type { TournamentDetail, TournamentEntryDto } from '../features/tournaments/domain';
import { useAuth } from '../context/AuthContext';
import { buildLoginRedirectPath } from '../utils/authRedirect';
import { extractApiErrorMessage } from '../utils/apiError';
import { apiClient } from '../api/axiosConfig';
import {
    RegistrationPolicyBadge,
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

const publicEntryStatuses = new Set(['APPROVED', 'ACTIVE', 'COMPLETED']);

const entryDisplayName = (entry: TournamentEntryDto) =>
    entry.squadName ?? entry.clubName ?? entry.displayName ?? 'Participant';

export const TournamentDetailPage = () => {
    const { tournamentId } = useParams<{ tournamentId: string }>();
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

    const id = Number(tournamentId);
    const isStaff = tournament?.staffAssignments?.some((assignment) => assignment.userId === user?.id && assignment.status === 'ACTIVE');
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
    const hostName = tournament.hostClubName ?? t('tournaments.public.hostFallback');
    const visibleFixtures = tournament.fixtures;

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
        <div className="min-h-full bg-[#0d1014] pb-8 text-zinc-100 selection:bg-emerald-400/20">
            {message ? (
                <div role={message.type === 'error' ? 'alert' : 'status'} className={`mb-5 rounded-xl border px-4 py-3 text-sm font-semibold ${message.type === 'success' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-rose-400/20 bg-rose-400/10 text-rose-300'}`}>
                    {message.text}
                </div>
            ) : null}

            <TournamentVisual name={tournament.name} imageUrl={tournament.bannerImageUrl} className="min-h-[360px] rounded-3xl border border-white/[0.07] shadow-[0_28px_80px_rgba(0,0,0,0.24)] sm:min-h-[420px]">
                <div className="flex min-h-[360px] flex-col justify-between p-5 sm:min-h-[420px] sm:p-8 lg:p-10">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <Link to="/tournaments" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3.5 py-2 text-xs font-bold text-zinc-200 backdrop-blur-md transition hover:bg-black/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">
                            <ArrowLeft className="h-3.5 w-3.5" />
                            {t('tournaments.public.backToTournaments')}
                        </Link>
                        <div className="flex flex-wrap justify-end gap-2 rounded-2xl border border-white/10 bg-black/35 p-1.5 shadow-lg shadow-black/10 backdrop-blur-md">
                            <span className="inline-flex items-center rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-200">Preview</span>
                            <TournamentStatusBadge status={tournament.status} />
                            <TournamentScopeBadge scope={tournament.participantScope} />
                            <RegistrationPolicyBadge policy={tournament.registrationPolicy} />
                        </div>
                    </div>
                    <div className="max-w-4xl">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">{t('tournaments.public.competition')}</p>
                        <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">{tournament.name}</h1>
                        <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-300 sm:text-base">
                            {tournament.description || t('tournaments.public.noDescription')}
                        </p>
                        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-300">
                            <span className="inline-flex items-center gap-2"><Building2 className="h-4 w-4 text-zinc-500" />{t('tournaments.public.hostedBy', { name: hostName })}</span>
                            <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-zinc-500" />{dateRange || t('tournaments.public.datesToBeConfirmed')}</span>
                        </div>
                    </div>
                </div>
            </TournamentVisual>

            <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] px-5 py-4 text-sm leading-6 text-amber-100/80">
                <p className="font-bold text-amber-100">Public tournament preview</p>
                <p className="mt-1">This page shows every published participant, fixture, and result. Public standings and brackets will be added later.</p>
            </div>

            <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
                <main className="space-y-6">
                    {tournament.championName ? (
                        <div className="flex flex-col gap-4 overflow-hidden rounded-2xl border border-amber-300/20 bg-[radial-gradient(circle_at_90%_20%,rgba(252,211,77,0.12),transparent_26%),#191813] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                            <div className="flex items-center gap-4">
                                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-300/10 text-amber-300"><Crown className="h-6 w-6" /></span>
                                <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300/70">{t('tournaments.public.champion')}</p><p className="mt-1 text-lg font-bold text-amber-50">{tournament.championName}</p></div>
                            </div>
                            <Trophy className="hidden h-16 w-16 text-amber-300/15 sm:block" />
                        </div>
                    ) : null}

                    <Section icon={<Trophy className="h-5 w-5" />} title={t('tournaments.public.aboutTitle')} eyebrow={t('tournaments.public.overview')}>
                        <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-400">
                            {tournament.description || t('tournaments.public.noDescriptionLong')}
                        </p>
                    </Section>

                    <div className="grid gap-6 xl:grid-cols-2">
                        <Section icon={<Award className="h-5 w-5" />} title={t('tournaments.public.prizesTitle')}>
                            {tournament.incentives ? <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-400">{tournament.incentives}</p> : <p className="text-sm leading-6 text-zinc-500">{t('tournaments.public.noPrizes')}</p>}
                        </Section>
                        <Section icon={<ShieldCheck className="h-5 w-5" />} title={t('tournaments.public.rulesTitle')}>
                            {tournament.rules ? <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-400">{tournament.rules}</p> : <p className="text-sm leading-6 text-zinc-500">{t('tournaments.public.noRules')}</p>}
                        </Section>
                    </div>

                    <Section icon={<UsersRound className="h-5 w-5" />} title={t('tournaments.public.entriesTitle')} eyebrow={t('tournaments.public.entryCount', { count: visibleEntries.length })}>
                        {visibleEntries.length > 0 ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                                {visibleEntries.map((entry) => (
                                    <div key={entry.id} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3.5">
                                        <TournamentIdentity name={entryDisplayName(entry)} subtitle={entry.squadName && entry.clubName ? entry.clubName : t(`tournaments.public.entryStatus.${entry.status.toLowerCase()}`)} />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-white/[0.09] bg-white/[0.02] px-5 py-8 text-center">
                                <UsersRound className="mx-auto h-7 w-7 text-zinc-700" />
                                <p className="mt-3 text-sm font-bold text-zinc-300">{t('tournaments.public.noEntriesTitle')}</p>
                                <p className="mt-1 text-xs leading-5 text-zinc-500">{t('tournaments.public.noEntriesDescription')}</p>
                            </div>
                        )}
                    </Section>

                    <Section icon={<CalendarDays className="h-5 w-5" />} title={t('tournaments.public.scheduleTitle')} eyebrow={t('tournaments.public.fixtureCount', { count: fixtureCount })}>
                        {visibleFixtures.length > 0 ? (
                            <div className="space-y-3">
                                {visibleFixtures.map((fixture) => (
                                    <div key={fixture.id} className="grid gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-600">{fixture.stageName || t('tournaments.public.fixture')}</p>
                                            <p className="mt-1 truncate text-sm font-bold text-zinc-200">
                                                {fixture.homeLabel || t('tournaments.public.toBeDecided')} <span className="mx-2 text-zinc-600">vs</span> {fixture.awayLabel || t('tournaments.public.toBeDecided')}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            {fixture.homeScore != null && fixture.awayScore != null ? <p className="text-sm font-bold text-zinc-200">{fixture.homeScore} – {fixture.awayScore}</p> : null}
                                            <p className="text-xs text-zinc-500">{formatTournamentDate(fixture.scheduledAt, i18n.language) || t('tournaments.public.kickoffToBeConfirmed')}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-white/[0.09] bg-white/[0.02] px-5 py-8 text-center">
                                <CalendarDays className="mx-auto h-7 w-7 text-zinc-700" />
                                <p className="mt-3 text-sm font-bold text-zinc-300">{t('tournaments.public.noFixturesTitle')}</p>
                                <p className="mt-1 text-xs leading-5 text-zinc-500">{t('tournaments.public.noFixturesDescription')}</p>
                            </div>
                        )}
                    </Section>
                </main>

                <aside className="space-y-5 lg:sticky lg:top-28">
                    <section className={`${panelClass} overflow-hidden`}>
                        <div className="border-b border-white/[0.06] bg-[radial-gradient(circle_at_top_right,rgba(36,190,103,0.12),transparent_36%)] p-5 sm:p-6">
                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300">{t('tournaments.public.yourNextStep')}</p>
                            <h2 className="mt-2 text-lg font-bold text-zinc-100">
                                {isStaff ? t('tournaments.public.manageCompetition') : t('tournaments.public.joinCompetition')}
                            </h2>
                            <p className="mt-2 text-xs leading-5 text-zinc-500">
                                {isStaff ? t('tournaments.public.workspaceExplanation') : t('tournaments.public.actionExplanation')}
                            </p>
                            <div className="mt-5">{actionContent}</div>
                        </div>
                        <div className="divide-y divide-white/[0.06] px-5">
                            <div className="flex items-center justify-between gap-4 py-4"><span className="text-xs text-zinc-500">{t('tournaments.public.registration')}</span><span className="text-right text-xs font-bold text-zinc-300">{tournamentPolicyText(tournament.registrationPolicy, t)}</span></div>
                            <div className="flex items-center justify-between gap-4 py-4"><span className="text-xs text-zinc-500">{t('tournaments.public.registrationWindow')}</span><span className="text-right text-xs font-bold text-zinc-300">{registrationRange || t('tournaments.public.toBeAnnounced')}</span></div>
                        </div>
                    </section>

                    <section className={`${panelClass} p-5 sm:p-6`}>
                        <h2 className="text-sm font-bold text-zinc-100">{t('tournaments.public.atAGlance')}</h2>
                        <dl className="mt-4 divide-y divide-white/[0.06]">
                            <div className="grid grid-cols-[100px_1fr] gap-4 py-3 first:pt-0"><dt className="text-xs text-zinc-500">{t('tournaments.public.scopeLabel')}</dt><dd className="text-right text-xs font-bold text-zinc-300">{tournamentScopeText(tournament.participantScope, t)}</dd></div>
                            <div className="grid grid-cols-[100px_1fr] gap-4 py-3"><dt className="text-xs text-zinc-500">{t('tournaments.public.visibilityLabel')}</dt><dd className="text-right text-xs font-bold text-zinc-300">{tournamentVisibilityText(tournament.visibility, t)}</dd></div>
                            <div className="grid grid-cols-[100px_1fr] gap-4 py-3"><dt className="text-xs text-zinc-500">{t('tournaments.public.hostLabel')}</dt><dd className="text-right text-xs font-bold text-zinc-300">{hostName}</dd></div>
                            <div className="grid grid-cols-[100px_1fr] gap-4 py-3"><dt className="text-xs text-zinc-500">{t('tournaments.public.organizerLabel')}</dt><dd className="text-right text-xs font-bold text-zinc-300">{organizerName}</dd></div>
                            <div className="grid grid-cols-[100px_1fr] gap-4 py-3"><dt className="text-xs text-zinc-500">{t('tournaments.public.participantsLabel')}</dt><dd className="text-right text-xs font-bold text-zinc-300">{t('tournaments.public.entryCount', { count: visibleEntries.length })}</dd></div>
                            <div className="grid grid-cols-[100px_1fr] gap-4 py-3 last:pb-0"><dt className="text-xs text-zinc-500">{t('tournaments.public.fixturesLabel')}</dt><dd className="text-right text-xs font-bold text-zinc-300">{fixtureCount}</dd></div>
                        </dl>
                    </section>
                </aside>
            </div>

            {showEntryModal ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={() => !entrySubmitting && setShowEntryModal(false)}>
                    <div role="dialog" aria-modal="true" aria-labelledby="entry-modal-title" className="w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.09] bg-[#15181c] shadow-[0_30px_100px_rgba(0,0,0,0.55)]" onClick={(event) => event.stopPropagation()}>
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
