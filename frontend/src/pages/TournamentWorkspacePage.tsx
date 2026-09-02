import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
    ArrowLeft, CalendarDays, Eye, ExternalLink, Loader2, Mail, Settings,
    Swords, Trash2, Trophy, Users, X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { extractApiErrorMessage } from '../utils/apiError';
import { fetchTournament, fetchMyOrganizations, removeEntry } from '../features/tournaments/api';
import { BracketEditor } from '../features/tournaments/components/BracketEditor';
import { EntryReviewPanel } from '../features/tournaments/components/EntryReviewPanel';
import { EventSettingsPanel } from '../features/tournaments/components/EventSettingsPanel';
import { TournamentInvitationsPanel } from '../features/tournaments/components/TournamentInvitationsPanel';
import { useTournamentPermissions } from '../features/tournaments/useTournamentPermissions';
import type { TournamentDetail, TournamentEntryDto } from '../features/tournaments/domain';
import { entryStatusTone, entryTypeLabel } from '../features/tournaments/domain';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import {
    RegistrationPolicyBadge, TournamentScopeBadge, TournamentStatusBadge, TournamentVisual,
} from '../components/tournaments/TournamentPresentation';
import {
    formatTournamentDate, formatTournamentDateRange, tournamentEntryStatusText,
    tournamentEntryTypeText, tournamentVisibilityText,
} from '../components/tournaments/tournamentFormatters';

type WorkspaceTab = 'participants' | 'bracketing' | 'invitations';

const tabs: { key: WorkspaceTab; labelKey: string; descriptionKey: string; icon: typeof Users }[] = [
    { key: 'participants', labelKey: 'tournaments.workspace.tabs.participants', descriptionKey: 'tournaments.workspace.tabs.participantsHint', icon: Users },
    { key: 'bracketing', labelKey: 'tournaments.workspace.tabs.bracketing', descriptionKey: 'tournaments.workspace.tabs.bracketingHint', icon: Swords },
    { key: 'invitations', labelKey: 'tournaments.workspace.tabs.invitations', descriptionKey: 'tournaments.workspace.tabs.invitationsHint', icon: Mail },
];

const statusToneBorder: Record<string, string> = {
    success: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    warning: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
    info: 'border-sky-400/25 bg-sky-400/10 text-sky-300',
    danger: 'border-rose-400/25 bg-rose-400/10 text-rose-300',
    neutral: 'border-white/10 bg-white/[0.05] text-zinc-400',
};

const entryTypeTone: Record<string, string> = {
    Club: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
    Squad: 'border-violet-400/20 bg-violet-400/10 text-violet-300',
    Player: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
};

const entryLabel = (entry: TournamentEntryDto): string =>
    entry.displayName ?? entry.clubName ?? entry.squadName ?? `Entry #${entry.id}`;

const entrySubLabel = (entry: TournamentEntryDto): string | null => {
    if (entry.clubName && entry.displayName && entry.displayName !== entry.clubName) return entry.clubName;
    if (entry.squadName && entry.clubName) return `${entry.clubName} / ${entry.squadName}`;
    return null;
};

const initials = (value: string) => value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

