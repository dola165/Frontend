import { ChevronLeft, ChevronRight, Filter, Loader2, Plus } from 'lucide-react';
import { OverflowActions, type OverflowActionItem } from '../ui/OverflowActions';

interface ScheduleToolbarStat {
    label: string;
    value: string;
    tone?: 'green' | 'blue' | 'purple' | 'pink' | 'neutral';
}

interface ScheduleToolbarProps {
    workspaceLabel: string;
    rangeLabel: string;
    filterSummary: string;
    filterChips: string[];
    stats: ScheduleToolbarStat[];
    scheduleBusy: boolean;
    onPrevious: () => void;
    onToday: () => void;
    onNext: () => void;
    onCreatePrimary?: () => void;
    primaryActionLabel?: string;
    overflowActions?: OverflowActionItem[];
}

export const ScheduleToolbar = ({
    workspaceLabel,
    rangeLabel,
    filterSummary,
    filterChips,
    stats,
    scheduleBusy,
    onPrevious,
    onToday,
    onNext,
    onCreatePrimary,
    primaryActionLabel = 'Create Event',
    overflowActions = []
}: ScheduleToolbarProps) => {
    const statToneClass: Record<NonNullable<ScheduleToolbarStat['tone']>, string> = {
        green: 'schedule-tone-green',
        blue: 'schedule-tone-blue',
        purple: 'schedule-tone-purple',
        pink: 'schedule-tone-pink',
        neutral: ''
    };
    const chipTones = ['schedule-tone-green', 'schedule-tone-blue', 'schedule-tone-purple', 'schedule-tone-pink'];

    return (
        <div className="operational-divider px-4 py-3 lg:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onPrevious}
                            className="schedule-interactive schedule-tone-blue inline-flex h-9 w-9 items-center justify-center rounded-[4px] text-secondary"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={onToday}
                            className="schedule-interactive schedule-tone-green inline-flex h-9 items-center justify-center rounded-[4px] px-3 text-[11px] font-black uppercase tracking-[0.16em] text-primary"
                        >
                            Today
                        </button>
                        <button
                            type="button"
                            onClick={onNext}
                            className="schedule-interactive schedule-tone-purple inline-flex h-9 w-9 items-center justify-center rounded-[4px] text-secondary"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="text-[10px] font-black uppercase tracking-[0.22em] accent-primary">{workspaceLabel}</span>
                            <h1 className="truncate text-[15px] font-black uppercase tracking-[0.12em] text-primary">{rangeLabel}</h1>
                            <span className="truncate text-xs text-secondary">{filterSummary}</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
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

                    {onCreatePrimary ? (
                        <button
                            type="button"
                            onClick={onCreatePrimary}
                            className="schedule-toolbar-action schedule-tone-green inline-flex items-center gap-2 rounded-[4px] px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] accent-primary"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            {primaryActionLabel}
                        </button>
                    ) : null}

                    {overflowActions.length > 0 ? <OverflowActions items={overflowActions} /> : null}
                </div>
            </div>

            {filterChips.length > 0 ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.16em] text-secondary">
                        <Filter className="h-3 w-3" />
                        Filters
                    </span>
                    {filterChips.map((chip, index) => (
                        <span
                            key={chip}
                            className={`schedule-inline-chip ${chipTones[index % chipTones.length]}`}
                        >
                            <span className="text-primary">{chip}</span>
                        </span>
                    ))}
                </div>
            ) : null}
        </div>
    );
};
