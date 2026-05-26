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
}

export const SquadRosterTable = ({ groups }: SquadRosterTableProps) => {
    if (groups.length === 0) {
        return (
            <div className="bg-surface border border-subtle px-5 py-10 text-center">
                <p className="text-sm text-secondary">No registered players in this squad yet.</p>
            </div>
        );
    }

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
                                </tr>
                            </thead>
                            <tbody>
                                {group.players.map((player) => (
                                    <tr key={player.id} className="border-b border-subtle transition-colors last:border-b-0 hover:bg-base">
                                        <td className="px-4 py-3 text-sm font-black text-primary">{player.number ?? '--'}</td>
                                        <td className="px-4 py-3 text-sm font-semibold text-primary">{player.name}</td>
                                        <td className="px-4 py-3 text-sm text-secondary">{player.age ?? '--'}</td>
                                        <td className="px-4 py-3 text-sm text-secondary">{player.position || 'Player'}</td>
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
