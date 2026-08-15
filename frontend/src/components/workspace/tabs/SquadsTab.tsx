import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Loader2, Pencil, ShieldCheck, Trash2, X } from 'lucide-react';
import { apiClient } from '../../../api/axiosConfig';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { SectionHeader, EmptyState } from '../helpers';
import { SquadRosterTable, type SquadRosterGroup } from '../../squads/SquadRosterTable';
import { SquadRosterGrid } from '../../squads/SquadRosterGrid';
import { AddPlayerToSquadModal } from '../../squads/AddPlayerToSquadModal';
import {
    updateSquad,
    deleteSquad,
    removePlayerFromSquad,
    updateSquadPlayer,
    type UpdateSquadPayload
} from '../../../features/clubs/api';
import type { ClubManagementOverview } from '../../../features/clubs/domain';
import { usePersistedState } from '../../../utils/usePersistedState';

// ── types ──

interface SquadDto {
    id: number;
    clubId: number;
    name: string;
    category: string;
    gender: string;
}

interface SquadsTabProps {
    clubId: number;
    overview: ClubManagementOverview | null;
    setParentError: (msg: string | null) => void;
    setParentSuccess: (msg: string | null) => void;
}

// ── component ──

export const SquadsTab = ({ clubId, overview, setParentError, setParentSuccess }: SquadsTabProps) => {
    // squad list
    const [squads, setSquads] = useState<SquadDto[]>([]);
    const [squadsLoading, setSquadsLoading] = useState(true);

    // selection + roster
    const [selectedSquadId, setSelectedSquadId] = useState<number | null>(null);
    const [rosterGroups, setRosterGroups] = useState<SquadRosterGroup[]>([]);
    const [rosterLoading, setRosterLoading] = useState(false);

    // view toggle
    const [cardView, setCardView] = usePersistedState('gkz:roster:cardView', false);

    // edit
    const [editingSquadId, setEditingSquadId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<UpdateSquadPayload>({});

    // create form
    const [squadForm, setSquadForm] = useState({ name: '', category: 'SENIOR', gender: 'MALE' });

    // confirmation dialogs
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
    const pendingDeleteRef = useRef<{ squadId: number; squadName: string } | null>(null);
    const pendingRemoveRef = useRef<{ userId: number; playerName: string } | null>(null);

    // modals + actions
    const [showAddPlayers, setShowAddPlayers] = useState(false);
    const [removingPlayerId, setRemovingPlayerId] = useState<number | null>(null);

    // loading states
    const [localPending, setLocalPending] = useState<string | null>(null);
    const [savingSquad, setSavingSquad] = useState(false);
    const [deletingSquadId, setDeletingSquadId] = useState<number | null>(null);

    const selectedSquad = squads.find((s) => s.id === selectedSquadId) ?? null;

    // ── data loading ──

    const loadSquads = useCallback(async () => {
        setSquadsLoading(true);
        try {
            const response = await apiClient.get<SquadDto[]>(`/clubs/${clubId}/squads`);
            const list = response.data || [];
            setSquads(list);
            setSelectedSquadId(prev => prev ?? list[0]?.id ?? null);
        } catch {
            // non-critical
        } finally {
            setSquadsLoading(false);
        }
    }, [clubId]);

    const loadRoster = useCallback(async (squadId: number) => {
        setRosterLoading(true);
        try {
            const response = await apiClient.get<SquadRosterGroup[]>(`/clubs/${clubId}/squads/${squadId}/roster`);
            setRosterGroups(response.data || []);
        } catch {
            setRosterGroups([]);
        } finally {
            setRosterLoading(false);
        }
    }, [clubId]);

    useEffect(() => { void loadSquads(); }, [loadSquads]);

    useEffect(() => {
        if (selectedSquadId) {
            void loadRoster(selectedSquadId);
        } else {
            setRosterGroups([]);
        }
    }, [selectedSquadId, loadRoster]);

    // ── actions ──

    const runAction = async (key: string, action: () => Promise<void>) => {
        setLocalPending(key);
        try {
            await action();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Request failed.';
            setParentError(msg);
        } finally {
            setLocalPending(null);
        }
    };

    const handleCreateSquad = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        await runAction('create-squad', async () => {
            await apiClient.post(`/clubs/${clubId}/squads`, squadForm);
            setSquadForm({ name: '', category: 'SENIOR', gender: 'MALE' });
            setParentSuccess('Squad created.');
            await loadSquads();
        });
    };

    const handleUpdateSquad = async (squadId: number) => {
        if (!editForm.name?.trim()) return;
        setSavingSquad(true);
        try {
            await updateSquad(clubId, squadId, editForm);
            setSquads((prev) => prev.map((s) => (s.id === squadId ? { ...s, ...editForm } as SquadDto : s)));
            setEditingSquadId(null);
            setEditForm({});
            setParentSuccess('Squad updated.');
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to update squad.';
            setParentError(msg);
        } finally {
            setSavingSquad(false);
        }
    };

    const handleDeleteSquad = async (squadId: number, squadName: string) => {
        pendingDeleteRef.current = { squadId, squadName };
        setShowDeleteConfirm(true);
    };

    const confirmDeleteSquad = async () => {
        setShowDeleteConfirm(false);
        const pending = pendingDeleteRef.current;
        if (!pending) return;
        setDeletingSquadId(pending.squadId);
        try {
            await deleteSquad(clubId, pending.squadId);
            setSquads((prev) => prev.filter((s) => s.id !== pending.squadId));
            if (selectedSquadId === pending.squadId) {
                const remaining = squads.filter((s) => s.id !== pending.squadId);
                setSelectedSquadId(remaining.length > 0 ? remaining[0].id : null);
            }
            setParentSuccess(`Squad "${pending.squadName}" deleted.`);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to delete squad.';
            setParentError(msg);
        } finally {
            setDeletingSquadId(null);
            pendingDeleteRef.current = null;
        }
    };

    const handleRemovePlayer = async (userId: number, playerName: string) => {
        if (!selectedSquad) return;
        pendingRemoveRef.current = { userId, playerName };
        setShowRemoveConfirm(true);
    };

    const confirmRemovePlayer = async () => {
        setShowRemoveConfirm(false);
        const pending = pendingRemoveRef.current;
        if (!pending || !selectedSquad) return;
        setRemovingPlayerId(pending.userId);
        try {
            await removePlayerFromSquad(clubId, selectedSquad.id, pending.userId);
            await loadRoster(selectedSquad.id);
            setParentSuccess(`${pending.playerName} removed from squad.`);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to remove player.';
            setParentError(msg);
        } finally {
            setRemovingPlayerId(null);
            pendingRemoveRef.current = null;
        }
    };

    const handleUpdatePlayer = async (userId: number, jerseyNumber: number | null, squadRole: string | null) => {
        if (!selectedSquad) return;
        try {
            await updateSquadPlayer(clubId, selectedSquad.id, userId, { jerseyNumber, squadRole });
            await loadRoster(selectedSquad.id);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to update player.';
            setParentError(msg);
        }
    };

    const handlePlayersAdded = async () => {
        if (!selectedSquad) return;
        await loadRoster(selectedSquad.id);
        setParentSuccess('Players added to squad.');
    };

    // ── render ──

    return (
        <div className="space-y-4">
            {/* ── Section 1: Squad Creation ── */}
            <SectionHeader
                eyebrow="Squads"
                title="Create Squad"
                description="Create a new squad. Manage rosters, assign jersey numbers, and set squad roles inline below."
            />
            <form onSubmit={handleCreateSquad} className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                    <input
                        type="text"
                        value={squadForm.name}
                        onChange={(e) => setSquadForm({ ...squadForm, name: e.target.value })}
                        placeholder="Squad name"
                        required
                        className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-3 py-2 text-sm text-[var(--fc-text-primary)] outline-none placeholder:text-[var(--fc-text-muted)] focus:ring-1 focus:ring-[var(--fc-accent)]"
                    />
                    <input
                        type="text"
                        value={squadForm.category}
                        onChange={(e) => setSquadForm({ ...squadForm, category: e.target.value.toUpperCase() })}
                        placeholder="Category (e.g. SENIOR)"
                        required
                        className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-3 py-2 text-sm text-[var(--fc-text-primary)] outline-none placeholder:text-[var(--fc-text-muted)] focus:ring-1 focus:ring-[var(--fc-accent)]"
                    />
                    <select
                        value={squadForm.gender}
                        onChange={(e) => setSquadForm({ ...squadForm, gender: e.target.value })}
                        className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-3 py-2 text-sm font-medium text-[var(--fc-text-primary)] outline-none focus:ring-1 focus:ring-[var(--fc-accent)]"
                    >
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="MIXED">Mixed</option>
                    </select>
                </div>
                <button
                    type="submit"
                    disabled={localPending === 'create-squad'}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[var(--fc-accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                    {localPending === 'create-squad' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    Create Squad
                </button>
            </form>

            {/* Stat cards */}
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-4 py-3">
                    <p className="text-xs font-medium text-[var(--fc-text-muted)]">Active Player Pool</p>
                    <p className="mt-1 text-2xl font-semibold text-[var(--fc-text-primary)]">{overview?.activePlayerCount ?? 0}</p>
                    <p className="mt-1 text-xs text-[var(--fc-text-secondary)]">Players available for squad assignment.</p>
                </div>
                <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-4 py-3">
                    <p className="text-xs font-medium text-[var(--fc-text-muted)]">Total Squads</p>
                    <p className="mt-1 text-2xl font-semibold text-[var(--fc-text-primary)]">{squads.length}</p>
                    <p className="mt-1 text-xs text-[var(--fc-text-secondary)]">Squads registered for this club.</p>
                </div>
            </div>

            {/* ── Section 2: Squad Roster Management ── */}
            {squadsLoading ? (
                <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-[var(--fc-text-muted)]" />
                </div>
            ) : squads.length === 0 ? (
                <EmptyState message="No squads created yet. Use the form above to create your first squad." />
            ) : (
                <div className="space-y-4">
                    {/* Squad selector — horizontal pill tabs */}
                    <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)]">
                        <div className="border-b border-[var(--fc-border)] px-4 py-2.5">
                            <p className="text-xs font-medium text-[var(--fc-text-muted)]">Squad Selector</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 p-3">
                            {squads.map((squad) => {
                                const isActive = selectedSquadId === squad.id;
                                const isEditing = editingSquadId === squad.id;
                                return (
                                    <div key={squad.id} className="flex items-center">
                                        {isEditing ? (
                                            <div className="flex items-center gap-1.5 rounded-xl border border-[var(--fc-accent-border)] bg-[var(--fc-surface-hover)] px-2 py-1.5">
                                                <input
                                                    value={editForm.name ?? squad.name}
                                                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                                                    placeholder="Name"
                                                    className="w-24 rounded border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-2 py-1 text-xs text-[var(--fc-text-primary)] outline-none"
                                                />
                                                <input
                                                    value={editForm.category ?? squad.category}
                                                    onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                                                    placeholder="CAT"
                                                    className="w-16 rounded border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-2 py-1 text-xs text-[var(--fc-text-primary)] outline-none"
                                                />
                                                <select
                                                    value={editForm.gender ?? squad.gender}
                                                    onChange={(e) => setEditForm((f) => ({ ...f, gender: e.target.value }))}
                                                    className="rounded border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-1 py-1 text-xs text-[var(--fc-text-primary)] outline-none"
                                                >
                                                    <option value="MALE">M</option>
                                                    <option value="FEMALE">F</option>
                                                    <option value="MIXED">X</option>
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={() => void handleUpdateSquad(squad.id)}
                                                    disabled={savingSquad}
                                                    className="rounded-xl bg-[var(--fc-accent)] px-2 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                                                >
                                                    {savingSquad ? '...' : 'Save'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setEditingSquadId(null); setEditForm({}); }}
                                                    className="rounded-xl p-0.5 text-[var(--fc-text-muted)] hover:text-[var(--fc-text-primary)]"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setSelectedSquadId(squad.id)}
                                                className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                                                    isActive
                                                        ? 'bg-[var(--fc-accent-soft)] text-[var(--fc-accent)] border border-[var(--fc-accent-border)]'
                                                        : 'text-[var(--fc-text-secondary)] border border-transparent hover:border-[var(--fc-border)] hover:text-[var(--fc-text-primary)]'
                                                }`}
                                            >
                                                {squad.name}
                                                <span className="text-[11px] text-[var(--fc-text-muted)]">{squad.category}</span>
                                            </button>
                                        )}

                                        {/* Edit / Delete buttons for active squad */}
                                        {isActive && !isEditing && (
                                            <div className="ml-1 flex items-center gap-0.5">
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); setEditingSquadId(squad.id); setEditForm({ name: squad.name, category: squad.category, gender: squad.gender }); }}
                                                    className="rounded-xl p-1 text-[var(--fc-text-muted)] hover:text-[var(--fc-text-primary)] transition-colors"
                                                    title="Edit squad"
                                                >
                                                    <Pencil className="h-3 w-3" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); void handleDeleteSquad(squad.id, squad.name); }}
                                                    disabled={deletingSquadId === squad.id}
                                                    className="rounded-xl p-1 text-[var(--fc-text-muted)] hover:text-[var(--fc-state-danger)] disabled:opacity-50 transition-colors"
                                                    title="Delete squad"
                                                >
                                                    {deletingSquadId === squad.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Selected squad detail + roster */}
                    {selectedSquad && (
                        <>
                            {/* Detail bar */}
                            <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)]">
                                <div className="grid divide-y divide-[var(--fc-border)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                                    <div className="px-4 py-3">
                                        <p className="text-xs font-medium text-[var(--fc-text-muted)]">Category</p>
                                        <p className="mt-1 text-sm font-semibold text-[var(--fc-text-primary)]">{selectedSquad.category}</p>
                                    </div>
                                    <div className="px-4 py-3">
                                        <p className="text-xs font-medium text-[var(--fc-text-muted)]">Gender</p>
                                        <p className="mt-1 text-sm font-semibold text-[var(--fc-text-primary)]">{selectedSquad.gender}</p>
                                    </div>
                                    <div className="px-4 py-3">
                                        <p className="text-xs font-medium text-[var(--fc-text-muted)]">Groups</p>
                                        <p className="mt-1 text-sm font-semibold text-[var(--fc-accent)]">{rosterGroups.length}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Toolbar: view toggle + add players */}
                            <div className="flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => setCardView((v) => !v)}
                                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-3 py-1.5 text-xs font-medium text-[var(--fc-text-secondary)] hover:text-[var(--fc-text-primary)] transition-colors"
                                >
                                    {cardView ? 'Table View' : 'Card View'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAddPlayers(true)}
                                    className="inline-flex items-center gap-2 rounded-xl bg-[var(--fc-accent)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                                >
                                    + Add Players
                                </button>
                            </div>

                            {/* Roster */}
                            {rosterLoading ? (
                                <div className="flex justify-center py-10">
                                    <Loader2 className="h-6 w-6 animate-spin text-[var(--fc-text-muted)]" />
                                </div>
                            ) : rosterGroups.length === 0 ? (
                                <EmptyState message={`No players in "${selectedSquad.name}". Click "Add Players" to assign squad members.`} />
                            ) : cardView ? (
                                <SquadRosterGrid
                                    groups={rosterGroups}
                                    editable
                                    onRemovePlayer={handleRemovePlayer}
                                    onUpdatePlayer={handleUpdatePlayer}
                                    removingPlayerId={removingPlayerId}
                                />
                            ) : (
                                <SquadRosterTable
                                    groups={rosterGroups}
                                    editable
                                    onRemovePlayer={handleRemovePlayer}
                                    onUpdatePlayer={handleUpdatePlayer}
                                    removingPlayerId={removingPlayerId}
                                />
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Add Players modal */}
            {selectedSquad && (
                <AddPlayerToSquadModal
                    clubId={clubId}
                    squadId={selectedSquad.id}
                    isOpen={showAddPlayers}
                    onClose={() => setShowAddPlayers(false)}
                    onPlayersAdded={handlePlayersAdded}
                />
            )}
            <ConfirmDialog
                open={showDeleteConfirm}
                title="Delete Squad"
                message={pendingDeleteRef.current ? `Delete squad "${pendingDeleteRef.current.squadName}"? All players must be removed first.` : ''}
                confirmLabel="Delete"
                variant="danger"
                onConfirm={confirmDeleteSquad}
                onCancel={() => { setShowDeleteConfirm(false); pendingDeleteRef.current = null; }}
            />
            <ConfirmDialog
                open={showRemoveConfirm}
                title="Remove Player"
                message={pendingRemoveRef.current ? `Remove "${pendingRemoveRef.current.playerName}" from squad "${selectedSquad?.name}"?` : ''}
                confirmLabel="Remove"
                variant="danger"
                onConfirm={confirmRemovePlayer}
                onCancel={() => { setShowRemoveConfirm(false); pendingRemoveRef.current = null; }}
            />
        </div>
    );
};
