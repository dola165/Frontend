import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Mail, Settings, Swords, Trash2, Trophy, Users } from 'lucide-react';
import { extractApiErrorMessage } from '../utils/apiError';
import { fetchTournament, removeEntry } from '../features/tournaments/api';
import { BracketEditor } from '../features/tournaments/components/BracketEditor';
import { EntryReviewPanel } from '../features/tournaments/components/EntryReviewPanel';
import { EventSettingsPanel } from '../features/tournaments/components/EventSettingsPanel';
import { QueueAndDraftBuilder } from '../features/tournaments/components/QueueAndDraftBuilder';
import { TournamentInvitationsPanel } from '../features/tournaments/components/TournamentInvitationsPanel';
import type { TournamentDetail, TournamentEntryDto } from '../features/tournaments/domain';
import { entryStatusTone, entryTypeLabel, tournamentScopeLabel, tournamentVisibilityLabel } from '../features/tournaments/domain';

type WorkspaceTab = 'participants' | 'bracketing' | 'invitations' | 'settings';

const tabs: { key: WorkspaceTab; label: string; icon: typeof Users }[] = [
    { key: 'participants', label: 'Participants', icon: Users },
    { key: 'bracketing', label: 'Bracketing', icon: Swords },
    { key: 'invitations', label: 'Invitations', icon: Mail },
    { key: 'settings', label: 'Settings', icon: Settings },
];

const statusToneBorder: Record<string, string> = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
    warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
    info: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30',
    danger: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30',
    neutral: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/30',
};

const entryLabel = (entry: TournamentEntryDto): string =>
    entry.displayName ?? entry.clubName ?? entry.squadName ?? `Entry #${entry.id}`;

const entrySubLabel = (entry: TournamentEntryDto): string | null => {
    if (entry.clubName && entry.displayName && entry.displayName !== entry.clubName) return entry.clubName;
    if (entry.squadName && entry.clubName) return `${entry.clubName} / ${entry.squadName}`;
    return null;
};

