interface PaginationBarProps {
    page: number;
    totalPages: number;
    totalElements: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    pageSizeOptions?: number[];
}

const DEFAULT_PAGE_SIZES = [9, 12, 15, 20, 30];

export const PaginationBar = ({
    page,
    totalPages,
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
                className="px-3 py-1.5 rounded-md border border-[#26282d] text-xs text-[#a1a1aa] disabled:opacity-30 hover:bg-[rgba(255,255,255,0.03)] transition-colors"
            >
                Previous
            </button>
            <span className="text-xs text-[#71717a]">
                Page {page + 1} of {totalPages}
            </span>
            <button
                onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 rounded-md border border-[#26282d] text-xs text-[#a1a1aa] disabled:opacity-30 hover:bg-[rgba(255,255,255,0.03)] transition-colors"
            >
                Next
            </button>
            <span className="text-[11px] text-[#4d4d52] mx-1">·</span>
            <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-[#4d4d52]">Show</span>
                <select
                    value={pageSize}
                    onChange={e => {
                        onPageSizeChange(Number(e.target.value));
                        onPageChange(0);
                    }}
                    className="rounded-md border border-[#26282d] bg-[#0f1117] text-xs text-[#a1a1aa] px-2 py-1 outline-none focus:border-[#16a34a]"
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
            <span className="text-xs text-[#71717a]">{totalElements} {label}</span>
            <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#71717a]">Show:</span>
                <select
                    value={pageSize}
                    onChange={e => onPageSizeChange(Number(e.target.value))}
                    className="rounded-md border border-[#26282d] bg-[#0f1117] text-xs text-[#a1a1aa] px-2 py-1 outline-none focus:border-[#16a34a]"
                >
                    {pageSizeOptions.map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
            </div>
        </div>
    );
};
