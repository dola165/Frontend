import type { RefObject } from 'react';
import { Filter, Search, X } from 'lucide-react';
import { DirectoryFilterChipRow, type DirectoryFilterAccent, type DirectoryFilterChip } from './DirectoryFilterShell';

export interface DirectorySortOption {
    value: string;
    label: string;
}

interface DirectoryToolbarProps {
    search: string;
    searchLabel: string;
    searchPlaceholder: string;
    resultCount?: number;
    resultLabel?: (count: number) => string;
    sort?: string;
    sortLabel?: string;
    sortOptions?: readonly DirectorySortOption[];
    hasActiveFilters: boolean;
    filtersOpen: boolean;
    filterLabel: string;
    activeFilterChips: readonly DirectoryFilterChip[];
    filterButtonRef?: RefObject<HTMLButtonElement | null>;
    accent?: DirectoryFilterAccent;
    onSearchChange: (value: string) => void;
    onSortChange?: (value: string) => void;
    onClearFilters: () => void;
    onRemoveFilter: (id: string) => void;
    onOpenFilters: () => void;
}

const accentClasses: Record<DirectoryFilterAccent, string> = {
    green: 'border-[var(--color-accent)]/60 bg-[var(--color-accent)]/10 text-[var(--color-accent)]',
    amber: 'border-[color:var(--color-warning)]/60 bg-[color:var(--color-warning)]/10 text-[color:var(--color-warning)]',
    violet: 'border-[var(--color-pink)]/60 bg-[var(--color-pink)]/10 text-[var(--color-pink)]',
    emerald: 'border-[color:var(--color-accent)]/60 bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]'
};

export const DirectoryToolbar = ({
    search,
    searchLabel,
    searchPlaceholder,
    resultCount,
    resultLabel = (count) => `${count} results`,
    sort,
    sortLabel = 'Sort results',
    sortOptions = [],
    hasActiveFilters,
    filtersOpen,
    filterLabel,
    activeFilterChips,
    filterButtonRef,
    accent = 'green',
    onSearchChange,
    onSortChange,
    onClearFilters,
    onRemoveFilter,
    onOpenFilters
}: DirectoryToolbarProps) => (
    <div className="mt-5 rounded-xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] p-2 shadow-[var(--theme-shadow)] sm:p-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <label className="flex min-h-11 min-w-[min(100%,15rem)] flex-1 items-center gap-2 rounded-lg border border-[color:var(--theme-border)] bg-[color:var(--theme-page)] px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]" />
                <span className="sr-only">{searchLabel}</span>
                <input
                    type="search"
                    aria-label={searchLabel}
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder={searchPlaceholder}
                    className="min-w-0 flex-1 bg-transparent text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)]"
                />
                {search && (
                    <button type="button" onClick={() => onSearchChange('')} aria-label={`Clear ${searchLabel.toLowerCase()}`} className="text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]">
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}
            </label>

            {sort && sortOptions.length > 0 && onSortChange && (
                <select aria-label={sortLabel} value={sort} onChange={(event) => onSortChange(event.target.value)} className="min-h-11 rounded-lg border border-[color:var(--theme-border)] bg-[color:var(--theme-page)] px-3 py-2 text-sm font-medium text-[color:var(--text-primary)] outline-none sm:min-h-0">
                    {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
            )}

            {resultCount != null && <span className="order-last w-full text-[11px] text-[color:var(--text-secondary)] sm:order-none sm:w-auto sm:flex-1" aria-live="polite">{resultLabel(resultCount)}</span>}

            <button
                ref={filterButtonRef}
                type="button"
                aria-expanded={filtersOpen}
                aria-haspopup="dialog"
                onClick={onOpenFilters}
                className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-semibold xl:hidden ${accentClasses[accent]}`}
            >
                <Filter className="h-3.5 w-3.5" />
                {filterLabel}
                {hasActiveFilters && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-current px-1 text-[9px] text-[color:var(--theme-page)]">!</span>}
            </button>

            {hasActiveFilters && <button type="button" onClick={onClearFilters} className="hidden text-[11px] font-medium text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] sm:inline-flex">Clear filters</button>}
        </div>
        <DirectoryFilterChipRow chips={activeFilterChips} onRemove={onRemoveFilter} accent={accent} />
    </div>
);