export const TournamentWorkspacePage = () => {
    const { tournamentId: tournamentIdParam } = useParams<{ tournamentId: string }>();
    const tournamentId = tournamentIdParam ? Number(tournamentIdParam) : null;

    const [tournament, setTournament] = useState<TournamentDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<WorkspaceTab>('participants');
    const [removingId, setRemovingId] = useState<number | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [messageType, setMessageType] = useState<'success' | 'error'>('success');

    const showMessage = (text: string, type: 'success' | 'error') => {
        setMessage(text);
        setMessageType(type);
        setTimeout(() => setMessage(null), 4000);
    };

    const loadTournament = useCallback(async () => {
        if (tournamentId == null || Number.isNaN(tournamentId)) {
            setError('Invalid tournament ID.');
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            setTournament(await fetchTournament(tournamentId));
        } catch (err) {
            setError(extractApiErrorMessage(err, 'Failed to load tournament.'));
        } finally {
            setLoading(false);
        }
    }, [tournamentId]);

    useEffect(() => { void loadTournament(); }, [loadTournament]);

    const pendingEntries = useMemo(
        () => (tournament?.entries ?? []).filter((e) => e.status === 'PENDING'),
        [tournament?.entries],
    );

    const confirmedEntries = useMemo(
        () => (tournament?.entries ?? []).filter((e) => e.status !== 'PENDING' && e.status !== 'REJECTED' && e.status !== 'WITHDRAWN'),
        [tournament?.entries],
    );

    const handleRemoveEntry = async (entryId: number) => {
        if (tournamentId == null) return;
        setRemovingId(entryId);
        try {
            await removeEntry(tournamentId, entryId);
            showMessage('Participant removed from event.', 'success');
            void loadTournament();
        } catch (err) {
            showMessage(extractApiErrorMessage(err, 'Failed to remove participant.'), 'error');
        } finally {
            setRemovingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-full items-center justify-center bg-[#f2f4f7] dark:bg-slate-950">
                <div className="flex flex-col items-center gap-4 text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-[#00c853]" />
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Loading Event</p>
                </div>
            </div>
        );
    }

    if (error || !tournament) {
        return (
            <div className="flex min-h-full items-center justify-center bg-[#f2f4f7] dark:bg-slate-950">
                <div className="max-w-md text-center">
                    <Trophy className="mx-auto mb-4 h-12 w-12 text-slate-300 dark:text-slate-600" />
                    <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">Event Not Found</p>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{error ?? 'The tournament could not be loaded.'}</p>
                    <Link to="/tournaments/setup" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#00c853] px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#00e676]">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Setup
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-full bg-[#f2f4f7] font-sans text-slate-950 selection:bg-[#00c853]/20 dark:bg-slate-950 dark:text-slate-100 dark:selection:bg-[#00c853]/30">
            {/* Header */}
            <div className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className="mx-auto max-w-[1880px] px-6 py-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <Link to="/tournaments/setup" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                                <ArrowLeft className="h-4 w-4" />
                                Setup
                            </Link>
                            <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-950 dark:text-white">
                                {tournament.name}
                            </h1>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Event #{tournament.id} &middot; {tournament.status}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {tournamentScopeLabel(tournament.participantScope)}
                            </span>
                            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {tournamentVisibilityLabel(tournament.visibility)}
                            </span>
                            <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                                tournament.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' :
                                tournament.status === 'COMPLETED' ? 'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400' :
                                tournament.status === 'CANCELLED' ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' :
                                'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300'
                            }`}>
                                {tournament.status}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Three-column workspace */}
            <div className="mx-auto grid max-w-[1880px] grid-cols-1 gap-0 px-4 pb-10 pt-4 xl:grid-cols-[280px_minmax(0,1fr)_280px] xl:gap-4 xl:px-6">
                {/* Left Rail — Queue & Draft Builder */}
                <aside className="flex flex-col gap-3">
                    <QueueAndDraftBuilder
                        tournamentId={tournament.id}
                        tournament={tournament}
                        onRefresh={loadTournament}
                    />
                </aside>

                {/* Center — Tabbed workspace */}
                <section className="min-w-0">
                    {/* Tab bar */}
                    <div className="flex rounded-t-[28px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`flex flex-1 items-center justify-center gap-2 border-r border-slate-200 px-4 py-3.5 text-sm font-semibold transition-colors last:border-r-0 dark:border-slate-800 ${
                                        activeTab === tab.key
                                            ? 'bg-[#f2f4f7] text-[#00c853] dark:bg-slate-950 dark:text-[#00c853]'
                                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Message toast */}
                    {message && (
                        <div className={`border border-t-0 border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-800 ${
                            messageType === 'success'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                        }`}>
                            {message}
                        </div>
                    )}

                    {/* Tab content */}
                    <div className="rounded-b-[28px] border border-t-0 border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                        {activeTab === 'participants' && (
                            <div className="flex flex-col">
                                {/* Pending Applications */}
                                <EntryReviewPanel
                                    tournamentId={tournament.id}
                                    tournament={tournament}
                                    onRefresh={loadTournament}
                                />

                                {/* Confirmed Roster */}
                                <div>
                                    <div className="border-b border-slate-200 bg-[#f2f4f7] px-5 py-3 dark:border-slate-800 dark:bg-slate-800/50">
                                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                            Confirmed Roster
                                            <span className="ml-2 text-slate-400">{confirmedEntries.length}</span>
                                        </p>
                                    </div>
                                    {confirmedEntries.length === 0 ? (
                                        <div className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                                            No confirmed participants yet. Approve pending applications above.
                                        </div>
                                    ) : (
                                        <div className="max-h-[500px] overflow-y-auto">
                                            {confirmedEntries.map((entry) => {
                                                const tone = entryStatusTone(entry.status);
                                                const type = entryTypeLabel(entry);
                                                return (
                                                    <div
                                                        key={entry.id}
                                                        className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                                                    >
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                                                                    {entryLabel(entry)}
                                                                </p>
                                                                <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                                                                    type === 'Club' ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300' :
                                                                    type === 'Squad' ? 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300' :
                                                                    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
                                                                }`}>
                                                                    {type}
                                                                </span>
                                                            </div>
                                                            {entrySubLabel(entry) && (
                                                                <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{entrySubLabel(entry)}</p>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusToneBorder[tone] ?? statusToneBorder.neutral}`}>
                                                                {entry.status}
                                                            </span>
                                                            <button
                                                                onClick={() => handleRemoveEntry(entry.id)}
                                                                disabled={removingId === entry.id}
                                                                className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-white p-2 text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/30 dark:bg-slate-900 dark:text-rose-400 dark:hover:bg-rose-500/10"
                                                                title="Remove from event"
                                                            >
                                                                {removingId === entry.id ? (
                                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                ) : (
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'bracketing' && (
                            <BracketEditor
                                tournamentId={tournament.id}
                                tournament={tournament}
                                onRefresh={loadTournament}
                            />
                        )}

                        {activeTab === 'invitations' && (
                            <TournamentInvitationsPanel tournamentId={tournament.id} />
                        )}

                        {activeTab === 'settings' && (
                            <EventSettingsPanel
                                tournament={tournament}
                                onRefresh={loadTournament}
                            />
                        )}
                    </div>
                </section>

                {/* Right Rail — Info Panel */}
                <aside className="flex flex-col gap-3">
                    <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                            <p className="text-sm font-semibold text-slate-950 dark:text-white">Event Info</p>
                        </div>
                        <div className="divide-y divide-slate-200 px-5 py-1 text-sm dark:divide-slate-800">
                            <div className="flex justify-between gap-3 py-2.5">
                                <span className="text-slate-500">Host Club</span>
                                <span className="font-semibold text-slate-950 dark:text-white">{tournament.hostClubId ?? 'None'}</span>
                            </div>
                            <div className="flex justify-between gap-3 py-2.5">
                                <span className="text-slate-500">Organizer</span>
                                <span className="font-semibold text-slate-950 dark:text-white">#{tournament.organizerOrganizationId}</span>
                            </div>
                            <div className="flex justify-between gap-3 py-2.5">
                                <span className="text-slate-500">Registration</span>
                                <span className="font-semibold text-slate-950 dark:text-white">{tournament.registrationPolicy === 'INVITE_ONLY' ? 'Invite-Only' : 'Open'}</span>
                            </div>
                            {tournament.startDate && (
                                <div className="flex justify-between gap-3 py-2.5">
                                    <span className="text-slate-500">Starts</span>
                                    <span className="font-semibold text-slate-950 dark:text-white">{new Date(tournament.startDate).toLocaleDateString()}</span>
                                </div>
                            )}
                            {tournament.endDate && (
                                <div className="flex justify-between gap-3 py-2.5">
                                    <span className="text-slate-500">Ends</span>
                                    <span className="font-semibold text-slate-950 dark:text-white">{new Date(tournament.endDate).toLocaleDateString()}</span>
                                </div>
                            )}
                            {tournament.registrationOpensAt && (
                                <div className="flex justify-between gap-3 py-2.5">
                                    <span className="text-slate-500">Reg Opens</span>
                                    <span className="font-semibold text-slate-950 dark:text-white">{new Date(tournament.registrationOpensAt).toLocaleString()}</span>
                                </div>
                            )}
                            {tournament.registrationClosesAt && (
                                <div className="flex justify-between gap-3 py-2.5">
                                    <span className="text-slate-500">Reg Closes</span>
                                    <span className="font-semibold text-slate-950 dark:text-white">{new Date(tournament.registrationClosesAt).toLocaleString()}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {tournament.description && (
                        <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                                <p className="text-sm font-semibold text-slate-950 dark:text-white">Description</p>
                            </div>
                            <p className="px-5 py-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{tournament.description}</p>
                        </div>
                    )}

                    {tournament.rules && (
                        <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                                <p className="text-sm font-semibold text-slate-950 dark:text-white">Rules</p>
                            </div>
                            <p className="whitespace-pre-wrap px-5 py-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{tournament.rules}</p>
                        </div>
                    )}

                    {(tournament.staffAssignments?.length ?? 0) > 0 && (
                        <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                                <p className="text-sm font-semibold text-slate-950 dark:text-white">Staff ({tournament.staffAssignments.length})</p>
                            </div>
                            <div className="max-h-[200px] overflow-y-auto">
                                {tournament.staffAssignments.map((s) => (
                                    <div key={s.id} className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3 text-sm dark:border-slate-800">
                                        <span className="truncate font-semibold text-slate-950 dark:text-white">{s.fullName}</span>
                                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">{s.role}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
};
