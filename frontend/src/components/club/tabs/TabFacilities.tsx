import { useTranslation } from 'react-i18next';
import { Car, Dumbbell, Fence, Warehouse } from 'lucide-react';
import type { ClubProfile } from '../../../pages/ClubProfilePage';

interface TabFacilitiesProps {
    club: ClubProfile;
    isOwnClubAdmin: boolean;
}

const facilityChips = [
    { icon: Fence, labelKey: 'clubFacilities.pitches' },
    { icon: Warehouse, labelKey: 'clubFacilities.clubhouse' },
    { icon: Dumbbell, labelKey: 'clubFacilities.gym' },
    { icon: Car, labelKey: 'clubFacilities.parking' },
];

export const TabFacilities = ({ club, isOwnClubAdmin }: TabFacilitiesProps) => {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col gap-6">
            <header>
                <h2 className="text-xl font-semibold tracking-[-0.02em] text-[color:var(--club-theme-text-primary)]">{t('clubFacilities.title')}</h2>
                <p className="mt-1 text-sm text-[color:var(--club-theme-text-secondary)]">
                    {t('clubFacilities.subtitle', { clubName: club.name })}
                </p>
            </header>

            <div className="flex flex-col items-center gap-5 rounded-2xl border border-dashed border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-card)] px-6 py-14 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--club-tone-cyan-soft)]">
                    <Warehouse className="h-8 w-8 text-[color:var(--club-tone-cyan)]" />
                </span>
                <div>
                    <h3 className="text-base font-semibold text-[color:var(--club-theme-text-primary)]">{t('clubFacilities.comingTitle')}</h3>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[color:var(--club-theme-text-secondary)]">
                        {t(isOwnClubAdmin ? 'clubFacilities.comingBodyAdmin' : 'clubFacilities.comingBodyGuest', { clubName: club.name })}
                    </p>
                </div>

                <div className="mt-2 w-full max-w-xl">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--club-theme-text-muted)]">
                        {t('clubFacilities.categoriesTitle')}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                        {facilityChips.map((chip) => (
                            <span
                                key={chip.labelKey}
                                className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-theme-base)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--club-theme-text-secondary)]"
                            >
                                <chip.icon className="h-3.5 w-3.5 text-[color:var(--club-tone-cyan)]" />
                                {t(chip.labelKey)}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
