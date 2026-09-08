import type { RefObject } from 'react';
import { Filter, Grid2X2, List, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SORT_OPTIONS } from './clubDirectoryTypes';
import { DirectoryFilterChipRow } from './DirectoryFilterShell';

export type ClubDirectoryView = 'grid' | 'list';

export interface ClubDirectoryFilterChip {
    id: string;
    label: string;
}

interface ClubDirectoryToolbarProps {
    search: string;
    sort: string;
    resultCount: number;
    view: ClubDirectoryView;
    hasActiveFilters: boolean;
    filtersOpen: boolean;
    activeFilterChips: ClubDirectoryFilterChip[];
    filterButtonRef?: RefObject<HTMLButtonElement | null>;
    onSearchChange: (value: string) => void;
    onSortChange: (value: string) => void;
    onClearFilters: () => void;
    onRemoveFilter: (id: string) => void;
    onOpenFilters: () => void;
    onViewChange: (view: ClubDirectoryView) => void;
}

export const ClubDirectoryToolbar = ({
    search,
    sort,
    resultCount,
    view,
    hasActiveFilters,
    filtersOpen,
    activeFilterChips,
    filterButtonRef,
    onSearchChange,
    onSortChange,
    onClearFilters,
    onRemoveFilter,
    onOpenFilters,
    onViewChange
}: ClubDirectoryToolbarProps) => {
    const { t } = useTranslation();

    return (
        <div className="sticky top-[var(--app-active-header-height)] z-20 -mx-1 rounded-xl border border-[#ffffff0d] bg-[#0f1117]/95 p-2 shadow-lg backdrop-blur-xl sm:-mx-2 sm:p-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="flex min-w-[min(100%,15rem)] flex-1 items-center gap-2 rounded-lg border border-[#ffffff0d] bg-[#16181d] px-3 py-2 min-h-11">
                    <Search className="h-4 w-4 shrink-0 text-[#a1a1aa]" />
                    <input
                        type="text"
                        aria-label={t('browseClubs.searchLabel')}
                        value={search}
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder={t('browseClubs.searchPlaceholder')}
                        className="min-w-0 flex-1 bg-transparent text-sm text-[#f4f4f5] placeholder:text-[#a1a1aa] focus:outline-none"
                    />
                    {search && (
                        <button type="button" onClick={() => onSearchChange('')} aria-label={t('browseClubs.clearSearch')} className="text-[#a1a1aa] hover:text-[#f4f4f5]">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                <select
                    aria-label={t('browseClubs.sortLabel')}
                    value={sort}
                    onChange={(event) => onSortChange(event.target.value)}
                    className="min-h-11 rounded-lg border border-[#ffffff0d] bg-[#16181d] px-3 py-2 text-sm font-medium text-[#f4f4f5] focus:outline-none sm:min-h-0"
                >
                    {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>

                <span className="order-last w-full text-[11px] text-[#a1a1aa] sm:order-none sm:w-auto sm:flex-1">
                    {t('browseClubs.resultCount', { count: resultCount })}
                </span>

                <div className="inline-flex rounded-lg border border-[#ffffff0d] bg-[#16181d] p-0.5" role="group" aria-label={t('browseClubs.viewLabel')}>
                    <button
                        type="button"
                        aria-label={t('browseClubs.gridView')}
                        aria-pressed={view === 'grid'}
                        onClick={() => onViewChange('grid')}
                        className={`inline-flex h-11 w-11 items-center justify-center rounded-md sm:h-8 sm:w-8 ${view === 'grid' ? 'bg-[#16a34a]/15 text-[#16a34a]' : 'text-[#a1a1aa] hover:text-[#f4f4f5]'}`}
                    >
                        <Grid2X2 className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        aria-label={t('browseClubs.listView')}
                        aria-pressed={view === 'list'}
                        onClick={() => onViewChange('list')}
                        className={`inline-flex h-11 w-11 items-center justify-center rounded-md sm:h-8 sm:w-8 ${view === 'list' ? 'bg-[#16a34a]/15 text-[#16a34a]' : 'text-[#a1a1aa] hover:text-[#f4f4f5]'}`}
                    >
                        <List className="h-4 w-4" />
                    </button>
                </div>

                <button
                    ref={filterButtonRef}
                    type="button"
                    aria-expanded={filtersOpen}
                    onClick={onOpenFilters}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#16a34a]/60 bg-[#16a34a]/10 px-3 py-2 text-[11px] font-semibold text-[#86efac] xl:hidden"
                >
                    <Filter className="h-3.5 w-3.5" />
                    {t('browseClubs.openFilters')}
                    {hasActiveFilters && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#16a34a] px-1 text-[9px] text-white">!</span>}
                </button>

                {hasActiveFilters && (
                    <button type="button" onClick={onClearFilters} className="hidden text-[11px] font-medium text-[#a1a1aa] hover:text-[#f4f4f5] sm:inline-flex">
                        {t('browseClubs.clearFilters')}
                    </button>
                )}

            </div>
            <DirectoryFilterChipRow
                chips={activeFilterChips}
                onRemove={onRemoveFilter}
                label={t('browseClubs.activeFilters')}
                removeLabel={t('browseClubs.removeFilter')}
            />
        </div>
    );
};
