import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';

export interface SquadRosterPlayer {
    id: number;
    number?: number | null;
    name: string;
    position?: string | null;
    age?: number | null;
}

export interface SquadRosterGroup {
    label: string;
    players: SquadRosterPlayer[];
}

interface SquadRosterTableProps {
    groups: SquadRosterGroup[];
    editable?: boolean;
    onRemovePlayer?: (userId: number, playerName: string) => void;
    onUpdatePlayer?: (userId: number, jerseyNumber: number | null, squadRole: string | null) => void;
    removingPlayerId?: number | null;
}

export const SquadRosterTable = ({
    groups,
    editable = false,
    onRemovePlayer,
    onUpdatePlayer,
    removingPlayerId
}: SquadRosterTableProps) => {
    const [editingCell, setEditingCell] = useState<{ userId: number; field: 'number' | 'role' } | null>(null);
    const [editValue, setEditValue] = useState('');

    if (groups.length === 0) {
        return (
            <div className="bg-surface border border-subtle px-5 py-10 text-center">
                <p className="text-sm text-secondary">No registered players in this squad yet.</p>
            </div>
        );
    }

    const startEdit = (userId: number, field: 'number' | 'role', currentValue: string) => {
        setEditingCell({ userId, field });
        setEditValue(currentValue);
    };

    const commitEdit = (userId: number, field: 'number' | 'role') => {
        if (!onUpdatePlayer) return;
        // Only send the field being edited; other field stays undefined so the API preserves its current value
        const jerseyNumber = field === 'number' ? (editValue ? parseInt(editValue, 10) : null) : undefined;
        const squadRole = field === 'role' ? (editValue || undefined) : undefined;

        if (editingCell?.userId === userId && editingCell?.field === field) {
            onUpdatePlayer(userId, jerseyNumber ?? null, squadRole ?? null);
        }
        setEditingCell(null);
    };

    return (
        <div className="bg-surface border border-subtle">
            {groups.map((group, index) => (
                <section key={group.label} className={index === 0 ? '' : 'border-t border-subtle'}>
                    <div className="flex items-center justify-between gap-4 border-b border-subtle bg-base px-4 py-3">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">{group.label}</h3>
                        <span className="text-[11px] font-black uppercase tracking-[0.16em] accent-primary">
                            {group.players.length} Player{group.players.length === 1 ? '' : 's'}
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full table-fixed">
                            <thead>
                                <tr className="border-b border-subtle bg-base text-left">
                                    <th className="w-20 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-secondary">No.</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-secondary">Player</th>
                                    <th className="w-24 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-secondary">Age</th>
                                    <th className="w-40 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-secondary">Role</th>
                                    {editable && <th className="w-12 px-2 py-3" />}
                                </tr>
                            </thead>
                            <tbody>
                                {group.players.map((player) => (
                                    <tr key={player.id} className="border-b border-subtle transition-colors last:border-b-0 hover:bg-base">
                                        {/* Jersey Number */}
                                        <td className="px-4 py-3">
                                            {editable && editingCell?.userId === player.id && editingCell?.field === 'number' ? (
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={99}
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={() => commitEdit(player.id, 'number')}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(player.id, 'number'); if (e.key === 'Escape') setEditingCell(null); }}
                                                    className="w-14 border border-subtle bg-base px-2 py-1 text-sm font-black text-primary focus:outline-none"
                                                    autoFocus
                                                />
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => editable && startEdit(player.id, 'number', String(player.number ?? ''))}
                                                    className={`text-sm font-black ${editable ? 'cursor-pointer hover:text-accent-primary' : ''} text-primary`}
                                                    tabIndex={editable ? 0 : -1}
                                                >
                                                    {player.number ?? '--'}
                                                </button>
                                            )}
                                        </td>

                                        {/* Player Name */}
                                        <td className="px-4 py-3 text-sm font-semibold text-primary">{player.name}</td>

                                        {/* Age */}
                                        <td className="px-4 py-3 text-sm text-secondary">{player.age ?? '--'}</td>

                                        {/* Role */}
                                        <td className="px-4 py-3">
                                            {editable && editingCell?.userId === player.id && editingCell?.field === 'role' ? (
                                                <select
                                                    value={editValue}
                                                    onChange={(e) => { setEditValue(e.target.value); commitEdit(player.id, 'role'); }}
                                                    className="w-28 border border-subtle bg-base px-2 py-1 text-sm text-primary focus:outline-none"
                                                    autoFocus
                                                >
                                                    <option value="PLAYER">PLAYER</option>
                                                    <option value="CAPTAIN">CAPTAIN</option>
                                                    <option value="TRIALIST">TRIALIST</option>
                                                </select>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => editable && startEdit(player.id, 'role', player.position || 'PLAYER')}
                                                    className={`text-sm ${editable ? 'cursor-pointer hover:text-accent-primary' : ''} text-secondary`}
                                                    tabIndex={editable ? 0 : -1}
                                                >
                                                    {player.position || 'Player'}
                                                </button>
                                            )}
                                        </td>

                                        {/* Remove Button (editable only) */}
                                        {editable && (
                                            <td className="px-2 py-3">
                                                <button
                                                    type="button"
                                                    onClick={() => onRemovePlayer?.(player.id, player.name)}
                                                    disabled={removingPlayerId === player.id}
                                                    className="p-1 text-secondary hover:text-[color:var(--state-danger)] disabled:opacity-50"
                                                    title={`Remove ${player.name} from squad`}
                                                >
                                                    {removingPlayerId === player.id ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    )}
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            ))}
        </div>
    );
};
