import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { apiClient } from '../../../api/axiosConfig';

interface SquadDto {
    id: number;
    clubId: number;
    name: string;
    category: string;
    gender: string;
}

export const TabTeams = ({ clubId, refreshKey = 0 }: { clubId: number; refreshKey?: number }) => {
    const navigate = useNavigate();
    const [squads, setSquads] = useState<SquadDto[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiClient.get(`/clubs/${clubId}/squads`)
            .then((squadsResponse) => {
                setSquads(squadsResponse.data || []);
            })
            .catch((error) => console.error('Failed to load squad directory', error))
            .finally(() => setLoading(false));
    }, [clubId, refreshKey]);

    if (loading) {
        return (
            <div className="flex justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--club-tone-green)]" />
            </div>
        );
    }

    if (squads.length === 0) {
        return (
            <div className="bg-[var(--club-card)] border border-[var(--club-theme-border-subtle)] rounded-xl px-5 py-10 text-center">
                <h3 className="text-base font-semibold text-[var(--club-theme-text-primary)]">No Active Squads</h3>
                <p className="mt-2 text-sm text-[var(--club-theme-text-secondary)]">This club has not registered any squads yet.</p>
            </div>
        );
    }

    return (
        <section className="bg-[var(--club-card)] border border-[var(--club-theme-border-subtle)] rounded-xl">
            <div className="border-b border-[var(--club-theme-border-subtle)] px-4 py-4">
                <p className="text-xs text-[var(--club-tone-green)]">Our teams</p>
                <h2 className="text-lg font-semibold text-[var(--club-theme-text-primary)]">Squads</h2>
                <p className="text-sm text-[var(--club-theme-text-secondary)]">Meet our teams and explore their player rosters.</p>
            </div>
            <div className="divide-y divide-[var(--club-theme-border-subtle)]">
                {squads.map((squad) => (
                    <article key={squad.id} className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-[var(--club-theme-text-primary)]">{squad.name}</p>
                            </div>
                            <p className="mt-2 text-[11px] font-semibold text-[var(--club-theme-text-secondary)]">
                                {squad.category} / {squad.gender}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => navigate(`/clubs/${clubId}/squads?squad=${squad.id}`)}
                            className="inline-flex items-center gap-2 rounded-xl border border-[var(--club-theme-border-subtle)] bg-[var(--club-theme-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--club-theme-text-primary)]"
                        >
                            View squad
                            <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                    </article>
                ))}
            </div>
        </section>
    );
};
