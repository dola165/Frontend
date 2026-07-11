import { Circle } from 'lucide-react';

interface StatusCellProps {
    label: string;
    tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

const toneColors: Record<string, string> = {
    success: 'text-[var(--fc-state-success)]',
    warning: 'text-[var(--fc-state-warning)]',
    danger: 'text-[var(--fc-state-danger)]',
    info: 'text-[var(--fc-state-info)]',
    neutral: 'text-[var(--fc-text-muted)]'
};

export const StatusCell = ({ label, tone = 'neutral' }: StatusCellProps) => (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${toneColors[tone]}`}>
        <Circle className="h-1.5 w-1.5 fill-current" />
        {label}
    </span>
);
