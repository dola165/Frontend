import { useState } from 'react';
import { UserPlus, Users } from 'lucide-react';
import type { AgentPortfolioPlayer } from '../../features/agents/domain';
import { addPlayerToPortfolio, removePlayerFromPortfolio } from '../../features/agents/api';
import { SectionHeader } from '../workspace/helpers';
import { EmptyStateCard } from '../workspace/EmptyStateCard';
import { UserIdentityCell } from '../workspace/UserIdentityCell';
import { OverflowActions } from '../ui/OverflowActions';

interface Props {
    players: AgentPortfolioPlayer[];
    onRefresh: () => void;
}

export const AgentPortfolioTab = ({ players, onRefresh }: Props) => {
    const [showAddModal, setShowAddModal] = useState(false);
    const [playerIdInput, setPlayerIdInput] = useState('');
    const [addingPlayer, setAddingPlayer] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);

    const handleAddPlayer = async () => {
        const id = parseInt(playerIdInput, 10);
        if (!id || isNaN(id)) {
            setAddError('Enter a valid player user ID.');
            return;
        }
        setAddingPlayer(true);
        setAddError(null);
        try {
            await addPlayerToPortfolio(id);
            setShowAddModal(false);
            setPlayerIdInput('');
            onRefresh();
        } catch (err: any) {
            setAddError(err?.response?.data?.message || err?.message || 'Failed to add player.');
        } finally {
            setAddingPlayer(false);
        }
    };

    const handleRemove = async (representationId: number) => {
        setBusyId(representationId);
        try {
            await removePlayerFromPortfolio(representationId);
            onRefresh();
        } catch (err) {
            console.error('Failed to remove player', err);
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div>
            <SectionHeader
                title="Player Portfolio"
                description="Players you represent"
                action={
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#16a34a] text-white text-xs font-semibold hover:bg-[#15803d] transition-colors"
                    >
                        <UserPlus className="w-3.5 h-3.5" /> Add Player
                    </button>
                }
            />

            {players.length === 0 ? (
                <EmptyStateCard
                    icon={Users}
                    title="No players yet"
                    description="Add players to your portfolio to manage their representation."
                    actionLabel="Add Your First Player"
                    actionIcon={UserPlus}
                    onAction={() => setShowAddModal(true)}
                />
            ) : (
                <div className="space-y-1.5 mt-4">
                    {players.map(player => (
                        <div
                            key={player.representationId}
                            className="flex items-center gap-4 px-4 py-3 rounded-md border border-[#ffffff0d] bg-[rgba(255,255,255,0.02)]"
                        >
                            <div className="flex-1 min-w-0">
                                <UserIdentityCell
                                    avatarUrl={player.avatarUrl}
                                    fullName={player.fullName}
                                    username={player.username}
                                    subtitle={player.currentClubName || 'No current club'}
                                />
                            </div>
                            <div className="hidden sm:block w-24 text-xs text-[#a1a1aa]">
                                {player.position || '—'}
                            </div>
                            <div className="hidden sm:block w-20">
                                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#16a34a]/10 text-[#16a34a]">
                                    {player.representationType}
                                </span>
                            </div>
                            <div className="w-9">
                                <OverflowActions
                                    items={[
                                        {
                                            label: 'Remove from Portfolio',
                                            onClick: () => handleRemove(player.representationId),
                                            tone: 'danger',
                                            confirm: {
                                                title: 'Remove Player',
                                                body: `Remove ${player.fullName} from your portfolio?`
                                            }
                                        }
                                    ]}
                                    disabled={busyId === player.representationId}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Player Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowAddModal(false)}>
                    <div className="bg-[#16181d] border border-[#26282d] rounded-md p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                        <h3 className="text-base font-semibold text-[#f4f4f5] mb-4">Add Player to Portfolio</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-[11px] font-semibold text-[#a1a1aa] block mb-1">Player User ID</label>
                                <input
                                    type="number"
                                    value={playerIdInput}
                                    onChange={e => setPlayerIdInput(e.target.value)}
                                    className="w-full px-3 py-2 rounded-md border border-[#26282d] bg-[#0f1117] text-sm text-[#f4f4f5] outline-none focus:border-[#16a34a]"
                                    placeholder="Enter player's user ID"
                                    autoFocus
                                />
                            </div>
                            {addError && <p className="text-xs text-[#d4737a]">{addError}</p>}
                            <div className="flex gap-2 justify-end pt-2">
                                <button onClick={() => setShowAddModal(false)} className="px-3 py-1.5 rounded-md border border-[#26282d] text-xs font-semibold text-[#a1a1aa] hover:text-[#f4f4f5]">Cancel</button>
                                <button onClick={handleAddPlayer} disabled={addingPlayer} className="px-3 py-1.5 rounded-md bg-[#16a34a] text-white text-xs font-semibold hover:bg-[#15803d] disabled:opacity-50">
                                    {addingPlayer ? 'Adding...' : 'Add Player'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
