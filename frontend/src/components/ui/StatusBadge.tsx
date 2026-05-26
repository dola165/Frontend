import type { ReactNode } from 'react';

type StatusBadgeTone = 'neutral' | 'success' | 'danger' | 'warning' | 'info';

interface StatusBadgeProps {
    children: ReactNode;
    tone?: StatusBadgeTone;
    className?: string;
}

const toneClassNames: Record<StatusBadgeTone, string> = {
    neutral: 'border-subtle bg-base text-secondary',
    success: 'border-[color:var(--state-success)] bg-[color:var(--state-success-soft)] text-[color:var(--state-success)]',
    danger: 'border-[color:var(--state-danger)] bg-[color:var(--state-danger-soft)] text-[color:var(--state-danger)]',
    warning: 'border-[color:var(--state-warning)] bg-[color:var(--state-warning-soft)] text-[color:var(--state-warning)]',
    info: 'border-[color:var(--state-info)] bg-[color:var(--state-info-soft)] text-[color:var(--state-info)]'
};

export const StatusBadge = ({ children, tone = 'neutral', className = '' }: StatusBadgeProps) => (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${toneClassNames[tone]} ${className}`.trim()}>
        {children}
    </span>
);
