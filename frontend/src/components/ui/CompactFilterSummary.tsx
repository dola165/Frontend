import type { ReactNode } from 'react';

interface CompactFilterSummaryProps {
    label: string;
    summary: string;
    chips?: Array<string | ReactNode>;
    className?: string;
}

export const CompactFilterSummary = ({
    label,
    summary,
    chips = [],
    className = ''
}: CompactFilterSummaryProps) => (
    <section className={`app-card px-4 py-4 ${className}`.trim()}>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-secondary">{label}</p>
        <p className="mt-2 text-sm leading-6 text-primary">{summary}</p>
        {chips.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
                {chips.map((chip, index) => (
                    <span key={index} className="app-chip rounded-[4px] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-secondary">
                        {chip}
                    </span>
                ))}
            </div>
        ) : null}
    </section>
);
