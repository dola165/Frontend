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
    removeDraftTeamMember,
} from '../api';
import type { DraftTeamDto, TournamentDetail, TournamentEntryDto } from '../domain';
import { draftTeamStatusLabel, entryStatusTone } from '../domain';

interface Props {
    tournamentId: number;
    tournament: TournamentDetail;
    onRefresh: () => void;
}

const statusToneBorder: Record<string, string> = {
    success: 'border-emerald-600 text-emerald-600',
    warning: 'border-amber-600 text-amber-600',
    info: 'border-sky-600 text-sky-600',
    danger: 'border-rose-600 text-rose-600',
    neutral: 'border-zinc-500 text-zinc-500',
};

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
            // silent — draft teams are secondary
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

    return (
        <div className="flex flex-col gap-0">
            {/* Free Agent Queue */}
            <div>
                <div className="tw-section-header">Free Agent Queue</div>
                {isPlayerScope && !alreadyRegistered && (
                    <div className="border-b border-subtle px-3 py-2">
                        <button
                            onClick={handleRegisterPlayer}
                            disabled={actionLoading}
                            className="tw-btn-default w-full"
                        >
                            <UserPlus className="mr-1.5 inline-block h-3.5 w-3.5" />
                            Register As Free Agent
                        </button>
                    </div>
                )}

                {queueLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted" />
                    </div>
                ) : queueEntries.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-muted">
                        {isPlayerScope ? 'No free agents in queue' : 'Queue only available for PLAYER-scope tournaments'}
                    </div>
                ) : (
                    <>
                        <div className="max-h-[320px] overflow-y-auto">
                            {queueEntries.map((entry) => (
                                <label
                                    key={entry.id}
                                    className="flex cursor-pointer items-center gap-2 border-b border-subtle px-3 py-1.5 transition-colors hover:bg-surface"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedPlayerIds.has(entry.id)}
                                        onChange={() => togglePlayer(entry.id)}
                                        className="h-3.5 w-3.5 accent-[var(--accent-highlight)]"
                                    />
                                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-primary">
                                        {entry.displayName ?? entry.userId ?? `Entry #${entry.id}`}
                                    </span>
                                    <span className={`tw-status-badge ${statusToneBorder[entryStatusTone(entry.status)] ?? statusToneBorder.neutral}`}>
                                        {entry.status}
                                    </span>
                                </label>
                            ))}
                        </div>
                        <div className="flex items-center justify-between border-b border-subtle px-3 py-1.5">
                            <label className="flex cursor-pointer items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted transition-colors hover:text-primary">
                                <input
                                    type="checkbox"
                                    checked={queueEntries.length > 0 && queueEntries.every((e) => selectedPlayerIds.has(e.id))}
                                    onChange={toggleAllVisible}
                                    className="h-3 w-3 accent-[var(--accent-highlight)]"
                                />
                                All
                            </label>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setQueuePage((p) => Math.max(0, p - 1))}
                                    disabled={queuePage === 0}
                                    className="p-0.5 text-muted transition-colors hover:text-primary disabled:opacity-30"
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                </button>
                                <span className="text-[10px] font-bold text-muted">{queuePage + 1}</span>
                                <button
                                    onClick={() => setQueuePage((p) => p + 1)}
                                    disabled={!queueHasMore}
                                    className="p-0.5 text-muted transition-colors hover:text-primary disabled:opacity-30"
                                >
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Draft Teams */}
            <div className="mt-0">
                <div className="tw-section-header">Draft Teams</div>

                {/* Create Team */}
                <div className="flex gap-1 border-b border-subtle px-3 py-2">
                    <input
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') void handleCreateTeam(); }}
                        placeholder="Team name"
                        className="min-w-0 flex-1 border border-subtle bg-base px-2 py-1 text-xs text-primary outline-none placeholder:text-muted focus:border-accent-primary"
                    />
                    <button onClick={handleCreateTeam} disabled={creatingTeam || !newTeamName.trim()} className="tw-btn-default">
                        {creatingTeam ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    </button>
                </div>

                {/* Team Selector + Add Selected */}
                {draftTeams.length > 0 && (
                    <div className="flex gap-1 border-b border-subtle px-3 py-2">
                        <select
                            value={selectedTeamId ?? ''}
                            onChange={(e) => setSelectedTeamId(e.target.value ? Number(e.target.value) : null)}
                            className="min-w-0 flex-1 border border-subtle bg-base px-2 py-1 text-xs text-primary outline-none"
                        >
                            <option value="">Select team...</option>
                            {draftTeams.filter((t) => t.status === 'FORMING').map((t) => (
                                <option key={t.id} value={t.id}>{t.name} ({t.memberCount})</option>
                            ))}
                        </select>
                        <button
                            onClick={handleAddMembers}
                            disabled={actionLoading || selectedTeamId == null || selectedPlayerIds.size === 0}
                            className="tw-btn-default disabled:opacity-40"
                        >
                            <Users className="mr-1 inline-block h-3 w-3" />
                            Add
                        </button>
                    </div>
                )}

                {/* Team List */}
                {draftTeamsLoading ? (
                    <div className="flex justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-muted" />
                    </div>
                ) : draftTeams.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-muted">No draft teams yet</div>
                ) : (
                    <div className="max-h-[240px] overflow-y-auto">
                        {draftTeams.map((team) => (
                            <div
                                key={team.id}
                                className={`flex items-center justify-between gap-2 border-b border-subtle px-3 py-2 transition-colors ${
                                    selectedTeamId === team.id ? 'bg-accent-primary-soft' : 'hover:bg-surface'
                                }`}
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-bold text-primary">{team.name}</p>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                                        {draftTeamStatusLabel(team.status)} &middot; {team.memberCount} members
                                    </p>
                                </div>
                                <div className="flex gap-1">
                                    {team.status === 'FORMING' && (
                                        <button
                                            onClick={() => handlePromote(team.id)}
                                            disabled={actionLoading}
                                            className="tw-btn-default text-xs"
                                            title="Promote to bracket"
                                        >
                                            Promote
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDisband(team.id)}
                                        disabled={actionLoading}
                                        className="tw-btn-destructive"
                                        title="Disband team"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Message toast */}
            {message && (
                <div className={`mx-3 mt-2 border px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${
                    messageType === 'success'
                        ? 'border-emerald-600 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10'
                        : 'border-rose-600 text-rose-600 bg-rose-50 dark:bg-rose-500/10'
                }`}>
                    {message}
                </div>
            )}
        </div>
    );
};
