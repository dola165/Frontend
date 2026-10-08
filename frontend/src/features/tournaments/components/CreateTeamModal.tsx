import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Pencil, Plus, Trash2, Trophy, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { extractApiErrorMessage } from '../../../utils/apiError';
import {
    addDraftTeamFakeMember,
    addDraftTeamMembers,
    createDraftTeam,
    disbandDraftTeam,
    fetchDraftTeam,
    fetchDraftTeams,
    promoteDraftTeam,
    removeDraftTeamFakeMember,
    removeDraftTeamMember,
    updateDraftTeam,
} from '../api';
import type { DraftTeamDetailDto, DraftTeamDto, TournamentEntryDto } from '../domain';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';

interface Props {
    tournamentId: number;
    /** Player entries available as roster material (unplaced players). */
    entries: TournamentEntryDto[];
    /** When set, the workspace opens with this team selected. */
    teamId?: number | null;
    onClose: () => void;
    onRefresh: () => void;
}

const memberLabel = (entry: TournamentEntryDto): string =>
    entry.displayName ?? entry.clubName ?? entry.squadName ?? `Entry #${entry.id}`;

export const CreateTeamModal = ({ tournamentId, entries, teamId, onClose, onRefresh }: Props) => {
    const { t } = useTranslation();
    const [teams, setTeams] = useState<DraftTeamDto[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<number | null>(teamId ?? null);
    const [team, setTeam] = useState<DraftTeamDetailDto | null>(null);
    const [teamName, setTeamName] = useState('');
    const [creating, setCreating] = useState(false);
    const [renaming, setRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const [busy, setBusy] = useState(false);
    const [fakeName, setFakeName] = useState('');
    const [message, setMessage] = useState<string | null>(null);
    const [confirm, setConfirm] = useState<'remove-member' | 'remove-fake' | 'disband' | null>(null);
    const [pendingMemberId, setPendingMemberId] = useState<number | null>(null);
    const [pendingFakeId, setPendingFakeId] = useState<number | null>(null);

    const loadTeams = () => {
        fetchDraftTeams(tournamentId)
            .then((data) => setTeams(data ?? []))
            .catch(() => setTeams([]));
    };

    useEffect(() => {
        loadTeams();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tournamentId]);

    // Select + load the selected team's roster.
    useEffect(() => {
        if (selectedTeamId == null) {
            setTeam(null);
            return;
        }
        let cancelled = false;
        fetchDraftTeam(tournamentId, selectedTeamId)
            .then((data) => {
                if (!cancelled) setTeam(data);
            })
            .catch(() => {
                if (!cancelled) setTeam(null);
            });
        return () => {
            cancelled = true;
        };
    }, [tournamentId, selectedTeamId]);

    const memberIds = useMemo(() => new Set((team?.members ?? []).map((m) => m.id)), [team?.members]);

    const addable = useMemo(
        () =>
            entries.filter(
                (e) => e.userId != null && (e.status === 'ACTIVE' || e.status === 'APPROVED') && !memberIds.has(e.id),
            ),
        [entries, memberIds],
    );

    const totalMembers = (team?.members.length ?? 0) + (team?.fakeMembers?.length ?? 0);

    const handleCreate = async () => {
        if (!teamName.trim()) return;
        setCreating(true);
        setMessage(null);
        try {
            const created = await createDraftTeam(tournamentId, { name: teamName.trim() });
            setTeams((prev) => [...prev, { id: created.id, name: created.name, status: created.status, memberCount: 0, promotedEntryId: null, createdAt: created.createdAt }]);
            setTeamName('');
            setSelectedTeamId(created.id);
            onRefresh();
        } catch (err) {
            setMessage(extractApiErrorMessage(err, t('tournaments.diagram.placeFailed')));
        } finally {
            setCreating(false);
        }
    };

    const run = async (fn: () => Promise<unknown>) => {
        if (!selectedTeamId) return;
        setBusy(true);
        setMessage(null);
        try {
            await fn();
            const detail = await fetchDraftTeam(tournamentId, selectedTeamId);
            setTeam(detail);
            loadTeams();
            onRefresh();
        } catch (err) {
            setMessage(extractApiErrorMessage(err, t('tournaments.diagram.placeFailed')));
        } finally {
            setBusy(false);
        }
    };

    const handleRename = () => {
        if (!renameValue.trim()) {
            setRenaming(false);
            return;
        }
        void run(async () => {
            await updateDraftTeam(tournamentId, selectedTeamId!, { name: renameValue.trim() });
        }).then(() => setRenaming(false));
    };

    const handleAddMember = (entryId: number) =>
        void run(() => addDraftTeamMembers(tournamentId, selectedTeamId!, { entryIds: [entryId] }));

    const handleAddFake = () => {
        if (!fakeName.trim()) return;
        const name = fakeName.trim();
        setFakeName('');
        void run(() => addDraftTeamFakeMember(tournamentId, selectedTeamId!, { name }));
    };

    const handlePromote = () => void run(() => promoteDraftTeam(tournamentId, selectedTeamId!));

    const handleDisband = () => {
        if (!selectedTeamId) return;
        setConfirm(null);
        setBusy(true);
        disbandDraftTeam(tournamentId, selectedTeamId)
            .then(() => {
                setSelectedTeamId(null);
                setTeam(null);
                loadTeams();
                onRefresh();
            })
            .catch((err) => setMessage(extractApiErrorMessage(err, t('tournaments.diagram.placeFailed'))))
            .finally(() => setBusy(false));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--color-overlay)]/60 p-4" onClick={onClose}>
            <div className="flex h-[90vh] w-full max-w-5xl flex-col rounded-xl border-2 border-[color:var(--color-border)]/10 bg-[color:var(--color-page)]" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between gap-3 border-b-2 border-[color:var(--color-border)]/10 px-6 py-4">
                    <p className="text-lg font-black text-[color:var(--color-text)]">{t('tournaments.diagram.createTeam')}</p>
                    <button onClick={onClose} className="text-[var(--color-secondary)] transition-colors hover:text-[color:var(--color-text)]" title="Close">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {message && (
                    <div className="border-b border-[color:var(--color-border)]/10 bg-[var(--color-danger)]/10 px-6 py-2.5 text-sm font-semibold text-[var(--color-danger)]">
                        {message}
                    </div>
                )}

                {/* Two-pane workspace */}
                <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)]">
                    {/* Left: teams + create */}
                    <div className="flex min-h-0 flex-col border-r-2 border-[color:var(--color-border)]/10 p-4">
                        <div className="flex gap-2">
                            <input
                                value={teamName}
                                onChange={(e) => setTeamName(e.target.value)}
                                placeholder={t('tournaments.diagram.teamName')}
                                className="min-w-0 flex-1 rounded-lg border border-[color:var(--color-border)]/15 bg-[color:var(--color-page)] px-3 py-2 text-sm font-semibold text-[color:var(--color-text)] outline-none placeholder:text-[var(--color-secondary)] focus:border-[var(--color-accent)]"
                            />
                            <button
                                onClick={handleCreate}
                                disabled={creating || !teamName.trim()}
                                title={t('tournaments.diagram.create')}
                                className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)] px-3 py-2 text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent)] disabled:opacity-40"
                            >
                                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                            </button>
                        </div>

                        <div className="mt-4 flex-1 space-y-1.5 overflow-y-auto">
                            {teams.length === 0 ? (
                                <p className="text-xs font-semibold text-[var(--color-secondary)]">{t('tournaments.diagram.noMembers')}</p>
                            ) : (
                                teams.map((tItem) => (
                                    <button
                                        key={tItem.id}
                                        onClick={() => setSelectedTeamId(tItem.id)}
                                        className={`flex w-full items-center justify-between gap-2 rounded-lg border-2 px-3 py-2 text-left transition-colors ${
                                            selectedTeamId === tItem.id
                                                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                                                : 'border-[color:var(--color-border)]/10 bg-[color:var(--color-page)] hover:bg-[color:var(--color-ink)]/5'
                                        }`}
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-bold text-[color:var(--color-text)]">{tItem.name}</p>
                                            <p className="text-[11px] font-semibold text-[var(--color-secondary)]">
                                                {tItem.status} &middot; {tItem.memberCount} / 5
                                            </p>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Right: selected team roster */}
                    <div className="flex min-h-0 flex-col p-4">
                        {team == null ? (
                            <div className="flex flex-1 items-center justify-center">
                                <p className="text-sm font-semibold text-[var(--color-secondary)]">
                                    {teams.length === 0
                                        ? t('tournaments.diagram.workspaceEmpty')
                                        : t('tournaments.diagram.noMembers')}
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Team header: name + rename + count */}
                                <div className="flex items-center justify-between gap-3">
                                    {renaming ? (
                                        <div className="flex min-w-0 flex-1 items-center gap-2">
                                            <input
                                                value={renameValue}
                                                onChange={(e) => setRenameValue(e.target.value)}
                                                className="min-w-0 flex-1 rounded-lg border border-[color:var(--color-border)]/15 bg-[color:var(--color-page)] px-3 py-2 text-sm font-bold text-[color:var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                                            />
                                            <button
                                                onClick={handleRename}
                                                disabled={busy || !renameValue.trim()}
                                                title={t('tournaments.diagram.rename')}
                                                className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)] px-3 py-2 text-[var(--color-on-accent)] disabled:opacity-40"
                                            >
                                                <Check className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex min-w-0 items-center gap-2">
                                            <p className="truncate text-xl font-black text-[color:var(--color-text)]">{team.name}</p>
                                            <button
                                                onClick={() => {
                                                    setRenameValue(team.name);
                                                    setRenaming(true);
                                                }}
                                                title={t('tournaments.diagram.rename')}
                                                className="shrink-0 text-[var(--color-secondary)] transition-colors hover:text-[var(--color-accent)]"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                            <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-black ${
                                                totalMembers >= 5 ? 'border-[var(--color-accent)]/50 bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : 'border-[color:var(--color-warning)]/50 bg-[color:var(--color-warning)]/10 text-[color:var(--color-warning)]'
                                            }`}>
                                                {totalMembers} / 5
                                            </span>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => setConfirm('disband')}
                                        disabled={busy}
                                        title={t('tournaments.diagram.confirmDisband')}
                                        className="inline-flex shrink-0 items-center justify-center rounded-lg border border-[color:var(--color-danger)]/40 bg-[color:var(--color-page)] p-2 text-[color:var(--color-danger)] transition-colors hover:bg-[color:var(--color-danger)]/10 disabled:opacity-40"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>

                                <div className="mt-4 grid min-h-0 flex-1 grid-cols-2 gap-4">
                                    {/* Roster */}
                                    <div className="min-h-0 overflow-y-auto">
                                        <p className="text-xs font-black uppercase tracking-[0.2em] text-[color:var(--color-text)]">
                                            {t('tournaments.diagram.draftTeamMembers')}
                                        </p>
                                        <div className="mt-2 space-y-1.5">
                                            {(team.members ?? []).map((m) => (
                                                <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border-2 border-[color:var(--color-border)]/10 bg-[color:var(--color-page)] px-3 py-2">
                                                    <span className="truncate text-sm font-bold text-[color:var(--color-text)]">{memberLabel(m)}</span>
                                                    <button
                                                        onClick={() => {
                                                            setPendingMemberId(m.id);
                                                            setConfirm('remove-member');
                                                        }}
                                                        disabled={busy}
                                                        title={t('tournaments.diagram.removeMember')}
                                                        className="shrink-0 text-[var(--color-secondary)] transition-colors hover:text-[color:var(--color-danger)] disabled:opacity-40"
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                            {(team.fakeMembers ?? []).map((f) => (
                                                <div key={f.id} className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-[color:var(--color-border)]/20 bg-[color:var(--color-page)] px-3 py-2">
                                                    <span className="truncate text-sm font-bold text-[var(--color-secondary)]">{f.name}</span>
                                                    <button
                                                        onClick={() => {
                                                            setPendingFakeId(f.id);
                                                            setConfirm('remove-fake');
                                                        }}
                                                        disabled={busy}
                                                        title={t('tournaments.diagram.removeMember')}
                                                        className="shrink-0 text-[var(--color-secondary)] transition-colors hover:text-[color:var(--color-danger)] disabled:opacity-40"
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                            {totalMembers === 0 && (
                                                <p className="text-xs font-semibold text-[var(--color-secondary)]">{t('tournaments.diagram.noMembers')}</p>
                                            )}
                                        </div>

                                        <div className="mt-4 flex items-center gap-2">
                                            <input
                                                value={fakeName}
                                                onChange={(e) => setFakeName(e.target.value)}
                                                placeholder={t('tournaments.diagram.fakePlayerPlaceholder')}
                                                className="min-w-0 flex-1 rounded-lg border border-[color:var(--color-border)]/15 bg-[color:var(--color-page)] px-3 py-2 text-sm font-semibold text-[color:var(--color-text)] outline-none placeholder:text-[var(--color-secondary)] focus:border-[var(--color-accent)]"
                                            />
                                            <button
                                                onClick={handleAddFake}
                                                disabled={busy || !fakeName.trim()}
                                                title={t('tournaments.diagram.addFakePlayer')}
                                                className="inline-flex shrink-0 items-center justify-center rounded-lg border border-[color:var(--color-border)]/15 bg-[color:var(--color-page)] px-3 py-2 text-[color:var(--color-text)] transition-colors hover:bg-[color:var(--color-ink)]/5 disabled:opacity-40"
                                            >
                                                <Plus className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Available players */}
                                    <div className="min-h-0 overflow-y-auto">
                                        <p className="text-xs font-black uppercase tracking-[0.2em] text-[color:var(--color-text)]">
                                            {t('tournaments.diagram.addMembers')}
                                        </p>
                                        <div className="mt-2 space-y-1.5">
                                            {addable.length === 0 ? (
                                                <p className="text-xs font-semibold text-[var(--color-secondary)]">{t('tournaments.diagram.allPlaced')}</p>
                                            ) : (
                                                addable.map((e) => (
                                                    <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg border-2 border-[color:var(--color-border)]/10 bg-[color:var(--color-page)] px-3 py-2">
                                                        <span className="truncate text-sm font-bold text-[color:var(--color-text)]">{memberLabel(e)}</span>
                                                        <button
                                                            onClick={() => handleAddMember(e.id)}
                                                            disabled={busy}
                                                            title={t('tournaments.diagram.addMembers')}
                                                            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)] p-1.5 text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent)] disabled:opacity-40"
                                                        >
                                                            <Plus className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Footer actions */}
                                <div className="mt-4">
                                    <button
                                        onClick={handlePromote}
                                        disabled={busy}
                                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-black text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent)] disabled:opacity-50"
                                    >
                                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
                                        {t('tournaments.diagram.sendToBracket')}
                                    </button>
                                    {totalMembers < 5 && (
                                        <p className="mt-1.5 text-xs font-semibold text-[color:var(--color-warning)]">{t('tournaments.diagram.readinessHint')}</p>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <ConfirmDialog
                open={confirm !== null}
                title={confirm === 'disband' ? t('tournaments.diagram.confirmDisband') : t('tournaments.diagram.removeMember')}
                message={confirm === 'disband' ? t('tournaments.diagram.confirmDisband') : t('tournaments.diagram.confirmRemoveMember')}
                variant="danger"
                confirmLabel={confirm === 'disband' ? t('tournaments.diagram.confirmDisband') : t('tournaments.diagram.removeMember')}
                onCancel={() => setConfirm(null)}
                onConfirm={() => {
                    if (confirm === 'remove-member' && pendingMemberId != null) {
                        const id = pendingMemberId;
                        setPendingMemberId(null);
                        setConfirm(null);
                        void run(() => removeDraftTeamMember(tournamentId, selectedTeamId!, id));
                    } else if (confirm === 'remove-fake' && pendingFakeId != null) {
                        const id = pendingFakeId;
                        setPendingFakeId(null);
                        setConfirm(null);
                        void run(() => removeDraftTeamFakeMember(tournamentId, selectedTeamId!, id));
                    } else if (confirm === 'disband') {
                        void handleDisband();
                    }
                }}
            />
        </div>
    );
};
