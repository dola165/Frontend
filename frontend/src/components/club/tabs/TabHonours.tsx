import { Trophy } from 'lucide-react';
import type { ClubProfile } from '../../../pages/ClubProfilePage';

interface TabHonoursProps {
    club: ClubProfile;
}

export const TabHonours = ({ club }: TabHonoursProps) => {
    const honours = club.honours || [];

    return (
        <section className="bg-[#16181d] border border-[#ffffff0d] rounded-md">
            <div className="border-b border-[#ffffff0d] px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-xs text-[#a1a1aa] text-[#16a34a]">Entity Tab</p>
                        <h2 className="text-lg font-semibold text-[#f4f4f5]">Honours</h2>
                        <p className="text-sm text-[#a1a1aa]">Recorded trophies, league finishes, and historical milestones for this club.</p>
                    </div>
                    <div className="border border-[#ffffff0d] bg-[#16181d] px-4 py-3">
                        <p className="text-xs text-[#a1a1aa]">Recorded</p>
                        <p className="text-lg font-semibold text-[#f4f4f5]">{honours.length}</p>
                    </div>
                </div>
            </div>

            {honours.length === 0 ? (
                <div className="px-5 py-12 text-center">
                    <Trophy className="mx-auto h-10 w-10 text-[#a1a1aa]" />
                    <h3 className="text-base font-semibold text-[#f4f4f5]">No Honours Recorded</h3>
                    <p className="mt-2 text-sm text-[#a1a1aa]">This archive will populate once the club records trophies, league finishes, and milestones.</p>
                </div>
            ) : (
                <div className="divide-y divide-[#ffffff0d]">
                    {honours.map((honour) => (
                        <article key={honour.id} className="grid gap-4 px-4 py-4 md:grid-cols-[90px_minmax(0,1fr)]">
                            <div className="text-xs text-[#a1a1aa] text-[#16a34a]">{honour.yearWon}</div>
                            <div>
                                <p className="text-sm font-semibold text-[#f4f4f5]">{honour.title}</p>
                                <p className="mt-2 text-sm text-[#a1a1aa]">{honour.description || 'Historic achievement recorded in the club archive.'}</p>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
};
