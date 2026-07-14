import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

export const avatarLetter = (value?: string | null) => (value?.trim()?.charAt(0) || '?').toUpperCase();

export const formatMetaTime = (value?: string | null) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export const SectionHeader = ({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) => (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
            <p className="text-xs font-semibold text-[var(--fc-text-muted)]">{eyebrow}</p>
            <h3 className="mt-1 text-base font-semibold text-[var(--fc-text-primary)]">{title}</h3>
            {description && <p className="mt-1 max-w-2xl text-sm text-[var(--fc-text-secondary)]">{description}</p>}
        </div>
        {action}
    </div>
);

export const EmptyState = ({ message, description, icon }: { message: string; description?: string; icon?: React.ReactNode }) => (
    <div className="rounded-md border border-[var(--fc-border)] px-4 py-12 text-center">
        {icon && <div className="mb-3 flex justify-center text-[var(--fc-text-muted)]">{icon}</div>}
        <p className="text-sm font-medium text-[var(--fc-text-muted)]">{message}</p>
        {description && <p className="mt-1 text-xs text-[var(--fc-text-muted)]">{description}</p>}
    </div>
);

export interface SortState {
    column: number;
    direction: 'asc' | 'desc';
}

export const DataTable = ({
    columns,
    children,
    sort,
    onSort
}: {
    columns: string[];
    children: ReactNode;
    sort?: SortState | null;
    onSort?: (columnIndex: number) => void;
}) => {
    const handleSort = (colIndex: number) => {
        if (!onSort || columns[colIndex] === '') return; // last action column not sortable
        onSort(colIndex);
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="border-b border-[var(--fc-border)]">
                        {columns.map((col, i) => {
                            const isSortable = onSort && col !== '';
                            const isActive = sort?.column === i;
                            return (
                                <th key={col || `col-${i}`} className="px-4 h-11 text-xs font-semibold text-[var(--fc-text-secondary)]">
                                    {isSortable ? (
                                        <button
                                            type="button"
                                            onClick={() => handleSort(i)}
                                            className="inline-flex items-center gap-1 hover:text-[var(--fc-text-primary)] transition-colors cursor-pointer"
                                        >
                                            {col}
                                            <span className="text-[10px] leading-none">
                                                {isActive ? (sort.direction === 'asc' ? '▲' : '▼') : '⇅'}
                                            </span>
                                        </button>
                                    ) : (
                                        col
                                    )}
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--fc-border)]">
                    {children}
                </tbody>
            </table>
        </div>
    );
};

export const Pill = ({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'danger' | 'warning' | 'info' }) => {
    const tones: Record<string, string> = {
        neutral: 'bg-[var(--fc-surface-hover)] text-[var(--fc-text-muted)]',
        success: 'bg-[var(--fc-state-success-soft)] text-[var(--fc-state-success)]',
        danger: 'bg-[var(--fc-state-danger-soft)] text-[var(--fc-state-danger)]',
        warning: 'bg-[var(--fc-state-warning-soft)] text-[var(--fc-state-warning)]',
        info: 'bg-[var(--fc-state-info-soft)] text-[var(--fc-state-info)]',
    };
    return (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
            {label}
        </span>
    );
};

export const PageSpinner = () => (
    <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--fc-text-muted)]" />
    </div>
);

export const ErrorBlock = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
    <div className="rounded-md border border-[var(--fc-state-danger-soft)] bg-[var(--fc-state-danger-soft)] px-6 py-10 text-center">
        <h3 className="text-base font-semibold text-[var(--fc-text-primary)]">Something went wrong</h3>
        <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--fc-text-secondary)]">{message}</p>
        <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-[var(--fc-accent)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
            Retry
        </button>
    </div>
);
