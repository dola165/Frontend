import { useId, type ReactNode } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';

export type DirectoryFilterVariant = 'rail' | 'drawer';
export type DirectoryFilterAccent = 'green' | 'amber' | 'violet' | 'emerald';

const accentClasses: Record<DirectoryFilterAccent, { icon: string; selected: string; border: string; dot: string }> = {
    green: { icon: 'text-[#16a34a]', selected: 'border-[#16a34a] bg-[#16a34a]/10 text-[#16a34a]', border: 'border-[#16a34a]', dot: 'bg-[#16a34a]' },
    amber: { icon: 'text-amber-400', selected: 'border-amber-400/60 bg-amber-400/10 text-amber-200', border: 'border-amber-400/60', dot: 'bg-amber-400' },
    violet: { icon: 'text-fuchsia-300', selected: 'border-fuchsia-400/60 bg-fuchsia-400/10 text-fuchsia-200', border: 'border-fuchsia-400/60', dot: 'bg-fuchsia-400' },
    emerald: { icon: 'text-emerald-400', selected: 'border-emerald-400/60 bg-emerald-400/10 text-emerald-200', border: 'border-emerald-400/60', dot: 'bg-emerald-400' }
};

interface DirectoryFilterShellProps {
    title: string;
    description?: string;
    variant?: DirectoryFilterVariant;
    accent?: DirectoryFilterAccent;
    hasActiveFilters?: boolean;
    clearLabel?: string;
    onClear?: () => void;
    children: ReactNode;
    className?: string;
}

export const DirectoryFilterShell = ({
    title,
    description,
    variant = 'rail',
    accent = 'green',
    hasActiveFilters = false,
    clearLabel = 'Clear all',
    onClear,
    children,
    className = ''
}: DirectoryFilterShellProps) => {
    const titleId = useId();
    const accentStyle = accentClasses[accent];

    return (
        <section aria-labelledby={titleId} className={`overflow-hidden rounded-xl border border-[color:var(--theme-border-strong)] bg-[color:var(--theme-surface)] shadow-[var(--theme-shadow)] ${className}`.trim()}>
            <header className={`flex items-start justify-between gap-3 border-b border-[color:var(--theme-border)] px-4 py-4 ${variant === 'drawer' ? 'sm:px-5' : ''}`}>
                <div className="min-w-0">
                    <h2 id={titleId} className="inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.1em] text-[color:var(--text-primary)]">
                        <SlidersHorizontal className={`h-4 w-4 ${accentStyle.icon}`} />
                        {title}
                    </h2>
                    {description && <p className="mt-1 text-xs leading-5 text-[color:var(--text-secondary)]">{description}</p>}
                </div>
                {hasActiveFilters && onClear && (
                    <button type="button" onClick={onClear} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[color:var(--theme-border)] px-2.5 py-1.5 text-xs font-bold text-[color:var(--text-secondary)] transition-colors hover:border-[color:var(--theme-border-strong)] hover:text-[color:var(--text-primary)]">
                        <X className="h-3.5 w-3.5" />
                        {clearLabel}
                    </button>
                )}
            </header>
            <div>{children}</div>
        </section>
    );
};

interface DirectoryFilterSectionProps {
    title: string;
    children: ReactNode;
    separated?: boolean;
    className?: string;
}

export const DirectoryFilterSection = ({ title, children, separated = false, className = '' }: DirectoryFilterSectionProps) => (
    <fieldset className={`${separated ? 'border-t border-[color:var(--theme-border)]' : ''} px-4 py-4 ${className}`.trim()}>
        <legend className="mb-3 text-xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-secondary)]">{title}</legend>
        {children}
    </fieldset>
);

export interface DirectoryChoiceOption {
    value: string;
    label: string;
}

interface DirectoryChoiceListProps {
    options: readonly DirectoryChoiceOption[];
    selectedValues: readonly string[];
    onToggle: (value: string) => void;
    accent?: DirectoryFilterAccent;
    variant?: 'pill' | 'row';
    columns?: string;
}

export const DirectoryChoiceList = ({
    options,
    selectedValues,
    onToggle,
    accent = 'green',
    variant = 'row',
    columns = 'grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1'
}: DirectoryChoiceListProps) => {
    const accentStyle = accentClasses[accent];

    return (
        <div className={variant === 'pill' ? 'flex flex-wrap gap-2' : columns}>
            {options.map((option) => {
                const selected = selectedValues.includes(option.value);
                return (
                    <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onToggle(option.value)}
                        className={variant === 'pill'
                            ? `min-h-11 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors sm:min-h-0 ${selected ? accentStyle.selected : 'border-[color:var(--theme-border)] text-[color:var(--text-secondary)] hover:border-[color:var(--theme-border-strong)] hover:text-[color:var(--text-primary)]'}`
                            : `flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${selected ? `${accentStyle.selected} font-bold` : 'border-transparent text-[color:var(--text-secondary)] hover:border-[color:var(--theme-border)] hover:bg-[color:var(--theme-surface-inset)] hover:text-[color:var(--text-primary)]'}`}
                    >
                        {variant === 'row' && (
                            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${selected ? accentStyle.border : 'border-[color:var(--theme-border-strong)]'}`}>
                                {selected && <span className={`h-2 w-2 rounded-full ${accentStyle.dot}`} />}
                            </span>
                        )}
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
};

export interface DirectoryFilterChip {
    id: string;
    label: string;
}

interface DirectoryFilterChipRowProps {
    chips: readonly DirectoryFilterChip[];
    onRemove: (id: string) => void;
    label?: string;
    removeLabel?: string;
    accent?: DirectoryFilterAccent;
}

export const DirectoryFilterChipRow = ({
    chips,
    onRemove,
    label = 'Active filters',
    removeLabel = 'Remove filter',
    accent = 'green'
}: DirectoryFilterChipRowProps) => {
    if (chips.length === 0) return null;
    const accentStyle = accentClasses[accent];

    return (
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[color:var(--theme-border)] pt-2" aria-label={label}>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[color:var(--text-muted)]">{label}</span>
            {chips.map((chip) => (
                <span key={chip.id} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium ${accentStyle.selected}`}>
                    {chip.label}
                    <button type="button" onClick={() => onRemove(chip.id)} aria-label={`${removeLabel} ${chip.label}`} className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-white/10">
                        <X className="h-3 w-3" />
                    </button>
                </span>
            ))}
        </div>
    );
};
