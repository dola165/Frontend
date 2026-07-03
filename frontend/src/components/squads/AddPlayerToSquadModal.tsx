import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Search, UserPlus, X } from 'lucide-react';
import { addPlayerToSquad, batchAddPlayersToSquad, fetchClubPlayers, type AddSquadPlayerPayload } from '../../features/clubs/api';

interface PlayerOption {
    userId: number;
    fullName: string;
    username: string;
    avatarUrl: string | null;
    status: string;
}

interface AddPlayerToSquadModalProps {
    clubId: number;
    squadId: number;
    isOpen: boolean;
    onClose: () => void;
    onPlayersAdded: () => void;
}

export const AddPlayerToSquadModal = ({ clubId, squadId, isOpen, onClose, onPlayersAdded }: AddPlayerToSquadModalProps) => {
    const [search, setSearch] = useState('');
    const [players, setPlayers] = useState<PlayerOption[]>([]);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(false);

    const loadPlayers = useCallback(async (pageNum: number, searchTerm: string) => {
        if (!clubId) return;
        setLoading(true);
        setError(null);
        try {
            const result = await fetchClubPlayers(clubId, undefined, pageNum, 30);
            const filtered = searchTerm
                ? result.content.filter(
                    (p) =>
                        p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        p.username.toLowerCase().includes(searchTerm.toLowerCase())
                )
                : result.content;
            if (pageNum === 0) {
                setPlayers(filtered);
            } else {
                setPlayers((prev) => [...prev, ...filtered]);
            }
            setHasMore((pageNum + 1) * 30 < result.totalElements);
        } catch (err) {
            console.error('Failed to load club players', err);
            setError('Could not load players.');
        } finally {
            setLoading(false);
        }
    }, [clubId]);

    useEffect(() => {
        if (isOpen) {
            setPage(0);
            setSearch('');
            setSelected(new Set());
            loadPlayers(0, '');
        }
    }, [isOpen, loadPlayers]);

    useEffect(() => {
        if (isOpen && search !== '') {
            const timer = setTimeout(() => {
                setPage(0);
                loadPlayers(0, search);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [search, isOpen, loadPlayers]);

    const togglePlayer = (userId: number) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(userId)) next.delete(userId);
            else next.add(userId);
            return next;
        });
    };

    const handleAddSelected = async () => {
        if (selected.size === 0) return;
        setSaving(true);
        setError(null);
        try {
            const payloads: AddSquadPlayerPayload[] = Array.from(selected).map((userId) => ({
                userId,
            }));
            if (payloads.length === 1) {
                await addPlayerToSquad(clubId, squadId, payloads[0]);
            } else {
                await batchAddPlayersToSquad(clubId, squadId, { players: payloads });
            }
            onPlayersAdded();
            onClose();
        } catch (err: any) {
            const message = err?.response?.data?.message || err?.message || 'Failed to add players.';
            setError(message);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center">
            <div className="theme-overlay absolute inset-0" onClick={onClose} />
            <div className="relative z-10 mx-4 w-full max-w-lg border border-subtle bg-base shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-subtle px-5 py-4">
                    <div className="flex items-center gap-3">
                        <UserPlus className="h-5 w-5 accent-primary" />
                        <div>
                            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-primary">Add Players</h2>
                            <p className="mt-0.5 text-[11px] font-medium text-secondary">
                                {selected.size > 0 ? `${selected.size} selected` : 'Search and select players to add to this squad'}
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-1 text-secondary hover:text-primary">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Search */}
                <div className="border-b border-subtle px-5 py-3">
                    <div className="flex items-center gap-2 border border-subtle bg-elevated px-3 py-2">
                        <Search className="h-4 w-4 text-secondary" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name or username..."
                            className="flex-1 bg-transparent text-sm text-primary placeholder:text-secondary focus:outline-none"
                        />
                    </div>
                </div>

                {/* Player List */}
                <div className="max-h-[50vh] min-h-[200px] overflow-y-auto">
                    {error && (
                        <div className="mx-5 mt-3 border border-[color:var(--state-danger)] bg-[color:var(--state-danger-soft)] px-4 py-2 text-xs font-semibold text-[color:var(--state-danger)]">
                            {error}
                        </div>
                    )}

                    {loading && players.length === 0 ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="h-7 w-7 animate-spin accent-primary" />
                        </div>
                    ) : players.length === 0 ? (
                        <div className="px-5 py-10 text-center text-sm text-secondary">
                            {search ? 'No players match your search.' : 'No players found in this club.'}
                        </div>
                    ) : (
                        <div className="divide-y divide-[color:var(--border-subtle)]">
                            {players.map((player) => {
                                const isSelected = selected.has(player.userId);
                                return (
                                    <button
                                        key={player.userId}
                                        type="button"
                                        onClick={() => togglePlayer(player.userId)}
                                        className={`flex w-full items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-elevated ${
                                            isSelected ? 'border-l-2 border-accent-primary bg-accent-primary-soft' : 'border-l-2 border-transparent'
                                        }`}
                                    >
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-elevated text-xs font-black uppercase tracking-[0.12em] text-secondary">
                                            {player.avatarUrl ? (
                                                <img src={player.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                                            ) : (
                                                (player.fullName || player.username).charAt(0).toUpperCase()
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-bold text-primary">{player.fullName || player.username}</p>
                                            <p className="mt-0.5 text-[11px] font-medium text-secondary">
                                                @{player.username} · {player.status}
                                            </p>
                                        </div>
                                        <div
                                            className={`flex h-5 w-5 shrink-0 items-center justify-center border ${
                                                isSelected
                                                    ? 'border-accent-primary bg-accent-primary text-[color:var(--accent-on-primary)]'
                                                    : 'border-subtle'
                                            }`}
                                        >
                                            {isSelected && <Plus className="h-3 w-3" />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-subtle px-5 py-3">
                    <button
                        type="button"
                        onClick={() => { setPage((p) => p + 1); loadPlayers(page + 1, search); }}
                        disabled={!hasMore || loading}
                        className="text-[11px] font-black uppercase tracking-[0.16em] text-secondary hover:text-primary disabled:opacity-40"
                    >
                        {loading ? 'Loading...' : hasMore ? 'Load More' : 'All players loaded'}
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="border border-subtle px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-secondary hover:text-primary"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleAddSelected}
                            disabled={selected.size === 0 || saving}
                            className="border border-accent-primary bg-accent-primary px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-[color:var(--accent-on-primary)] hover:bg-accent-primary-hover disabled:opacity-50"
                        >
                            {saving ? (
                                <span className="inline-flex items-center gap-2">
                                    <Loader2 className="h-3 w-3 animate-spin" /> Adding...
                                </span>
                            ) : (
                                `Add ${selected.size > 0 ? `(${selected.size})` : ''}`
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
