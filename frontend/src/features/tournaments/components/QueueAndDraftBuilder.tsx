import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Plus, Trash2, UserPlus, Users } from 'lucide-react';
import { extractApiErrorMessage } from '../../../utils/apiError';
import {
    addDraftTeamMembers,
    createDraftTeam,
    disbandDraftTeam,
    fetchDraftTeams,
    fetchPlayerQueue,
    promoteDraftTeam,
    registerPlayer,
} from '../api';
import type { DraftTeamDto, TournamentDetail, TournamentEntryDto } from '../domain';
import { draftTeamStatusLabel, entryStatusTone } from '../domain';

interface Props {
    tournamentId: number;
    tournament: TournamentDetail;
    onRefresh: () => void;
}

const statusToneBorder: Record<string, string> = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
    warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
    info: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30',
    danger: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30',
    neutral: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/30',
};

const inputClass = 'min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#1f6feb] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-[#4c8dff]';
const selectClass = 'min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

export const QueueAndDraftBuilder = ({ tournamentId, tournament, onRefresh }: Props) => {
    const [queueEntries, setQueueEntries] = useState<TournamentEntryDto[]>([]);
    const [queuePage, setQueuePage] = useState(0);
    const [queueHasMore, setQueueHasMore] = useState(false);
    const [queueLoading, setQueueLoading] = useState(false);
    const [draftTeams, setDraftTeams] = useState<DraftTeamDto[]>([]);
    const [draftTeamsLoading, setDraftTeamsLoading] = useState(false);
    const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(new Set());
    const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
    const [newTeamName, setNewTeamName] = useState('');
    const [creatingTeam, setCreatingTeam] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [messageType, setMessageType] = useState<'success' | 'error'>('success');

    const showMessage = (text: string, type: 'success' | 'error') => {
        setMessage(text);
        setMessageType(type);
        setTimeout(() => setMessage(null), 4000);
    };

    const loadQueue = useCallback(async (page: number) => {
        setQueueLoading(true);
        try {
            const data = await fetchPlayerQueue(tournamentId, 'ACTIVE', page, 15);
            setQueueEntries(data.entries ?? []);
            setQueueHasMore((data.entries ?? []).length === 15);
        } catch (err) {
            showMessage(extractApiErrorMessage(err, 'Failed to load player queue'), 'error');
        } finally {
            setQueueLoading(false);
        }
    }, [tournamentId]);

    const loadDraftTeams = useCallback(async () => {
        setDraftTeamsLoading(true);
        try {
            setDraftTeams(await fetchDraftTeams(tournamentId));
        } catch {
            // silent
        } finally {
            setDraftTeamsLoading(false);
        }
    }, [tournamentId]);

    useEffect(() => { void loadQueue(queuePage); }, [loadQueue, queuePage]);
    useEffect(() => { void loadDraftTeams(); }, [loadDraftTeams]);

    const togglePlayer = (entryId: number) => {
        setSelectedPlayerIds((prev) => {
            const next = new Set(prev);
            if (next.has(entryId)) next.delete(entryId); else next.add(entryId);
            return next;
        });
    };

    const toggleAllVisible = () => {
        const allSelected = queueEntries.every((e) => selectedPlayerIds.has(e.id));
        if (allSelected) {
            setSelectedPlayerIds(new Set());
        } else {
            setSelectedPlayerIds((prev) => {
                const next = new Set(prev);
                queueEntries.forEach((e) => next.add(e.id));
                return next;
            });
        }
    };

    const handleRegisterPlayer = async () => {
        setActionLoading(true);
        try {
            await registerPlayer(tournamentId);
            showMessage('Registered as free agent', 'success');
            onRefresh();
            void loadQueue(queuePage);
        } catch (err) {
            showMessage(extractApiErrorMessage(err, 'Failed to register'), 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleCreateTeam = async () => {
        if (!newTeamName.trim()) return;
        setCreatingTeam(true);
        try {
            const team = await createDraftTeam(tournamentId, { name: newTeamName.trim() });
            setNewTeamName('');
            setSelectedTeamId(team.id);
            showMessage(`Team "${team.name}" created`, 'success');
            void loadDraftTeams();
            onRefresh();
        } catch (err) {
            showMessage(extractApiErrorMessage(err, 'Failed to create team'), 'error');
        } finally {
            setCreatingTeam(false);
        }
    };

    const handleAddMembers = async () => {
        if (selectedTeamId == null || selectedPlayerIds.size === 0) return;
        setActionLoading(true);
        try {
            await addDraftTeamMembers(tournamentId, selectedTeamId, { entryIds: [...selectedPlayerIds] });
            setSelectedPlayerIds(new Set());
            showMessage(`Added ${selectedPlayerIds.size} player(s) to team`, 'success');
            onRefresh();
            void loadDraftTeams();
        } catch (err) {
            showMessage(extractApiErrorMessage(err, 'Failed to add members'), 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handlePromote = async (teamId: number) => {
        setActionLoading(true);
        try {
            await promoteDraftTeam(tournamentId, teamId);
            showMessage('Team promoted to bracket', 'success');
            onRefresh();
            void loadDraftTeams();
        } catch (err) {
            showMessage(extractApiErrorMessage(err, 'Failed to promote team'), 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDisband = async (teamId: number) => {
        setActionLoading(true);
        try {
            await disbandDraftTeam(tournamentId, teamId);
            if (selectedTeamId === teamId) setSelectedTeamId(null);
            showMessage('Team disbanded', 'success');
            void loadDraftTeams();
        } catch (err) {
            showMessage(extractApiErrorMessage(err, 'Failed to disband team'), 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const isPlayerScope = tournament.participantScope === 'PLAYER';
    const alreadyRegistered = tournament.entries?.some(
        (e) => e.userId != null && e.status !== 'WITHDRAWN' && e.status !== 'REJECTED',
    );

    const btnDefault = 'inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800';
    const btnDestructive = 'inline-flex items-center justify-center rounded-full border border-rose-200 bg-white p-1.5 text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/30 dark:bg-slate-900 dark:text-rose-400 dark:hover:bg-rose-500/10';

    return (
        <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {/* Free Agent Queue */}
            <div>
                <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Free Agent Queue</p>
                </div>
                {isPlayerScope && !alreadyRegistered && (
                    <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                        <button onClick={handleRegisterPlayer} disabled={actionLoading} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1f6feb] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1957bb] disabled:opacity-60">
                            <UserPlus className="h-4 w-4" />
                            Register As Free Agent
                        </button>
                    </div>
                )}

                {queueLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-[#1f6feb]" />
                    </div>
                ) : queueEntries.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                        {isPlayerScope ? 'No free agents in queue' : 'Queue only available for PLAYER-scope events'}
                    </div>
                ) : (
                    <>
                        <div className="max-h-[280px] overflow-y-auto">
                            {queueEntries.map((entry) => (
                                <label
                                    key={entry.id}
                                    className="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-4 py-2 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedPlayerIds.has(entry.id)}
                                        onChange={() => togglePlayer(entry.id)}
                                        className="h-4 w-4 accent-[#1f6feb]"
                                    />
                                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 dark:text-slate-200">
                                        {entry.displayName ?? entry.userId ?? `Entry #${entry.id}`}
                                    </span>
                                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${statusToneBorder[entryStatusTone(entry.status)] ?? statusToneBorder.neutral}`}>
                                        {entry.status}
                                    </span>
                                </label>
                            ))}
                        </div>
                        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-800">
                            <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                                <input
                                    type="checkbox"
                                    checked={queueEntries.length > 0 && queueEntries.every((e) => selectedPlayerIds.has(e.id))}
                                    onChange={toggleAllVisible}
                                    className="h-3.5 w-3.5 accent-[#1f6feb]"
                                />
                                All
                            </label>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setQueuePage((p) => Math.max(0, p - 1))} disabled={queuePage === 0} className="rounded-full p-1 text-slate-400 transition-colors hover:text-slate-900 disabled:opacity-30 dark:hover:text-white">
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{queuePage + 1}</span>
                                <button onClick={() => setQueuePage((p) => p + 1)} disabled={!queueHasMore} className="rounded-full p-1 text-slate-400 transition-colors hover:text-slate-900 disabled:opacity-30 dark:hover:text-white">
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Draft Teams */}
            <div>
                <div className="border-b border-slate-200 bg-[#f2f4f7] px-5 py-3 dark:border-slate-800 dark:bg-slate-800/50">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Draft Teams</p>
                </div>

                {/* Create Team */}
                <div className="flex gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                    <input
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') void handleCreateTeam(); }}
                        placeholder="Team name"
                        className={inputClass}
                    />
                    <button onClick={handleCreateTeam} disabled={creatingTeam || !newTeamName.trim()} className={btnDefault}>
                        {creatingTeam ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    </button>
                </div>

                {/* Team Selector + Add */}
                {draftTeams.length > 0 && (
                    <div className="flex gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                        <select
                            value={selectedTeamId ?? ''}
                            onChange={(e) => setSelectedTeamId(e.target.value ? Number(e.target.value) : null)}
                            className={selectClass}
                        >
                            <option value="">Select team...</option>
                            {draftTeams.filter((t) => t.status === 'FORMING').map((t) => (
                                <option key={t.id} value={t.id}>{t.name} ({t.memberCount})</option>
                            ))}
                        </select>
                        <button onClick={handleAddMembers} disabled={actionLoading || selectedTeamId == null || selectedPlayerIds.size === 0} className={`${btnDefault} disabled:opacity-40`}>
                            <Users className="h-3.5 w-3.5" />
                            Add
                        </button>
                    </div>
                )}

                {/* Team List */}
                {draftTeamsLoading ? (
                    <div className="flex justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-[#1f6feb]" />
                    </div>
                ) : draftTeams.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No draft teams yet</div>
                ) : (
                    <div className="max-h-[220px] overflow-y-auto">
                        {draftTeams.map((team) => (
                            <div
                                key={team.id}
                                className={`flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 transition-colors dark:border-slate-800 ${
                                    selectedTeamId === team.id ? 'bg-blue-50 dark:bg-blue-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                }`}
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{team.name}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {draftTeamStatusLabel(team.status)} &middot; {team.memberCount} members
                                    </p>
                                </div>
                                <div className="flex gap-1.5">
                                    {team.status === 'FORMING' && (
                                        <button onClick={() => handlePromote(team.id)} disabled={actionLoading} className={btnDefault} title="Promote to bracket">
                                            Promote
                                        </button>
                                    )}
                                    <button onClick={() => handleDisband(team.id)} disabled={actionLoading} className={btnDestructive} title="Disband team">
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Message toast */}
            {message && (
                <div className={`rounded-b-[28px] border-t px-4 py-3 text-sm font-semibold ${
                    messageType === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300'
                }`}>
                    {message}
                </div>
            )}
        </div>
    );
};
