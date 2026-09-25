import { ChevronLeft, ChevronRight, CircleHelp, Plus, ShieldCheck, UserRound } from 'lucide-react';
import type { WorkspaceSurface } from './workspaceTypes';
import './schedule-workspace.css';

interface ScheduleWorkspaceHeaderProps {
    workspaceSurface: WorkspaceSurface;
    canOpenClubSchedule: boolean;
    rangeLabel: string;
    scheduleBusy: boolean;
    canCreate?: boolean;
    onSelectSurface: (surface: WorkspaceSurface) => void;
    onPrevious: () => void;
    onToday: () => void;
    onNext: () => void;
    onCreateEvent: () => void;
    onReplayTutorial?: () => void;
}

export const ScheduleWorkspaceHeader = ({
    workspaceSurface,
    canOpenClubSchedule,
    rangeLabel,
    scheduleBusy,
    canCreate = true,
    onSelectSurface,
    onPrevious,
    onToday,
    onNext,
    onCreateEvent,
    onReplayTutorial
}: ScheduleWorkspaceHeaderProps) => (
    <header className="schedule-workspace-header">
        <div className="schedule-workspace-heading">
            <div data-tutorial="calendar-surface-toggle" className="schedule-workspace-segments" role="group" aria-label="Choose schedule">
                <button type="button" onClick={() => onSelectSurface('MY_SCHEDULE')}
                    aria-pressed={workspaceSurface === 'MY_SCHEDULE'}>
                    <UserRound aria-hidden="true" />
                    My schedule
                </button>
                <button type="button" onClick={() => onSelectSurface('CLUB_SCHEDULE')}
                    aria-pressed={workspaceSurface === 'CLUB_SCHEDULE'} disabled={!canOpenClubSchedule}
                    title={!canOpenClubSchedule ? 'Join a club to view its schedule' : undefined}>
                    <ShieldCheck aria-hidden="true" />
                    Club schedule
                </button>
            </div>
            <div className="schedule-workspace-period">
                <div data-tutorial="calendar-date-nav" className="schedule-workspace-date-nav" role="group" aria-label="Calendar dates">
                    <button type="button" className="schedule-workspace-icon-button" onClick={onPrevious} aria-label="Previous period" title="Previous period">
                        <ChevronLeft aria-hidden="true" />
                    </button>
                    <button type="button" className="schedule-workspace-button schedule-workspace-today" onClick={onToday}>Today</button>
                    <button type="button" className="schedule-workspace-icon-button" onClick={onNext} aria-label="Next period" title="Next period">
                        <ChevronRight aria-hidden="true" />
                    </button>
                </div>
                <h1 aria-live="polite" aria-atomic="true">{rangeLabel}</h1>
            </div>
        </div>
        <div className="schedule-workspace-header-actions">
            {onReplayTutorial && (
                <button type="button" className="schedule-workspace-icon-button schedule-workspace-help" onClick={onReplayTutorial}
                    aria-label="Schedule help" title="Show schedule tutorial">
                    <CircleHelp aria-hidden="true" />
                </button>
            )}
            {canCreate && (
                <button type="button" data-tutorial="calendar-new-event-btn" className="schedule-workspace-button schedule-workspace-primary"
                    onClick={onCreateEvent} disabled={scheduleBusy}>
                    <Plus aria-hidden="true" />
                    New Event
                </button>
            )}
        </div>
    </header>
);
