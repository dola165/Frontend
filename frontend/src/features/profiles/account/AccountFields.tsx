import type { ReactNode } from 'react';
import { labelClass, surfaceClass } from './accountModel';

export const Section = ({
    title,
    description,
    actions,
    children
}: {
    title: string;
    description?: string;
    actions?: ReactNode;
    children: ReactNode;
}) => (
    <section className={surfaceClass}>
        <div className="flex flex-col gap-3 border-b border-[var(--fc-border)] px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <h2 className="text-base font-semibold text-[color:var(--fc-text-primary)]">{title}</h2>
                {description && <p className="mt-1 text-sm leading-6 text-[color:var(--fc-text-secondary)]">{description}</p>}
            </div>
            {actions}
        </div>
        <div className="p-5">{children}</div>
    </section>
);

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
    <label className="flex flex-col gap-1.5">
        <span className={labelClass}>{label}</span>
        {children}
    </label>
);

export const StatTile = ({ label, value }: { label: string; value: ReactNode }) => (
    <div className={surfaceClass}>
        <div className="px-4 py-3.5">
            <p className={labelClass}>{label}</p>
            <div className="mt-2 text-xl font-bold text-[color:var(--fc-text-primary)]">{value}</div>
        </div>
    </div>
);

export const DetailRow = ({ label, value }: { label: string; value: ReactNode }) => (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--fc-border)] py-3 first:pt-0 last:border-b-0 last:pb-0">
        <p className={labelClass}>{label}</p>
        <div className="max-w-[70%] text-right text-sm font-semibold text-[color:var(--fc-text-primary)]">{value}</div>
    </div>
);
