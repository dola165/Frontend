import { Loader2, TriangleAlert } from 'lucide-react';
import { CollapsiblePanel } from '../ui/CollapsiblePanel';
import { DetailPanelSection } from '../ui/DetailPanelSection';
import {
    eventTypeCopy,
    publicationCopy,
    visibilityCopy,
    type ScheduleWorkspaceEvent,
    type WorkspaceSurface
} from './workspaceTypes';

interface SelectedEventPanelProps {
    selectedEvent: ScheduleWorkspaceEvent | null;
    workspaceLabel: string;
    workspaceSurface: WorkspaceSurface;
    canManageClubSchedule: boolean;
    canOpenClubSchedule: boolean;
    canEditSelectedEvent: boolean;
    canDeleteSelectedEvent: boolean;
    canAdjustVisibility: boolean;
    deletingEventId: number | null;
    onEdit: () => void;
    onDelete: () => void;
    onReleaseNow: () => void;
    onQueueRelease: () => void;
    onKeepPrivate: () => void;
    onOpenConflictSource: () => void;
}

const formatTime = (value: string) =>
    new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const formatDate = (value: string) =>
    new Date(value).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

const formatDateTime = (value: string) =>
    new Date(value).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const formatEnumLabel = (value: string) =>
    value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

export const SelectedEventPanel = ({
    selectedEvent,
    workspaceLabel,
    workspaceSurface,
    canManageClubSchedule,
    canOpenClubSchedule,
    canEditSelectedEvent,
    canDeleteSelectedEvent,
    canAdjustVisibility,
    deletingEventId,
    onEdit,
    onDelete,
    onReleaseNow,
    onQueueRelease,
    onKeepPrivate,
    onOpenConflictSource
}: SelectedEventPanelProps) => (
    <div className="flex flex-col gap-4">
        <DetailPanelSection
            eyebrow="Selection"
            title={selectedEvent ? 'Selected Event' : 'No Selection'}
            description={
                selectedEvent ? (
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <EventBadge event={selectedEvent} />
                            <span className="app-chip rounded-[4px] px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-secondary">
                                {workspaceLabel}
                            </span>
                            {selectedEvent.recurring ? (
                                <span className="app-chip rounded-[4px] px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-secondary">
                                    Recurring
                                </span>
                            ) : null}
                        </div>
                        <div>
                            <h2 className="text-base font-black uppercase tracking-tight text-primary">{selectedEvent.title}</h2>
                            {selectedEvent.subtitle || selectedEvent.description ? (
                                <p className="mt-1.5 text-[13px] leading-5 text-secondary">{selectedEvent.subtitle ?? selectedEvent.description}</p>
                            ) : null}
                        </div>
                    </div>
                ) : 'Select an event or slot to inspect the active operational context.'
            }
        >
            {selectedEvent ? (
                <div className="grid gap-2">
                    <InfoTile label="When" value={formatDate(selectedEvent.startsAt)} meta={`${formatTime(selectedEvent.startsAt)} - ${formatTime(selectedEvent.endsAt)}`} />
                    {selectedEvent.recurring && selectedEvent.recurrenceLabel ? (
                        <InfoTile label="Pattern" value="Recurring" meta={selectedEvent.recurrenceLabel} />
                    ) : null}
                    <InfoTile label="Visibility" value={visibilityCopy[selectedEvent.visibility]} meta={publicationCopy[selectedEvent.publicationState]} />
                    <InfoTile label="Location" value={selectedEvent.locationText || 'No location'} meta={selectedEvent.ownerLabel} />
                    <InfoTile label="Status" value={selectedEvent.status} meta={selectedEvent.recurring ? 'Recurring series event' : 'Single event'} />
                </div>
            ) : null}
        </DetailPanelSection>

        <DetailPanelSection eyebrow="Actions" title="Primary Controls">
            {!selectedEvent ? (
                <p className="text-sm leading-6 text-secondary">Select an event to unlock the most relevant actions here.</p>
            ) : workspaceSurface === 'CLUB_SCHEDULE' && !canManageClubSchedule ? (
                <p className="text-sm leading-6 text-secondary">You can inspect this club event here, but only club managers can change it.</p>
            ) : (
                <div className="flex flex-col gap-2">
                    <ActionButton
                        label="Edit event"
                        body={selectedEvent.recurring ? 'Open the recurring series in the schedule drawer.' : 'Open the selected event in the schedule drawer.'}
                        onClick={onEdit}
                        disabled={!canEditSelectedEvent}
                    />
                    <ActionButton
                        label="Delete event"
                        body={selectedEvent.recurring ? 'Deletes the full recurring series.' : 'Removes this event from the active schedule.'}
                        onClick={onDelete}
                        disabled={!canDeleteSelectedEvent}
                        loading={deletingEventId === selectedEvent.eventId}
                        tone="danger"
                    />
                    {workspaceSurface === 'CLUB_SCHEDULE' ? (
                        <div className="grid gap-2">
                            <ActionButton
                                label="Release now"
                                body="Make the selected club event public immediately."
                                onClick={onReleaseNow}
                                disabled={!canAdjustVisibility || selectedEvent.visibility === 'PUBLIC'}
                            />
                            <ActionButton
                                label="Queue release"
                                body="Keep it private for now and publish it closer to the event."
                                onClick={onQueueRelease}
                                disabled={!canAdjustVisibility || !selectedEvent.mapEligible}
                            />
                            <ActionButton
                                label="Keep private"
                                body="Return the event to members-only visibility."
                                onClick={onKeepPrivate}
                                disabled={!canAdjustVisibility || selectedEvent.visibility === 'CLUB_ONLY'}
                            />
                        </div>
                    ) : null}
                </div>
            )}
        </DetailPanelSection>

        <CollapsiblePanel
            eyebrow="Advanced"
            title="Publication Logic"
            helpText={selectedEvent ? 'Audience, publication timing, and map eligibility.' : 'Shown once an event is selected.'}
        >
            {selectedEvent ? (
                <div className="space-y-3 text-sm leading-6 text-secondary">
                    <StatusLine label="Audience" value={visibilityCopy[selectedEvent.visibility]} />
                    <StatusLine label="Publication" value={publicationCopy[selectedEvent.publicationState]} />
                    {selectedEvent.publishAt ? <StatusLine label="Publish on" value={formatDateTime(selectedEvent.publishAt)} /> : null}
                    <StatusLine label="Map eligible" value={selectedEvent.mapEligible ? 'Yes' : 'No'} />
                    <StatusLine label="On map now" value={selectedEvent.appearsOnMap ? 'Visible' : 'Hidden'} />
                </div>
            ) : (
                <p className="text-sm leading-6 text-secondary">Club events can stay private, go public immediately, or queue for later release.</p>
            )}
        </CollapsiblePanel>

        <CollapsiblePanel
            eyebrow="Advanced"
            title="Conflicts / Challenge Context"
            helpText={selectedEvent ? 'Overlap warnings and challenge metadata stay available without dominating the rail.' : 'Shown once an event is selected.'}
        >
            {!selectedEvent ? (
                <p className="text-sm leading-6 text-secondary">Selected events surface overlap warnings for personal schedules and challenge state for club fixtures.</p>
            ) : selectedEvent.conflict ? (
                <div className="space-y-3">
                    <div className="rounded-[4px] border border-[color:var(--state-danger)] bg-[color:var(--state-danger-soft)] px-3 py-3 text-sm text-[color:var(--state-danger)]">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em]">Conflict detected</p>
                        <p className="mt-2 leading-6">{selectedEvent.conflict.explanation}</p>
                    </div>
                    <StatusLine label="Source" value={selectedEvent.conflict.sourceTitle} />
                    <StatusLine label="Severity" value={selectedEvent.conflict.severity === 'critical' ? 'Critical overlap' : 'Warning overlap'} />
                    <StatusLine label="Overlap" value={`${selectedEvent.conflict.overlapMinutes} minutes`} />
                    {canOpenClubSchedule ? (
                        <ActionButton
                            label="Open club overlap"
                            body="Jump directly to the overlapping club item in the same workspace."
                            onClick={onOpenConflictSource}
                        />
                    ) : null}
                </div>
            ) : selectedEvent.challenge ? (
                <div className="space-y-3">
                    <StatusLine label="Pathway" value={formatEnumLabel(selectedEvent.challenge.pathway)} />
                    <StatusLine label="State" value={formatEnumLabel(selectedEvent.challenge.state)} />
                    {selectedEvent.challenge.opponentName ? <StatusLine label="Opponent" value={selectedEvent.challenge.opponentName} /> : null}
                </div>
            ) : (
                <p className="text-sm leading-6 text-secondary">
                    {workspaceSurface === 'CLUB_SCHEDULE'
                        ? 'Non-match club events still carry publication state even when challenge metadata does not apply.'
                        : 'No club conflict is currently attached to this private item.'}
                </p>
            )}
        </CollapsiblePanel>
    </div>
);

