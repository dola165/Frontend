import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Loader2, Pencil, ShieldCheck, Trash2, X } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { SquadRosterTable, type SquadRosterGroup } from '../components/squads/SquadRosterTable';
import { SquadRosterGrid } from '../components/squads/SquadRosterGrid';
import { AddPlayerToSquadModal } from '../components/squads/AddPlayerToSquadModal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { deleteSquad, updateSquad, removePlayerFromSquad, updateSquadPlayer, type UpdateSquadPayload } from '../features/clubs/api';
import { fetchMyClubMembershipContext } from '../features/clubs/api';
import { isLeadershipRole } from '../features/clubs/domain';

interface ClubSquadHeader {
    id: number;
    name: string;
    type: string;
    addressText?: string;
    isOfficial: boolean;
}

interface SquadDto {
    id: number;
    clubId: number;
    name: string;
    category: string;
    gender: string;
}

export const ClubSquadsPage = () => {
    const { id } = useParams<{ id: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const [club, setClub] = useState<ClubSquadHeader | null>(null);
    const [squads, setSquads] = useState<SquadDto[]>([]);
    const [groups, setGroups] = useState<SquadRosterGroup[]>([]);
    const [loadingClub, setLoadingClub] = useState(true);
    const [loadingRoster, setLoadingRoster] = useState(true);
    const [isClubAdmin, setIsClubAdmin] = useState(false);
    const [editingSquadId, setEditingSquadId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<UpdateSquadPayload>({});
    const [savingSquad, setSavingSquad] = useState(false);
    const [deletingSquadId, setDeletingSquadId] = useState<number | null>(null);
    const [showAddPlayers, setShowAddPlayers] = useState(false);
    const [removingPlayerId, setRemovingPlayerId] = useState<number | null>(null);
    const [cardView, setCardView] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
    const pendingDeleteRef = useRef<{ squadId: number; squadName: string } | null>(null);
    const pendingRemoveRef = useRef<{ userId: number; playerName: string } | null>(null);

    const selectedSquadId = Number(searchParams.get('squad'));
    const selectedSquad = useMemo(() => squads.find((squad) => squad.id === selectedSquadId) ?? squads[0] ?? null, [selectedSquadId, squads]);

    useEffect(() => {
        if (!id) return;
        setLoadingClub(true);
        Promise.all([apiClient.get(`/clubs/${id}`), apiClient.get(`/clubs/${id}/squads`)])
            .then(([clubResponse, squadsResponse]) => {
                setClub(clubResponse.data);
                setSquads(squadsResponse.data || []);
            })
            .catch((error) => {
                console.error('Failed to load squads page context', error);
                setClub(null);
                setSquads([]);
            })
            .finally(() => setLoadingClub(false));
    }, [id]);

    useEffect(() => {
        if (!id) return;
        fetchMyClubMembershipContext()
            .then((ctx) => setIsClubAdmin(isLeadershipRole(ctx?.myRole) && ctx?.clubId === Number(id)))
            .catch(() => setIsClubAdmin(false));
    }, [id]);

    const handleUpdateSquad = useCallback(async (squadId: number) => {
        if (!id || !editForm.name?.trim()) return;
        setSavingSquad(true);
        try {
            await updateSquad(Number(id), squadId, editForm);
            setSquads((prev) =>
                prev.map((s) => (s.id === squadId ? { ...s, ...editForm } as SquadDto : s))
            );
            setEditingSquadId(null);
            setEditForm({});
        } catch (error) {
            console.error('Failed to update squad', error);
        } finally {
            setSavingSquad(false);
        }
    }, [id, editForm]);

    const handleDeleteSquad = useCallback(async (squadId: number, squadName: string) => {
        if (!id) return;
        pendingDeleteRef.current = { squadId, squadName };
        setShowDeleteConfirm(true);
    }, [id]);

    const handleConfirmDelete = useCallback(async () => {
        setShowDeleteConfirm(false);
        const pending = pendingDeleteRef.current;
        if (!pending || !id) return;
        setDeletingSquadId(pending.squadId);
        try {
            await deleteSquad(Number(id), pending.squadId);
            setSquads((prev) => prev.filter((s) => s.id !== pending.squadId));
            if (selectedSquadId === pending.squadId) {
                setSearchParams({}, { replace: true });
            }
        } catch (error) {
            console.error('Failed to delete squad', error);
        } finally {
            setDeletingSquadId(null);
            pendingDeleteRef.current = null;
        }
    }, [id, selectedSquadId, setSearchParams]);

    const handleRemovePlayer = useCallback(async (userId: number, playerName: string) => {
        if (!id || !selectedSquad) return;
        pendingRemoveRef.current = { userId, playerName };
        setShowRemoveConfirm(true);
    }, [id, selectedSquad]);

    const handleConfirmRemove = useCallback(async () => {
        setShowRemoveConfirm(false);
        const pending = pendingRemoveRef.current;
        if (!pending || !id || !selectedSquad) return;
        setRemovingPlayerId(pending.userId);
        try {
            await removePlayerFromSquad(Number(id), selectedSquad.id, pending.userId);
            const response = await apiClient.get(`/clubs/${id}/squads/${selectedSquad.id}/roster`);
            setGroups(response.data || []);
        } catch (error) {
            console.error('Failed to remove player from squad', error);
        } finally {
            setRemovingPlayerId(null);
            pendingRemoveRef.current = null;
        }
    }, [id, selectedSquad]);

    const handleUpdatePlayer = useCallback(async (userId: number, jerseyNumber: number | null, squadRole: string | null) => {
        if (!id || !selectedSquad) return;
        try {
            await updateSquadPlayer(Number(id), selectedSquad.id, userId, {
                jerseyNumber,
                squadRole,
            });
            // Refresh roster
            const response = await apiClient.get(`/clubs/${id}/squads/${selectedSquad.id}/roster`);
            setGroups(response.data || []);
        } catch (error) {
            console.error('Failed to update squad player', error);
        }
    }, [id, selectedSquad]);

    const handlePlayersAdded = useCallback(async () => {
        if (!id || !selectedSquad) return;
        try {
            const response = await apiClient.get(`/clubs/${id}/squads/${selectedSquad.id}/roster`);
            setGroups(response.data || []);
        } catch (error) {
            console.error('Failed to refresh roster', error);
        }
    }, [id, selectedSquad]);

    useEffect(() => {
        if (!selectedSquad) {
            setGroups([]);
            setLoadingRoster(false);
            return;
        }

        const nextSquadId = String(selectedSquad.id);
        if (searchParams.get('squad') !== nextSquadId) {
            setSearchParams({ squad: nextSquadId }, { replace: true });
            return;
        }

        setLoadingRoster(true);
        apiClient.get(`/clubs/${id}/squads/${selectedSquad.id}/roster`)
            .then((response) => setGroups(response.data || []))
            .catch((error) => {
                console.error('Failed to load squad roster', error);
                setGroups([]);
            })
            .finally(() => setLoadingRoster(false));
    }, [id, searchParams, selectedSquad, setSearchParams]);

    if (loadingClub) {
        return (
            <div className="bg-[#0f1117] flex h-full min-h-[calc(100vh-var(--app-header-height))] items-center justify-center">
                <Loader2 className="h-9 w-9 animate-spin text-[#16a34a]" />
            </div>
        );
    }

    if (!club) {
        return (
            <div className="bg-[#0f1117] flex h-full min-h-[calc(100vh-var(--app-header-height))] items-center justify-center px-6">
                <div className="rounded-xl border border-[#ffffff0d] bg-[#16181d] px-8 py-10 text-center">
                    <h2 className="text-xl font-semibold text-[#f4f4f5]">Club Not Found</h2>
                    <Link to="/clubs" className="mt-4 inline-flex text-sm font-medium text-[#16a34a] hover:text-[#16a34a]/80 transition-colors">
                        Return To Clubs
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#0f1117] min-h-full">
            <div className="border-b border-[#ffffff0d] px-6 py-5">
                <div className="flex items-center gap-2 mb-2">
                    <Link to={`/clubs/${club.id}`} className="inline-flex items-center gap-1.5 text-xs font-medium text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors">
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Back to Club
                    </Link>
                </div>
                <h1 className="text-xl font-semibold text-[#f4f4f5] flex items-center gap-2">
                    {club.name} — Squads
                    {club.isOfficial && <ShieldCheck className="h-5 w-5 text-[#16a34a]" />}
                </h1>
                <p className="mt-1 text-sm text-[#a1a1aa]">{club.type}{club.addressText && ` · ${club.addressText}`}</p>
                {/* Stat cards */}
                <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-[#ffffff0d] bg-[#16181d] px-4 py-3">
                        <p className="text-xs text-[#a1a1aa]">Squads</p>
                        <p className="mt-1 text-lg font-semibold text-[#f4f4f5]">{squads.length}</p>
                    </div>
                    <div className="rounded-xl border border-[#ffffff0d] bg-[#16181d] px-4 py-3">
                        <p className="text-xs text-[#a1a1aa]">Selected</p>
                        <p className="mt-1 text-lg font-semibold text-[#f4f4f5]">{selectedSquad ? selectedSquad.name : 'None'}</p>
                    </div>
                    <div className="rounded-xl border border-[#ffffff0d] bg-[#16181d] px-4 py-3">
                        <p className="text-xs text-[#a1a1aa]">Roster View</p>
                        <p className="mt-1 text-lg font-semibold text-[#16a34a]">{cardView ? 'Cards' : 'Table'}</p>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 px-6 py-6 xl:grid-cols-[280px_1fr_280px] xl:items-start">
                {/* LEFT SIDEBAR */}
                <div className="flex flex-col gap-4 xl:sticky xl:top-[calc(var(--app-header-height)+24px)]">
                    {/* Squad Navigation */}
                    <div className="rounded-xl border border-[#ffffff0d] bg-[#16181d] overflow-hidden">
                        <div className="px-4 py-3 border-b border-[#ffffff0d]">
                            <p className="text-xs font-semibold text-[#a1a1aa]">Squad Navigation</p>
                        </div>
                        <div className="divide-y divide-[#ffffff0d]">
                            {squads.length === 0 ? (
                                <div className="px-4 py-5 text-sm text-[#a1a1aa]">No registered squads for this club yet.</div>
                            ) : (
                                squads.map((squad) => {
                                    const isActive = selectedSquad?.id === squad.id;
                                    const isEditing = editingSquadId === squad.id;
                                    return (
                                        <div key={squad.id}>
                                            {isEditing ? (
                                                <div className="space-y-2 px-4 py-3 bg-[var(--fc-accent-soft)]">
                                                    <input value={editForm.name ?? squad.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} placeholder="Squad name" className="w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-3 py-1.5 text-sm text-[#f4f4f5] outline-none" />
                                                    <input value={editForm.category ?? squad.category} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))} placeholder="Category" className="w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-3 py-1.5 text-sm text-[#f4f4f5] outline-none" />
                                                    <select value={editForm.gender ?? squad.gender} onChange={(e) => setEditForm((f) => ({ ...f, gender: e.target.value }))} className="w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-3 py-1.5 text-sm text-[#f4f4f5] outline-none">
                                                        <option value="MALE">MALE</option><option value="FEMALE">FEMALE</option><option value="MIXED">MIXED</option>
                                                    </select>
                                                    <div className="flex gap-2">
                                                        <button type="button" onClick={() => void handleUpdateSquad(squad.id)} disabled={savingSquad} className="rounded-xl bg-[#16a34a] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">{savingSquad ? 'Saving...' : 'Save'}</button>
                                                        <button type="button" onClick={() => { setEditingSquadId(null); setEditForm({}); }} className="rounded-xl border border-[#ffffff0d] px-3 py-1.5 text-xs font-semibold text-[#a1a1aa] hover:text-[#f4f4f5]"><X className="h-3 w-3" /></button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center">
                                                    <button type="button" onClick={() => setSearchParams({ squad: String(squad.id) })} className={`flex flex-1 items-center justify-between gap-3 border-l-[3px] px-4 py-3 text-left transition-colors ${isActive ? 'border-[#16a34a] bg-[var(--fc-accent-soft)] text-[#f4f4f5]' : 'border-transparent text-[#a1a1aa] hover:bg-[var(--fc-surface-hover)] hover:text-[#f4f4f5]'}`}>
                                                        <span>
                                                            <span className="block text-sm font-semibold">{squad.name}</span>
                                                            <span className="mt-0.5 block text-xs text-[#a1a1aa]">{squad.category} / {squad.gender}</span>
                                                        </span>
                                                    </button>
                                                    {isClubAdmin && (
                                                        <div className="flex shrink-0 items-center gap-1 pr-2">
                                                            <button type="button" onClick={(e) => { e.stopPropagation(); setEditingSquadId(squad.id); setEditForm({ name: squad.name, category: squad.category, gender: squad.gender }); }} className="p-1 text-[#a1a1aa] hover:text-[#f4f4f5]" title="Edit squad"><Pencil className="h-3 w-3" /></button>
                                                            <button type="button" onClick={(e) => { e.stopPropagation(); void handleDeleteSquad(squad.id, squad.name); }} disabled={deletingSquadId === squad.id} className="p-1 text-[#a1a1aa] hover:text-[#ef4444] disabled:opacity-50" title="Delete squad">{deletingSquadId === squad.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}</button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Club Record */}
                    <div className="rounded-xl border border-[#ffffff0d] bg-[#16181d] overflow-hidden">
                        <div className="px-4 py-3 border-b border-[#ffffff0d]">
                            <p className="text-xs font-semibold text-[#a1a1aa]">Club Record</p>
                        </div>
                        <div className="divide-y divide-[#ffffff0d]">
                            <div className="flex items-start justify-between gap-3 px-4 py-3">
                                <span className="text-sm text-[#a1a1aa]">Club Type</span>
                                <span className="text-sm font-medium text-[#f4f4f5]">{club.type}</span>
                            </div>
                            <div className="flex items-start justify-between gap-3 px-4 py-3">
                                <span className="text-sm text-[#a1a1aa]">Official</span>
                                <span className={club.isOfficial ? 'text-[#16a34a] text-sm font-medium' : 'text-sm font-medium text-[#f4f4f5]'}>{club.isOfficial ? 'Yes' : 'No'}</span>
                            </div>
                            <div className="px-4 py-3">
                                <p className="text-sm text-[#a1a1aa] mb-1">Location</p>
                                <p className="text-sm font-medium text-[#f4f4f5]">{club.addressText || 'Not listed'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CENTER */}
                <div className="flex flex-col gap-4">
                    {squads.length === 0 ? (
                        <div className="rounded-xl border border-[#ffffff0d] bg-[#16181d] p-5 text-center">
                            <p className="text-sm text-[#a1a1aa]">No registered squads for this club yet.</p>
                        </div>
                    ) : loadingRoster ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="h-8 w-8 animate-spin text-[#16a34a]" />
                        </div>
                    ) : (
                        <>
                            {/* Squad stats bar */}
                            <div className="rounded-xl border border-[#ffffff0d] bg-[#16181d]">
                                <div className="grid divide-y divide-[#ffffff0d] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                                    <div className="px-4 py-3">
                                        <p className="text-xs text-[#a1a1aa]">Category</p>
                                        <p className="mt-2 text-lg font-semibold text-[#f4f4f5]">{selectedSquad?.category || 'Unspecified'}</p>
                                    </div>
                                    <div className="px-4 py-3">
                                        <p className="text-xs text-[#a1a1aa]">Gender</p>
                                        <p className="mt-2 text-lg font-semibold text-[#f4f4f5]">{selectedSquad?.gender || 'Unspecified'}</p>
                                    </div>
                                    <div className="px-4 py-3">
                                        <p className="text-xs text-[#a1a1aa]">Groups</p>
                                        <p className="mt-2 text-lg font-semibold text-[#16a34a]">{groups.length}</p>
                                    </div>
                                </div>
                            </div>

                            {/* View toggle + Add Players */}
                            {(isClubAdmin && selectedSquad) && (
                                <div className="flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setCardView(v => !v)}
                                        className="rounded-xl border border-[#ffffff0d] px-3 py-1.5 text-xs font-semibold text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
                                    >
                                        {cardView ? 'Table View' : 'Card View'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowAddPlayers(true)}
                                        className="rounded-xl bg-[#16a34a] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                                    >
                                        + Add Players
                                    </button>
                                </div>
                            )}

                            {!isClubAdmin && (
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setCardView(v => !v)}
                                        className="rounded-xl border border-[#ffffff0d] px-3 py-1.5 text-xs font-semibold text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
                                    >
                                        {cardView ? 'Table View' : 'Card View'}
                                    </button>
                                </div>
                            )}

                            {cardView ? (
                                <SquadRosterGrid
                                    groups={groups}
                                    editable={isClubAdmin}
                                    onRemovePlayer={handleRemovePlayer}
                                    onUpdatePlayer={handleUpdatePlayer}
                                    removingPlayerId={removingPlayerId}
                                />
                            ) : (
                                <SquadRosterTable
                                    groups={groups}
                                    editable={isClubAdmin}
                                    onRemovePlayer={handleRemovePlayer}
                                    onUpdatePlayer={handleUpdatePlayer}
                                    removingPlayerId={removingPlayerId}
                                />
                            )}
                        </>
                    )}
                </div>

                {/* RIGHT SIDEBAR */}
                <div className="flex flex-col gap-4 xl:sticky xl:top-[calc(var(--app-header-height)+24px)]">
                    {/* Selected Squad */}
                    <div className="rounded-xl border border-[#ffffff0d] bg-[#16181d] overflow-hidden">
                        <div className="px-4 py-3 border-b border-[#ffffff0d]">
                            <p className="text-xs font-semibold text-[#a1a1aa]">Selected Squad</p>
                        </div>
                        <div className="divide-y divide-[#ffffff0d]">
                            <div className="px-4 py-3">
                                <p className="text-xs text-[#a1a1aa]">Name</p>
                                <p className="mt-1 text-sm font-medium text-[#f4f4f5]">{selectedSquad?.name || 'No squad selected'}</p>
                            </div>
                            <div className="px-4 py-3">
                                <p className="text-xs text-[#a1a1aa]">Category</p>
                                <p className="mt-1 text-sm font-medium text-[#f4f4f5]">{selectedSquad?.category || 'Unspecified'}</p>
                            </div>
                            <div className="px-4 py-3">
                                <p className="text-xs text-[#a1a1aa]">Gender</p>
                                <p className="mt-1 text-sm font-medium text-[#f4f4f5]">{selectedSquad?.gender || 'Unspecified'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="rounded-xl border border-[#ffffff0d] bg-[#16181d] overflow-hidden">
                        <div className="px-4 py-3 border-b border-[#ffffff0d]">
                            <p className="text-xs font-semibold text-[#a1a1aa]">Actions</p>
                        </div>
                        <div className="px-4 py-3">
                            <Link to={`/clubs/${club.id}`} className="inline-flex items-center justify-between gap-2 w-full rounded-xl border border-[#ffffff0d] bg-[var(--fc-card-bg)] px-3 py-2 text-sm font-medium text-[#f4f4f5] hover:bg-[var(--fc-surface-hover)] transition-colors">
                                Back to Club
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {selectedSquad && (
                <AddPlayerToSquadModal
                    clubId={Number(id)}
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
                onConfirm={handleConfirmDelete}
                onCancel={() => { setShowDeleteConfirm(false); pendingDeleteRef.current = null; }}
            />
            <ConfirmDialog
                open={showRemoveConfirm}
                title="Remove Player"
                message={pendingRemoveRef.current ? `Remove "${pendingRemoveRef.current.playerName}" from squad "${selectedSquad?.name}"?` : ''}
                confirmLabel="Remove"
                variant="danger"
                onConfirm={handleConfirmRemove}
                onCancel={() => { setShowRemoveConfirm(false); pendingRemoveRef.current = null; }}
            />
        </div>
    );
};
