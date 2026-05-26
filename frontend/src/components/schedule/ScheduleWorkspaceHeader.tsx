import type { ReactNode } from 'react';
import { ArrowLeft, Loader2, Moon, PencilLine, Plus, RefreshCcw, Sun, Trash2 } from 'lucide-react';
import { OverflowActions, type OverflowActionItem } from '../ui/OverflowActions';
import {
    eventTypeCopy,
    surfaceCopy,
    viewCopy,
    type ScheduleEntryMode,
    type ScheduleRibbonTab,
    type ScheduleWorkspaceEvent,
    type WorkspaceSurface,
    type WorkspaceView
} from './workspaceTypes';
import type { ScheduleEventType } from '../../features/schedule/api';

interface ScheduleWorkspaceHeaderProps {
    user: { id?: number; username?: string; fullName?: string; role?: string } | null;
    darkMode: boolean;
    setDarkMode: (value: boolean) => void;
    workspaceLabel: string;
    rangeLabel: string;
    selectedEvent: ScheduleWorkspaceEvent | null;
    scheduleBusy: boolean;
    workspaceSurface: WorkspaceSurface;
    canOpenClubSchedule: boolean;
    activeInsertType: ScheduleEventType;
    activeRibbonTab: ScheduleRibbonTab;
    entryMode: ScheduleEntryMode;
    viewMode: WorkspaceView;
    canCreateEvent: boolean;
    canEditSelectedEvent: boolean;
    canDeleteSelectedEvent: boolean;
    canOpenConflictSource: boolean;
    onBack: () => void;
    onOpenAccount?: () => void;
    onSelectRibbonTab: (tab: ScheduleRibbonTab) => void;
    onSelectSurface: (surface: WorkspaceSurface) => void;
    onSelectInsertType: (eventType: ScheduleEventType) => void;
    onSelectEntryMode: (mode: ScheduleEntryMode) => void;
    onSelectViewMode: (view: WorkspaceView) => void;
    onResetLayout: () => void;
    onCreate?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    onFocusSelected?: () => void;
    onOpenConflictSource?: () => void;
    overflowActions?: OverflowActionItem[];
}

const getProfileLabel = (user: ScheduleWorkspaceHeaderProps['user']) =>
    (user?.username || user?.fullName || 'U').substring(0, 2).toUpperCase();

const toneForType = (type: ScheduleEventType) =>
    type === 'TRAINING'
        ? 'schedule-tone-green'
        : type === 'TRYOUT'
            ? 'schedule-tone-blue'
            : type === 'FRIENDLY'
                ? 'schedule-tone-pink'
                : type === 'MATCH'
                    ? 'schedule-tone-purple'
                    : 'schedule-tone-blue';

const RibbonGroup = ({ label, children }: { label: string; children: ReactNode }) => (
    <section className="schedule-ribbon-group">
        <div className="schedule-ribbon-group__body">{children}</div>
        <p className="schedule-ribbon-group__label">{label}</p>
    </section>
);

const ribbonTabs: Array<{ id: ScheduleRibbonTab; label: string }> = [
    { id: 'schedule', label: 'Schedule' },
    { id: 'edit', label: 'Edit' },
    { id: 'insert', label: 'Insert' },
    { id: 'layout', label: 'Layout' },
    { id: 'reference', label: 'Reference' }
];

