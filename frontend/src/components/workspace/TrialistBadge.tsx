import { useRef, useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';

export interface TrialistBadgeProps {
    joinedAt?: string | null;
    /** Optional — if provided, clicking the badge opens an approve/release popover */
    onApprove?: () => void;
    /** Optional — if provided, clicking the badge opens an approve/release popover */
    onRelease?: () => void;
    /** Optional label for the approve action (default "Approve to Active") */
    approveLabel?: string;
    className?: string;
}

const OVERDUE_THRESHOLD_DAYS = 14;

export function getTrialistDays(joinedAt?: string | null): number | null {
    if (!joinedAt) return null;
    return Math.floor((Date.now() - new Date(joinedAt).getTime()) / 86_400_000);
}

export const TrialistBadge = ({
    joinedAt,
    onApprove,
    onRelease,
    approveLabel = 'Approve to Active',
    className = '',
}: TrialistBadgeProps) => {
    const days = getTrialistDays(joinedAt);
    if (days === null) return null;

    const hasActions = !!onApprove || !!onRelease;
    const isOverdue = days > OVERDUE_THRESHOLD_DAYS;

    const colorClasses = isOverdue
        ? 'bg-red-950 text-red-400 border-red-800'
        : 'bg-amber-950 text-amber-400 border-amber-800';

    // ── popover state (only used when actions are provided) ──
    const [open, setOpen] = useState(false);
    const badgeRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: PointerEvent) => {
            if (badgeRef.current && !badgeRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('pointerdown', handler);
        return () => document.removeEventListener('pointerdown', handler);
    }, [open]);

    if (!hasActions) {
        return (
            <span
                className={`inline-flex items-center rounded-t-full rounded-b-sm px-2 py-0.5 text-[10px] font-semibold border ${colorClasses} ${className}`}
            >
                {days}d
            </span>
        );
    }

    return (
        <span className={`relative ${className}`} ref={badgeRef}>
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className={`inline-flex items-center rounded-t-full rounded-b-sm px-2 py-0.5 text-[11px] font-semibold cursor-pointer hover:opacity-80 transition-opacity border ${colorClasses}`}
            >
                {days}d
            </button>
            {open && (
                <div className="absolute left-0 top-full mt-1 z-30 min-w-[170px] rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-1">
                    {onApprove && (
                        <button
                            type="button"
                            onClick={() => { onApprove(); setOpen(false); }}
                            className="flex w-full items-center gap-2 rounded px-3 py-2 text-xs font-medium text-[var(--fc-accent)] hover:bg-[var(--fc-accent-soft)] transition-colors"
                        >
                            <Check className="h-3.5 w-3.5" />
                            {approveLabel}
                        </button>
                    )}
                    {onRelease && (
                        <button
                            type="button"
                            onClick={() => { onRelease(); setOpen(false); }}
                            className="flex w-full items-center gap-2 rounded px-3 py-2 text-xs font-medium text-[var(--fc-state-danger)] hover:bg-[var(--fc-state-danger-soft)] transition-colors"
                        >
                            <X className="h-3.5 w-3.5" />
                            Release
                        </button>
                    )}
                </div>
            )}
        </span>
    );
};
