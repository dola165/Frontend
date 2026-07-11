import { Loader2 } from 'lucide-react';

interface ScheduleToolbarStat {
    label: string;
    value: string;
    tone?: 'green' | 'blue' | 'purple' | 'pink' | 'neutral';
}

interface ScheduleToolbarProps {
    workspaceLabel: string;
    rangeLabel: string;
    viewMode: 'month' | 'week' | 'day';
    stats: ScheduleToolbarStat[];
    scheduleBusy: boolean;
    onViewModeChange: (view: 'month' | 'week' | 'day') => void;
}

const VIEW_OPTIONS = [
    { value: 'month' as const, label: 'Month' },
    { value: 'week' as const, label: 'Week' },
    { value: 'day' as const, label: 'Day' }
];

export const ScheduleToolbar = ({
    workspaceLabel,
    rangeLabel,
    viewMode,
    stats,
    scheduleBusy,
    onViewModeChange
}: ScheduleToolbarProps) => {
    const statToneClass: Record<NonNullable<ScheduleToolbarStat['tone']>, string> = {
        green: 'schedule-tone-green',
        blue: 'schedule-tone-blue',
        purple: 'schedule-tone-purple',
        pink: 'schedule-tone-pink',
        neutral: ''
    };

    return (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--fc-border)] px-4 py-2">
            <div className="flex items-center gap-4">
                <span className="text-xs font-semibold text-[var(--fc-text-primary)]">{workspaceLabel}</span>
                <span className="text-xs text-[var(--fc-text-secondary)]">{rangeLabel}</span>
            </div>

            <div className="flex items-center gap-3">
                <div data-tutorial="calendar-view-mode" className="flex rounded-[var(--fc-radius)] border border-[var(--fc-border)] bg-[var(--fc-sidebar-bg)] p-0.5">
                    {VIEW_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => onViewModeChange(opt.value)}
                            className={`rounded-[4px] px-3 py-1 text-xs font-semibold transition-all ${
                                viewMode === opt.value
                                    ? 'bg-[var(--fc-accent)] text-white'
                                    : 'text-[var(--fc-text-muted)] hover:text-[var(--fc-text-primary)]'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                {stats.map((stat) => (
                    <span
                        key={`${stat.label}-${stat.value}`}
                        className={`schedule-inline-chip ${statToneClass[stat.tone ?? 'neutral']}`.trim()}
                    >
                        <span className="text-secondary">{stat.label}</span>
                        <span className="text-primary">{stat.value}</span>
                    </span>
                ))}

                {scheduleBusy ? (
                    <span className="schedule-inline-chip schedule-tone-blue">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-secondary" />
                        <span className="text-secondary">Refreshing</span>
                    </span>
                ) : null}
            </div>
        </div>
    );
};