export const ScheduleWorkspaceHeader = ({
    user,
    darkMode,
    setDarkMode,
    workspaceLabel,
    rangeLabel,
    selectedEvent,
    scheduleBusy,
    workspaceSurface,
    canOpenClubSchedule,
    activeInsertType,
    activeRibbonTab,
    entryMode,
    viewMode,
    canCreateEvent,
    canEditSelectedEvent,
    canDeleteSelectedEvent,
    canOpenConflictSource,
    onBack,
    onOpenAccount,
    onSelectRibbonTab,
    onSelectSurface,
    onSelectInsertType,
    onSelectEntryMode,
    onSelectViewMode,
    onResetLayout,
    onCreate,
    onEdit,
    onDelete,
    onFocusSelected,
    onOpenConflictSource,
    overflowActions = []
}: ScheduleWorkspaceHeaderProps) => {
    const createLabel = entryMode === 'series' ? 'New Training Series' : `New ${eventTypeCopy[activeInsertType].label}`;

    return (
        <header className="schedule-workspace-topbar">
            <div className="schedule-page-frame">
                <div className="schedule-workspace-command flex items-center justify-between gap-3 px-1 py-2">
                    <div className="flex min-w-0 items-center gap-3">
                        <button
                            type="button"
                            onClick={onBack}
                            className="schedule-toolbar-action schedule-tone-blue inline-flex h-10 items-center gap-2 rounded-[4px] px-3 text-[11px] font-black uppercase tracking-[0.16em] text-primary"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Go Back
                        </button>

                        <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] accent-primary">{workspaceLabel}</p>
                            <p className="truncate text-[14px] font-black uppercase tracking-[0.12em] text-primary">{rangeLabel}</p>
                        </div>
                    </div>

                    <div className="flex min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden">
                        <span className="schedule-inline-chip schedule-tone-purple min-w-0 max-w-[340px]">
                            <span className="text-secondary">{selectedEvent ? 'Selected' : 'Focus'}</span>
                            <span className="truncate text-primary">{selectedEvent?.title ?? 'Schedule board'}</span>
                        </span>

                        {selectedEvent?.recurrenceLabel ? (
                            <span className="schedule-inline-chip schedule-tone-green max-w-[260px]">
                                <span className="text-secondary">Pattern</span>
                                <span className="truncate text-primary">{selectedEvent.recurrenceLabel}</span>
                            </span>
                        ) : null}

                        {scheduleBusy ? (
                            <span className="schedule-inline-chip schedule-tone-blue">
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-secondary" />
                                <span className="text-secondary">Syncing</span>
                            </span>
                        ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setDarkMode(!darkMode)}
                            className="schedule-toolbar-action schedule-tone-blue inline-flex h-10 w-10 items-center justify-center rounded-[4px] text-secondary"
                            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                        >
                            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                        </button>

                        {user && onOpenAccount ? (
                            <button
                                type="button"
                                onClick={onOpenAccount}
                                className="schedule-toolbar-action schedule-tone-purple inline-flex h-10 min-w-10 items-center justify-center rounded-[4px] px-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-primary"
                                aria-label="Open account"
                            >
                                {getProfileLabel(user)}
                            </button>
                        ) : null}
                    </div>
                </div>

                <div className="schedule-ribbon-tabs px-1">
                    {ribbonTabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => onSelectRibbonTab(tab.id)}
                            className="schedule-ribbon-tab"
                            data-active={activeRibbonTab === tab.id}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="schedule-workspace-ribbon px-1 pb-2">
                    {activeRibbonTab === 'schedule' ? (
                        <RibbonGroup label="Schedule">
                            <div className="flex flex-wrap gap-2">
                                {(Object.keys(surfaceCopy) as WorkspaceSurface[]).map((surface) => {
                                    const meta = surfaceCopy[surface];
                                    const Icon = meta.icon;
                                    const active = workspaceSurface === surface;
                                    const disabled = surface === 'CLUB_SCHEDULE' && !canOpenClubSchedule;
                                    const toneClass = surface === 'MY_SCHEDULE' ? 'schedule-tone-green' : 'schedule-tone-purple';

                                    return (
                                        <button
                                            key={surface}
                                            type="button"
                                            onClick={() => !disabled && onSelectSurface(surface)}
                                            disabled={disabled}
                                            className={`schedule-interactive ${toneClass} inline-flex h-10 items-center gap-2 rounded-[4px] px-3 text-[11px] font-black uppercase tracking-[0.16em] ${
                                                active ? 'bg-elevated text-primary' : 'bg-transparent text-primary'
                                            } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                                            data-active={active}
                                            title={meta.description}
                                        >
                                            <Icon className="h-3.5 w-3.5" />
                                            {meta.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </RibbonGroup>
                    ) : null}

                    {activeRibbonTab === 'edit' ? (
                        <RibbonGroup label="Edit">
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={onCreate}
                                    disabled={!canCreateEvent || !onCreate}
                                    className={`schedule-toolbar-action schedule-tone-green inline-flex h-10 items-center gap-2 rounded-[4px] px-3 text-[11px] font-black uppercase tracking-[0.16em] ${
                                        !canCreateEvent || !onCreate ? 'cursor-not-allowed opacity-50' : 'accent-primary'
                                    }`}
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    {createLabel}
                                </button>

                                <button
                                    type="button"
                                    onClick={onEdit}
                                    disabled={!canEditSelectedEvent || !onEdit}
                                    className={`schedule-toolbar-action schedule-tone-blue inline-flex h-10 items-center gap-2 rounded-[4px] px-3 text-[11px] font-black uppercase tracking-[0.16em] text-primary ${
                                        !canEditSelectedEvent || !onEdit ? 'cursor-not-allowed opacity-50' : ''
                                    }`}
                                >
                                    <PencilLine className="h-3.5 w-3.5" />
                                    Edit
                                </button>

                                <button
                                    type="button"
                                    onClick={onDelete}
                                    disabled={!canDeleteSelectedEvent || !onDelete}
                                    className={`schedule-toolbar-action schedule-tone-pink inline-flex h-10 items-center gap-2 rounded-[4px] px-3 text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--state-danger)] ${
                                        !canDeleteSelectedEvent || !onDelete ? 'cursor-not-allowed opacity-50' : ''
                                    }`}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete
                                </button>

                                {overflowActions.length > 0 ? <OverflowActions items={overflowActions} /> : null}
                            </div>
                        </RibbonGroup>
                    ) : null}

                    {activeRibbonTab === 'insert' ? (
                        <>
                            <RibbonGroup label="Insert">
                                <div className="flex flex-wrap gap-2">
                                    {(['TRAINING', 'TRYOUT', 'MATCH', 'FRIENDLY', 'ACTIVITY'] as ScheduleEventType[]).map((type) => {
                                        const meta = eventTypeCopy[type];
                                        const Icon = meta.icon;
                                        const active = activeInsertType === type;

                                        return (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => onSelectInsertType(type)}
                                                className={`schedule-interactive ${toneForType(type)} inline-flex h-10 items-center gap-2 rounded-[4px] px-3 text-[11px] font-black uppercase tracking-[0.16em] ${
                                                    active ? 'bg-elevated text-primary' : 'bg-transparent text-primary'
                                                }`}
                                                data-active={active}
                                            >
                                                <Icon className="h-3.5 w-3.5" />
                                                {meta.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </RibbonGroup>

                            <RibbonGroup label="Timing">
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => onSelectEntryMode('single')}
                                        className="schedule-interactive schedule-tone-blue inline-flex h-10 items-center gap-2 rounded-[4px] px-3 text-[11px] font-black uppercase tracking-[0.16em] text-primary"
                                        data-active={entryMode === 'single'}
                                    >
                                        Single Event
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onSelectEntryMode('series')}
                                        disabled={!canCreateEvent}
                                        className={`schedule-interactive schedule-tone-green inline-flex h-10 items-center gap-2 rounded-[4px] px-3 text-[11px] font-black uppercase tracking-[0.16em] text-primary ${
                                            !canCreateEvent ? 'cursor-not-allowed opacity-50' : ''
                                        }`}
                                        data-active={entryMode === 'series'}
                                        title="Recurring mode creates a weekly training series."
                                    >
                                        Repeatable Training
                                    </button>
                                </div>
                            </RibbonGroup>
                        </>
                    ) : null}

                    {activeRibbonTab === 'reference' ? (
                        <RibbonGroup label="Reference">
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={onFocusSelected}
                                    disabled={!selectedEvent || !onFocusSelected}
                                    className={`schedule-interactive schedule-tone-purple inline-flex h-10 items-center gap-2 rounded-[4px] px-3 text-[11px] font-black uppercase tracking-[0.16em] text-primary ${
                                        !selectedEvent || !onFocusSelected ? 'cursor-not-allowed opacity-50' : ''
                                    }`}
                                >
                                    Focus Selection
                                </button>

                                <button
                                    type="button"
                                    onClick={onOpenConflictSource}
                                    disabled={!canOpenConflictSource || !onOpenConflictSource}
                                    className={`schedule-interactive schedule-tone-pink inline-flex h-10 items-center gap-2 rounded-[4px] px-3 text-[11px] font-black uppercase tracking-[0.16em] text-primary ${
                                        !canOpenConflictSource || !onOpenConflictSource ? 'cursor-not-allowed opacity-50' : ''
                                    }`}
                                >
                                    Open Overlap
                                </button>
                            </div>
                        </RibbonGroup>
                    ) : null}

                    {activeRibbonTab === 'layout' ? (
                        <RibbonGroup label="Layout">
                            <div className="flex flex-wrap gap-2">
                                {(Object.keys(viewCopy) as WorkspaceView[]).map((view) => {
                                    const meta = viewCopy[view];
                                    const Icon = meta.icon;
                                    const toneClass = view === 'month' ? 'schedule-tone-green' : view === 'week' ? 'schedule-tone-blue' : 'schedule-tone-purple';

                                    return (
                                        <button
                                            key={view}
                                            type="button"
                                            onClick={() => onSelectViewMode(view)}
                                            className={`schedule-interactive ${toneClass} inline-flex h-10 items-center gap-2 rounded-[4px] px-3 text-[11px] font-black uppercase tracking-[0.16em] text-primary`}
                                            data-active={viewMode === view}
                                        >
                                            <Icon className="h-3.5 w-3.5" />
                                            {meta.label}
                                        </button>
                                    );
                                })}

                                <button
                                    type="button"
                                    onClick={onResetLayout}
                                    className="schedule-interactive schedule-tone-blue inline-flex h-10 items-center gap-2 rounded-[4px] px-3 text-[11px] font-black uppercase tracking-[0.16em] text-primary"
                                >
                                    <RefreshCcw className="h-3.5 w-3.5" />
                                    Reset Rails
                                </button>
                            </div>
                        </RibbonGroup>
                    ) : null}
                </div>
            </div>
        </header>
    );
};
