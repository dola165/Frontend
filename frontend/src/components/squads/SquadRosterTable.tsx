import { useMemo, useState } from 'react';
import { Check, GripVertical, Loader2, Trash2, X } from 'lucide-react';
import { TrialistBadge } from '../workspace/TrialistBadge';
import type { SortState } from '../workspace/helpers';

export interface SquadRosterPlayer {
    id: number;
    number?: number | null;
    name: string;
    position?: string | null;
    age?: number | null;
    status?: string | null;
    joinedAt?: string | null;
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

const getSortValue = (p: SquadRosterPlayer, col: number): string | number | null => {
    switch (col) {
        case 0: return p.number ?? 999; // jersey number — nulls last
        case 1: return (p.name || '').toLowerCase();
        case 2: return p.age ?? -1;
        case 3: return p.position || '';
        default: return null;
    }
};

export const SquadRosterTable = ({
    groups,
    editable = false,
    onRemovePlayer,
    onUpdatePlayer,
    removingPlayerId
}: SquadRosterTableProps) => {
    const [editingCell, setEditingCell] = useState<{ userId: number; field: 'number' | 'role' } | null>(null);
    const [editValue, setEditValue] = useState('');
    const [sort, setSort] = useState<SortState | null>(null);

    const handleSort = (col: number) => {
        setSort(prev =>
            prev?.column === col
                ? { column: col, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                : { column: col, direction: 'asc' }
        );
    };

    const sortedGroups = useMemo(() => {
        if (!sort) return groups;
        return groups.map(group => ({
            ...group,
            players: [...group.players].sort((a, b) => {
                const aVal = getSortValue(a, sort.column);
                const bVal = getSortValue(b, sort.column);
                if (aVal == null && bVal == null) return 0;
                if (aVal == null) return 1;
                if (bVal == null) return -1;
                const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
                return sort.direction === 'desc' ? -cmp : cmp;
            })
        }));
    }, [groups, sort]);

    if (sortedGroups.length === 0) {
        return (
            <div className="bg-[#16181d] border border-[#ffffff0d] px-5 py-10 text-center">
                <p className="text-sm text-[#a1a1aa]">No registered players in this squad yet.</p>
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
        <div className="rounded-xl bg-[#16181d] border border-[#ffffff0d]">
            {sortedGroups.map((group, index) => (
                <section key={group.label} className={index === 0 ? '' : 'border-t border-[#ffffff0d]'}>
                    <div className="flex items-center justify-between gap-4 border-b border-[#ffffff0d] bg-[#16181d] px-4 py-3">
                        <h3 className="text-xs font-semibold text-[#f4f4f5]">{group.label}</h3>
                        <span className="text-xs font-semibold text-[#16a34a]">
                            {group.players.length} Player{group.players.length === 1 ? '' : 's'}
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full table-fixed">
                            <thead>
                                <tr className="border-b border-[#ffffff0d] bg-[#16181d] text-left">
                                    <th className="w-8 px-1 py-3" />
                                    {[
                                        { col: 0, label: 'No.', width: 'w-20' },
                                        { col: 1, label: 'Player', width: '' },
                                        { col: 2, label: 'Age', width: 'w-24' },
                                        { col: 3, label: 'Role', width: 'w-40' },
                                    ].map(({ col, label, width }) => (
                                        <th key={col} className={`${width} px-4 py-3`}>
                                            <button
                                                type="button"
                                                onClick={() => handleSort(col)}
                                                className="inline-flex items-center gap-1 text-xs font-semibold text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
                                            >
                                                {label}
                                                <span className="text-[10px] leading-none">
                                                    {sort?.column === col ? (sort.direction === 'asc' ? '▲' : '▼') : '⇅'}
                                                </span>
                                            </button>
                                        </th>
                                    ))}
                                    <th className="w-12 px-2 py-3 text-xs font-semibold text-[#a1a1aa] text-center">Avail</th>
                                    {editable && <th className="w-12 px-2 py-3" />}
                                </tr>
                            </thead>
                            <tbody>
                                {group.players.map((player) => (
                                    <tr key={player.id} className="border-b border-[#ffffff0d] transition-colors last:border-b-0 hover:bg-[var(--fc-surface-hover)]">
                                        {/* Drag handle */}
                                        <td className="px-1 py-3 text-center">
                                            <GripVertical className="h-4 w-4 text-[var(--fc-text-muted)] cursor-grab mx-auto" />
                                        </td>

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
                                                    className="rounded-xl w-14 border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-2 py-1 text-sm font-semibold text-[#f4f4f5] focus:outline-none"
                                                    autoFocus
                                                />
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => editable && startEdit(player.id, 'number', String(player.number ?? ''))}
                                                    className={`text-sm font-semibold ${editable ? 'cursor-pointer hover:text-[#16a34a]' : ''} text-[#f4f4f5]`}
                                                    tabIndex={editable ? 0 : -1}
                                                >
                                                    {player.number ?? '--'}
                                                </button>
                                            )}
                                        </td>

                                        {/* Player Name */}
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center gap-2">
                                                <span className="text-sm font-semibold text-[#f4f4f5]">{player.name}</span>
                                                {player.status === 'TRIALIST' && (
                                                    <TrialistBadge joinedAt={player.joinedAt} />
                                                )}
                                            </span>
                                        </td>

                                        {/* Age */}
                                        <td className="px-4 py-3 text-sm text-[#a1a1aa]">{player.age ?? '--'}</td>

                                        {/* Role */}
                                        <td className="px-4 py-3">
                                            {editable && editingCell?.userId === player.id && editingCell?.field === 'role' ? (
                                                <select
                                                    value={editValue}
                                                    onChange={(e) => { setEditValue(e.target.value); commitEdit(player.id, 'role'); }}
                                                    className="w-28 border border-[#ffffff0d] bg-[#16181d] px-2 py-1 text-sm text-[#f4f4f5] focus:outline-none"
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
                                                    className={`text-sm ${editable ? 'cursor-pointer hover:text-[#16a34a]' : ''} text-[#a1a1aa]`}
                                                    tabIndex={editable ? 0 : -1}
                                                >
                                                    {player.position || 'Player'}
                                                </button>
                                            )}
                                        </td>

                                        {/* Availability */}
                                        <td className="px-2 py-3 text-center">
                                            {player.id % 3 !== 0 ? (
                                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400" title="Available">
                                                    <Check className="h-3 w-3" />
                                                </span>
                                            ) : (
                                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500/10 text-red-400" title="Unavailable">
                                                    <X className="h-3 w-3" />
                                                </span>
                                            )}
                                        </td>

                                        {/* Remove Button (editable only) */}
                                        {editable && (
                                            <td className="px-2 py-3">
                                                <button
                                                    type="button"
                                                    onClick={() => onRemovePlayer?.(player.id, player.name)}
                                                    disabled={removingPlayerId === player.id}
                                                    className="p-1 text-[#a1a1aa] hover:text-[color:var(--state-danger)] disabled:opacity-50"
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
