import { MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CLUB_TYPES, JOIN_POLICIES } from './clubDirectoryTypes';
import { DirectoryChoiceList, DirectoryFilterSection, DirectoryFilterShell } from './DirectoryFilterShell';

interface ClubDirectoryFiltersProps {
    selectedTypes: string[];
    selectedPolicies: string[];
    city: string;
    country: string;
    hasActiveFilters: boolean;
    variant?: 'rail' | 'drawer';
    onCityChange: (value: string) => void;
    onCountryChange: (value: string) => void;
    onToggleType: (type: string) => void;
    onTogglePolicy: (policy: string) => void;
    onClearFilters: () => void;
}

export const ClubDirectoryFilters = ({
    selectedTypes,
    selectedPolicies,
    city,
    country,
    hasActiveFilters,
    variant = 'rail',
    onCityChange,
    onCountryChange,
    onToggleType,
    onTogglePolicy,
    onClearFilters
}: ClubDirectoryFiltersProps) => {
    const { t } = useTranslation();
    return (
        <DirectoryFilterShell
            title={t('browseClubs.filters')}
            variant={variant}
            hasActiveFilters={hasActiveFilters}
            clearLabel={t('browseClubs.clearFilters')}
            onClear={onClearFilters}
        >
            <div className="mt-5 space-y-5 px-4 pb-4">
                <DirectoryFilterSection title={t('browseClubs.clubType')} className="px-0 py-0">
                    <DirectoryChoiceList
                        options={CLUB_TYPES.map((type) => ({ value: type, label: type.replace('_', ' ') }))}
                        selectedValues={selectedTypes}
                        onToggle={onToggleType}
                        variant="pill"
                    />
                </DirectoryFilterSection>

                <DirectoryFilterSection title={t('browseClubs.joinPolicy')} className="px-0 py-0">
                    <DirectoryChoiceList
                        options={JOIN_POLICIES.map((policy) => ({ value: policy, label: policy.replace(/_/g, ' ') }))}
                        selectedValues={selectedPolicies}
                        onToggle={onTogglePolicy}
                        variant="pill"
                    />
                </DirectoryFilterSection>

                <DirectoryFilterSection title={t('browseClubs.location')} className="px-0 py-0">
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 rounded-lg border border-[#ffffff0d] bg-[#0f1117] px-3 py-2">
                            <MapPin className="h-4 w-4 shrink-0 text-[#a1a1aa]" />
                            <span className="sr-only">{t('browseClubs.city')}</span>
                            <input
                                type="text"
                                value={city}
                                onChange={(event) => onCityChange(event.target.value)}
                                placeholder={t('browseClubs.cityPlaceholder')}
                                className="min-w-0 flex-1 bg-transparent text-sm text-[#f4f4f5] placeholder:text-[#a1a1aa] focus:outline-none"
                            />
                        </label>
                        <label className="flex items-center gap-2 rounded-lg border border-[#ffffff0d] bg-[#0f1117] px-3 py-2">
                            <span className="text-[10px] font-medium text-[#a1a1aa]">CC</span>
                            <span className="sr-only">{t('browseClubs.country')}</span>
                            <input
                                type="text"
                                value={country}
                                onChange={(event) => onCountryChange(event.target.value)}
                                placeholder={t('browseClubs.countryPlaceholder')}
                                className="min-w-0 flex-1 bg-transparent text-sm text-[#f4f4f5] placeholder:text-[#a1a1aa] focus:outline-none"
                            />
                        </label>
                    </div>
                </DirectoryFilterSection>
            </div>
        </DirectoryFilterShell>
    );
};
