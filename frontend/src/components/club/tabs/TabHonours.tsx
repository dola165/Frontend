import { Trophy } from 'lucide-react';
import type { ClubProfile } from '../../../pages/ClubProfilePage';

interface TabHonoursProps {
    club: ClubProfile;
}

export const TabHonours = ({ club }: TabHonoursProps) => {
    const honours = club.honours || [];

    return (
        <section className="bg-[var(--club-card)] border border-[var(--club-theme-border-subtle)] rounded-xl">
            <div className="border-b border-[var(--club-theme-border-subtle)] px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-xs text-[var(--club-tone-green)]">Club history</p>
                        <h2 className="text-lg font-semibold text-[var(--club-theme-text-primary)]">Honours</h2>
                        <p className="text-sm text-[var(--club-theme-text-secondary)]">Recorded trophies, league finishes, and historical milestones for this club.</p>
                    </div>
                    <div className="border border-[var(--club-theme-border-subtle)] bg-[var(--club-card)] px-4 py-3">
                        <p className="text-xs text-[var(--club-theme-text-secondary)]">Recorded</p>
                        <p className="text-lg font-semibold text-[var(--club-theme-text-primary)]">{honours.length}</p>
                    </div>
                </div>
            </div>

            {honours.length === 0 ? (
                <div className="px-5 py-12 text-center">
                    <Trophy className="mx-auto h-10 w-10 text-[var(--club-theme-text-secondary)]" />
                    <h3 className="text-base font-semibold text-[var(--club-theme-text-primary)]">No Honours Recorded</h3>
                    <p className="mt-2 text-sm text-[var(--club-theme-text-secondary)]">This archive will populate once the club records trophies, league finishes, and milestones.</p>
                </div>
            ) : (
                <div className="divide-y divide-[var(--club-theme-border-subtle)]">
                    {honours.map((honour) => (
                        <article key={honour.id} className="grid gap-4 px-4 py-4 md:grid-cols-[90px_minmax(0,1fr)]">
                            <div className="text-xs text-[var(--club-tone-green)]">{honour.yearWon}</div>
                            <div>
                                <p className="text-sm font-semibold text-[var(--club-theme-text-primary)]">{honour.title}</p>
                                <p className="mt-2 text-sm text-[var(--club-theme-text-secondary)]">{honour.description || 'Historic achievement recorded in the club archive.'}</p>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
};
