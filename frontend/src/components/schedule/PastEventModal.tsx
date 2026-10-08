import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Loader2, MessageSquareOff, X } from 'lucide-react';
import { completeClubEvent } from '../../features/schedule/api';
import { extractApiErrorMessage } from '../../utils/apiError';
import type { ScheduleWorkspaceEvent } from './workspaceTypes';
import { useDialogFocus } from '../workspace/useDialogFocus';
import { usePanelMotion } from '../ui/usePanelMotion';
import { ScheduleResult } from '../../features/matchHistory/ScheduleResult';

interface PastEventModalProps {
    event: ScheduleWorkspaceEvent;
    /** Host club id — null for personal events (they have no complete endpoint). */
    clubId: number | null;
    clubName: string;
    canComplete?: boolean;
    canRecordResult?: boolean;
    onClose: () => void;
    onCompleted: () => void;
}

/**
 * Past event details, completion and authorized, reasoned result recovery.
 * Exchange fixtures retain their independent confirmation workflow.
 */
export const PastEventModal = ({ event, clubId, clubName, canComplete = false, onClose: finishClose, onCompleted }: PastEventModalProps) => {
    const motion = usePanelMotion(finishClose);
    const onClose = motion.close;
    const { t } = useTranslation();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const dialog = useRef<HTMLDivElement>(null);
    useDialogFocus(true, dialog, () => { if (!busy) onClose(); });

    const isMatch = event.eventType === 'MATCH' || event.eventType === 'FRIENDLY';
    const status = event.status.toUpperCase();
    const done = status === 'COMPLETED' || status === 'CANCELLED';
    const typeLabel = t(`schedule.event.${event.eventType.toLowerCase()}`);

    const start = new Date(event.startsAt);
    const end = new Date(event.endsAt);
    const when = `${start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;

    const complete = async () => {
        if (!clubId || !canComplete || busy) return;
        setBusy(true);
        setError(null);
        try {
            await completeClubEvent(clubId, event.eventId);
            onCompleted();
        } catch (err) {
            setError(extractApiErrorMessage(err, t('schedule.past.completeFailed')));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="app-motion-portal app-motion-backdrop fixed inset-0 z-[9999] flex items-center justify-center bg-[color:var(--color-overlay)]/60 p-4" data-closing={motion.closing} onClick={() => { if (!busy) onClose(); }}>
            <div
                ref={dialog} role="dialog" aria-modal="true" aria-labelledby="past-event-title"
                className="app-motion-dialog schedule-past-dialog w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6" data-closing={motion.closing} onAnimationEnd={motion.onAnimationEnd}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">{typeLabel}</span>
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                status === 'COMPLETED'
                                    ? 'bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]'
                                    : status === 'CANCELLED'
                                        ? 'bg-[color:var(--color-danger)]/10 text-[color:var(--color-danger)]'
                                        : 'bg-[color-mix(in_srgb,_var(--color-ink)_6%,_transparent)] text-[var(--color-secondary)]'
                            }`}>
                                {status === 'COMPLETED'
                                    ? t('schedule.past.completed')
                                    : status === 'CANCELLED'
                                        ? t('schedule.past.cancelled')
                                        : t('schedule.past.inThePast')}
                            </span>
                        </div>
                        <h2 id="past-event-title" className="mt-2 text-lg font-semibold text-[var(--color-text)]">{event.title}</h2>
                    </div>
                    <button
                        type="button" aria-label="Close past event" disabled={busy}
                        onClick={onClose}
                        className="rounded-full p-1.5 text-[var(--color-secondary)] hover:bg-[color-mix(in_srgb,_var(--color-ink)_6%,_transparent)] hover:text-[var(--color-text)] transition-colors shrink-0"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="mt-3 space-y-1.5 text-sm text-[var(--color-secondary)]">
                    <p>{when}</p>
                    {event.locationText && <p>{event.locationText}</p>}
                    <p className="text-xs text-[var(--color-secondary)]">{event.ownerLabel}</p>
                </div>

                {isMatch && <ScheduleResult event={{ ...event, canRecordResult: event.canRecordResult === true }} clubId={clubId} clubName={clubName} onSaved={onCompleted} />}
                {done ? (
                    <p className="mt-4 flex items-center gap-2 text-sm font-medium text-[var(--color-text)]">
                        <CheckCircle2 className="h-4 w-4 text-[var(--color-accent)]" />
                        {t('schedule.past.thisEventIs', { status: status === 'COMPLETED' ? t('schedule.past.completed').toLowerCase() : t('schedule.past.cancelled').toLowerCase() })}
                    </p>
                ) : clubId && canComplete && !event.matchExchangeId ? (
                    <div className="mt-4 border-t border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] pt-4">
                        {event.challenge?.state === 'ACCEPTED' && (
                            <p className="mb-3 flex items-center gap-2 text-xs font-medium text-[var(--color-secondary)]">
                                <MessageSquareOff className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                                {t('schedule.past.chatWillClose')}
                            </p>
                        )}
                        {error && <p className="mb-3 text-xs font-semibold text-[var(--color-danger)]">{error}</p>}
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => void complete()}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-on-accent)] hover:bg-[var(--color-accent)] disabled:opacity-50"
                        >
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            {isMatch ? t('schedule.past.completeMatch') : t('schedule.past.markCompleted')}
                        </button>
                    </div>
                ) : event.matchExchangeId ? null : (
                    <p className="mt-4 text-sm text-[var(--color-secondary)]">
                        {clubId ? 'Only club schedule managers can complete this event.' : t('schedule.past.personalReadOnly')}
                    </p>
                )}
            </div>
        </div>
    );
};
