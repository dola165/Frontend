import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Loader2, MapPin, Pencil, ShieldCheck, Trash2, X } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { EntityHeaderBand, EntityPageLayout, EntitySection } from '../components/layout/EntityPageLayout';
import { SquadRosterTable, type SquadRosterGroup } from '../components/squads/SquadRosterTable';
import { AddPlayerToSquadModal } from '../components/squads/AddPlayerToSquadModal';
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
                prev.map((s) => (s.id === squadId ? { ...s, ...editForm } : s))
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
        if (!id || !window.confirm(`Delete squad "${squadName}"? All players must be removed first.`)) return;
        setDeletingSquadId(squadId);
        try {
            await deleteSquad(Number(id), squadId);
            setSquads((prev) => prev.filter((s) => s.id !== squadId));
            if (selectedSquadId === squadId) {
                setSearchParams({}, { replace: true });
            }
        } catch (error) {
            console.error('Failed to delete squad', error);
        } finally {
            setDeletingSquadId(null);
        }
    }, [id, selectedSquadId, setSearchParams]);

    const handleRemovePlayer = useCallback(async (userId: number, playerName: string) => {
        if (!id || !selectedSquad || !window.confirm(`Remove "${playerName}" from squad "${selectedSquad.name}"?`)) return;
        setRemovingPlayerId(userId);
        try {
            await removePlayerFromSquad(Number(id), selectedSquad.id, userId);
            // Refresh roster
            const response = await apiClient.get(`/clubs/${id}/squads/${selectedSquad.id}/roster`);
            setGroups(response.data || []);
        } catch (error) {
            console.error('Failed to remove player from squad', error);
        } finally {
            setRemovingPlayerId(null);
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
            <div className="bg-base flex h-full min-h-[calc(100vh-var(--app-header-height))] items-center justify-center">
                <Loader2 className="h-9 w-9 animate-spin accent-primary" />
            </div>
        );
    }

    if (!club) {
        return (
            <div className="bg-base flex h-full min-h-[calc(100vh-var(--app-header-height))] items-center justify-center px-6">
                <div className="bg-surface border border-subtle px-8 py-10 text-center">
                    <h2 className="text-xl font-black uppercase tracking-[0.18em] text-primary">Club Not Found</h2>
                    <Link to="/clubs" className="mt-4 inline-flex text-sm font-black uppercase tracking-[0.16em] accent-primary">
                        Return To Clubs
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-base min-h-full">
            <EntityHeaderBand>
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
                    <div>
                        <Link to={`/clubs/${club.id}`} className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-secondary transition-colors hover:text-primary">
                            <ChevronLeft className="h-4 w-4" />
                            Back To Club
                        </Link>
                        <p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] accent-primary">Squad Directory</p>
                        <h1 className="mt-2 flex items-center gap-2 text-3xl font-black uppercase tracking-tight text-primary">
                            {club.name}
                            {club.isOfficial && <ShieldCheck className="h-5 w-5 accent-primary" />}
                        </h1>
                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] font-black uppercase tracking-[0.18em] text-secondary">
                            <span>{club.type}</span>
                            {club.addressText && (
                                <>
                                    <span className="h-1 w-1 rounded-full bg-[color:var(--accent-muted)]" />
                                    <span className="inline-flex items-center gap-1.5">
                                        <MapPin className="h-3.5 w-3.5 accent-primary" />
                                        {club.addressText}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="border border-subtle bg-base">
                        <div className="grid divide-y divide-[color:var(--border-subtle)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                            <div className="px-4 py-3">
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-secondary">Squads</p>
                                <p className="mt-2 text-xl font-black uppercase tracking-tight text-primary">{squads.length}</p>
                            </div>
                            <div className="px-4 py-3">
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-secondary">Selected</p>
                                <p className="mt-2 text-xl font-black uppercase tracking-tight text-primary">{selectedSquad ? 'Active' : 'None'}</p>
                            </div>
                            <div className="px-4 py-3">
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-secondary">Roster View</p>
                                <p className="mt-2 text-xl font-black uppercase tracking-tight accent-primary">Structured</p>
                            </div>
                        </div>
                    </div>
                </div>
            </EntityHeaderBand>

            <EntityPageLayout
                left={(
                    <div className="flex flex-col gap-4 lg:sticky lg:top-[calc(var(--app-header-height)+24px)]">
                        <EntitySection eyebrow="Squad Navigation" title="Club Units" bodyClassName="divide-y divide-[color:var(--border-subtle)]">
                            {squads.length === 0 ? (
                                <div className="px-4 py-5 text-sm leading-6 text-secondary">No registered squads for this club yet.</div>
                            ) : (
                                squads.map((squad) => {
                                    const isActive = selectedSquad?.id === squad.id;
                                    const isEditing = editingSquadId === squad.id;
                                    return (
                                        <div key={squad.id}>
                                            {isEditing ? (
                                                <div className="space-y-2 px-4 py-3 border-l-2 border-accent-muted bg-elevated">
                                                    <input
                                                        value={editForm.name ?? squad.name}
                                                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                                                        placeholder="Squad name"
                                                        className="w-full border border-subtle bg-base px-2 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-primary"
                                                    />
                                                    <input
                                                        value={editForm.category ?? squad.category}
                                                        onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                                                        placeholder="Category"
                                                        className="w-full border border-subtle bg-base px-2 py-1 text-[11px] font-medium normal-case tracking-normal text-primary"
                                                    />
                                                    <select
                                                        value={editForm.gender ?? squad.gender}
                                                        onChange={(e) => setEditForm((f) => ({ ...f, gender: e.target.value }))}
                                                        className="w-full border border-subtle bg-base px-2 py-1 text-[11px] font-medium normal-case tracking-normal text-primary"
                                                    >
                                                        <option value="MALE">MALE</option>
                                                        <option value="FEMALE">FEMALE</option>
                                                        <option value="MIXED">MIXED</option>
                                                    </select>
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => void handleUpdateSquad(squad.id)}
                                                            disabled={savingSquad}
                                                            className="border border-accent-primary bg-accent-primary-soft px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] accent-primary disabled:opacity-50"
                                                        >
                                                            {savingSquad ? 'Saving...' : 'Save'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => { setEditingSquadId(null); setEditForm({}); }}
                                                            className="border border-subtle bg-base px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-secondary"
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSearchParams({ squad: String(squad.id) })}
                                                        className={`flex flex-1 items-center justify-between gap-3 border-l-2 px-4 py-3 text-left transition-colors ${
                                                            isActive ? 'border-accent-muted bg-elevated text-primary' : 'border-transparent text-secondary hover:bg-base hover:text-primary'
                                                        }`}
                                                    >
                                                        <span>
                                                            <span className="block text-[11px] font-black uppercase tracking-[0.16em]">{squad.name}</span>
                                                            <span className="mt-1 block text-[11px] font-medium normal-case tracking-normal text-secondary">{squad.category} / {squad.gender}</span>
                                                        </span>
                                                        {isActive && <span className="h-px w-5 bg-[color:var(--accent-muted)]" aria-hidden="true" />}
                                                    </button>
                                                    {isClubAdmin && (
                                                        <div className="flex shrink-0 items-center gap-1 pr-2">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); setEditingSquadId(squad.id); setEditForm({ name: squad.name, category: squad.category, gender: squad.gender }); }}
                                                                className="p-1 text-secondary hover:text-primary"
                                                                title="Edit squad"
                                                            >
                                                                <Pencil className="h-3 w-3" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); void handleDeleteSquad(squad.id, squad.name); }}
                                                                disabled={deletingSquadId === squad.id}
                                                                className="p-1 text-secondary hover:text-[color:var(--state-danger)] disabled:opacity-50"
                                                                title="Delete squad"
                                                            >
                                                                {deletingSquadId === squad.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </EntitySection>

                        <EntitySection eyebrow="Club Record" title="Context" bodyClassName="divide-y divide-[color:var(--border-subtle)]">
                            <div className="flex items-start justify-between gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em]">
                                <span className="text-secondary">Club Type</span>
                                <span className="text-primary">{club.type}</span>
                            </div>
                            <div className="flex items-start justify-between gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em]">
                                <span className="text-secondary">Official</span>
                                <span className={club.isOfficial ? 'accent-primary' : 'text-primary'}>{club.isOfficial ? 'Yes' : 'No'}</span>
                            </div>
                            <div className="px-4 py-3">
                                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-secondary">Location</p>
                                <p className="mt-2 text-sm leading-6 text-primary">{club.addressText || 'Not listed'}</p>
                            </div>
                        </EntitySection>
                    </div>
                )}
                center={(
                    squads.length === 0 ? (
                        <EntitySection eyebrow="Roster Surface" title="No Squads Registered" bodyClassName="px-5 py-10 text-center">
                            <p className="text-sm text-secondary">No registered squads for this club yet.</p>
                        </EntitySection>
                    ) : loadingRoster ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="h-8 w-8 animate-spin accent-primary" />
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <EntitySection
                                    eyebrow="Roster Surface"
                                    title={selectedSquad?.name ?? 'Squad Roster'}
                                    description="Structured by football unit for fast scanning instead of card-heavy tiles."
                                    bodyClassName="grid divide-y divide-[color:var(--border-subtle)] sm:grid-cols-3 sm:divide-x sm:divide-y-0"
                                >
                                <div className="px-4 py-3">
                                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-secondary">Category</p>
                                    <p className="mt-2 text-xl font-black uppercase tracking-tight text-primary">{selectedSquad?.category || 'Unspecified'}</p>
                                </div>
                                <div className="px-4 py-3">
                                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-secondary">Gender</p>
                                    <p className="mt-2 text-xl font-black uppercase tracking-tight text-primary">{selectedSquad?.gender || 'Unspecified'}</p>
                                </div>
                                <div className="px-4 py-3">
                                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-secondary">Groups</p>
                                    <p className="mt-2 text-xl font-black uppercase tracking-tight accent-primary">{groups.length}</p>
                                </div>
                            </EntitySection>

                            {isClubAdmin && selectedSquad && (
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddPlayers(true)}
                                        className="inline-flex items-center gap-2 border border-accent-primary bg-accent-primary px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-[color:var(--accent-on-primary)] hover:bg-accent-primary-hover"
                                    >
                                        + Add Players
                                    </button>
                                </div>
                            )}

                            <SquadRosterTable
                                groups={groups}
                                editable={isClubAdmin}
                                onRemovePlayer={handleRemovePlayer}
                                onUpdatePlayer={handleUpdatePlayer}
                                removingPlayerId={removingPlayerId}
                            />
                        </div>
                    )
                )}
                right={(
                    <div className="flex flex-col gap-4 xl:sticky xl:top-[calc(var(--app-header-height)+24px)]">
                        <EntitySection eyebrow="Utility Layer" title="Selected Squad" bodyClassName="divide-y divide-[color:var(--border-subtle)]">
                            <div className="px-4 py-3">
                                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-secondary">Name</p>
                                <p className="mt-2 text-sm font-black uppercase tracking-[0.12em] text-primary">{selectedSquad?.name || 'No squad selected'}</p>
                            </div>
                            <div className="px-4 py-3">
                                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-secondary">Category</p>
                                <p className="mt-2 text-sm font-black uppercase tracking-[0.12em] text-primary">{selectedSquad?.category || 'Unspecified'}</p>
                            </div>
                            <div className="px-4 py-3">
                                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-secondary">Gender</p>
                                <p className="mt-2 text-sm font-black uppercase tracking-[0.12em] text-primary">{selectedSquad?.gender || 'Unspecified'}</p>
                            </div>
                        </EntitySection>

                        <EntitySection eyebrow="Actions" title="Club Navigation" bodyClassName="px-4 py-4">
                            <div className="flex flex-col gap-2">
                                <Link
                                    to={`/clubs/${club.id}`}
                                    className="inline-flex items-center justify-between gap-2 border border-subtle bg-base px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-primary"
                                >
                                    Back To Club
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                </Link>
                            </div>
                        </EntitySection>
                    </div>
                )}
            />

            {selectedSquad && (
                <AddPlayerToSquadModal
                    clubId={Number(id)}
                    squadId={selectedSquad.id}
                    isOpen={showAddPlayers}
                    onClose={() => setShowAddPlayers(false)}
                    onPlayersAdded={handlePlayersAdded}
                />
            )}
        </div>
    );
};
