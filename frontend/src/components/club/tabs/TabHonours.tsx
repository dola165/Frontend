import { Trophy } from 'lucide-react';
import type { ClubProfile } from '../../../pages/ClubProfilePage';

interface TabHonoursProps {
    club: ClubProfile;
}

export const TabHonours = ({ club }: TabHonoursProps) => {
    const honours = club.honours || [];

    return (
        <section className="bg-surface border border-subtle">
            <div className="border-b border-subtle px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] accent-primary">Entity Tab</p>
                        <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-primary">Honours</h2>
                        <p className="mt-2 text-sm leading-6 text-secondary">Recorded trophies, league finishes, and historical milestones for this club.</p>
                    </div>
                    <div className="border border-subtle bg-base px-4 py-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-secondary">Recorded</p>
                        <p className="mt-2 text-2xl font-black uppercase tracking-tight text-primary">{honours.length}</p>
                    </div>
                </div>
            </div>

            {honours.length === 0 ? (
                <div className="px-5 py-12 text-center">
                    <Trophy className="mx-auto h-10 w-10 text-secondary" />
                    <h3 className="mt-4 text-lg font-black uppercase tracking-[0.14em] text-primary">No Honours Recorded</h3>
                    <p className="mt-2 text-sm text-secondary">This archive will populate once the club records trophies, league finishes, and milestones.</p>
                </div>
            ) : (
                <div className="divide-y divide-[color:var(--border-subtle)]">
                    {honours.map((honour) => (
                        <article key={honour.id} className="grid gap-4 px-4 py-4 md:grid-cols-[90px_minmax(0,1fr)]">
                            <div className="text-[11px] font-black uppercase tracking-[0.18em] accent-primary">{honour.yearWon}</div>
                            <div>
                                <p className="text-base font-black uppercase tracking-[0.12em] text-primary">{honour.title}</p>
                                <p className="mt-2 text-sm leading-6 text-secondary">{honour.description || 'Historic achievement recorded in the club archive.'}</p>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
};