const EventBadge = ({ event }: { event: ScheduleWorkspaceEvent }) => {
    const meta = eventTypeCopy[event.eventType];
    const Icon = meta.icon;
    const conflict = Boolean(event.conflict);

    return (
        <span
            className="inline-flex items-center gap-2 rounded-[4px] border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
            style={{
                borderColor: conflict ? 'var(--state-danger)' : meta.accent,
                backgroundColor: conflict ? 'var(--state-danger-soft)' : meta.soft,
                color: 'var(--text-primary)'
            }}
        >
            <Icon className="h-3.5 w-3.5" />
            {conflict ? 'Conflict' : meta.label}
        </span>
    );
};

const InfoTile = ({ label, value, meta }: { label: string; value: string; meta: string }) => (
    <div className="schedule-detail-tile rounded-[4px] px-3 py-2.5">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">{label}</p>
        <p className="mt-1.5 text-[13px] font-black uppercase tracking-[0.12em] text-primary">{value}</p>
        <p className="mt-1 text-[12px] leading-5 text-secondary">{meta}</p>
    </div>
);

const StatusLine = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-start justify-between gap-4 border-b border-subtle pb-3 last:border-b-0 last:pb-0">
        <span className="text-[11px] font-black uppercase tracking-[0.16em] text-secondary">{label}</span>
        <span className="max-w-[58%] text-right text-sm font-medium text-primary">{value}</span>
    </div>
);

const ActionButton = ({
    label,
    body,
    onClick,
    disabled = false,
    loading = false,
    tone = 'default'
}: {
    label: string;
    body: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
    tone?: 'default' | 'danger';
}) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`schedule-action-button ${tone === 'danger' ? 'schedule-tone-pink' : 'schedule-tone-blue'} rounded-[4px] px-3 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            tone === 'danger' ? 'schedule-action-button--danger text-[color:var(--state-danger)]' : 'text-primary hover:text-primary'
        }`}
    >
        <div className="flex items-center gap-2">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {tone === 'danger' && !loading ? <TriangleAlert className="h-3.5 w-3.5" /> : null}
            <p className={`text-[11px] font-black uppercase tracking-[0.16em] ${tone === 'danger' ? 'text-current' : 'text-primary'}`}>{label}</p>
        </div>
        <p className={`mt-1 text-sm leading-5 ${tone === 'danger' ? 'text-current/90' : 'text-secondary'}`}>{body}</p>
    </button>
);
