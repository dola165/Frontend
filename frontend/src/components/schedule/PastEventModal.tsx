import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Loader2, MessageSquareOff, X } from 'lucide-react';
import { completeClubEvent, completeClubEventWithResult } from '../../features/schedule/api';
import { extractApiErrorMessage } from '../../utils/apiError';
import type { ScheduleWorkspaceEvent } from './workspaceTypes';

interface PastEventModalProps {
    event: ScheduleWorkspaceEvent;
    /** Host club id — null for personal events (they have no complete endpoint). */
    clubId: number | null;
    clubName: string;
    onClose: () => void;
    onCompleted: () => void;
}

/**
 * Read-only view for past events (WEB_APP_MASTER_PLAN.md §5). The past is
 * never editable — but club events can be COMPLETED here, with a result for
 * matches. Completing a match also tears down its temporary challenge chat
 * (MatchChatOrchestrator) — the hint below makes that visible.
 */
export const PastEventModal = ({ event, clubId, clubName, onClose, onCompleted }: PastEventModalProps) => {
    const { t } = useTranslation();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [homeScore, setHomeScore] = useState('');
    const [awayScore, setAwayScore] = useState('');
    const [winner, setWinner] = useState<'home' | 'opponent' | 'draw'>('home');

    const isMatch = event.eventType === 'MATCH' || event.eventType === 'FRIENDLY';
    const done = event.status === 'COMPLETED' || event.status === 'CANCELLED';
    const opponentName = event.challenge?.opponentName ?? t('schedule.past.awayClub');
    const typeLabel = t(`schedule.event.${event.eventType.toLowerCase()}`);

    const start = new Date(event.startsAt);
    const end = new Date(event.endsAt);
    const when = `${start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;

    const complete = async (withResult: boolean) => {
        if (!clubId) return;
        setBusy(true);
        setError(null);
        try {
            if (withResult) {
                await completeClubEventWithResult(clubId, event.eventId, {
                    homeScore: Number(homeScore),
                    awayScore: Number(awayScore),
                    winnerClubId: winner === 'home' ? clubId : winner === 'opponent' ? (event.opponentClubId ?? null) : null,
                });
            } else {
                await completeClubEvent(clubId, event.eventId);
            }
            onCompleted();
        } catch (err) {
            setError(extractApiErrorMessage(err, t('schedule.past.completeFailed')));
        } finally {
            setBusy(false);
        }
    };

    const inputClass = 'rounded-xl border border-[#26282d] bg-[#0f1117] px-3 py-2 text-sm text-[#f4f4f5] placeholder:text-[#71717a] focus:border-[#16a34a] outline-none';

    return (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
            <div
                className="w-full max-w-md rounded-xl border border-[#26282d] bg-[#0f1117] p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#16a34a]">{typeLabel}</span>
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                event.status === 'COMPLETED'
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : event.status === 'CANCELLED'
                                        ? 'bg-red-500/10 text-red-400'
                                        : 'bg-[rgba(255,255,255,0.06)] text-[#a1a1aa]'
                            }`}>
                                {event.status === 'COMPLETED'
                                    ? t('schedule.past.completed')
                                    : event.status === 'CANCELLED'
                                        ? t('schedule.past.cancelled')
                                        : t('schedule.past.inThePast')}
                            </span>
                        </div>
                        <h2 className="mt-2 text-lg font-semibold text-[#f4f4f5]">{event.title}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full p-1.5 text-[#a1a1aa] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#f4f4f5] transition-colors shrink-0"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="mt-3 space-y-1.5 text-sm text-[#a1a1aa]">
                    <p>{when}</p>
                    {event.locationText && <p>{event.locationText}</p>}
                    <p className="text-xs text-[#71717a]">{event.ownerLabel}</p>
                </div>

                {done ? (
                    <p className="mt-4 flex items-center gap-2 text-sm font-medium text-[#f4f4f5]">
                        <CheckCircle2 className="h-4 w-4 text-[#16a34a]" />
                        {t('schedule.past.thisEventIs', { status: event.status === 'COMPLETED' ? t('schedule.past.completed').toLowerCase() : t('schedule.past.cancelled').toLowerCase() })}
                    </p>
                ) : clubId ? (
                    <div className="mt-4 border-t border-[#ffffff0d] pt-4">
                        {event.challenge?.state === 'ACCEPTED' && (
                            <p className="mb-3 flex items-center gap-2 text-xs font-medium text-[#a1a1aa]">
                                <MessageSquareOff className="h-3.5 w-3.5 text-[#16a34a]" />
                                {t('schedule.past.chatWillClose')}
                            </p>
                        )}
                        {isMatch && (
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <input
                                    type="number" min={0} value={homeScore}
                                    onChange={(e) => setHomeScore(e.target.value)}
                                    placeholder={t('schedule.past.homeScore', { club: clubName })} className={inputClass}
                                />
                                <input
                                    type="number" min={0} value={awayScore}
                                    onChange={(e) => setAwayScore(e.target.value)}
                                    placeholder={t('schedule.past.awayScore', { club: opponentName })} className={inputClass}
                                />
                                <select value={winner} onChange={(e) => setWinner(e.target.value as 'home' | 'opponent' | 'draw')} className={`${inputClass} col-span-2`}>
                                    <option value="home">{t('schedule.past.winner', { club: clubName })}</option>
                                    <option value="opponent">{t('schedule.past.winner', { club: opponentName })}</option>
                                    <option value="draw">{t('schedule.past.draw')}</option>
                                </select>
                            </div>
                        )}
                        {error && <p className="mb-3 text-xs font-semibold text-[#ef4444]">{error}</p>}
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => void complete(isMatch && Boolean(homeScore || awayScore))}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#22c55e] disabled:opacity-50"
                        >
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            {isMatch ? t('schedule.past.completeMatch') : t('schedule.past.markCompleted')}
                        </button>
                    </div>
                ) : (
                    <p className="mt-4 text-sm text-[#a1a1aa]">
                        {t('schedule.past.personalReadOnly')}
                    </p>
                )}
            </div>
        </div>
    );
};
