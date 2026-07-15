import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal, MoreVertical, AlertTriangle } from 'lucide-react';

export interface OverflowActionItem {
    id: string;
    label: string;
    description?: string;
    icon?: ReactNode;
    tone?: 'default' | 'positive' | 'danger' | 'warning';
    disabled?: boolean;
    divider?: boolean;
    confirm?: {
        title: string;
        body: string;
        confirmLabel?: string;
        cancelLabel?: string;
    };
    onSelect: () => void;
}

interface OverflowActionsProps {
    label?: string;
    items: OverflowActionItem[];
    className?: string;
    triggerIcon?: 'horizontal' | 'vertical';
}

export const OverflowActions = ({
    label = 'More actions',
    items,
    className = '',
    triggerIcon = 'horizontal'
}: OverflowActionsProps) => {
    const [open, setOpen] = useState(false);
    const [confirmingItemId, setConfirmingItemId] = useState<string | null>(null);
    const menuId = useId();
    const rootRef = useRef<HTMLDivElement>(null);

    const TriggerIcon = triggerIcon === 'vertical' ? MoreVertical : MoreHorizontal;

    useEffect(() => {
        if (!open) return;

        const handlePointerDown = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setOpen(false);
                setConfirmingItemId(null);
            }
        };

        window.addEventListener('pointerdown', handlePointerDown);
        return () => window.removeEventListener('pointerdown', handlePointerDown);
    }, [open]);

    const handleSelect = (item: OverflowActionItem) => {
        if (item.confirm) {
            setConfirmingItemId(item.id);
        } else {
            item.onSelect();
            setOpen(false);
        }
    };

    const handleConfirm = (item: OverflowActionItem) => {
        item.onSelect();
        setOpen(false);
        setConfirmingItemId(null);
    };

    const toneClass = (tone?: string) => {
        switch (tone) {
            case 'danger': return 'text-[var(--fc-state-danger)] hover:bg-[var(--fc-state-danger-soft)]';
            case 'positive': return 'text-[var(--fc-accent)] hover:bg-[var(--fc-accent-soft)]';
            case 'warning': return 'text-[var(--fc-state-warning)] hover:bg-[var(--fc-state-warning-soft)]';
            default: return 'text-[var(--fc-text-primary)] hover:bg-[var(--fc-surface-hover)]';
        }
    };

    return (
        <div ref={rootRef} className={`relative ${className}`.trim()}>
            <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={menuId}
                onClick={() => setOpen((current) => !current)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-[var(--fc-text-secondary)] transition-colors hover:text-[var(--fc-text-primary)] hover:bg-[var(--fc-surface-hover)]"
            >
                <span className="sr-only">{label}</span>
                <TriggerIcon className="h-4 w-4" />
            </button>

            {open ? (
                <div
                    id={menuId}
                    role="menu"
                    className="absolute right-0 top-[calc(100%+4px)] z-20 min-w-[200px] rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-1"
                >
                    {items.map((item) => {
                        const isConfirming = confirmingItemId === item.id;
                        return (
                            <div key={item.id}>
                                {item.divider ? (
                                    <hr className="my-1 border-[var(--fc-border)]" />
                                ) : null}
                                {isConfirming ? (
                                    <div className="rounded-xl bg-[var(--fc-state-warning-soft)] px-3 py-3">
                                        <div className="flex items-start gap-2">
                                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fc-state-warning)]" />
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-[var(--fc-state-warning)]">
                                                    {item.confirm?.title}
                                                </p>
                                                <p className="mt-1 text-xs text-[var(--fc-text-secondary)]">
                                                    {item.confirm?.body}
                                                </p>
                                                <div className="mt-2.5 flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setConfirmingItemId(null)}
                                                        className="rounded-xl border border-[var(--fc-border)] px-2.5 py-1 text-xs font-medium text-[var(--fc-text-secondary)] hover:text-[var(--fc-text-primary)] transition-colors"
                                                    >
                                                        {item.confirm?.cancelLabel || 'Cancel'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleConfirm(item)}
                                                        disabled={item.disabled}
                                                        className="rounded-xl bg-[var(--fc-state-warning)] px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                                                    >
                                                        {item.confirm?.confirmLabel || 'Confirm'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        role="menuitem"
                                        disabled={item.disabled}
                                        onClick={() => handleSelect(item)}
                                        className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${toneClass(item.tone)}`}
                                    >
                                        {item.icon ? <span className="mt-0.5 shrink-0">{item.icon}</span> : null}
                                        <span className="min-w-0">
                                            <span className="block text-sm font-medium">{item.label}</span>
                                            {item.description ? <span className="mt-0.5 block text-xs text-[var(--fc-text-secondary)]">{item.description}</span> : null}
                                        </span>
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
};
