import { Car, Dumbbell, Fence, Warehouse } from 'lucide-react';
import type { ClubProfile } from '../../../pages/ClubProfilePage';

interface TabFacilitiesProps {
    club: ClubProfile;
    isOwnClubAdmin: boolean;
}

const facilityChips = [
    { icon: Fence, label: 'Pitches & training grounds' },
    { icon: Warehouse, label: 'Clubhouse & changing rooms' },
    { icon: Dumbbell, label: 'Gym & recovery' },
    { icon: Car, label: 'Parking & accessibility' },
];

export const TabFacilities = ({ club, isOwnClubAdmin }: TabFacilitiesProps) => {
    return (
        <div className="flex flex-col gap-6">
            <header>
                <h2 className="text-xl font-semibold tracking-[-0.02em] text-[color:var(--club-theme-text-primary)]">Facilities</h2>
                <p className="mt-1 text-sm text-[color:var(--club-theme-text-secondary)]">
                    Where {club.name} trains and plays — grounds, clubhouse and amenities.
                </p>
            </header>

            <div className="flex flex-col items-center gap-5 rounded-2xl border border-dashed border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-card)] px-6 py-14 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--club-tone-cyan-soft)]">
                    <Warehouse className="h-8 w-8 text-[color:var(--club-tone-cyan)]" />
                </span>
                <div>
                    <h3 className="text-base font-semibold text-[color:var(--club-theme-text-primary)]">Facilities are on the way</h3>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[color:var(--club-theme-text-secondary)]">
                        {club.name} hasn't published its facilities yet. Pitches, training grounds, clubhouse
                        and accessibility details will appear here once they are added.
                        {isOwnClubAdmin ? ' You can publish them from the club workspace.' : ' Check back soon.'}
                    </p>
                </div>

                <div className="mt-2 w-full max-w-xl">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--club-theme-text-muted)]">
                        Typical categories clubs publish
                    </p>
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                        {facilityChips.map((chip) => (
                            <span
                                key={chip.label}
                                className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-theme-base)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--club-theme-text-secondary)]"
                            >
                                <chip.icon className="h-3.5 w-3.5 text-[color:var(--club-tone-cyan)]" />
                                {chip.label}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
