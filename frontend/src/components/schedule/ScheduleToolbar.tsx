import { Check, Loader2, PencilLine } from 'lucide-react';
import './schedule-workspace.css';
import { SelectionIndicator } from '../ui/SelectionIndicator';

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
    editMode: boolean;
    onToggleEditMode: () => void;
    canEdit: boolean;
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
    onViewModeChange,
    editMode,
    onToggleEditMode,
    canEdit
}: ScheduleToolbarProps) => (
    <div className="schedule-workspace-toolbar" role="group" aria-label={`${workspaceLabel}: ${rangeLabel}`}>
        <div className="schedule-workspace-toolbar-controls">
            <div data-tutorial="calendar-view-mode" className="app-selection-rail schedule-workspace-segments schedule-workspace-views" role="group" aria-label="Calendar view">
                <SelectionIndicator value={viewMode} />
                {VIEW_OPTIONS.map((option) => (
                    <button key={option.value} type="button" aria-pressed={viewMode === option.value}
                        onClick={() => onViewModeChange(option.value)}>{option.label}</button>
                ))}
            </div>
            {canEdit && (
                <button type="button" className="schedule-workspace-button schedule-workspace-edit" onClick={onToggleEditMode}
                    aria-pressed={editMode}
                    title={editMode ? 'Finish moving events and return to viewing your schedule' : 'Turn on dragging to move events to another date or time'}>
                    {editMode ? <Check aria-hidden="true" /> : <PencilLine aria-hidden="true" />}
                    {editMode ? 'Done editing' : 'Edit schedule'}
                </button>
            )}
        </div>
        <div className="schedule-workspace-toolbar-summary">
            {workspaceLabel.toLowerCase() !== 'my schedule' && <span className="schedule-workspace-owner" title={workspaceLabel}>{workspaceLabel}</span>}
            {stats.map((stat) => (
                <span key={stat.label} className="schedule-workspace-stat" data-tone={stat.tone ?? 'neutral'}>
                    <span className="schedule-workspace-stat-dot" aria-hidden="true" />
                    <strong>{stat.value}</strong>
                    <span>{stat.label}</span>
                </span>
            ))}
            {scheduleBusy && (
                <span className="schedule-workspace-refresh" role="status">
                    <Loader2 aria-hidden="true" className="animate-spin" />
                    Refreshing
                </span>
            )}
        </div>
    </div>
);
