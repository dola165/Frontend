import { useState } from 'react';
import { Check, Clock, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { updateEntryStatus } from '../api';
import type { TournamentDetail, TournamentEntryDto, TournamentEntryStatus } from '../domain';
import { entryStatusTone } from '../domain';
import { tournamentEntryStatusText } from '../../../components/tournaments/tournamentFormatters';

interface Props {
    tournamentId: number;
    tournament: TournamentDetail;
    onRefresh: () => void;
}

const statusToneBorder: Record<string, string> = {
    success: 'bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)] border-[color:var(--color-accent)]/30',
    warning: 'bg-[color:var(--color-warning)]/10 text-[color:var(--color-warning)] border-[color:var(--color-warning)]/30',
    info: 'bg-[color:var(--color-info)]/10 text-[color:var(--color-info)] border-[color:var(--color-info)]/30',
    danger: 'bg-[color:var(--color-danger)]/10 text-[color:var(--color-danger)] border-[color:var(--color-danger)]/30',
    neutral: 'bg-[var(--color-surface)] text-[var(--color-secondary)] border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)]',
};

const validTransitions: Record<TournamentEntryStatus, TournamentEntryStatus[]> = {
    PENDING: ['APPROVED', 'REJECTED', 'WAITLISTED', 'ACTIVE'],
    APPROVED: ['REJECTED', 'WAITLISTED', 'ACTIVE'],
    WAITLISTED: ['APPROVED', 'REJECTED', 'ACTIVE'],
    REJECTED: ['APPROVED', 'WAITLISTED', 'ACTIVE'],
    ACTIVE: [],
    WITHDRAWN: [],
    ELIMINATED: [],
    COMPLETED: [],
};

const transitionLabelKey: Record<string, string> = {
    APPROVED: 'tournaments.workspace.entryActions.approve',
    REJECTED: 'tournaments.workspace.entryActions.reject',
    WAITLISTED: 'tournaments.workspace.entryActions.waitlist',
    ACTIVE: 'tournaments.workspace.entryActions.activate',
};

const transitionIcon: Record<string, typeof Check> = {
    APPROVED: Check,
    REJECTED: X,
    WAITLISTED: Clock,
    ACTIVE: Check,
};

const entryLabel = (entry: TournamentEntryDto): string =>
    entry.displayName ?? entry.clubName ?? entry.squadName ?? `Entry #${entry.id}`;

const entrySubLabel = (entry: TournamentEntryDto): string | null => {
    if (entry.clubName && entry.displayName && entry.displayName !== entry.clubName) return entry.clubName;
    if (entry.squadName && entry.clubName) return `${entry.clubName} / ${entry.squadName}`;
    return null;
};

export const EntryReviewPanel = ({ tournamentId, tournament, onRefresh }: Props) => {
    const { t } = useTranslation();
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [messageType, setMessageType] = useState<'success' | 'error'>('success');

    const showMessage = (text: string, type: 'success' | 'error') => {
        setMessage(text);
        setMessageType(type);
        setTimeout(() => setMessage(null), 4000);
    };

    const handleStatusChange = async (entryId: number, newStatus: TournamentEntryStatus) => {
        setActionLoading(entryId);
        try {
            await updateEntryStatus(tournamentId, entryId, { status: newStatus });
            showMessage(`Entry ${newStatus.toLowerCase()}.`, 'success');
            onRefresh();
        } catch (err) {
            showMessage(extractApiErrorMessage(err, `Failed to ${newStatus.toLowerCase()} entry.`), 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const entries = tournament.entries ?? [];
    const pendingCount = entries.filter((e) => e.status === 'PENDING').length;
    const reviewEntries = entries.filter((entry) => (validTransitions[entry.status] ?? []).length > 0);

    if (reviewEntries.length === 0) {
        return (
            <div>
                <div className="border-b border-[color:var(--color-border)]/[0.08] px-5 py-4 sm:px-6">
                    <p className="text-sm font-bold text-[color:var(--color-text)]">{t('tournaments.workspace.entryReview')}</p>
                </div>
                <div className="px-5 py-12 text-center text-sm text-[color:var(--color-muted)]">
                    {entries.length === 0 ? t('tournaments.workspace.noEntries') : t('tournaments.workspace.noEntryDecisions')}
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="border-b border-[color:var(--color-border)]/[0.08] px-5 py-4 sm:px-6">
                <p className="text-sm font-bold text-[color:var(--color-text)]">
                    {t('tournaments.workspace.entryReview')}
                    {pendingCount > 0 && (
                        <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[color:var(--color-warning)]/15 px-1.5 text-xs font-bold text-[color:var(--color-warning)]">
                            {pendingCount}
                        </span>
                    )}
                </p>
                <p className="mt-1 text-xs text-[color:var(--color-muted)]">{t('tournaments.workspace.entryReviewHint')}</p>
            </div>

            {message && (
                <div className={`border-b border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] px-4 py-3 text-sm font-semibold ${
                    messageType === 'success'
                        ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                        : 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]'
                }`}>
                    {message}
                </div>
            )}

            <div className="max-h-[430px] divide-y divide-[color:var(--color-border)]/[0.06] overflow-y-auto">
                {reviewEntries.map((entry) => {
                    const tone = entryStatusTone(entry.status);
                    const available = validTransitions[entry.status] ?? [];
                    return (
                        <div
                            key={entry.id}
                            className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-[color:var(--color-ink)]/[0.025] sm:flex-nowrap sm:px-6"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold text-[color:var(--color-text)]">
                                    {entryLabel(entry)}
                                </p>
                                {entrySubLabel(entry) && (
                                    <p className="mt-0.5 truncate text-xs text-[color:var(--color-muted)]">{entrySubLabel(entry)}</p>
                                )}
                            </div>
                            <span className={`shrink-0 rounded-xl border px-2.5 py-0.5 text-xs font-semibold ${statusToneBorder[tone] ?? statusToneBorder.neutral}`}>
                                {tournamentEntryStatusText(entry.status, t)}
                            </span>
                            {available.length > 0 && (
                                <div className="flex shrink-0 gap-1">
                                    {available.map((targetStatus) => {
                                        const Icon = transitionIcon[targetStatus] ?? Check;
                                        const isDestructive = targetStatus === 'REJECTED';
                                        return (
                                            <button
                                                key={targetStatus}
                                                type="button"
                                                onClick={() => handleStatusChange(entry.id, targetStatus)}
                                                disabled={actionLoading === entry.id}
                                                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                                                    isDestructive
                                                        ? 'border-[color:var(--color-danger)]/30 text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger)]/10'
                                                        : 'border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] text-[var(--color-secondary)] hover:bg-[var(--color-surface)]'
                                                } disabled:opacity-50`}
                                                title={t(transitionLabelKey[targetStatus])}
                                            >
                                                {actionLoading === entry.id ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <Icon className="h-3.5 w-3.5" />
                                                )}
                                                {t(transitionLabelKey[targetStatus])}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
