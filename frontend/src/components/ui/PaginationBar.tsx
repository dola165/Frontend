interface PaginationBarProps {
    page: number;
    totalPages: number;
    totalElements?: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    pageSizeOptions?: number[];
}

const DEFAULT_PAGE_SIZES = [9, 12, 15, 20, 30];

export const PaginationBar = ({
    page,
    totalPages,
    totalElements,
    pageSize,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = DEFAULT_PAGE_SIZES
}: PaginationBarProps) => {
    return (
        <div className="flex items-center justify-center gap-3 mt-6">
            <button
                onClick={() => onPageChange(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 rounded-xl border border-[var(--color-border)] text-xs text-[var(--color-secondary)] disabled:opacity-30 hover:bg-[color-mix(in_srgb,_var(--color-ink)_3%,_transparent)] transition-colors"
            >
                Previous
            </button>
            <span className="text-xs text-[var(--color-secondary)]">
                Page {page + 1} of {totalPages}
            </span>
            {totalElements !== undefined && (
                <span className="text-[11px] text-[var(--color-muted)]">
                    {totalElements} items
                </span>
            )}
            <button
                onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 rounded-xl border border-[var(--color-border)] text-xs text-[var(--color-secondary)] disabled:opacity-30 hover:bg-[color-mix(in_srgb,_var(--color-ink)_3%,_transparent)] transition-colors"
            >
                Next
            </button>
            <span className="text-[11px] text-[var(--color-muted)] mx-1">·</span>
            <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-[var(--color-muted)]">Show</span>
                <select
                    aria-label="Results per page"
                    value={pageSize}
                    onChange={e => {
                        onPageSizeChange(Number(e.target.value));
                        onPageChange(0);
                    }}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-xs text-[var(--color-secondary)] px-2 py-1 outline-none focus:border-[var(--color-accent)]"
                >
                    {pageSizeOptions.map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
            </div>
        </div>
    );
};

export const PaginationTopBar = ({
    totalElements,
    pageSize,
    onPageSizeChange,
    pageSizeOptions = DEFAULT_PAGE_SIZES,
    label = 'items'
}: {
    totalElements: number;
    pageSize: number;
    onPageSizeChange: (size: number) => void;
    pageSizeOptions?: number[];
    label?: string;
}) => {
    return (
        <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-[var(--color-secondary)]">{totalElements} {label}</span>
            <div className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--color-secondary)]">Show:</span>
                <select
                    aria-label="Results per page"
                    value={pageSize}
                    onChange={e => onPageSizeChange(Number(e.target.value))}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-xs text-[var(--color-secondary)] px-2 py-1 outline-none focus:border-[var(--color-accent)]"
                >
                    {pageSizeOptions.map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
            </div>
        </div>
    );
};
