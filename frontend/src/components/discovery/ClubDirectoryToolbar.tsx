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
        <div className="club-directory-toolbar sticky top-[var(--app-active-header-height)] z-20 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 p-2 shadow-lg backdrop-blur-xl sm:p-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="club-directory-search flex min-w-[min(100%,15rem)] flex-1 items-center gap-2 rounded-lg border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[var(--color-surface)] px-3 py-2 min-h-11">
                    <Search className="h-4 w-4 shrink-0 text-[var(--color-secondary)]" />
                    <input
                        type="text"
                        aria-label={t('browseClubs.searchLabel')}
                        value={search}
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder={t('browseClubs.searchPlaceholder')}
                        className="min-w-0 flex-1 bg-transparent text-sm text-[var(--color-text)] placeholder:text-[var(--color-secondary)] focus:outline-none"
                    />
                    {search && (
                        <button type="button" onClick={() => onSearchChange('')} aria-label={t('browseClubs.clearSearch')} className="text-[var(--color-secondary)] hover:text-[var(--color-text)]">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                <select
                    aria-label={t('browseClubs.sortLabel')}
                    value={sort}
                    onChange={(event) => onSortChange(event.target.value)}
                    className="min-h-11 rounded-lg border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-text)] focus:outline-none sm:min-h-0"
                >
                    {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>

                <span className="order-last w-full text-[11px] text-[var(--color-secondary)] sm:order-none sm:w-auto sm:flex-1">
                    {t('browseClubs.resultCount', { count: resultCount })}
                </span>

                <div className="inline-flex rounded-lg border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[var(--color-surface)] p-0.5" role="group" aria-label={t('browseClubs.viewLabel')}>
                    <button
                        type="button"
                        aria-label={t('browseClubs.gridView')}
                        aria-pressed={view === 'grid'}
                        onClick={() => onViewChange('grid')}
                        className={`inline-flex h-11 w-11 items-center justify-center rounded-md sm:h-8 sm:w-8 ${view === 'grid' ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]' : 'text-[var(--color-secondary)] hover:text-[var(--color-text)]'}`}
                    >
                        <Grid2X2 className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        aria-label={t('browseClubs.listView')}
                        aria-pressed={view === 'list'}
                        onClick={() => onViewChange('list')}
                        className={`inline-flex h-11 w-11 items-center justify-center rounded-md sm:h-8 sm:w-8 ${view === 'list' ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]' : 'text-[var(--color-secondary)] hover:text-[var(--color-text)]'}`}
                    >
                        <List className="h-4 w-4" />
                    </button>
                </div>

                <button
                    ref={filterButtonRef}
                    type="button"
                    aria-expanded={filtersOpen}
                    onClick={onOpenFilters}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--color-accent)]/60 bg-[var(--color-accent)]/10 px-3 py-2 text-[11px] font-semibold text-[var(--color-accent)] xl:hidden"
                >
                    <Filter className="h-3.5 w-3.5" />
                    {t('browseClubs.openFilters')}
                    {hasActiveFilters && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-accent)] px-1 text-[9px] text-[var(--color-on-accent)]">!</span>}
                </button>

                {hasActiveFilters && (
                    <button type="button" onClick={onClearFilters} className="hidden text-[11px] font-medium text-[var(--color-secondary)] hover:text-[var(--color-text)] sm:inline-flex">
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