export const TournamentWorkspacePage = () => {
    const { tournamentId: tournamentIdParam } = useParams<{ tournamentId: string }>();
    const tournamentId = tournamentIdParam ? Number(tournamentIdParam) : null;
    const { t, i18n } = useTranslation();
    const { user } = useAuth();

    const [tournament, setTournament] = useState<TournamentDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<WorkspaceTab>('participants');
    const [removingId, setRemovingId] = useState<number | null>(null);
    const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [messageType, setMessageType] = useState<'success' | 'error'>('success');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [organizations, setOrganizations] = useState<{ id: number; displayName: string }[]>([]);

    useEffect(() => {
        let active = true;
        fetchMyOrganizations().then((data) => { if (active) setOrganizations(data); }).catch(() => {});
        return () => { active = false; };
    }, []);

    const permissions = useTournamentPermissions(tournament, user?.id);

    const hostClubName = useMemo(() => {
        if (!tournament?.hostClubId) return null;
        return tournament.hostClubName
            ?? tournament.entries.find((entry) => entry.clubId === tournament.hostClubId)?.clubName
            ?? null;
    }, [tournament]);

    const organizerName = useMemo(() => {
        if (!tournament) return null;
        return tournament.organizerName
            ?? organizations.find((org) => org.id === tournament.organizerOrganizationId)?.displayName
            ?? null;
    }, [organizations, tournament]);

    const showMessage = (text: string, type: 'success' | 'error') => {
        setMessage(text);
        setMessageType(type);
        setTimeout(() => setMessage(null), 4000);
    };

    const loadTournament = useCallback(async () => {
        if (tournamentId == null || Number.isNaN(tournamentId)) {
            setError(t('tournaments.workspace.invalidId'));
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            setTournament(await fetchTournament(tournamentId));
        } catch (err) {
            setError(extractApiErrorMessage(err, t('tournaments.workspace.loadFailed')));
        } finally {
            setLoading(false);
        }
    }, [tournamentId, t]);

    useEffect(() => { void loadTournament(); }, [loadTournament]);

    const confirmedEntries = useMemo(
        () => (tournament?.entries ?? []).filter((entry) => !['PENDING', 'REJECTED', 'WITHDRAWN'].includes(entry.status)),
        [tournament?.entries],
    );

    const handleRemoveEntry = async (entryId: number) => {
        if (tournamentId == null || removingId != null || !permissions.canManage) return;
        setRemovingId(entryId);
        try {
            await removeEntry(tournamentId, entryId);
            showMessage(t('tournaments.workspace.participantRemoved'), 'success');
            void loadTournament();
        } catch (err) {
            showMessage(extractApiErrorMessage(err, t('tournaments.workspace.removeFailed')), 'error');
        } finally {
            setRemovingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-full items-center justify-center bg-[#090c0b]">
                <div className="flex flex-col items-center gap-4 text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-emerald-400" />
                    <p className="text-sm text-zinc-400">{t('tournaments.workspace.loading')}</p>
                </div>
            </div>
        );
    }

    if (error || !tournament) {
        return (
            <div className="flex min-h-full items-center justify-center bg-[#090c0b] px-6">
                <div className="max-w-md text-center">
                    <Trophy className="mx-auto mb-4 h-12 w-12 text-zinc-600" />
                    <p className="text-lg font-semibold text-zinc-100">{t('tournaments.workspace.notFound')}</p>
                    <p className="mt-2 text-sm text-zinc-400">{error ?? t('tournaments.workspace.notFoundHint')}</p>
                    <button type="button" onClick={() => void loadTournament()} className="mt-6 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-[#07110b] hover:bg-emerald-400">
                        {t('tournaments.public.detail.retry')}
                    </button>
                </div>
            </div>
        );
    }

    const isBracketing = activeTab === 'bracketing';
    const dateRange = formatTournamentDateRange(tournament.startDate, tournament.endDate, i18n.language);
    const roleLabel = permissions.canEditSettings
        ? t('tournaments.workspace.roles.admin')
        : permissions.canManage
            ? t('tournaments.workspace.roles.operator')
            : permissions.canScore
                ? t('tournaments.workspace.roles.official')
                : t('tournaments.workspace.roles.viewer');
    const tabCount: Partial<Record<WorkspaceTab, number>> = {
        participants: confirmedEntries.length,
        bracketing: tournament.stages.length,
    };

    return (
        <div className="min-h-full bg-[#090c0b] text-zinc-100 selection:bg-emerald-400/20">
            <TournamentVisual name={tournament.name} imageUrl={tournament.bannerImageUrl} overlay={false} className="h-[272px] border-b border-white/[0.08]" imageClassName="object-center">
                <div className="absolute inset-0 bg-gradient-to-r from-[#07100c]/95 via-[#07100c]/70 to-[#07100c]/25" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#090c0b] via-transparent to-black/20" />
                <div className="relative mx-auto flex h-full max-w-[var(--app-page-max-width)] flex-col justify-between px-[var(--app-page-gutter)] py-6">
                    <div className="flex items-center justify-between gap-4">
                        <Link to={`/tournaments/${tournament.id}`} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-semibold text-zinc-200 backdrop-blur-md hover:bg-black/45">
                            <ArrowLeft className="h-3.5 w-3.5" />
                            {t('tournaments.workspace.publicTournament')}
                        </Link>
                        <span className="rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-xs font-semibold text-zinc-200 backdrop-blur-md">{roleLabel}</span>
                    </div>
                    <div className="flex flex-wrap items-end justify-between gap-5">
                        <div className="min-w-0 max-w-4xl">
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">{t('tournaments.workspace.operations')}</p>
                            <h1 className="mt-2 truncate text-3xl font-black tracking-tight text-white drop-shadow-sm sm:text-4xl">{tournament.name}</h1>
                            <div className="mt-3 flex flex-wrap items-center gap-2.5">
                                <TournamentStatusBadge status={tournament.status} />
                                <TournamentScopeBadge scope={tournament.participantScope} />
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-xs font-medium text-zinc-200">
                                    <Eye className="h-3.5 w-3.5 text-zinc-400" />
                                    {tournamentVisibilityText(tournament.visibility, t)}
                                </span>
                                {dateRange && <span className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-200"><CalendarDays className="h-4 w-4 text-emerald-300" />{dateRange}</span>}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Link to={`/tournaments/${tournament.id}`} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-black/30 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-md hover:bg-black/50">
                                <ExternalLink className="h-4 w-4" />
                                {t('tournaments.workspace.viewPublicPage')}
                            </Link>
                            {permissions.canEditSettings && (
                                <button type="button" onClick={() => setSettingsOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-[#07110b] shadow-lg shadow-emerald-950/30 hover:bg-emerald-300">
                                    <Settings className="h-4 w-4" />
                                    {t('tournaments.workspace.settings')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </TournamentVisual>

            <div className="border-b border-white/[0.08] bg-[#0d1210]/95">
                <div className="mx-auto flex max-w-[var(--app-page-max-width)] overflow-x-auto px-[var(--app-page-gutter)]">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const selected = activeTab === tab.key;
                        return (
                            <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`group relative flex min-w-[180px] flex-1 items-center justify-center gap-3 px-5 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 ${selected ? 'text-white' : 'text-zinc-500 hover:bg-white/[0.025] hover:text-zinc-200'}`}>
                                <Icon className={`h-5 w-5 shrink-0 ${selected ? 'text-emerald-300' : 'text-zinc-600 group-hover:text-zinc-400'}`} />
                                <span>
                                    <span className="flex items-center gap-2 text-sm font-bold">
                                        {t(tab.labelKey)}
                                        {tabCount[tab.key] != null && <span className={`rounded-full px-2 py-0.5 text-[10px] ${selected ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/[0.05] text-zinc-500'}`}>{tabCount[tab.key]}</span>}
                                    </span>
                                    <span className="mt-0.5 hidden text-xs font-normal text-zinc-500 lg:block">{t(tab.descriptionKey)}</span>
                                </span>
                                {selected && <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-emerald-400" />}
                            </button>
                        );
                    })}
                </div>
            </div>

            {message && <div className={`border-b px-[var(--app-page-gutter)] py-3 text-sm font-semibold ${messageType === 'success' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-rose-400/20 bg-rose-400/10 text-rose-300'}`}>{message}</div>}

            {isBracketing ? (
                <div className="mx-auto max-w-[var(--app-page-max-width)] px-[var(--app-page-gutter)] py-6">
                    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d1210] shadow-2xl shadow-black/20">
                        <BracketEditor tournamentId={tournament.id} tournament={tournament} canManage={permissions.canManage} canScore={permissions.canScore} onRefresh={loadTournament} />
                    </div>
                </div>
            ) : (
                <div className="mx-auto grid max-w-[var(--app-page-max-width)] grid-cols-1 gap-5 px-[var(--app-page-gutter)] py-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <section className="min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111612] shadow-xl shadow-black/10">
                        {activeTab === 'participants' && (
                            <div className="flex flex-col">
                                {permissions.canManage && <EntryReviewPanel tournamentId={tournament.id} tournament={tournament} onRefresh={loadTournament} />}
                                <div className="border-b border-white/[0.08] px-5 py-4 sm:px-6">
                                    <div className="flex items-center justify-between gap-4">
                                        <div><p className="text-sm font-bold text-zinc-100">{t('tournaments.workspace.confirmedRoster')}</p><p className="mt-1 text-xs text-zinc-500">{t('tournaments.workspace.rosterHint')}</p></div>
                                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-zinc-300">{t('tournaments.workspace.participantCount', { count: confirmedEntries.length })}</span>
                                    </div>
                                </div>
                                {confirmedEntries.length === 0 ? (
                                    <div className="flex flex-col items-center px-5 py-14 text-center">
                                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-zinc-600"><Users className="h-6 w-6" /></span>
                                        <p className="mt-4 text-sm font-semibold text-zinc-300">{t('tournaments.workspace.noConfirmed')}</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-px bg-white/[0.06] md:grid-cols-2">
                                        {confirmedEntries.map((entry) => {
                                            const tone = entryStatusTone(entry.status);
                                            const type = entryTypeLabel(entry);
                                            const label = entryLabel(entry);
                                            return (
                                                <div key={entry.id} className="flex min-w-0 items-center gap-3 bg-[#111612] px-5 py-4 transition-colors hover:bg-[#151b16] sm:px-6">
                                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-sm font-black text-emerald-300">{initials(label)}</span>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex min-w-0 items-center gap-2"><p className="truncate text-sm font-bold text-zinc-100">{label}</p><span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${entryTypeTone[type] ?? entryTypeTone.Player}`}>{tournamentEntryTypeText(type, t)}</span></div>
                                                        <div className="mt-1 flex min-w-0 items-center gap-2">{entrySubLabel(entry) && <p className="truncate text-xs text-zinc-500">{entrySubLabel(entry)}</p>}<span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusToneBorder[tone] ?? statusToneBorder.neutral}`}>{tournamentEntryStatusText(entry.status, t)}</span></div>
                                                    </div>
                                                    {permissions.canManage && (
                                                        <button type="button" onClick={() => setConfirmRemoveId(entry.id)} disabled={removingId === entry.id} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-400/15 text-rose-300 hover:border-rose-400/30 hover:bg-rose-400/10 disabled:opacity-50" title={t('tournaments.workspace.removeFromEvent')}>
                                                            {removingId === entry.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                        {activeTab === 'invitations' && <TournamentInvitationsPanel tournamentId={tournament.id} />}
                    </section>

                    <aside className="flex flex-col gap-4">
                        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111612]">
                            <div className="border-b border-white/[0.08] px-5 py-4"><p className="text-sm font-bold text-zinc-100">{t('tournaments.workspace.tournamentInfo')}</p></div>
                            <div className="divide-y divide-white/[0.06] px-5 text-sm">
                                <div className="flex justify-between gap-4 py-3"><span className="text-zinc-500">{t('tournaments.workspace.hostClub')}</span><span className="text-right font-semibold text-zinc-200">{tournament.hostClubId ? (hostClubName ?? t('tournaments.workspace.clubFallback', { id: tournament.hostClubId })) : t('tournaments.workspace.noHostClub')}</span></div>
                                <div className="flex justify-between gap-4 py-3"><span className="text-zinc-500">{t('tournaments.workspace.organizer')}</span><span className="text-right font-semibold text-zinc-200">{organizerName ?? t('tournaments.workspace.orgFallback', { id: tournament.organizerOrganizationId })}</span></div>
                                <div className="flex items-center justify-between gap-4 py-3"><span className="text-zinc-500">{t('tournaments.workspace.registration')}</span><RegistrationPolicyBadge policy={tournament.registrationPolicy} /></div>
                                {tournament.startDate && <div className="flex justify-between gap-4 py-3"><span className="text-zinc-500">{t('tournaments.workspace.starts')}</span><span className="font-semibold text-zinc-200">{formatTournamentDate(tournament.startDate, i18n.language)}</span></div>}
                                {tournament.endDate && <div className="flex justify-between gap-4 py-3"><span className="text-zinc-500">{t('tournaments.workspace.ends')}</span><span className="font-semibold text-zinc-200">{formatTournamentDate(tournament.endDate, i18n.language)}</span></div>}
                            </div>
                        </div>
                        {tournament.description && <div className="rounded-2xl border border-white/[0.08] bg-[#111612] px-5 py-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">{t('tournaments.workspace.description')}</p><p className="mt-3 text-sm leading-6 text-zinc-300">{tournament.description}</p></div>}
                        {tournament.rules && <div className="rounded-2xl border border-white/[0.08] bg-[#111612] px-5 py-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">{t('tournaments.workspace.rules')}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{tournament.rules}</p></div>}
                    </aside>
                </div>
            )}

            <ConfirmDialog open={confirmRemoveId != null} title={t('tournaments.workspace.removeParticipant')} message={t('tournaments.diagram.confirmUndone')} variant="danger" confirmLabel={t('tournaments.workspace.remove')} onCancel={() => setConfirmRemoveId(null)} onConfirm={() => { const entryId = confirmRemoveId; setConfirmRemoveId(null); if (entryId != null) void handleRemoveEntry(entryId); }} />

            {settingsOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={() => setSettingsOpen(false)}>
                    <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#111612] shadow-2xl" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-4"><p className="text-sm font-bold text-zinc-100">{t('tournaments.workspace.settings')}</p><button type="button" onClick={() => setSettingsOpen(false)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-100" title={t('tournaments.workspace.close')}><X className="h-4 w-4" /></button></div>
                        <EventSettingsPanel tournament={tournament} onRefresh={loadTournament} />
                    </div>
                </div>
            )}
        </div>
    );
};
