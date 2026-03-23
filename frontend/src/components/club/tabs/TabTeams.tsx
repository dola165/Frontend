import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../api/axiosConfig';
import { ArrowRight, Layers3, Loader2, Users } from 'lucide-react';

interface ClubRosterDto {
    id: number;
    squadId?: number | null;
}

interface SquadDto {
    id: number;
    clubId: number;
    name: string;
    category: string;
    gender: string;
}

export const TabTeams = ({ clubId, refreshKey = 0 }: { clubId: number; refreshKey?: number }) => {
    const navigate = useNavigate();
    const [roster, setRoster] = useState<ClubRosterDto[]>([]);
    const [squads, setSquads] = useState<SquadDto[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            apiClient.get(`/clubs/${clubId}/roster`),
            apiClient.get(`/clubs/${clubId}/squads`)
        ])
            .then(([rosterRes, squadsRes]) => {
                setRoster(rosterRes.data || []);
                setSquads(squadsRes.data || []);
            })
            .catch((error) => console.error('Failed to load squad directory', error))
            .finally(() => setLoading(false));
    }, [clubId, refreshKey]);

    const squadCounts = useMemo(() => {
        const counts = new Map<number, number>();
        roster.forEach((player) => {
            if (!player.squadId) return;
            counts.set(player.squadId, (counts.get(player.squadId) || 0) + 1);
        });
        return counts;
    }, [roster]);

    if (loading) {
        return (
            <div className="flex justify-center py-10">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    if (squads.length === 0) {
        return (
            <div className="theme-surface-muted theme-border rounded-lg border px-5 py-10 text-center">
                <h3 className="text-lg font-black uppercase tracking-wide text-slate-900 dark:text-white">No Active Squads</h3>
                <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-400">This club has not registered any squads yet.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5">
            <section className="theme-surface-muted theme-border rounded-lg border">
                <div className="theme-border border-b px-5 py-4">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">
                        <Layers3 className="h-3.5 w-3.5" />
                        Squad Directory
                    </div>
                    <h2 className="mt-4 text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Football Structure</h2>
                    <p className="mt-2 max-w-2xl text-sm font-medium text-slate-600 dark:text-slate-400">
                        Open the dedicated squads page for full roster tables, grouped positions, and squad-specific football data.
                    </p>
                </div>

                <div className="divide-y theme-border">
                    {squads.map((squad) => (
                        <div key={squad.id} className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-base font-black uppercase tracking-wide text-slate-900 dark:text-white">{squad.name}</h3>
                                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">
                                        <Users className="h-3 w-3" />
                                        {squadCounts.get(squad.id) || 0}
                                    </span>
                                </div>
                                <p className="mt-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                                    {squad.category} · {squad.gender}
                                </p>
                            </div>

                            <button
                                onClick={() => navigate(`/clubs/${clubId}/squads?squad=${squad.id}`)}
                                className="theme-surface-strong theme-border inline-flex items-center gap-2 self-start rounded-sm border px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-700 transition-colors hover:border-emerald-500 hover:text-emerald-500 dark:text-slate-200 dark:hover:text-emerald-400 lg:self-auto"
                            >
                                Open Squad View
                                <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};
