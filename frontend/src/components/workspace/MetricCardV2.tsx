import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';

interface MetricCardV2Props {
    label: string;
    value: number;
    icon: LucideIcon;
    trend?: {
        direction: 'up' | 'down' | 'flat';
        percentage: number;
        label: string;
    };
    tone?: 'default' | 'success' | 'warning' | 'danger';
}

const trendColorMap: Record<string, string> = {
    up: 'text-[var(--fc-state-success)]',
    down: 'text-[var(--fc-state-danger)]',
    flat: 'text-[var(--fc-text-muted)]'
};

export const MetricCardV2 = ({ label, value, icon: Icon, trend, tone = 'default' }: MetricCardV2Props) => {
    const TrendIcon = trend?.direction === 'up' ? TrendingUp : trend?.direction === 'down' ? TrendingDown : Minus;
    const trendColor = trend ? trendColorMap[trend.direction] : '';

    return (
        <div className="rounded-md border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-4 py-3">
            <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-[var(--fc-text-secondary)]">{label}</p>
                <Icon className="h-4 w-4 text-[var(--fc-text-muted)]" />
            </div>
            <p className="mt-1.5 text-2xl font-semibold text-[var(--fc-text-primary)]">{value}</p>
            {trend && (
                <div className="mt-1 flex items-center gap-1">
                    <TrendIcon className={`h-3.5 w-3.5 ${trendColor}`} />
                    <span className={`text-xs font-medium ${trendColor}`}>
                        {trend.direction === 'up' ? '+' : trend.direction === 'down' ? '-' : ''}{trend.percentage}%
                    </span>
                    <span className="text-xs text-[var(--fc-text-muted)]">{trend.label}</span>
                </div>
            )}
        </div>
    );
};
