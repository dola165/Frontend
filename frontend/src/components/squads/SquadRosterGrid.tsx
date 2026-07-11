import { Check, GripVertical, Loader2, X } from 'lucide-react';
import { type SquadRosterGroup, type SquadRosterPlayer } from './SquadRosterTable';
import { TrialistBadge } from '../workspace/TrialistBadge';

interface SquadRosterGridProps {
    groups: SquadRosterGroup[];
    editable?: boolean;
    onRemovePlayer?: (userId: number, playerName: string) => void;
    onUpdatePlayer?: (userId: number, jerseyNumber: number | null, squadRole: string | null) => void;
    removingPlayerId?: number | null;
}

const PlayerCard = ({
    player,
    editable,
    onRemovePlayer,
    onUpdatePlayer,
    isRemoving
}: {
    player: SquadRosterPlayer;
    editable: boolean;
    onRemovePlayer?: (userId: number, playerName: string) => void;
    onUpdatePlayer?: (userId: number, jerseyNumber: number | null, squadRole: string | null) => void;
    isRemoving: boolean;
}) => {
    const initial = (player.name || '?').charAt(0).toUpperCase();

    return (
        <div className="rounded-[2px] border border-[#ffffff0d] bg-[rgba(255,255,255,0.02)] overflow-hidden transition-colors hover:border-[#ffffff1a]">
            {/* image area */}
            <div className="relative h-24 w-full bg-[rgba(255,255,255,0.03)]">
                <div className="flex h-full w-full items-center justify-center">
                    <span className="text-3xl font-black text-[#71717a]">{initial}</span>
                </div>
                {/* drag handle */}
                <span className="absolute top-1 left-1 text-[#71717a] cursor-grab">
                    <GripVertical className="h-4 w-4" />
                </span>
                {/* jersey number badge */}
                <span className="absolute top-2 left-7 rounded-[2px] bg-black/70 px-2 py-0.5 text-[10px] font-black text-[#f4f4f5]">
                    #{player.number ?? '--'}
                </span>
                {/* availability */}
                <span className="absolute top-2 right-2">
                    {player.id % 3 !== 0 ? (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-950 text-green-400" title="Available">
                            <Check className="h-3 w-3" />
                        </span>
                    ) : (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-950 text-red-400" title="Unavailable">
                            <X className="h-3 w-3" />
                        </span>
                    )}
                </span>
            </div>

            {/* info area */}
            <div className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-[#f4f4f5] truncate" title={player.name}>
                        {player.name}
                    </p>
                    {player.status === 'TRIALIST' && (
                        <TrialistBadge joinedAt={player.joinedAt} className="shrink-0" />
                    )}
                </div>
                <div className="flex flex-wrap gap-1">
                    {player.position && (
                        <span className="inline-flex rounded-full border border-[#00ff6e]/20 bg-[#00ff6e]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#00ff6e]">
                            {player.position}
                        </span>
                    )}
                    {player.age != null && (
                        <span className="inline-flex rounded-full border border-[#ffffff0d] bg-[rgba(255,255,255,0.02)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#71717a]">
                            Age {player.age}
                        </span>
                    )}
                </div>

                {editable && (
                    <div className="flex gap-2 pt-1.5 border-t border-[#ffffff0d]">
                        {onUpdatePlayer && (
                            <button
                                type="button"
                                onClick={() => onUpdatePlayer(player.id, player.number ?? null, player.position ?? null)}
                                className="flex-1 rounded-[2px] border border-[#ffffff0d] bg-[rgba(255,255,255,0.02)] py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
                            >
                                Edit
                            </button>
                        )}
                        {onRemovePlayer && (
                            <button
                                type="button"
                                onClick={() => onRemovePlayer(player.id, player.name)}
                                disabled={isRemoving}
                                className="flex-1 rounded-[2px] border border-[var(--state-danger)]/20 bg-[var(--state-danger-soft)] py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--state-danger)] hover:bg-[var(--state-danger)] hover:text-white disabled:opacity-50 transition-colors"
                            >
                                {isRemoving ? <Loader2 className="mx-auto h-3 w-3 animate-spin" /> : 'Remove'}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export const SquadRosterGrid = ({
    groups,
    editable = false,
    onRemovePlayer,
    onUpdatePlayer,
    removingPlayerId
}: SquadRosterGridProps) => {
    if (groups.length === 0) {
        return (
            <div className="rounded-[2px] border border-[#ffffff0d] bg-[rgba(255,255,255,0.02)] px-5 py-10 text-center">
                <p className="text-sm text-[#a1a1aa]">No registered players in this squad yet.</p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {groups.map((group) => (
                <section key={group.label}>
                    <div className="flex items-center justify-between gap-4 mb-3">
                        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f4f4f5]">{group.label}</h3>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#00ff6e]">
                            {group.players.length} Player{group.players.length === 1 ? '' : 's'}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {group.players.map((player) => (
                            <PlayerCard
                                key={player.id}
                                player={player}
                                editable={editable}
                                onRemovePlayer={onRemovePlayer}
                                onUpdatePlayer={onUpdatePlayer}
                                isRemoving={removingPlayerId === player.id}
                            />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
};
