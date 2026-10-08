import { useId, useRef, useState, useEffect } from 'react';
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

function getTrialistDays(joinedAt?: string | null): number | null {
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
    const hasActions = !!onApprove || !!onRelease;
    const isOverdue = days !== null && days > OVERDUE_THRESHOLD_DAYS;

    const colorClasses = isOverdue
        ? 'bg-[color:var(--color-danger)] text-[color:var(--color-danger)] border-[color:var(--color-danger)]'
        : 'bg-[color:var(--color-warning)] text-[color:var(--color-warning)] border-[color:var(--color-warning)]';

    // ── popover state (only used when actions are provided) ──
    const [openFor, setOpenFor] = useState<string | null>(null);
    const open = days !== null && hasActions && openFor === joinedAt;
    const containerRef = useRef<HTMLSpanElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const menuId = useId();

    useEffect(() => {
        if (!open) return;
        const handler = (e: PointerEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpenFor(null);
            }
        };
        document.addEventListener('pointerdown', handler);
        const focusTimer = window.setTimeout(() => menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus(), 0);
        return () => {
            window.clearTimeout(focusTimer);
            document.removeEventListener('pointerdown', handler);
        };
    }, [open]);

    if (days === null) return null;

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
        <span className={`relative ${className}`} ref={containerRef}>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpenFor(open ? null : joinedAt ?? null)}
                aria-label={`${days} days as trialist. Open actions`}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                className={`inline-flex items-center rounded-t-full rounded-b-sm px-2 py-0.5 text-[11px] font-semibold cursor-pointer hover:opacity-80 transition-opacity border ${colorClasses}`}
            >
                {days}d
            </button>
            {open && (
                <div
                    ref={menuRef}
                    id={menuId}
                    role="menu"
                    aria-label="Trialist actions"
                    onKeyDown={(event) => {
                        const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
                        const index = items.indexOf(document.activeElement as HTMLButtonElement);
                        if (event.key === 'Escape') {
                            event.preventDefault();
                            setOpenFor(null);
                            triggerRef.current?.focus();
                        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                            event.preventDefault();
                            const direction = event.key === 'ArrowDown' ? 1 : -1;
                            items[(index + direction + items.length) % items.length]?.focus();
                        } else if (event.key === 'Home') {
                            event.preventDefault();
                            items[0]?.focus();
                        } else if (event.key === 'End') {
                            event.preventDefault();
                            items.at(-1)?.focus();
                        }
                    }}
                    className="absolute right-0 top-full z-30 mt-1 w-max min-w-[170px] max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-1 shadow-xl"
                >
                    {onApprove && (
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => { onApprove(); setOpenFor(null); }}
                            className="flex w-full items-center gap-2 rounded px-3 py-2 text-xs font-medium text-[var(--fc-accent)] hover:bg-[var(--fc-accent-soft)] transition-colors"
                        >
                            <Check className="h-3.5 w-3.5" />
                            {approveLabel}
                        </button>
                    )}
                    {onRelease && (
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => { onRelease(); setOpenFor(null); }}
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
