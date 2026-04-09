import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, Users } from 'lucide-react';
import { apiClient } from '../../../api/axiosConfig';

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
        Promise.all([apiClient.get(`/clubs/${clubId}/roster`), apiClient.get(`/clubs/${clubId}/squads`)])
            .then(([rosterResponse, squadsResponse]) => {
                setRoster(rosterResponse.data || []);
                setSquads(squadsResponse.data || []);
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
                <Loader2 className="h-8 w-8 animate-spin accent-primary" />
            </div>
        );
    }

    if (squads.length === 0) {
        return (
            <div className="bg-surface border border-subtle px-5 py-10 text-center">
                <h3 className="text-lg font-black uppercase tracking-[0.14em] text-primary">No Active Squads</h3>
                <p className="mt-2 text-sm text-secondary">This club has not registered any squads yet.</p>
            </div>
        );
    }

    return (
        <section className="bg-surface border border-subtle">
            <div className="border-b border-subtle px-4 py-4">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] accent-primary">Entity Tab</p>
                <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-primary">Squads</h2>
                <p className="mt-2 text-sm leading-6 text-secondary">Each squad keeps a dedicated roster page, while this tab stays as the club-level squad directory.</p>
            </div>
            <div className="divide-y divide-[color:var(--border-subtle)]">
                {squads.map((squad) => (
                    <article key={squad.id} className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="text-base font-black uppercase tracking-[0.12em] text-primary">{squad.name}</p>
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.16em] accent-primary">
                                    <Users className="h-3.5 w-3.5" />
                                    {squadCounts.get(squad.id) || 0}
                                </span>
                            </div>
                            <p className="mt-2 text-[11px] font-black uppercase tracking-[0.16em] text-secondary">
                                {squad.category} / {squad.gender}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => navigate(`/clubs/${clubId}/squads?squad=${squad.id}`)}
                            className="inline-flex items-center gap-2 border border-subtle bg-base px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-primary"
                        >
                            Open Squad View
                            <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                    </article>
                ))}
            </div>
        </section>
    );
};
