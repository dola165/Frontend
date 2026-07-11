import { ChevronLeft, ChevronRight, Plus, ShieldCheck, UserRound } from 'lucide-react';
import type { WorkspaceSurface } from './workspaceTypes';

interface ScheduleWorkspaceHeaderProps {
    workspaceSurface: WorkspaceSurface;
    canOpenClubSchedule: boolean;
    rangeLabel: string;
    scheduleBusy: boolean;
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
    onSelectSurface,
    onPrevious,
    onToday,
    onNext,
    onCreateEvent,
    onReplayTutorial
}: ScheduleWorkspaceHeaderProps) => (
    <header className="border-b border-[var(--fc-border)] bg-[var(--fc-card-bg)]">
        <div className="flex items-center justify-between gap-4 px-5 py-3">
            {/* Left: Surface toggle + Date navigation */}
            <div className="flex items-center gap-3">
                {/* Segmented surface picker */}
                <div data-tutorial="calendar-surface-toggle" className="flex rounded-[var(--fc-radius)] border border-[var(--fc-border)] bg-[var(--fc-sidebar-bg)] p-0.5">
                    <button
                        type="button"
                        onClick={() => onSelectSurface('CLUB_SCHEDULE')}
                        disabled={!canOpenClubSchedule}
                        className={`inline-flex items-center gap-1.5 rounded-[4px] px-3 py-1.5 text-xs font-semibold transition-all ${
                            workspaceSurface === 'CLUB_SCHEDULE'
                                ? 'bg-[var(--fc-accent)] text-white'
                                : 'text-[var(--fc-text-secondary)] hover:text-[var(--fc-text-primary)]'
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Club
                    </button>
                    <button
                        type="button"
                        onClick={() => onSelectSurface('MY_SCHEDULE')}
                        className={`inline-flex items-center gap-1.5 rounded-[4px] px-3 py-1.5 text-xs font-semibold transition-all ${
                            workspaceSurface === 'MY_SCHEDULE'
                                ? 'bg-[var(--fc-accent)] text-white'
                                : 'text-[var(--fc-text-secondary)] hover:text-[var(--fc-text-primary)]'
                        }`}
                    >
                        <UserRound className="h-3.5 w-3.5" />
                        My
                    </button>
                </div>

                {/* Date navigation */}
                <div data-tutorial="calendar-date-nav" className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={onPrevious}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--fc-radius)] text-[var(--fc-text-muted)] transition-colors hover:bg-[var(--fc-surface-hover)] hover:text-[var(--fc-text-primary)]"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={onToday}
                        className="rounded-[var(--fc-radius)] px-2.5 py-1.5 text-xs font-semibold text-[var(--fc-text-secondary)] transition-colors hover:bg-[var(--fc-surface-hover)] hover:text-[var(--fc-text-primary)]"
                    >
                        Today
                    </button>
                    <button
                        type="button"
                        onClick={onNext}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--fc-radius)] text-[var(--fc-text-muted)] transition-colors hover:bg-[var(--fc-surface-hover)] hover:text-[var(--fc-text-primary)]"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>

                {/* Date label */}
                <h1 className="text-sm font-semibold text-[var(--fc-text-primary)]">{rangeLabel}</h1>
            </div>

            {/* Right: Help + Action button */}
            <div className="flex items-center gap-2">
                {onReplayTutorial && (
                    <button
                        type="button"
                        onClick={onReplayTutorial}
                        title="Show tutorial"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--fc-border)] text-sm font-bold text-[var(--fc-text-muted)] transition-colors hover:border-[var(--fc-accent)] hover:text-[var(--fc-accent)]"
                    >
                        ?
                    </button>
                )}
                <button
                    type="button"
                    data-tutorial="calendar-new-event-btn"
                    onClick={onCreateEvent}
                disabled={scheduleBusy}
                className="inline-flex items-center gap-2 rounded-[var(--fc-radius)] bg-[var(--fc-accent)] px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            >
                <Plus className="h-4 w-4" />
                New Event
            </button>
            </div>
        </div>
    </header>
);
