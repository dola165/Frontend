import { useState } from 'react';
import { Check, Clock, Loader2, X } from 'lucide-react';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { updateEntryStatus } from '../api';
import type { TournamentDetail, TournamentEntryDto, TournamentEntryStatus } from '../domain';
import { entryStatusTone } from '../domain';

interface Props {
    tournamentId: number;
    tournament: TournamentDetail;
    onRefresh: () => void;
}

const statusToneBorder: Record<string, string> = {
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    info: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    danger: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    neutral: 'bg-[#16181d] text-[#a1a1aa] border-[#ffffff0d]',
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

const transitionLabel: Record<string, string> = {
    APPROVED: 'Approve',
    REJECTED: 'Reject',
    WAITLISTED: 'Waitlist',
    ACTIVE: 'Activate',
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

    if (entries.length === 0) {
        return (
            <div>
                <div className="border-b border-[#ffffff0d] bg-[#16181d] px-5 py-3">
                    <p className="text-sm font-semibold text-[#f4f4f5]">Pending Applications</p>
                </div>
                <div className="px-5 py-12 text-center text-sm text-[#a1a1aa]">
                    No entries yet. Entries will appear here when players or clubs register.
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="border-b border-[#ffffff0d] bg-[#16181d] px-5 py-3">
                <p className="text-sm font-semibold text-[#f4f4f5]">
                    Pending Applications
                    {pendingCount > 0 && (
                        <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-xl bg-amber-500/20 px-1.5 text-xs font-bold text-amber-400">
                            {pendingCount}
                        </span>
                    )}
                </p>
            </div>

            {message && (
                <div className={`border-b border-[#ffffff0d] px-4 py-3 text-sm font-semibold ${
                    messageType === 'success'
                        ? 'bg-[#16a34a]/10 text-[#16a34a]'
                        : 'bg-[#ef4444]/10 text-[#ef4444]'
                }`}>
                    {message}
                </div>
            )}

            <div className="max-h-[400px] overflow-y-auto">
                {entries.map((entry) => {
                    const tone = entryStatusTone(entry.status);
                    const available = validTransitions[entry.status] ?? [];
                    return (
                        <div
                            key={entry.id}
                            className="flex items-center justify-between gap-3 border-b border-[#ffffff0d] px-5 py-3 transition-colors hover:bg-[#1a1c22]"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-[#f4f4f5]">
                                    {entryLabel(entry)}
                                </p>
                                {entrySubLabel(entry) && (
                                    <p className="truncate text-xs text-[#a1a1aa]">{entrySubLabel(entry)}</p>
                                )}
                            </div>
                            <span className={`shrink-0 rounded-xl border px-2.5 py-0.5 text-xs font-semibold ${statusToneBorder[tone] ?? statusToneBorder.neutral}`}>
                                {entry.status}
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
                                                className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                                    isDestructive
                                                        ? 'border-rose-500/30 text-rose-400 hover:bg-rose-500/10'
                                                        : 'border-[#ffffff0d] text-[#a1a1aa] hover:bg-[#1a1c22]'
                                                } disabled:opacity-50`}
                                                title={transitionLabel[targetStatus]}
                                            >
                                                {actionLoading === entry.id ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <Icon className="h-3.5 w-3.5" />
                                                )}
                                                {transitionLabel[targetStatus]}
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
