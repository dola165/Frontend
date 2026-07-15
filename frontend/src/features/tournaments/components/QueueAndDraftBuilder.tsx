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
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    info: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    danger: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    neutral: 'bg-[#16181d] text-[#a1a1aa] border-[#ffffff0d]',
};

const inputClass = 'min-w-0 flex-1 rounded-xl border border-[#ffffff0d] bg-[#16181d] px-3 py-2 text-sm text-[#f4f4f5] outline-none placeholder:text-[#a1a1aa] focus:border-[#16a34a]';
const selectClass = 'min-w-0 flex-1 rounded-xl border border-[#ffffff0d] bg-[#16181d] px-3 py-2 text-sm text-[#f4f4f5] outline-none';

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

    const btnDefault = 'inline-flex items-center gap-1.5 rounded-xl border border-[#ffffff0d] bg-[#16181d] px-3 py-1.5 text-xs font-semibold text-[#a1a1aa] transition-colors hover:bg-[#1a1c22] disabled:opacity-40';
    const btnDestructive = 'inline-flex items-center justify-center rounded-xl border border-rose-500/30 bg-[#16181d] p-1.5 text-rose-400 transition-colors hover:bg-rose-500/10 disabled:opacity-50';

    return (
        <div className="rounded-xl border border-[#ffffff0d] bg-[#16181d]">
            {/* Free Agent Queue */}
            <div>
                <div className="border-b border-[#ffffff0d] px-5 py-3">
                    <p className="text-sm font-semibold text-[#f4f4f5]">Free Agent Queue</p>
                </div>
                {isPlayerScope && !alreadyRegistered && (
                    <div className="border-b border-[#ffffff0d] px-4 py-3">
                        <button onClick={handleRegisterPlayer} disabled={actionLoading} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#16a34a] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#22c55e] disabled:opacity-60">
                            <UserPlus className="h-4 w-4" />
                            Register As Free Agent
                        </button>
                    </div>
                )}

                {queueLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-[#16a34a]" />
                    </div>
                ) : queueEntries.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-[#a1a1aa]">
                        {isPlayerScope ? 'No free agents in queue' : 'Queue only available for PLAYER-scope events'}
                    </div>
                ) : (
                    <>
                        <div className="max-h-[280px] overflow-y-auto">
                            {queueEntries.map((entry) => (
                                <label
                                    key={entry.id}
                                    className="flex cursor-pointer items-center gap-2 border-b border-[#ffffff0d] px-4 py-2 transition-colors hover:bg-[#1a1c22]"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedPlayerIds.has(entry.id)}
                                        onChange={() => togglePlayer(entry.id)}
                                        className="h-4 w-4 accent-[#16a34a]"
                                    />
                                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#f4f4f5]">
                                        {entry.displayName ?? entry.userId ?? `Entry #${entry.id}`}
                                    </span>
                                    <span className={`shrink-0 rounded-xl border px-2 py-0.5 text-xs font-semibold ${statusToneBorder[entryStatusTone(entry.status)] ?? statusToneBorder.neutral}`}>
                                        {entry.status}
                                    </span>
                                </label>
                            ))}
                        </div>
                        <div className="flex items-center justify-between border-b border-[#ffffff0d] px-4 py-2">
                            <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-[#a1a1aa] transition-colors hover:text-[#f4f4f5]">
                                <input
                                    type="checkbox"
                                    checked={queueEntries.length > 0 && queueEntries.every((e) => selectedPlayerIds.has(e.id))}
                                    onChange={toggleAllVisible}
                                    className="h-3.5 w-3.5 accent-[#16a34a]"
                                />
                                All
                            </label>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setQueuePage((p) => Math.max(0, p - 1))} disabled={queuePage === 0} className="rounded-xl p-1 text-[#a1a1aa] transition-colors hover:text-[#f4f4f5] disabled:opacity-30">
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <span className="text-xs font-medium text-[#a1a1aa]">{queuePage + 1}</span>
                                <button onClick={() => setQueuePage((p) => p + 1)} disabled={!queueHasMore} className="rounded-xl p-1 text-[#a1a1aa] transition-colors hover:text-[#f4f4f5] disabled:opacity-30">
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Draft Teams */}
            <div>
                <div className="border-b border-[#ffffff0d] bg-[#16181d] px-5 py-3">
                    <p className="text-sm font-semibold text-[#f4f4f5]">Draft Teams</p>
                </div>

                {/* Create Team */}
                <div className="flex gap-2 border-b border-[#ffffff0d] px-4 py-3">
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
                    <div className="flex gap-2 border-b border-[#ffffff0d] px-4 py-3">
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
                        <Loader2 className="h-5 w-5 animate-spin text-[#16a34a]" />
                    </div>
                ) : draftTeams.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-[#a1a1aa]">No draft teams yet</div>
                ) : (
                    <div className="max-h-[220px] overflow-y-auto">
                        {draftTeams.map((team) => (
                            <div
                                key={team.id}
                                className={`flex items-center justify-between gap-2 border-b border-[#ffffff0d] px-4 py-3 transition-colors ${
                                    selectedTeamId === team.id ? 'bg-[#16a34a]/10' : 'hover:bg-[#1a1c22]'
                                }`}
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-[#f4f4f5]">{team.name}</p>
                                    <p className="text-xs text-[#a1a1aa]">
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
                <div className={`border-t border-[#ffffff0d] px-4 py-3 text-sm font-semibold ${
                    messageType === 'success'
                        ? 'bg-[#16a34a]/10 text-[#16a34a]'
                        : 'bg-[#ef4444]/10 text-[#ef4444]'
                }`}>
                    {message}
                </div>
            )}
        </div>
    );
};
